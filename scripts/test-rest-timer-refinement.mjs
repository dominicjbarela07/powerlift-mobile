import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  cueForRestTimerSecond,
  DEFAULT_REST_TIMER_CUE_CONFIG,
  REST_TIMER_ANTICIPATION_START_SECONDS,
  REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS,
  shouldPromoteRestTimer,
} from '../lib/rest-timer-cues.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const workoutRoute = read('app/(tabs)/workout/[workoutId].tsx');
const sessionShell = read('components/workout-logger/session-shell.tsx');
const focusSurface = read('components/workout-logger/rest-timer-focus.tsx');
const restTimerStorage = read('lib/rest-timer-storage.ts');
const restTimerPresenter = read('components/rest-timer-completion-presenter.tsx');
const restTimerRuntime = read('lib/rest-timer-completion.ts');

assert.equal(REST_TIMER_ANTICIPATION_START_SECONDS, 10);
assert.equal(REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS, 3);
assert.equal(DEFAULT_REST_TIMER_CUE_CONFIG.promoteAtSeconds, 10);
assert.equal(shouldPromoteRestTimer(true, 11), false);
for (let second = 10; second >= 1; second -= 1) {
  assert.equal(
    shouldPromoteRestTimer(true, second),
    true,
    `focus experience must remain promoted at ${second} seconds`,
  );
}
assert.equal(shouldPromoteRestTimer(true, 3), true);
assert.equal(shouldPromoteRestTimer(true, 1), true);
assert.equal(shouldPromoteRestTimer(true, 0), false);
assert.equal(shouldPromoteRestTimer(false, 3), false);

assert.deepEqual(cueForRestTimerSecond(3), { tone: 'short', haptic: 'light' });
assert.deepEqual(cueForRestTimerSecond(2), { tone: 'short', haptic: 'light' });
assert.deepEqual(cueForRestTimerSecond(1), { tone: 'short', haptic: 'light' });
assert.deepEqual(cueForRestTimerSecond(0), { tone: 'finish', haptic: 'success' });
assert.deepEqual(cueForRestTimerSecond(10), { tone: null, haptic: null });
assert.deepEqual(cueForRestTimerSecond(4), { tone: null, haptic: null });
assert.deepEqual(
  cueForRestTimerSecond(2, {
    ...DEFAULT_REST_TIMER_CUE_CONFIG,
    audioEnabled: false,
    hapticsEnabled: false,
  }),
  { tone: null, haptic: null },
);

