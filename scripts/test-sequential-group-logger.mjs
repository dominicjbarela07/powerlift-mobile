import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  advanceSequentialGroupStep,
  createSequentialGroupDraft,
  previousSequentialGroupStep,
  updateSequentialGroupDraft,
  validateSequentialGroupForSave,
} from '../lib/sequential-group-logger.ts';
import {
  SEQUENTIAL_GROUP_REDUCED_MOTION_TRANSITION_MS,
  SEQUENTIAL_GROUP_STEP_TRANSITION_MS,
  sequentialGroupTransitionConfig,
} from '../lib/sequential-group-transition.ts';

const entry = (itemId, title, overrides = {}) => ({
  itemId,
  title,
  weight: '25',
  reps: '12',
  rir: '1',
  requiresRir: true,
  alreadyLogged: false,
  validationError: null,
  ...overrides,
});

const initial = createSequentialGroupDraft([
  entry(1, 'Cable Fly'),
  entry(2, 'Pressdown'),
]);
assert.equal(initial.activeIndex, 0);

const editedFirst = updateSequentialGroupDraft(
  initial,
  1,
  'weight',
  '32.5',
);
const advanced = advanceSequentialGroupStep(editedFirst);
assert.equal(advanced.validation.valid, true);
assert.equal(advanced.state.activeIndex, 1);
assert.equal(
  advanced.state.entries[0].weight,
  '32.5',
  'forward navigation must retain the exact first-movement draft',
);

const editedSecond = updateSequentialGroupDraft(
  advanced.state,
  2,
  'reps',
  '15',
);
const returned = previousSequentialGroupStep(editedSecond);
assert.equal(returned.activeIndex, 0);
assert.equal(returned.entries[0].weight, '32.5');
assert.equal(
  returned.entries[1].reps,
  '15',
  'back navigation must retain the second-movement draft',
);

const invalidSecond = updateSequentialGroupDraft(
  editedSecond,
  2,
  'rir',
  '',
);
const invalidSave = validateSequentialGroupForSave(invalidSecond);
assert.equal(invalidSave.validation.valid, false);
assert.equal(invalidSave.validation.invalidIndex, 1);
assert.equal(invalidSave.state.activeIndex, 1);
assert.match(invalidSave.validation.message, /Pressdown/);

const validSave = validateSequentialGroupForSave(editedSecond);
assert.equal(validSave.validation.valid, true);

const partialRound = createSequentialGroupDraft([
  entry(1, 'Cable Fly', { alreadyLogged: true }),
  entry(2, 'Pressdown'),
]);
assert.equal(
  partialRound.activeIndex,
  1,
  'a partial round must open directly on the first missing movement',
);
const attemptedLoggedEdit = updateSequentialGroupDraft(
  partialRound,
  1,
  'weight',
  '999',
);
assert.equal(
  attemptedLoggedEdit.entries[0].weight,
  '25',
  'saved evidence must remain read-only and duplicate-safe',
);

const triSet = createSequentialGroupDraft([
  entry(1, 'Movement A'),
  entry(2, 'Movement B'),
  entry(3, 'Movement C'),
]);
assert.equal(advanceSequentialGroupStep(triSet).state.activeIndex, 1);
assert.equal(
  advanceSequentialGroupStep({
    ...triSet,
    activeIndex: 1,
  }).state.activeIndex,
  2,
  'sequential navigation must support groups larger than two',
);

const forwardTransition = sequentialGroupTransitionConfig('forward', false);
assert.equal(
  forwardTransition.outgoingDurationMs + forwardTransition.incomingDurationMs,
  SEQUENTIAL_GROUP_STEP_TRANSITION_MS,
);
assert.ok(forwardTransition.outgoingTranslateX < 0);
assert.ok(forwardTransition.incomingTranslateX > 0);

const backwardTransition = sequentialGroupTransitionConfig('backward', false);
assert.ok(backwardTransition.outgoingTranslateX > 0);
assert.ok(backwardTransition.incomingTranslateX < 0);

const reducedMotionTransition = sequentialGroupTransitionConfig('forward', true);
assert.equal(
  reducedMotionTransition.outgoingDurationMs + reducedMotionTransition.incomingDurationMs,
  SEQUENTIAL_GROUP_REDUCED_MOTION_TRANSITION_MS,
);
assert.equal(reducedMotionTransition.outgoingTranslateX, 0);
assert.equal(reducedMotionTransition.incomingTranslateX, 0);
assert.equal(reducedMotionTransition.usesHorizontalMotion, false);

