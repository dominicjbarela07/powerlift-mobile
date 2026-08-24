import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatPerformedLoad } from '../lib/performed-load-semantics.ts';

const root = resolve(import.meta.dirname, '..');
const logger = readFileSync(resolve(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const ledger = readFileSync(resolve(root, 'components/ledger/index-experience.tsx'), 'utf8');

const bodyweight = { loadConvention: 'bodyweight_only', measurementType: 'bodyweight_reps' };
assert.equal(formatPerformedLoad(0, 'lb', bodyweight), 'BW');
assert.equal(formatPerformedLoad(4.5359237, 'lb', bodyweight), 'BW + 10 lb');
assert.equal(formatPerformedLoad(6.80388555, 'lb', bodyweight), 'BW + 15 lb');
assert.equal(formatPerformedLoad(6.80388555, 'kg', bodyweight), 'BW + 6.25 kg');
assert.equal(formatPerformedLoad(9.0718474, 'lb', { loadConvention: 'added_bodyweight' }), 'BW + 20 lb');
assert.equal(formatPerformedLoad(0, 'lb', { loadConvention: 'added_bodyweight' }), 'BW');
assert.equal(formatPerformedLoad(36.2873896, 'lb', { loadConvention: 'assistance_load' }), '80 lb assistance');
assert.equal(formatPerformedLoad(45.359237, 'lb', { loadConvention: 'external_load' }), '100 lb');

assert.match(logger, /formatMovementHistorySet[\s\S]*?formatPerformedLoad\(w, unit, assisted \? \{ loadConvention: 'assistance_load' \} : null\)/);
assert.match(logger, /historyPerformanceParts[\s\S]*?formatPerformedLoad\(row\.weight_kg, unit, assisted \? \{ loadConvention: 'assistance_load' \} : null\)/);
assert.match(ledger, /entry\?\.evidence\?\.load_semantics/);
assert.match(ledger, /measurementType:/);

console.log('bodyweight external-load semantics contract passed');