assert.doesNotMatch(workoutRoute, /useAudioPlayer/);
assert.match(workoutRoute, /createAudioPlayer\([\s\S]*rest-countdown-sequence\.wav/);
assert.match(workoutRoute, /keepAudioSessionActive: false/);
assert.match(workoutRoute, /new RestTimerCountdownAudioWindow/);
assert.doesNotMatch(workoutRoute, /setAudioModeAsync|setIsAudioActiveAsync/);
assert.match(
  workoutRoute,
  /remaining <= REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS[\s\S]*deliverRestTimerCue\(remaining\)/,
);
assert.match(workoutRoute, /Haptics\.ImpactFeedbackStyle\.Light/);
assert.match(workoutRoute, /Haptics\.ImpactFeedbackStyle\.Medium/);
assert.match(workoutRoute, /Haptics\.NotificationFeedbackType\.Success/);
assert.match(workoutRoute, /restTimerPromoted \|\| restTimerZeroVisible \|\| restTimerReadyVisible/);
assert.match(workoutRoute, /<RestTimerFocus[\s\S]*visible=\{restTimerFocusVisible\}[\s\S]*ready=\{restTimerReadyVisible\}/);
assert.match(workoutRoute, /REST_TIMER_ZERO_HOLD_MS = 650/);
assert.match(workoutRoute, /REST_TIMER_READY_HOLD_MS = 900/);
assert.match(workoutRoute, /REST_TIMER_RETURN_MS = 250/);
assert.doesNotMatch(workoutRoute, /presentRestTimerReady\(/);
assert.match(workoutRoute, /remaining <= 0[\s\S]*reconcileGlobalRestTimerCompletion\(\)/);
assert.match(workoutRoute, /AppState\.addEventListener\('change'[\s\S]*remaining <= REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS[\s\S]*deliverRestTimerCue\(remaining\)[\s\S]*remaining <= 0[\s\S]*reconcileGlobalRestTimerCompletion\(\)/);
assert.match(workoutRoute, /restReadyDismissTimerRef\.current/);
assert.match(workoutRoute, /restZeroAdvanceTimerRef\.current/);
assert.match(workoutRoute, /onRestTimerLayout=\{handleRestTimerLayout\}/);
assert.match(restTimerPresenter, /isRestTimerNotification\(notification\.request\.content\.data\)[\s\S]*shouldShowAlert: !suppressRestEnd/);
assert.match(workoutRoute, /beginGlobalRestTimer\([\s\S]*workoutId,[\s\S]*endAtMs: endAt/);
assert.match(restTimerRuntime, /persistRestTimerExpiry\(timer\.workoutId, timer\.endAtMs\)/);
assert.match(workoutRoute, /loadRestTimerExpiry\(workoutId\)[\s\S]*restEndAtMsRef\.current = stored\.endAtMs/);
assert.match(workoutRoute, /clearRestTimerExpiry\(workoutId\)/);
assert.match(restTimerStorage, /REST_TIMER_STORAGE_PREFIX = 'strength-ledger:rest-timer:v1'/);
assert.match(restTimerStorage, /endAtMs <= nowMs[\s\S]*AsyncStorage\.removeItem\(key\)/);

assert.match(focusSurface, /StyleSheet\.absoluteFillObject/);
assert.match(focusSurface, /pointerEvents="box-none"/);
assert.match(focusSurface, /import \{ BlurView \} from 'expo-blur'/);
assert.match(focusSurface, /<BlurView[\s\S]*intensity=\{68\}/);
assert.match(focusSurface, /experimentalBlurMethod="dimezisBlurView"/);
assert.match(focusSurface, /tint="systemThickMaterialDark"/);
assert.match(focusSurface, /Animated\.spring\(translateY/);
assert.match(focusSurface, /Animated\.spring\(surfaceScale/);
assert.match(focusSurface, /headerOrigin/);
assert.match(focusSurface, /ready \? 'READY'/);
assert.match(focusSurface, /Math\.max\(0, seconds\)/);
assert.doesNotMatch(focusSurface, />\s*GO\s*</);
assert.match(focusSurface, /ENTER_MS = 300/);
assert.match(focusSurface, /EXIT_MS = 250/);
assert.match(focusSurface, /energyForState\(seconds, ready\)/);
assert.match(focusSurface, /contentScale\.setValue\(ready \? 0\.9 : 0\.84\)/);
assert.match(focusSurface, /seconds > REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS/);
assert.match(focusSurface, /Animated\.loop\([\s\S]*duration: 1200/);
assert.match(focusSurface, /0\.18 \+ \(anticipationProgress \* 0\.24\)/);
assert.match(
  focusSurface,
  /REST_TIMER_ANTICIPATION_START_SECONDS[\s\S]*REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS/,
);
assert.doesNotMatch(focusSurface, /particle|confetti|firework|lens.?flare/i);
assert.doesNotMatch(focusSurface, /<Modal|Alert\.alert|flash/i);

assert.match(sessionShell, /measureInWindow/);
assert.match(sessionShell, /collapsable=\{false\}/);
assert.match(sessionShell, /restPromoted && styles\.commandTimerBlockPromoted/);

assert.match(sessionShell, /progressRingFraction/);
assert.match(sessionShell, /\{loggedSets\}/);
assert.match(sessionShell, /\/\{plannedSets \|\| '—'\}/);
assert.doesNotMatch(sessionShell, /\{Math\.round\(clampedProgress\)\}%/);
assert.equal(
  sessionShell.match(/<SessionProgressRing/g)?.length,
  1,
  'the existing session progress ring must render exactly once',
);
assert.match(
  sessionShell,
  /function SessionProgressRing[\s\S]*<SLAnimatedMetric value=\{loggedSets\}[^>]*>/,
  'relocation must preserve the progress-ring completion animation hook',
);
assert.match(
  sessionShell,
  /<SLAnimatedMetric value=\{loggedSets\} style=\{styles\.progressRingMetric\}>[\s\S]*adjustsFontSizeToFit[\s\S]*minimumFontScale=\{0\.68\}[\s\S]*numberOfLines=\{1\}[\s\S]*\{loggedSets\}\/\{plannedSets \|\| '—'\}/,
  'multi-digit completed and planned counts must scale together inside one bounded line',
);
assert.doesNotMatch(
  sessionShell,
  /typographyRole="numeric" style=\{styles\.progressRingFraction\}/,
  'the global numeric role must not override the progress ring’s bounded local size',
);
assert.match(
  sessionShell,
  /progressRingMetric:\s*\{[\s\S]*?width: 78/,
  'the count must stay within the enlarged ring’s inner diameter',
);
assert.match(
  sessionShell,
  /function SessionCommandStrip[\s\S]*styles\.commandProgressBlock[\s\S]*<SessionProgressRing[\s\S]*styles\.commandTimerBlock/,
  'session progress must sit immediately before the rest-timer control',
);
assert.doesNotMatch(
  sessionShell,
  />\s*Session Progress\s*</,
  'the progress ring is self-explanatory and must not carry a redundant heading',
);
assert.match(
  sessionShell,
  /function SessionTitleStatus[\s\S]*Session status:[\s\S]*\{statusLabel\}/,
  'the session title status must preserve the existing dynamic state label',
);
assert.equal(
  sessionShell.match(/<SessionTitleStatus screenMode=\{screenMode\} statusLabel=\{statusLabel\}/g)?.length,
  3,
  'not-started, active, and finished session title branches must all render the relocated status',
);
assert.match(
  sessionShell,
  /sessionIdentityTitleCol[\s\S]*activeSessionTitle[\s\S]*<SessionTitleStatus screenMode=\{screenMode\} statusLabel=\{statusLabel\}/,
  'active-session status must occupy the former progress-ring slot beside the Training Session title',
);
assert.match(
  sessionShell,
  /commandTimerBlock: \{[\s\S]*flex: 1[\s\S]*minHeight: 42/,
  'the timer control must retain flexible width beside the fixed progress ring on narrow screens',
);
assert.match(
  sessionShell,
  /commandStripWrap: \{[\s\S]*paddingVertical: 0[\s\S]*commandStrip: \{[\s\S]*minHeight: 96/,
  'the sticky utility row must not exceed the natural progress-ring height',
);
assert.match(
  sessionShell,
  /progressRingWrap: \{[\s\S]*width: 96,[\s\S]*height: 96/,
  'vertical compression must preserve the progress-ring dimensions',
);
assert.doesNotMatch(
  sessionShell,
  /progressRingWrap:\s*\{[^}]*marginTop:/,
  'the relocated ring must not retain title-area vertical margin',
);
assert.match(
  sessionShell,
  /commandButton: \{[\s\S]*minWidth: 88,[\s\S]*height: 38/,
  'vertical compression must preserve the Set Timer button size',
);
assert.match(
  sessionShell,
  /sessionIdentityTitleCol: \{[\s\S]*flex: 1[\s\S]*minWidth: 0/,
  'the Training Session title must retain narrow-width wrapping beside the session status',
);
assert.match(
  workoutRoute,
  /<SessionCommandStrip[\s\S]*progressPct=\{progressPct\}/,
  'the existing route-level progress calculation must feed the relocated ring',
);
assert.match(workoutRoute, /const loggedSets = loggedSetCountForWorkout\(workout\)/);
assert.match(workoutRoute, /const plannedSets = plannedSetCountForWorkout\(workout\)/);

const sequence = fs.readFileSync(path.join(root, 'assets/audio/rest-countdown-sequence.wav'));
assert.equal(sequence.subarray(0, 4).toString(), 'RIFF', 'countdown sequence is not a WAV file.');
assert.equal(sequence.subarray(8, 12).toString(), 'WAVE', 'countdown sequence is not a WAV file.');
assert.equal(sequence.readUInt32LE(24), 44_100, 'countdown sequence must remain 44.1 kHz.');
assert.equal(sequence.readUInt16LE(22), 1, 'countdown sequence must remain mono.');
assert.equal(sequence.readUInt16LE(34), 16, 'countdown sequence must remain 16-bit PCM.');
assert.ok(sequence.length > 320_000, 'countdown sequence must contain the complete 3-2-1-0 cue.');

const startTimerBody = workoutRoute.slice(
  workoutRoute.indexOf('const startRestTimer'),
  workoutRoute.indexOf('const stopRestTimer'),
);
const stopTimerBody = workoutRoute.slice(
  workoutRoute.indexOf('const stopRestTimer'),
  workoutRoute.indexOf('const formatRestTime'),
);
assert.doesNotMatch(
  startTimerBody,
  /useEffect|set_logs|loggedSets|save|submission/i,
  'Timer start remains explicit and must not be coupled to set completion.',
);
assert.match(stopTimerBody, /setRestTimerZeroVisible\(false\)/);
assert.match(stopTimerBody, /setRestTimerReadyVisible\(false\)/);
assert.match(stopTimerBody, /setRestActive\(false\)/);
assert.match(stopTimerBody, /setRestSeconds\(0\)/);

console.log('Training Session Logger progress typography and rest-timer refinement tests passed.');
