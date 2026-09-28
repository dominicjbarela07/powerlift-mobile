import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RestTimerSignalGate, restTimerSignalForExpiry } from '../lib/rest-timer-signal.ts';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const logger = read('app/(tabs)/workout/[workoutId].tsx');
const presenter = read('components/rest-timer-completion-presenter.tsx');
const endAtMs = 100_000;
const base = {
  timerId: 'session-41:timer-1', workoutId: '41', ownerUserId: '9',
  endAtMs, nowMs: endAtMs + 40, appState: 'active',
  foregroundSinceMs: 90_000, loggerVisibleSinceMs: 95_000,
  currentUserId: '9', route: { segments: ['(tabs)', 'workout', '[workoutId]'], workoutId: '41' },
};
assert.equal(restTimerSignalForExpiry(base), 'voice', 'visible Logger expiry speaks');
for (const context of [
  { appState: 'background' }, { appState: 'inactive' },
  { foregroundSinceMs: null }, { foregroundSinceMs: endAtMs + 1 },
  { loggerVisibleSinceMs: null }, { loggerVisibleSinceMs: endAtMs + 1 },
  { route: { segments: ['(tabs)', 'ledger', 'home'], workoutId: '41' } },
  { route: { segments: ['(tabs)', 'workout', '[workoutId]'], workoutId: '42' } },
  { currentUserId: '10' }, { nowMs: endAtMs + 1_000 },
]) {
  assert.equal(restTimerSignalForExpiry({ ...base, ...context }), 'notification', JSON.stringify(context));
}
const gate = new RestTimerSignalGate();
assert.equal(gate.claim(base.timerId, 'voice'), 'voice');
assert.equal(gate.claim(base.timerId, 'notification'), 'voice', 'native notification cannot follow speech');
assert.equal(gate.claim('timer-2', 'notification'), 'notification');
assert.equal(gate.claim('timer-2', 'voice'), 'notification', 'returning to Logger cannot replay speech');
assert.equal(gate.claim('timer-3', 'voice'), 'voice', 'next timer has independent delivery');

assert.match(presenter, /Rest complete\. Begin your next set\./);
assert.match(presenter, /Speech\.speak\(REST_COMPLETE_SPOKEN_CUE, \{ useApplicationAudioSession: false \}\)/);
assert.match(presenter, /signalAtExpiryRef\.current\(active\)/);
assert.match(presenter, /shouldShowBanner: !suppressRestEnd/);
assert.match(presenter, /shouldPlaySound: !suppressRestEnd/);
assert.match(logger, /onRestSecond=\{deliverRestTimerCue\}/);
assert.doesNotMatch(logger, /createAudioPlayer|rest-countdown-sequence|RestTimerCountdownAudioWindow/);
assert.doesNotMatch(presenter, /setAudioModeAsync|setIsAudioActiveAsync/);
for (const file of ['lib/rest-timer-countdown-audio.ts',
  'assets/audio/rest-countdown-sequence.wav', 'assets/audio/rest-countdown-tick.wav',
  'assets/audio/rest-countdown-finish.wav']) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must be removed`);
}
console.log('Rest timer voice, notification arbitration, and audio isolation tests passed.');
