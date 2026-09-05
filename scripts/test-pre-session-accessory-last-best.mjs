import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  accessoryLastBestInlineText,
  buildAccessoryLastBestCue,
} from '../lib/accessory-last-best.ts';
import { exactAccessoryLastExposure } from '../lib/exact-accessory-history.ts';

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const cardSource = fs.readFileSync(path.join(root, 'components/workout-logger/core-loggers.tsx'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'lib/accessory-last-best.ts'), 'utf8');

const prior = {
  id: 812,
  weight_kg: 36.2873896,
  reps: 12,
  rir: 1,
  date: '2026-08-28T19:15:00Z',
};
const exactHistory = {
  identity_scope: 'exact_identity',
  comparison_allowed: true,
  comparison_identity_key: 'movement:167:equipment:25',
  comparison_scope: 'exact_implementation',
  identity_resolution_source: 'canonical_movement_identity',
  previous_exposure: {
    workout_id: 910,
    date: '2026-08-28',
    comparison_identity_key: 'movement:167:equipment:25',
    representative_set_id: prior.id,
    representative_set_selection_reason: 'highest_canonical_e10rm',
    representative_set: prior,
  },
  recent_sessions: [prior],
};

const standard = buildAccessoryLastBestCue({
  history: exactHistory,
  unit: 'lb',
  semantics: { loadConvention: 'external_load' },
});
assert.equal(standard.kind, 'last_best');
assert.equal(standard.eyebrow, 'LAST BEST');
assert.equal(standard.primary, '80 lb × 12 @1 RIR');
assert.equal(standard.supporting, 'Aug 28');
assert.equal(standard.sourceSetId, prior.id);
assert.equal(standard.sourceSetId, exactAccessoryLastExposure(exactHistory)?.id);
assert.equal(standard.comparisonIdentityKey, 'movement:167:equipment:25');
assert.equal(accessoryLastBestInlineText(standard), 'Last best: 80 lb × 12 @1 RIR · Aug 28');

const kilograms = buildAccessoryLastBestCue({
  history: exactHistory,
  unit: 'kg',
  semantics: { loadConvention: 'external_load' },
});
assert.equal(kilograms.primary, '36.25 kg × 12 @1 RIR');

const assisted = buildAccessoryLastBestCue({
  history: {
    ...exactHistory,
    previous_exposure: {
      ...exactHistory.previous_exposure,
      representative_set: { ...prior, weight_kg: 31.7514659, reps: 10 },
    },
  },
  unit: 'lb',
  semantics: { loadConvention: 'assistance_load' },
});
assert.equal(assisted.primary, '70 lb assistance × 10 @1 RIR');

const weightedBodyweight = buildAccessoryLastBestCue({
  history: {
    ...exactHistory,
    previous_exposure: {
      ...exactHistory.previous_exposure,
      representative_set: { ...prior, weight_kg: 20.41165665, reps: 8, rir: null },
    },
  },
  unit: 'lb',
  semantics: { loadConvention: 'added_bodyweight' },
});
assert.equal(weightedBodyweight.primary, 'BW + 45 lb × 8');

const firstExposure = buildAccessoryLastBestCue({
  history: {
    ...exactHistory,
    previous_exposure: null,
    recent_sessions: [],
  },
  unit: 'lb',
});
assert.equal(firstExposure.kind, 'first_exact_exposure');
assert.equal(firstExposure.primary, 'First exact exposure');
assert.doesNotMatch(`${firstExposure.primary} ${firstExposure.supporting}`, /(?:0 lb|—)/);

for (const unsafeHistory of [
  { ...exactHistory, identity_scope: 'legacy_unresolved' },
  { ...exactHistory, comparison_allowed: false },
  { ...exactHistory, comparison_identity_key: null },
]) {
  const cue = buildAccessoryLastBestCue({ history: unsafeHistory, unit: 'lb' });
  assert.equal(cue.kind, 'unavailable');
  assert.doesNotMatch(cue.primary, /80 lb/);
}

const equipmentUnavailable = buildAccessoryLastBestCue({
  history: {
    ...exactHistory,
    comparison_allowed: false,
    previous_exposure: null,
    recent_sessions: [],
  },
  unit: 'lb',
});
assert.equal(equipmentUnavailable.primary, 'Equipment-specific history unavailable');

const legacyAuthoritativeResolution = buildAccessoryLastBestCue({
  history: {
    ...exactHistory,
    identity_resolution_source: 'legacy_resolution',
  },
  unit: 'lb',
  semantics: { loadConvention: 'external_load' },
});
assert.equal(legacyAuthoritativeResolution.kind, 'last_best');
assert.equal(legacyAuthoritativeResolution.comparisonIdentityKey, 'movement:167:equipment:25');

assert.doesNotMatch(helperSource, /\bfetch\s*\(|\baxios\b|apiClient|openIdentityPicker/);
assert.match(helperSource, /exactAccessoryLastExposure\(history\)/);
assert.match(routeSource, /priorPerformanceCue=\{accessoryIsComplete \? null : lastBestCue\}/);
assert.match(routeSource, /historyLine:\s*accessoryLookbackLine\(item\)/);
assert.match(routeSource, /performed_canonical_movement_identity[\s\S]+performed_movement_identity[\s\S]+effective_movement_identity/);
assert.match(cardSource, /\{priorPerformanceCue\.eyebrow\}/);
assert.match(cardSource, /\{priorPerformanceCue\.primary\}/);
assert.match(cardSource, /\{priorPerformanceCue\.supporting\}/);
assert.match(cardSource, /priorPerformancePrimary:[\s\S]*fontSize:\s*SLTypography\.body\.fontSize/);
assert.match(cardSource, /priorPerformanceSupporting:[\s\S]*fontSize:\s*SLTypography\.caption\.fontSize/);

console.log('[pre-session-accessory-last-best] exact history, load semantics, fail-closed identity, and visible card contracts passed');
