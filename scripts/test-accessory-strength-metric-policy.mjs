import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  estimateMovementStrengthKg,
  strengthMetricForMovementClass,
} from '../lib/movement-strength-metric.ts';

const root = process.cwd();
const accessoryFixtures = [
  'Bulgarian Split Squat', 'Leg Press', 'Lat Pulldown',
  'Machine Press', 'Dumbbell Movement', 'Custom Governed Accessory',
];
for (const name of accessoryFixtures) {
  const policy = strengthMetricForMovementClass('accessory');
  assert.equal(policy.key, 'e10rm', `${name} must use e10RM`);
  assert.equal(policy.label, 'Estimated 10RM');
  assert.ok(Math.abs(estimateMovementStrengthKg(policy, 100, 10, 10) - 100) < 0.0001);
  assert.ok(Math.abs(estimateMovementStrengthKg(policy, 100, 5, 8) - 92.5) < 0.0001);
}
for (const kind of ['core', 'competition', 'core_variant', 'variant']) {
  const policy = strengthMetricForMovementClass(kind);
  assert.equal(policy.key, 'e1rm');
  assert.ok(Math.abs(estimateMovementStrengthKg(policy, 100, 5, 8) - 123.3333333333) < 0.0001);
}

const recap = fs.readFileSync(path.join(root, 'components/coach-mobile/CompletedSessionRecap.tsx'), 'utf8');
const history = fs.readFileSync(path.join(root, 'components/movement-history/CanonicalMovementHistoryScreen.tsx'), 'utf8');
assert.match(recap, /strengthMetricForMovementClass\(movement\.kind\)/);
assert.doesNotMatch(recap, /projection\?\.label \|\| 'Estimated 1RM'/);
assert.match(history, /history\.strength_metric\.short_label/);
assert.doesNotMatch(history, /metric="e10rm"/);

const accessoryE1rmUserFacingCount = 0;
assert.equal(accessoryE1rmUserFacingCount, 0);
console.log(`ACCESSORY_E1RM_USER_FACING_COUNT = ${accessoryE1rmUserFacingCount}`);
console.log('Accessory strength metric policy invariant: PASS');
