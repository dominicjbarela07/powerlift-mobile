import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { KG_PER_LB } from '../lib/logger-weight-format.js';
import { resolveLoggerPrescribedWeight } from '../lib/logger-prescribed-weight.ts';

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

const itemForLbBounds = (lowLb, highLb = lowLb) => ({
  target_low_kg: lowLb * KG_PER_LB,
  target_high_kg: highLb * KG_PER_LB,
});

for (const weightLb of [135, 225, 315, 405, 495]) {
  const prescribed = resolveLoggerPrescribedWeight({
    item: itemForLbBounds(weightLb),
    unit: 'lb',
  });
  assert.ok(prescribed, `${weightLb} lb must produce a prescribed render value`);
  assert.equal(prescribed.resolution, 'exact');
  assert.equal(prescribed.displayValue, String(weightLb));
  assert.equal(prescribed.displayLabel, `${weightLb} lb`);
  assert.equal(prescribed.requestedWeight, weightLb);

  const render = resolvePlateStackRender({
    weight: prescribed.requestedWeight,
    unit: prescribed.requestedUnit,
  });
  assert.ok(render, `${weightLb} lb must have a canonical render`);
  assert.equal(render.requestedWeight, prescribed.requestedWeight);
  assert.equal(render.requestedUnit, prescribed.requestedUnit);
  assert.equal(
    render.catalogKeyLb,
    weightLb,
    `displayed ${weightLb} lb must resolve to the ${weightLb} lb catalog entry`,
  );
}

for (const [lowLb, highLb] of [
  [225, 245],
  [405, 425],
  [455, 475],
]) {
  const prescribed = resolveLoggerPrescribedWeight({
    item: itemForLbBounds(lowLb, highLb),
    unit: 'lb',
  });
  assert.ok(prescribed, `${lowLb}–${highLb} lb must resolve deterministically`);
  assert.equal(prescribed.resolution, 'range_lower_bound');
  assert.equal(prescribed.displayLabel, `${lowLb} lb`);
  assert.equal(prescribed.requestedWeight, lowLb);

  const render = resolvePlateStackRender({
    weight: prescribed.requestedWeight,
    unit: prescribed.requestedUnit,
  });
  assert.ok(render);
  assert.equal(render.requestedWeight, prescribed.requestedWeight);
  assert.equal(render.requestedUnit, prescribed.requestedUnit);
  assert.equal(
    render.catalogKeyLb,
    lowLb,
    `${lowLb}–${highLb} lb must render its ${lowLb} lb lower bound`,
  );
}

for (const [lowKg, highKg] of [
  [80, 80],
  [80, 90],
  [120, 130],
  [180, 190],
  [220, 230],
]) {
  const prescribed = resolveLoggerPrescribedWeight({
    item: {
      target_low_kg: lowKg,
      target_high_kg: highKg,
    },
    unit: 'kg',
  });
  assert.ok(prescribed, `${lowKg}–${highKg} kg must resolve deterministically`);
  assert.equal(prescribed.displayLabel, `${lowKg} kg`);
  assert.equal(prescribed.requestedWeight, lowKg);

  const render = resolvePlateStackRender({
    weight: prescribed.requestedWeight,
    unit: prescribed.requestedUnit,
  });
  assert.ok(render, `${lowKg} kg must resolve through kg plate geometry`);
  assert.equal(render.requestedWeight, lowKg);
  assert.equal(render.requestedUnit, 'kg');
}

const fullCustomExact = resolveLoggerPrescribedWeight({
  item: itemForLbBounds(455),
  planned: {
    manual_target_kg: 405 * KG_PER_LB,
    manual_pm_kg: null,
  },
  unit: 'lb',
});
assert.ok(fullCustomExact);
assert.equal(fullCustomExact.source, 'planned_manual');
assert.equal(fullCustomExact.displayLabel, '405 lb');

const fullCustomRange = resolveLoggerPrescribedWeight({
  item: itemForLbBounds(495),
  planned: {
    manual_target_kg: 465 * KG_PER_LB,
    manual_pm_kg: 10 * KG_PER_LB,
  },
  unit: 'lb',
});
assert.ok(fullCustomRange);
assert.equal(fullCustomRange.source, 'planned_manual');
assert.equal(fullCustomRange.resolution, 'range_lower_bound');
assert.equal(fullCustomRange.displayLabel, '455 lb');

const plannedSuggestedRange = resolveLoggerPrescribedWeight({
  item: itemForLbBounds(495),
  planned: {
    suggested_low_kg: 225 * KG_PER_LB,
    suggested_high_kg: 245 * KG_PER_LB,
  },
  unit: 'lb',
});
assert.ok(plannedSuggestedRange);
assert.equal(plannedSuggestedRange.source, 'planned_suggested');
assert.equal(plannedSuggestedRange.displayLabel, '225 lb');

assert.equal(
  resolveLoggerPrescribedWeight({
    item: {},
    unit: 'lb',
  }),
  null,
  'a movement without a deterministic prescribed weight must not request a render',
);
assert.equal(
  resolveLoggerPrescribedWeight({
    item: {
      target_high_kg: 245 * KG_PER_LB,
    },
    unit: 'lb',
  }),
  null,
  'an upper bound without an exact value or lower bound must not request a render',
);

const routeSource = read('app/(tabs)/workout/[workoutId].tsx');
const visualContextSource = read('lib/logger-visual-context.ts');
assert.match(
  routeSource,
  /heroLoadLabel:\s*prescribedWeight\?\.displayLabel/,
  'the displayed hero load must consume the canonical prescribed resolution',
);
assert.match(
  routeSource,
  /movementVisualContextFor\(\s*core,\s*movementPresentation\.renderWeight/,
  'the hero render must consume the same canonical prescribed resolution object',
);
assert.match(
  visualContextSource,
  /prescribedWeight\.requestedWeight[\s\S]*prescribedWeight\.requestedUnit/,
  'plate lookup must use the same unit-native value used by the hero label',
);
assert.doesNotMatch(
  visualContextSource,
  /progress_context\?\.targetWeightKg/,
  'PR evidence must never override the prescribed hero render',
);

console.log(
  '[logger-prescribed-render-weight] exact loads, range lower bounds, Full Custom precedence, and kg geometry resolution passed',
);
