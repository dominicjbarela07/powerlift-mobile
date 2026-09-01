import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { KG_PER_LB } from '../lib/logger-weight-format.js';
import { resolveLoggerPhysicalLoading } from '../lib/logger-physical-loading.ts';

const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions['.png'] = (module, filename) => {
  module.exports = filename;
};
const { resolvePhysicalPlateStackRender } = await import(
  '../lib/barbell/plate-stack-render-resolver.ts'
);

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const plate = (denomination, count) => ({ denomination, count });
const physical = ({
  totalLb,
  unit = 'lb',
  totalKg = totalLb * KG_PER_LB,
  barKey = 'lb_55',
  barWeightKg = 55 * KG_PER_LB,
  collarKey = 'none',
  collarWeightKg = 0,
  platesPerSide,
}) => ({
  total_kg: totalKg,
  total: unit === 'lb' ? totalLb : totalKg,
  unit,
  bar_key: barKey,
  bar_weight_kg: barWeightKg,
  collar_key: collarKey,
  collar_weight_kg: collarWeightKg,
  plates_per_side: platesPerSide,
  plate_stack_known: true,
  loadability: 'verified',
  equation: {
    bar_kg: barWeightKg,
    collars_kg: collarWeightKg,
    plates_kg: totalKg - barWeightKg - collarWeightKg,
  },
});

const lower415 = physical({
  totalLb: 415,
  totalKg: 188.240834,
  platesPerSide: [plate(45, 4)],
});
const upper435 = physical({
  totalLb: 435,
  totalKg: 197.312681,
  platesPerSide: [plate(45, 4), plate(10, 1)],
});
const options = [lower415, upper435];

// Production-shaped regression: the canonical prescription bounds are
// 187.5–197.5 kg, which Logger presents as 415–435 lb. Matching only the raw
// canonical kg values previously missed both physical options and leaked the
// default 45 lb-bar catalog path.
const lowerEndpoint = {
  canonicalWeightKg: 187.5,
  requestedWeight: 415,
  requestedUnit: 'lb',
};
const upperEndpoint = {
  canonicalWeightKg: 197.5,
  requestedWeight: 435,
  requestedUnit: 'lb',
};
assert.equal(resolveLoggerPhysicalLoading(options, lowerEndpoint), lower415);
assert.equal(resolveLoggerPhysicalLoading(options, upperEndpoint), upper435);

const lowerRender = resolvePhysicalPlateStackRender(lower415);
const upperRender = resolvePhysicalPlateStackRender(upper435);
assert.ok(lowerRender);
assert.ok(upperRender);
assert.equal(lowerRender.catalogKeyLb, 405, 'four 45 lb plates per side use the canonical four-plate render');
assert.equal(upperRender.catalogKeyLb, 425, 'four 45s plus one 10 per side use the matching canonical plate render');

const defaultBar415 = physical({
  totalLb: 415,
  barKey: 'lb_45',
  barWeightKg: 45 * KG_PER_LB,
  platesPerSide: [plate(45, 4), plate(5, 1)],
});
assert.equal(resolvePhysicalPlateStackRender(defaultBar415)?.catalogKeyLb, 415);
assert.equal(resolveLoggerPhysicalLoading([defaultBar415], lowerEndpoint), defaultBar415);
assert.equal(
  resolveLoggerPhysicalLoading([lower415], lowerEndpoint),
  lower415,
  'replacing refreshed movement options must immediately replace the Logger physical stack',
);

// The same physical options remain authoritative when presentation switches
// to kg; physical bar identity is not replaced by a nominal 20/25 kg bar.
assert.equal(resolveLoggerPhysicalLoading(options, {
  canonicalWeightKg: 187.5,
  requestedWeight: 187.5,
  requestedUnit: 'kg',
}), lower415);
assert.equal(lower415.bar_key, 'lb_55');

const competitionCollars = physical({
  totalLb: (45 + (5 / KG_PER_LB) + 360),
  barKey: 'lb_45',
  barWeightKg: 45 * KG_PER_LB,
  collarKey: 'competition',
  collarWeightKg: 5,
  platesPerSide: [plate(45, 4)],
});
assert.equal(resolvePhysicalPlateStackRender(competitionCollars)?.catalogKeyLb, 405);

const customBarAndCollars = physical({
  totalLb: 414,
  barKey: 'custom',
  barWeightKg: 50 * KG_PER_LB,
  collarKey: 'custom',
  collarWeightKg: 4 * KG_PER_LB,
  platesPerSide: [plate(45, 4)],
});
assert.equal(resolvePhysicalPlateStackRender(customBarAndCollars)?.catalogKeyLb, 405);

const visualContext = read('lib/logger-visual-context.ts');
const route = read('app/(tabs)/workout/[workoutId].tsx');
assert.match(visualContext, /resolveLoggerPhysicalLoading\(warmup\.allowed_working_loads, endpoint\)/);
assert.match(visualContext, /physicalLoading === undefined/);
assert.match(visualContext, /physicalLoading[\s\S]*resolvePhysicalPlateStackRender\(physicalLoading\)/);
assert.match(route, /formatWarmupPhysicalConfiguration\(core\.smart_warmup\.session\.loading_configuration, unit\)/);
assert.match(route, /resolveLoggerPlateStack\([\s\S]*item,[\s\S]*unit,[\s\S]*resolvedPlateWeight/);

console.log('movement-scoped Logger physical loading contracts: PASS');