const root = path.resolve(import.meta.dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);
const loggerWheel = fs.readFileSync(
  path.join(root, 'components/workout-logger/logger-wheel-picker.tsx'),
  'utf8',
);
const modalStart = route.indexOf('visible={Boolean(supersetRoundLogger)}');
const modalEnd = route.indexOf('visible={!!pendingRowVideoUpload}', modalStart);
assert.ok(modalStart > 0 && modalEnd > modalStart);
const modalSource = route.slice(modalStart, modalEnd);

assert.equal(
  (modalSource.match(/<LoggerWheelPicker/g) || []).length,
  1,
  'the sheet must render exactly one movement form',
);
assert.doesNotMatch(
  modalSource,
  /<TextInput/,
  'the round logger must reuse the established wheel controls instead of custom dark inputs',
);
assert.match(modalSource, /activeEntry/);
assert.match(modalSource, /Next Movement/);
assert.match(modalSource, /Save Round/);
assert.match(modalSource, /Finish Round/);
assert.match(modalSource, />Captured</);
assert.match(modalSource, /hasCompletedMovement/);
assert.match(modalSource, /goBackInSupersetRoundLogger/);
assert.match(modalSource, /supersetRoundLogger\.saving/);
assert.match(modalSource, /supersetRoundTransitioning/);
assert.match(
  modalSource,
  /<Animated\.View[\s\S]*?styles\.supersetRoundProgressMark[\s\S]*?supersetRoundCapturedPulse\.interpolate/,
  'the captured-movement pulse must render on an Animated.View so scale receives a resolved number',
);
assert.match(route, /supersetRoundSaveInFlightRef\.current/);
assert.match(route, /supersetRoundTransitionInFlightRef\.current/);
assert.match(
  route,
  /if \(!result\.validation\.valid\) return;[\s\S]*runSupersetRoundStepTransition\([\s\S]*'forward'/,
  'invalid movement data must stop before any forward transition begins',
);
assert.match(
  route,
  /runSupersetRoundStepTransition\([\s\S]*'backward', null\)/,
  'Back must use the reverse transition without a captured confirmation',
);
assert.match(
  route,
  /Haptics\.selectionAsync\(\)[\s\S]*Animated\.parallel/,
  'valid forward capture must use the existing light selection haptic and step animation',
);
assert.match(
  route,
  /AccessibilityInfo\.announceForAccessibility\([\s\S]*Movement \$\{nextLogger\.activeIndex \+ 1\} of \$\{nextLogger\.entries\.length\}/,
);
assert.doesNotMatch(
  route,
  /SLTypography\.numeric/,
  'the round logger route must not reference a nonexistent compatibility typography token',
);
assert.match(route, /supersetRoundLoggedResult:[\s\S]*fontFamily: SLFontFamilies\.numeric/);
assert.match(
  route,
  /missingSupersetRoundItemIds[\s\S]*alreadyExists[\s\S]*if \(!parsed \|\| alreadyExists\) return item/,
  'final save must skip existing logs and persist only missing round members',
);
assert.match(
  route,
  /feedbackAnalytics\('superset_round_logged'[\s\S]*?closeSupersetRoundLogger\(\);[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?openTimerPicker\(\);/,
  'a successfully saved round must close its logger before opening the shared rest-timer prompt',
);
assert.match(
  route,
  /catch \(error: any\)[\s\S]*saving: false[\s\S]*Could not save this round/,
  'a failed save must keep the sheet state available for retry',
);
assert.match(
  route,
  /supersetRoundSheet:[\s\S]*backgroundColor: SLColors\.surfaceFloating[\s\S]*borderColor: SLColors\.borderStrong/,
);
assert.match(route, /supersetRoundContext:[\s\S]*color: SLColors\.textStrong/);
assert.match(route, /supersetRoundError:[\s\S]*color: SLColors\.danger/);
assert.match(route, /import \{ LoggerWheelPicker \} from '@\/components\/workout-logger\/logger-wheel-picker'/);
assert.match(loggerWheel, /optionText:[\s\S]*color: SLColors\.textMuted/);
assert.match(loggerWheel, /optionTextActive:[\s\S]*color: SLColors\.textStrong/);
assert.match(route, /visible=\{!!accessoryWheel\?\.visible\}/);
assert.match(route, /onPress=.*commitAccessoryWheel/);

console.log(
  '[sequential-group-logger] navigation, draft retention, validation routing, partial recovery, single-form rendering, save guards, and explicit contrast passed',
);
