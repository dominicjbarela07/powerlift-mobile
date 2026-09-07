import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const backendRoot = resolve(root, '..');
const source = (base, path) => readFileSync(resolve(base, path), 'utf8');
const experience = source(root, 'components/ledger/VariantsExperience.tsx');
const routeScreen = source(root, 'components/ledger/route-screen.tsx');
const oldExploration = source(root, 'components/ledger/exploration-experiences.tsx');
const client = source(root, 'lib/ledger-variants.ts');
const service = source(backendRoot, 'app/services/core_variants_ledger.py');
const seed = source(backendRoot, 'scripts/seed_core_variants_dev.py');
const laws = source(backendRoot, 'AGENTS.md');

assert.match(routeScreen, /screen === 'variants'.*<VariantsExperience/s);
assert.doesNotMatch(routeScreen, /MovementCollectionExperience/);
assert.doesNotMatch(oldExploration, /MovementCollectionExperience|Overview', 'By Muscle', 'History/);
assert.ok(existsSync(resolve(root, 'app/(tabs)/ledger/variant/[variantId].tsx')));
assert.ok(existsSync(resolve(root, 'app/(tabs)/ledger/variant-family/[family].tsx')));
assert.match(experience, /VariantFamilyExperience/);

for (const marker of [
  'variants-atmospheric-header',
  'variants-current-rotation',
  'variant-family-summary',
  'variants-making-progress',
  'variant-block-exposure',
  'variant-historical-record',
  'variant-weight-on-bar',
  'variant-rep-strength',
  'variant-comparable-performance',
  'variant-performed-volume',
  'variant-block-history',
  'variant-session-history',
]) assert.match(experience, new RegExp(marker), `missing Variants experience contract: ${marker}`);

assert.match(experience, /ledger-chapter-variants-v1\.png/);
assert.match(experience, /CanonicalMovementArtwork/);
assert.match(experience, /Variant bests never claim that your Competition lift improved/);
assert.doesNotMatch(experience, /MuscleMap|By Muscle|metricGrid|grid2x2/);

assert.match(client, /schema_version: 'core-variants-ledger-v1'/);
assert.match(client, /core_movement_id/);
assert.match(service, /exact_core_history_rows/);
assert.match(service, /literal_heaviest_recorded_load_per_session/);
assert.match(service, /same_reps_more_weight.*same_weight_more_reps.*same_task_lower_effort/s);
assert.match(service, /competition_carryover_claimed["']:\s*False/);
assert.doesNotMatch(service, /["'](?:estimated_?1rm|e1rm)["']\s*:/i);

for (const key of [
  'three_count_pause_squat',
  'tempo_squat_3_0_3',
  'pin_squat',
  'front_squat',
  'two_count_pause_bench',
  'larsen_press',
  'spoto_press',
  'close_grip_bench',
  'pause_deadlift',
  'deficit_deadlift',
  'romanian_deadlift',
  'block_pull',
]) assert.match(seed, new RegExp(`['"]${key}['"]`), `DEV seed is missing ${key}`);

assert.match(seed, /database_name\.endswith\(["']_dev["']\)/);
assert.match(seed, /--reset/);
assert.match(seed, /capture_set_identity_snapshot/);
assert.match(laws, /Core Variants are organized by their governed parent Core lift/);
assert.match(laws, /must never be merged into or presented as causal\s+improvement/);

console.log('[core-variants-experience] continuous UX, exact identity, independent evidence, rich detail, and DEV seed contracts passed');
