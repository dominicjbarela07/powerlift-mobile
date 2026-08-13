import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ACCESSORY_CATALOG_REVIEW_USER_ID,
  ACCESSORY_REVIEW_CATALOG,
  buildAccessoryReviewExport,
  buildAccessoryReviewJson,
  buildAccessoryReviewMarkdown,
  canAccessAccessoryCatalogReview,
  createAccessoryReviewStore,
  deriveReviewCounts,
  filterAccessoryMovements,
  reconcileAccessoryReviewStore,
  reviewStateFor,
  setMovementCorrect,
  setMovementCorrected,
} from '../lib/accessory-catalog-review.ts';

const root = resolve(import.meta.dirname, '..');
const settingsSource = readFileSync(resolve(root, 'app/(tabs)/settings.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const routeSource = readFileSync(resolve(root, 'app/(tabs)/accessory-catalog-review.tsx'), 'utf8');
const storageSource = readFileSync(resolve(root, 'lib/accessory-catalog-review-storage.ts'), 'utf8');
const loggerSource = readFileSync(resolve(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const workspaceSource = readFileSync(resolve(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');

assert.equal(ACCESSORY_REVIEW_CATALOG.total_movements, 583, 'reviewer must use all canonical accessories');
assert.equal(ACCESSORY_REVIEW_CATALOG.movements.length, 583, 'catalog projection count must reconcile');
assert.equal(ACCESSORY_REVIEW_CATALOG.muscle_groups.length, 22, 'governed muscle taxonomy must be complete');
assert.equal(ACCESSORY_REVIEW_CATALOG.execution_families.length, 6, 'governed execution taxonomy must be complete');
assert.equal(new Set(ACCESSORY_REVIEW_CATALOG.movements.map((movement) => movement.id)).size, 583, 'stable movement IDs must be unique');
assert.match(ACCESSORY_REVIEW_CATALOG.catalog_version, /^sha256:/, 'review state must be versioned by catalog fingerprint');

assert.equal(ACCESSORY_CATALOG_REVIEW_USER_ID, 1);
assert.equal(canAccessAccessoryCatalogReview({ id: 1 }), true);
assert.equal(canAccessAccessoryCatalogReview({ user_id: '1' }), true);
assert.equal(canAccessAccessoryCatalogReview({ id: 2 }), false);
assert.equal(canAccessAccessoryCatalogReview(null), false);
assert.match(settingsSource, /canAccessAccessoryCatalogReview\(auth\.user\)/, 'Settings row must be identity-gated');
assert.match(settingsSource, /Accessory Catalog Review/, 'authorized Settings entry must remain discoverable');
assert.match(routeSource, /if \(!authorized\)[\s\S]*?router\.replace\('\/\(tabs\)\/settings'\)/, 'direct route must fail closed');
assert.match(layoutSource, /canUseAccessoryCatalogReview = canAccessAccessoryCatalogReview\(user\)/, 'authenticated account-state routing must explicitly preserve the authorized route');

const first = ACCESSORY_REVIEW_CATALOG.movements[0];
const second = ACCESSORY_REVIEW_CATALOG.movements[1];
let store = createAccessoryReviewStore();
assert.deepEqual(deriveReviewCounts(store), { total: 583, reviewed: 0, correct: 0, corrected: 0, remaining: 583 });

store = setMovementCorrect(store, first, '2026-08-11T00:00:00.000Z');
assert.equal(reviewStateFor(store, first.id), 'CORRECT');
assert.deepEqual(deriveReviewCounts(store), { total: 583, reviewed: 1, correct: 1, corrected: 0, remaining: 582 });

store = setMovementCorrected(store, first, {
  canonical_name: `${first.canonical_name} Revised`,
  primary_muscle_group: 'rear_delts',
  secondary_muscle_groups: ['upper_back', 'rear_delts', 'upper_back'],
  execution_family: 'CABLE',
}, 'Review note', '2026-08-11T00:01:00.000Z');
assert.equal(reviewStateFor(store, first.id), 'CORRECTED');
assert.deepEqual(deriveReviewCounts(store), { total: 583, reviewed: 1, correct: 0, corrected: 1, remaining: 582 });
assert.deepEqual(store.reviews[first.id].proposed.secondary_muscle_groups, ['upper_back'], 'secondary taxonomy must deduplicate and exclude the primary');

store = setMovementCorrect(store, second, '2026-08-11T00:02:00.000Z');
assert.deepEqual(deriveReviewCounts(store), { total: 583, reviewed: 2, correct: 1, corrected: 1, remaining: 581 });

const corrected = filterAccessoryMovements(store, { state: 'CORRECTED', primaryMuscle: null, executionFamily: null, search: '' });
assert.deepEqual(corrected.map((movement) => movement.id), [first.id]);
assert.ok(filterAccessoryMovements(store, { state: 'ALL', primaryMuscle: first.primary_muscle_group, executionFamily: first.execution_family, search: first.canonical_name.slice(0, 5) }).some((movement) => movement.id === first.id));
assert.equal(filterAccessoryMovements(store, { state: 'ALL', primaryMuscle: null, executionFamily: null, search: first.id }).some((movement) => movement.id === first.id), true);

const reconciled = reconcileAccessoryReviewStore({ ...store, catalog_version: 'older-version', last_movement_id: first.id });
assert.equal(reconciled.reviews[first.id].review_state, 'CORRECTED', 'catalog version/order changes must preserve records by stable ID');
assert.equal(reconciled.last_movement_id, first.id);

const exported = buildAccessoryReviewExport(store, '2026-08-11T01:00:00.000Z');
assert.equal(exported.review_metadata.reviewed, 2);
assert.equal(exported.reviews.length, 2);
assert.equal(exported.effective_catalog.length, 583);
assert.equal(exported.effective_catalog.find((movement) => movement.movement_id === first.id).canonical_name, `${first.canonical_name} Revised`);
assert.equal(exported.effective_catalog.find((movement) => movement.movement_id === ACCESSORY_REVIEW_CATALOG.movements[2].id).review_state, 'UNREVIEWED');
assert.deepEqual(JSON.parse(buildAccessoryReviewJson(store, '2026-08-11T01:00:00.000Z')), exported);
assert.match(buildAccessoryReviewMarkdown(store, '2026-08-11T01:00:00.000Z'), new RegExp(first.canonical_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(storageSource, /AsyncStorage\.setItem/, 'review decisions must persist immediately');
assert.match(storageSource, /userId/, 'persistent state must be scoped to the authorized user');
assert.match(routeSource, /Sharing\.shareAsync/, 'exports must use the existing OS share capability');
assert.match(routeSource, /resetAccessoryReviewStore/, 'review reset must be supported');
assert.match(routeSource, /Alert\.alert\([\s\S]*?Reset all accessory catalog review progress/, 'reset must require explicit confirmation');

assert.doesNotMatch(loggerSource, /accessory-catalog-review/, 'Session Logger must not import reviewer runtime');
assert.doesNotMatch(workspaceSource, /accessory-catalog-review/, 'Session Workspace must not import reviewer runtime');

console.log('[accessory-catalog-review] authorization, canonical data, state transitions, resume reconciliation, filters, exports, and runtime isolation passed');
