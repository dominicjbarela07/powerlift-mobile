import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  exactAccessoryBestExposure,
  exactAccessoryDefaultWeightKg,
  exactAccessoryHistoryRows,
  exactAccessoryLastExposure,
  isExactComparableAccessoryHistory,
} from '../lib/exact-accessory-history.ts';

const exact = {
  identity_scope: 'exact_identity',
  comparison_allowed: true,
  comparison_identity_key: 'movement:167:equipment:25',
  most_recent_logged_set: { weight_kg: 43.091, reps: 12, rir: 2, date: '2026-08-14' },
  best_logged_set: { weight_kg: 63.503, reps: 8, rir: 1, date: '2026-08-14' },
  recent_sets: [
    { weight_kg: 43.091, reps: 12, rir: 2, date: '2026-08-14' },
    { weight_kg: 63.503, reps: 8, rir: 1, date: '2026-08-14' },
  ],
  recent_sessions: [{ weight_kg: 63.503, reps: 8, rir: 1, date: '2026-08-14' }],
};
assert.equal(isExactComparableAccessoryHistory(exact), true);
assert.equal(exactAccessoryLastExposure(exact)?.weight_kg, 43.091);
assert.equal(exactAccessoryBestExposure(exact)?.weight_kg, 63.503);
assert.equal(exactAccessoryDefaultWeightKg(exact), 43.091);
assert.equal(exactAccessoryHistoryRows(exact).length, 2);

for (const unsafe of [
  { ...exact, identity_scope: 'legacy_unresolved' },
  { ...exact, comparison_allowed: false },
  { ...exact, comparison_identity_key: null },
]) {
  assert.equal(isExactComparableAccessoryHistory(unsafe), false);
  assert.equal(exactAccessoryLastExposure(unsafe), null);
  assert.equal(exactAccessoryDefaultWeightKg(unsafe), null);
  assert.deepEqual(exactAccessoryHistoryRows(unsafe), []);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logger = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'components/coach-mobile/SessionEditingWorkspace.tsx'), 'utf8');
assert.match(logger, /exactAccessoryLastExposure\(it\?\.movement_history\)/);
assert.match(logger, /const previousLog = item\.set_logs\?\.length[\s\S]*exactAccessoryDefaultWeightKg\(item\.movement_history\)/);
assert.match(logger, /No previous exact exposure\./);
assert.match(workspace, /exactAccessoryHistoryRows\(item\.movement_history\)/);
assert.match(workspace, /No previous exact exposure\./);

console.log('[accessory-history] exact identity, fail-closed UI, and logger-default contracts passed');
