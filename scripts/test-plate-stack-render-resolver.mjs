import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { loadingForTotalWeightKg } from '../lib/barbell/kg-loading.ts';
import {
  plateStackCatalogKeyForWeight,
  resolvePlateStackRenderGeometry,
} from '../lib/barbell/plate-stack-render-geometry.ts';
import {
  KG_RENDER_DENOMINATION_MAPPING,
} from '../lib/barbell/render-denomination-mapping.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions['.png'] = (module, filename) => {
  module.exports = filename;
};
const { resolvePlateStackRender } = await import(
  '../lib/barbell/plate-stack-render-resolver.ts'
);

const catalogSource = read('lib/barbell/plate-stack-render-catalog.ts');
const resolverSource = read('lib/barbell/plate-stack-render-resolver.ts');
const milestonesSource = read('lib/milestones-layout.ts');
const loggerSource = read('lib/logger-visual-context.ts');
const loggerRouteSource = read('app/(tabs)/workout/[workoutId].tsx');
const achievementsSource = read('components/ledger/AchievementsExperience.tsx');

assert.deepEqual(
  KG_RENDER_DENOMINATION_MAPPING,
  [
    { kg: 20, renderEquivalentLb: 45 },
    { kg: 15, renderEquivalentLb: 35 },
    { kg: 10, renderEquivalentLb: 25 },
    { kg: 5, renderEquivalentLb: 10 },
    { kg: 2.5, renderEquivalentLb: 5 },
    { kg: 1.25, renderEquivalentLb: 2.5 },
  ],
  'the immutable geometry mapping must match the canonical denomination table',
);
assert.ok(Object.isFrozen(KG_RENDER_DENOMINATION_MAPPING));
for (const entry of KG_RENDER_DENOMINATION_MAPPING) assert.ok(Object.isFrozen(entry));

assert.deepEqual(loadingForTotalWeightKg(20), []);
assert.deepEqual(loadingForTotalWeightKg(80), [20, 10]);
assert.deepEqual(loadingForTotalWeightKg(220), [20, 20, 20, 20, 20]);
assert.deepEqual(loadingForTotalWeightKg(240), [20, 20, 20, 20, 20, 10]);

for (const [kg, expectedCatalogKeyLb] of [
  [20, 45],
  [60, 135],
  [80, 185],
  [120, 275],
  [180, 405],
  [220, 495],
  [240, 545],
  [420, 945],
]) {
  const kgGeometry = resolvePlateStackRenderGeometry(kg, 'kg');
  const lbGeometry = resolvePlateStackRenderGeometry(expectedCatalogKeyLb, 'lb');
  assert.equal(
    kgGeometry.catalogKeyLb,
    expectedCatalogKeyLb,
    `${kg} kg must resolve by plate geometry to catalog key ${expectedCatalogKeyLb}`,
  );
  assert.deepEqual(
    kgGeometry.renderEquivalentPlatesPerSideLb,
    lbGeometry.renderEquivalentPlatesPerSideLb,
    `${kg} kg and ${expectedCatalogKeyLb} lb must share identical render geometry`,
  );
  const kgRender = resolvePlateStackRender({ weight: kg, unit: 'kg' });
  const lbRender = resolvePlateStackRender({
    weight: expectedCatalogKeyLb,
    unit: 'lb',
  });
  assert.ok(kgRender, `${kg} kg must resolve through the public runtime entry point`);
  assert.ok(
    lbRender,
    `${expectedCatalogKeyLb} lb must resolve through the public runtime entry point`,
  );
  assert.equal(kgRender.assetPath, lbRender.assetPath);
  assert.strictEqual(
    kgRender.imageSource,
    lbRender.imageSource,
    'equivalent kg/lb requests must return the same bundled image module',
  );
}

for (const weightLb of [265, 395, 485]) {
  const render = resolvePlateStackRender({ weight: weightLb, unit: 'lb' });
  assert.ok(render, `${weightLb} lb must resolve for the Achievements hero`);
  assert.equal(render.catalogKeyLb, weightLb);
}

const expectedLbKeys = Array.from(
  { length: ((945 - 45) / 5) + 1 },
  (_, index) => 45 + (index * 5),
);
for (const weightLb of expectedLbKeys) {
  assert.equal(
    plateStackCatalogKeyForWeight(weightLb, 'lb'),
    weightLb,
    `pound lookup must remain unchanged at ${weightLb} lb`,
  );
  assert.ok(
    resolvePlateStackRender({ weight: weightLb, unit: 'lb' }),
    `${weightLb} lb must resolve through the runtime catalog`,
  );
}
for (let weightKg = 20; weightKg <= 420; weightKg += 2.5) {
  const catalogKeyLb = plateStackCatalogKeyForWeight(weightKg, 'kg');
  assert.ok(
    resolvePlateStackRender({ weight: weightKg, unit: 'kg' }),
    `${weightKg} kg must resolve to an existing catalog asset (${catalogKeyLb} lb key)`,
  );
}

const staticRequirePaths = Array.from(
  catalogSource.matchAll(/imageSource: require\('([^']+\.png)'\)/g),
  (match) => match[1],
);
assert.equal(staticRequirePaths.length, 181, 'Metro catalog must contain all 181 static image requires');
assert.equal(
  new Set(staticRequirePaths).size,
  staticRequirePaths.length,
  'the catalog must not duplicate image modules',
);
assert.match(
  catalogSource,
  /405:[\s\S]*logger-renders\/blender-cycles-poc-v1\/mobile-hero-240x160@3x\/squat\/405\.png/,
  'the canonical 405 asset must remain the existing approved render',
);
for (const requirePath of staticRequirePaths) {
  assert.ok(
    fs.existsSync(path.resolve(root, 'lib/barbell', requirePath)),
    `missing statically registered image ${requirePath}`,
  );
}

assert.match(resolverSource, /resolvePlateStackRenderGeometry/);
assert.match(resolverSource, /lookupPlateStackRenderCatalogAsset/);
assert.match(resolverSource, /return asset[\s\S]*Object\.freeze/);
assert.doesNotMatch(
  resolverSource,
  /KG_PER_LB|0\.45359237|Math\.round\([^)]*\*\s*2\.204/,
  'the runtime resolver must not convert kg totals into pounds',
);
assert.doesNotMatch(
  milestonesSource,
  /KG_TO_PLATE_MODEL_LB/,
  'milestones must consume the one shared denomination mapping',
);
assert.match(milestonesSource, /plateStackCatalogKeyForWeight\(totalWeightKg, 'kg'\)/);
assert.match(
  loggerSource,
  /resolvePlateStackRender\(\{[\s\S]*weight: prescribedWeight\.requestedWeight,[\s\S]*unit: prescribedWeight\.requestedUnit/,
);
assert.match(
  loggerRouteSource,
  /resolveLoggerPlateStack\(\s*item,\s*unit,\s*resolvedPlateWeight/,
);
assert.match(achievementsSource, /resolvePlateStackRender\(\{ weight: current, unit \}\)/);
assert.doesNotMatch(achievementsSource, /resolveHeroRender|canonicalHeroLoading/);
assert.doesNotMatch(loggerSource, /resolveLoggerPlateRenderAsset/);
assert.equal(
  fs.existsSync(
    path.join(
      root,
      'assets/images/plate-stack-catalog/blender-cycles-catalog-v1/kg',
    ),
  ),
  false,
  'no duplicate kilogram image catalog may be introduced',
);

console.log(
  '[plate-stack-render-resolver] lb parity, kg geometry mapping, 181 static lookups, and complete supported kg coverage passed',
);
