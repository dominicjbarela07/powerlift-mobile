import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const state = read('lib/surface-weight-unit.ts');
const primitive = read('components/ui/surface-weight-unit-toggle.tsx');
const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
const history = read('components/movement-history/CanonicalMovementHistoryScreen.tsx');
const historyRoute = read('app/movement-history-sheet.tsx');
const ledger = read('components/ledger/experiences.tsx');
const ledgerIndex = read('components/ledger/index-experience.tsx');
const ledgerExploration = read('components/ledger/exploration-experiences.tsx');
const achievements = read('components/ledger/AchievementsExperience.tsx');
const trainingHub = read('components/training-hub/AthleteTrainingHubExperience.tsx');
const athleteHome = read('components/home/AthleteHomeV3.tsx');
const coachAthlete = read('components/coach-mobile/CoachAthleteHubSheet.tsx');
const logger = read('app/(tabs)/workout/[workoutId].tsx');
const loggerPrimitive = read('components/workout-logger/logger-primitives.tsx');
const sessionHistory = read('app/(tabs)/workout/session-history.tsx');
const sessionWorkspaceRoute = read('app/(tabs)/workout/session-workspace/[workoutId].tsx');
const sessionWorkspace = read('components/coach-mobile/SessionEditingWorkspace.tsx');

assert.match(state, /parseDisplayWeightUnit\(inheritedUnit\)[\s\S]*normalizeDisplayWeightUnit\(preferredUnit\)/);
assert.match(state, /localOverrideRef\.current = true/);
assert.doesNotMatch(state, /from ['"]@react-native-async-storage|fetchJson\(|preferred_units\s*:/);
assert.match(primitive, /\(\['lb', 'kg'\] as const\)/);
assert.match(primitive, /accessibilityState=\{\{ selected: active \}\}/);

for (const [name, source, testId] of [
  ['Recap', recap, 'session-recap-unit-toggle'],
  ['Movement History', history, 'movement-history-unit-toggle'],
  ['Ledger Strength/Journey', ledger, 'ledger-strength-unit-toggle'],
  ['Ledger home', ledgerIndex, 'ledger-index-unit-toggle'],
  ['Ledger exploration', ledgerExploration, 'ExplorationUnitToolbar'],
  ['Achievements', achievements, 'ledger-achievements-unit-toggle'],
  ['Training Hub', trainingHub, 'training-hub-unit-toggle'],
  ['Athlete Home', athleteHome, 'athlete-home-unit-toggle'],
  ['Coach athlete evidence', coachAthlete, 'coach-athlete-hub-unit-toggle'],
  ['Session History', sessionHistory, 'session-history-unit-toggle'],
]) {
  assert.match(source, /useSurfaceWeightUnit/, `${name} must initialize one local surface unit`);
  assert.match(source, new RegExp(testId), `${name} must expose the shared unit control`);
}

assert.doesNotMatch(ledger, /strength-ledger\.progression\.unit|AsyncStorage\.setItem/);
assert.match(recap, /Plan \/ Compare/);
assert.match(recap, /setResultLabel\([^\n]*unit\)/);
assert.match(recap, /onOpenMovementHistory\(row, unit\)/);
assert.match(historyRoute, /initialDisplayUnit=\{initialDisplayUnit\}/);
assert.match(achievements, /formatCalculatedWeightFromKg\(valueKg, unit\)/);
assert.match(achievements, /formatWeightFromKg\(bodyweight, unit\)/);
assert.match(logger, /unitLocalOverrideRef/);
assert.match(logger, /payload\.athlete\?\.preferred_units/);
assert.match(loggerPrimitive, /SurfaceWeightUnitToggle unit=\{unit\}/);
assert.match(coachAthlete, /summary\?\.athlete\.preferred_units \?\? athlete\?\.preferred_units/);
assert.doesNotMatch(sessionWorkspaceRoute, /preferred_units:\s*plan\.metadataPatch\.displayUnit/);
assert.doesNotMatch(sessionWorkspace, /current\.displayUnit !== persisted\.displayUnit/);
assert.doesNotMatch(sessionWorkspace, /displayUnit !== persisted\.displayUnit \? \{ displayUnit/);

console.log('Global weight unit toggle contracts passed.');
