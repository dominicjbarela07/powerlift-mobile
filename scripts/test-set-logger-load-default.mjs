import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { resolveSetLoggerLoadDefault } from '../lib/set-logger-load-default.ts';
import { formatLoggerWeightKg } from '../lib/logger-weight-format.js';

const historicalExposure = {
  identity_scope: 'exact_identity',
  movement_definition_id: 42,
  most_recent_logged_set: { workout_id: 901, set_index: 3, weight_kg: 140, date: '2026-08-09' },
  previous_exposure: {
    representative_set: { id: 7001, workout_id: 901, set_index: 1, weight_kg: 135, date: '2026-08-09' },
  },
  recent_sets: [
    { workout_id: 901, set_index: 3, weight_kg: 140, date: '2026-08-09' },
    { workout_id: 901, set_index: 2, weight_kg: 137.5, date: '2026-08-09' },
    { workout_id: 901, set_index: 1, weight_kg: 135, date: '2026-08-09' },
    { workout_id: 880, set_index: 2, weight_kg: 132.5, date: '2026-08-02' },
  ],
};

assert.deepEqual(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 2,
    currentSessionSets: [{ id: 12, set_index: 2, actual_weight_kg: 142.5 }],
    comparableHistory: historicalExposure,
    prescribedWeightKg: 130,
    fallbackWeightKg: 0,
  }),
  { weightKg: 142.5, source: 'persisted_current_set', evidenceSetIndex: 2 },
  'editing an existing set must start from its exact persisted load',
);

assert.deepEqual(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 3,
    currentSessionSets: [
      { id: 21, set_index: 1, actual_weight_kg: 136.077711 }, // 300 lb
      { id: 22, set_index: 2, actual_weight_kg: 140.613635 }, // 310 lb
    ],
    comparableHistory: historicalExposure,
    prescribedWeightKg: 130,
    fallbackWeightKg: 0,
  }),
  { weightKg: 140.613635, source: 'current_session_previous_set', evidenceSetIndex: 2 },
  'the immediately previous successful set must outrank history and prescription',
);

assert.deepEqual(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 2,
    currentSessionSets: [],
    comparableHistory: historicalExposure,
    prescribedWeightKg: 130,
    fallbackWeightKg: 0,
  }),
  { weightKg: 135, source: 'historical_representative_set', evidenceSetIndex: 1 },
  'the canonical representative set from the most recent comparable exposure is preferred',
);

assert.deepEqual(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 4,
    comparableHistory: historicalExposure,
    prescribedWeightKg: 130,
    fallbackWeightKg: 0,
  }),
  { weightKg: 135, source: 'historical_representative_set', evidenceSetIndex: 1 },
  'every new-set default uses the same canonical representative evidence',
);

assert.equal(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 1,
    comparableHistory: { ...historicalExposure, identity_scope: 'legacy_unresolved' },
    prescribedWeightKg: 132.5,
    fallbackWeightKg: 0,
  }).weightKg,
  132.5,
  'legacy/unresolved history must never initialize a comparable load wheel',
);

assert.deepEqual(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 1,
    prescribedWeightKg: 132.5,
    fallbackWeightKg: 0,
  }),
  { weightKg: 132.5, source: 'prescription', evidenceSetIndex: null },
  'prescription is the useful no-evidence fallback',
);

assert.deepEqual(
  resolveSetLoggerLoadDefault({ currentSetIndex: 1, fallbackWeightKg: 0 }),
  { weightKg: 0, source: 'fallback', evidenceSetIndex: null },
  'zero is retained only as the true no-context accessory fallback',
);

assert.equal(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 2,
    currentSessionSets: [{ set_index: 1, actual_weight_kg: 180 }],
    prescribedWeightKg: 150,
    fallbackWeightKg: 0,
    preferPrescriptionForStageTransition: true,
  }).weightKg,
  150,
  'an explicit set-stage target change may lead with its intentional prescription',
);

const supersetA = resolveSetLoggerLoadDefault({
  currentSetIndex: 2,
  currentSessionSets: [{ set_index: 1, actual_weight_kg: 102.058283 }],
  fallbackWeightKg: 0,
});
const supersetB = resolveSetLoggerLoadDefault({
  currentSetIndex: 2,
  currentSessionSets: [{ set_index: 1, actual_weight_kg: 27.215542 }],
  fallbackWeightKg: 0,
});
assert.equal(supersetA.weightKg, 102.058283, 'superset movement A carries only A');
assert.equal(supersetB.weightKg, 27.215542, 'superset movement B carries only B');
assert.equal(formatLoggerWeightKg(supersetA.weightKg, 'lb'), '225', 'canonical kg initializes correctly in lb');
assert.equal(formatLoggerWeightKg(supersetA.weightKg, 'kg'), '102.5', 'canonical kg initializes on the kg wheel');

assert.equal(
  resolveSetLoggerLoadDefault({
    currentSetIndex: 2,
    // A failed 315 lb attempt is deliberately absent from authoritative sets.
    currentSessionSets: [{ set_index: 1, actual_weight_kg: 136.077711 }],
    fallbackWeightKg: 0,
  }).weightKg,
  136.077711,
  'failed drafts cannot become carry-forward evidence',
);

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
assert.match(route, /resolveSetLoggerLoadDefault/);
assert.match(route, /acceptedLoadByItemIdRef/);
assert.match(route, /rememberAcceptedLoad/);
assert.match(route, /if \(!json\) return;[\s\S]{0,240}rememberAcceptedLoad/);
assert.match(route, /identity_scope[^\n]*exact_identity|comparableHistory/);
assert.match(route, /unitLocalOverrideRef\.current = nextUnit/);
assert.match(route, /if \(unitLocalOverrideRef\.current == null\)/);
assert.match(route, /setLog\.actual_weight_kg != null[\s\S]*buildEditWeightOptions/);
assert.doesNotMatch(route, /defaultAccessoryWeight\(item, unit, accInputs/);

console.log('Set Logger load-wheel defaulting regression checks passed.');
