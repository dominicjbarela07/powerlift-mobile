import assert from 'node:assert/strict';
import { loadingForTotalWeightLb, nearestSupportedTotalWeightLb, platePlacements } from '../lib/barbell/loading.ts';
import { PLATE_METADATA } from '../lib/barbell/plate-metadata.ts';

assert.deepEqual(loadingForTotalWeightLb(225), [45, 45]);
assert.deepEqual(loadingForTotalWeightLb(275), [45, 45, 25]);
assert.deepEqual(loadingForTotalWeightLb(455), [45, 45, 45, 45, 25]);
assert.deepEqual(loadingForTotalWeightLb(495), [45, 45, 45, 45, 45]);
assert.deepEqual(loadingForTotalWeightLb(585), [45, 45, 45, 45, 45, 45]);
assert.throws(() => loadingForTotalWeightLb(226), /Cannot represent/);
assert.throws(() => loadingForTotalWeightLb(662.5), /Cannot represent/);
assert.equal(nearestSupportedTotalWeightLb(662.5), 665);
assert.equal(nearestSupportedTotalWeightLb(300 * 2.20462), 660);

const ordered = platePlacements([45, 25, 5]);
assert.deepEqual(ordered.map((item) => item.denomination), [45, 25, 5]);
assert.equal(ordered[0].x, PLATE_METADATA[45].thickness / 2);
assert.equal(ordered[1].x, PLATE_METADATA[45].thickness + PLATE_METADATA[25].thickness / 2);
assert.deepEqual(ordered.map((item) => Number(item.x.toFixed(5))), [0.02223, 0.05976, 0.08322]);
assert.equal(platePlacements([]).length, 0);
assert.throws(() => platePlacements([99]), /Unsupported plate denomination/);
assert.equal(PLATE_METADATA[45].nodeName, 'plate_45');
assert.equal(PLATE_METADATA[2.5].nodeName, 'plate_2_5');

const original = PLATE_METADATA[35].thickness;
const before = platePlacements([35, 45])[1].x;
PLATE_METADATA[35].thickness = original + 0.01;
const after = platePlacements([35, 45])[1].x;
PLATE_METADATA[35].thickness = original;
assert.ok(Math.abs((after - before) - 0.01) < 1e-9);

console.log('barbell loading helpers passed');
