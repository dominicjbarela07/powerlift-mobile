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
assert.equal(restTimerSignalForExpiry(base), 'beep', 'visible Logger expiry beeps');
for (const context of [
  { appState: 'background' }, { appState: 'inactive' },
  { foregroundSinceMs: null }, { foregroundSinceMs: endAtMs + 1 },
  { loggerVisibleSinceMs: null }, { loggerVisibleSinceMs: endAtMs + 1 },
  { route: { segments: ['(tabs)', 'ledger', 'home'], workoutId: '41' } },
  { route: { segments: ['(tabs)', 'workout', '[workoutId]'], workoutId: '42' } },
  { currentUserId: '10' }, { nowMs: endAtMs - 1 },
]) {
  assert.equal(restTimerSignalForExpiry({ ...base, ...context }), 'notification', JSON.stringify(context));
}
assert.equal(restTimerSignalForExpiry({ ...base, nowMs: endAtMs + 4_000 }), 'beep',
  'a delayed JS callback can beep only when the app and Logger stayed visible through expiry');
const gate = new RestTimerSignalGate();
assert.equal(gate.claim(base.timerId, 'beep'), 'beep');
assert.equal(gate.claim(base.timerId, 'notification'), 'beep', 'native notification cannot follow beep');
assert.equal(gate.claim('timer-2', 'notification'), 'notification');
assert.equal(gate.claim('timer-2', 'beep'), 'notification', 'returning to Logger cannot replay beep');
assert.equal(gate.claim('timer-3', 'beep'), 'beep', 'next timer has independent delivery');

assert.doesNotMatch(presenter, /expo-speech|Speech\.speak|REST_COMPLETE_SPOKEN_CUE/);
assert.match(presenter, /useAudioPlayer\(REST_COMPLETION_BEEP, \{[\s\S]*keepAudioSessionActive: false/);
assert.doesNotMatch(presenter, /downloadFirst: true/, 'bundled player must have an immediate source');
assert.match(presenter, /Asset\.fromModule\(REST_COMPLETION_BEEP\)[\s\S]*asset\.downloadAsync\(\)[\s\S]*beepPlayer\.replace\(\{ uri: asset\.localUri \}\)/,
  'bundled tone must also be prefetched to a local playback URL');
assert.match(presenter, /if \(!activeTimerId\) return;[\s\S]*configureCompletionAudio\(\)/,
  'each timer must reassert playback category after other media may have changed the shared session');
assert.match(presenter, /!beepPlayer\.isLoaded \|\| !beepResetReadyRef\.current/);
assert.match(presenter, /beepPlayer\.play\(\)/);
assert.match(presenter, /beepPlayer\.seekTo\(0\)/);
assert.match(presenter, /playsInSilentMode: true,[\s\S]*interruptionMode: 'duckOthers'/);
const nativeAudio = read('node_modules/expo-audio/ios/AudioModule.swift');
assert.match(nativeAudio, /category = mode\.allowsRecording \? \.playAndRecord : \.playback/,
  'installed native runtime must map Silent Mode playback to AVAudioSession playback category');
assert.match(nativeAudio, /case \.duckOthers:[\s\S]*categoryOptions\.insert\(\.duckOthers\)/);
assert.match(nativeAudio, /setActive\(false, options: \[\.notifyOthersOnDeactivation\]\)/,
  'one-shot completion must release ducking after playback');
assert.match(presenter, /signalGate\.claim\(timer\.timerId, 'notification'\)/);
assert.match(presenter, /signalAtExpiryRef\.current\(active\)/);
assert.match(presenter, /shouldShowBanner: !suppressRestEnd/);
assert.match(presenter, /shouldPlaySound: !suppressRestEnd/);
assert.match(logger, /onRestSecond=\{deliverRestTimerCue\}/);
assert.doesNotMatch(logger, /createAudioPlayer|rest-countdown-sequence|RestTimerCountdownAudioWindow/);
for (const file of ['lib/rest-timer-countdown-audio.ts',
  'assets/audio/rest-countdown-sequence.wav', 'assets/audio/rest-countdown-tick.wav',
  'assets/audio/rest-countdown-finish.wav']) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must be removed`);
}
const tone = fs.readFileSync(path.join(root, 'assets/audio/rest-completion-beep.wav'));
assert.equal(tone.toString('ascii', 0, 4), 'RIFF');
assert.equal(tone.toString('ascii', 8, 12), 'WAVE');
const duration = tone.readUInt32LE(40) / (tone.readUInt32LE(28));
assert.ok(duration >= 0.8 && duration <= 1.2, `beep duration ${duration}s`);
assert.ok(tone.byteLength < 150_000, 'one short local audio asset');
console.log('Rest timer beep, notification arbitration, asset, and audio isolation tests passed.');
