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
const resolveEndpointRenders = (prescribed) =>
  prescribed.endpoints.map((endpoint) => ({
    ...endpoint,
    plateStack: resolvePlateStackRender({
      weight: endpoint.requestedWeight,
      unit: endpoint.requestedUnit,
    }),
  }));

const itemForLbBounds = (lowLb, highLb = lowLb) => ({
  target_low_kg: lowLb * KG_PER_LB,
  target_high_kg: highLb * KG_PER_LB,
});

for (const weightLb of [135, 225, 315, 405, 495]) {
  const item = { ...itemForLbBounds(weightLb), lift: 'SQ' };
  const prescribed = resolveLoggerPrescribedWeight({ item, unit: 'lb' });
  assert.ok(prescribed, `${weightLb} lb must produce a prescribed render value`);
  assert.equal(prescribed.resolution, 'exact');
  assert.equal(prescribed.displayValue, String(weightLb));
  assert.equal(prescribed.displayLabel, `${weightLb} lb`);
  assert.equal(prescribed.requestedWeight, weightLb);
  assert.deepEqual(
    prescribed.endpoints.map((endpoint) => endpoint.requestedWeight),
    [weightLb],
  );

  const render = resolvePlateStackRender({
    weight: prescribed.requestedWeight,
    unit: prescribed.requestedUnit,
  });
  assert.ok(render, `${weightLb} lb must have a canonical render`);
  assert.equal(render.catalogKeyLb, weightLb);

  const endpoints = resolveEndpointRenders(prescribed);
  assert.equal(endpoints.length, 1);
  assert.equal(endpoints[0].plateStack?.catalogKeyLb, weightLb);
}

for (const [lowLb, highLb] of [
  [225, 245],
  [405, 425],
  [455, 475],
]) {
  const item = { ...itemForLbBounds(lowLb, highLb), lift: 'SQ' };
  const prescribed = resolveLoggerPrescribedWeight({ item, unit: 'lb' });
  assert.ok(prescribed, `${lowLb}–${highLb} lb must preserve both endpoints`);
  assert.equal(prescribed.resolution, 'range');
  assert.equal(prescribed.displayLabel, `${lowLb}–${highLb} lb`);
  assert.equal(prescribed.requestedWeight, lowLb);
  assert.deepEqual(
    prescribed.endpoints.map((endpoint) => endpoint.requestedWeight),
    [lowLb, highLb],
  );

  const endpoints = resolveEndpointRenders(prescribed);
  assert.deepEqual(
    endpoints.map((endpoint) => endpoint.plateStack?.catalogKeyLb),
    [lowLb, highLb],
    `${lowLb}–${highLb} lb must resolve two independent catalog renders`,
  );
}

for (const [lowKg, highKg] of [
  [80, 80],
  [80, 90],
  [120, 130],
  [180, 190],
  [220, 230],
]) {
  const item = {
    target_low_kg: lowKg,
    target_high_kg: highKg,
    lift: 'DL',
  };
  const prescribed = resolveLoggerPrescribedWeight({ item, unit: 'kg' });
  assert.ok(prescribed, `${lowKg}–${highKg} kg must resolve deterministically`);
  assert.equal(
    prescribed.displayLabel,
    lowKg === highKg ? `${lowKg} kg` : `${lowKg}–${highKg} kg`,
  );
  assert.equal(prescribed.requestedWeight, lowKg);
  assert.deepEqual(
    prescribed.endpoints.map((endpoint) => endpoint.requestedWeight),
    lowKg === highKg ? [lowKg] : [lowKg, highKg],
  );

  const endpoints = resolveEndpointRenders(prescribed);
  assert.ok(endpoints.every((endpoint) => endpoint.plateStack));
  assert.ok(endpoints.every((endpoint) => endpoint.requestedUnit === 'kg'));
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
assert.equal(fullCustomRange.resolution, 'range');
assert.equal(fullCustomRange.displayLabel, '455–475 lb');
assert.deepEqual(
  fullCustomRange.endpoints.map((endpoint) => endpoint.requestedWeight),
  [455, 475],
);

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
assert.equal(plannedSuggestedRange.displayLabel, '225–245 lb');
assert.deepEqual(
  plannedSuggestedRange.endpoints.map((endpoint) => endpoint.requestedWeight),
  [225, 245],
);

const partiallyUnresolvedRange = resolveLoggerPrescribedWeight({
  item: itemForLbBounds(225, 2000),
  unit: 'lb',
});
assert.ok(partiallyUnresolvedRange);
const partiallyUnresolvedEndpoints = resolveEndpointRenders(partiallyUnresolvedRange);
assert.ok(partiallyUnresolvedEndpoints[0].plateStack);
assert.equal(partiallyUnresolvedEndpoints[1].plateStack, null);
assert.equal(partiallyUnresolvedEndpoints[1].displayLabel, '2000 lb');

assert.equal(
  resolveLoggerPrescribedWeight({ item: {}, unit: 'lb' }),
  null,
  'a movement without a prescribed weight must not request a render',
);
assert.equal(
  resolveLoggerPrescribedWeight({
    item: { target_high_kg: 245 * KG_PER_LB },
    unit: 'lb',
  }),
  null,
  'an upper bound without a lower bound must not request a render',
);

const routeSource = read('app/(tabs)/workout/[workoutId].tsx');
const visualContextSource = read('lib/logger-visual-context.ts');
const coreLoggerSource = read('components/workout-logger/core-loggers.tsx');
assert.match(
  routeSource,
  /heroLoadLabel:\s*prescribedWeight\?\.displayLabel/,
  'the displayed hero load must consume the canonical prescribed resolution',
);
assert.match(
  routeSource,
  /movementVisualContextFor\(\s*core,\s*movementPresentation\.renderWeight/,
  'the hero render must consume the same structured prescribed resolution object',
);
assert.match(
  visualContextSource,
  /prescribedWeight\.endpoints\.map[\s\S]*resolveLoggerPlateStackEndpoint/,
  'plate lookup must resolve every structured prescription endpoint',
);
assert.match(coreLoggerSource, /visualContext\.plateStack\.mode === 'range'/);
assert.match(coreLoggerSource, /visualContext\.plateStack\.endpoints\.map/);
assert.match(coreLoggerSource, /endpoint\.displayLabel/);
assert.match(coreLoggerSource, /endpoint\.plateStack \?/);
assert.doesNotMatch(coreLoggerSource, />\s*(MIN|MAX|LOW|HIGH)\s*</i);
assert.match(routeSource, /topPrescribedWeight[\s\S]*backdownPrescribedWeight/);
assert.doesNotMatch(
  visualContextSource,
  /progress_context\?\.targetWeightKg/,
  'PR evidence must never override the prescribed hero render',
);

console.log(
  '[logger-prescribed-render-weight] single loads, dual-endpoint ranges, partial fallbacks, Full Custom, Top/Backdown, and kg resolution passed',
);
