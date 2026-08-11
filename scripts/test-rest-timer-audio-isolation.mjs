import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  REST_TIMER_AUDIO_SEQUENCE_TAIL_MS,
  REST_TIMER_AUDIO_WINDOW_START_SECOND,
  RestTimerCountdownAudioWindow,
} from '../lib/rest-timer-countdown-audio.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const route = read('app/(tabs)/workout/[workoutId].tsx');
const appLayout = read('app/_layout.tsx');

function createHarness(overrides = {}) {
  const players = [];
  const scheduled = [];
  const errors = [];
  let createCount = 0;

  const controller = new RestTimerCountdownAudioWindow({
    createPlayer: () => {
      createCount += 1;
      if (overrides.createError) throw overrides.createError;
      const player = {
        volume: 0,
        playCount: 0,
        pauseCount: 0,
        releaseCount: 0,
        seekOffsets: [],
        play() {
          this.playCount += 1;
          if (overrides.playError) throw overrides.playError;
        },
        pause() {
          this.pauseCount += 1;
        },
        async seekTo(seconds) {
          this.seekOffsets.push(seconds);
          if (overrides.seekError) throw overrides.seekError;
        },
        release() {
          this.releaseCount += 1;
        },
      };
      players.push(player);
      return player;
    },
    onError: (error) => errors.push(error),
    schedule: (callback, delayMs) => {
      const handle = { callback, delayMs, cancelled: false };
      scheduled.push(handle);
      return handle;
    },
    cancelScheduled: (handle) => {
      handle.cancelled = true;
    },
  });

  return {
    controller,
    players,
    scheduled,
    errors,
    get createCount() {
      return createCount;
    },
  };
}

const normal = createHarness();
assert.equal(normal.createCount, 0, 'constructing the JS controller must not create a native player');
assert.equal(normal.controller.startAt(60), false);
assert.equal(normal.controller.startAt(4), false);
assert.equal(normal.createCount, 0, 'idle and pre-countdown states must perform zero native audio work');
assert.equal(normal.controller.startAt(3), true);
assert.equal(normal.createCount, 1);
assert.equal(normal.players[0].playCount, 1);
assert.equal(normal.players[0].volume, 0.78);
assert.equal(normal.scheduled[0].delayMs, 3_000 + REST_TIMER_AUDIO_SEQUENCE_TAIL_MS);
assert.equal(normal.controller.startAt(2), false);
assert.equal(normal.controller.startAt(1), false);
assert.equal(normal.controller.startAt(0), false);
assert.equal(normal.createCount, 1, 'one countdown must use exactly one native player');
normal.scheduled[0].callback();
assert.equal(normal.players[0].pauseCount, 1);
assert.equal(normal.players[0].releaseCount, 1);

normal.controller.reset();
assert.equal(normal.controller.startAt(3), true, 'a later timer must be allowed to start a fresh sequence');
assert.equal(normal.createCount, 2);
normal.controller.reset();
assert.equal(normal.players[1].releaseCount, 1);

const late = createHarness();
assert.equal(late.controller.startAt(1), true);
await Promise.resolve();
assert.deepEqual(late.players[0].seekOffsets, [2]);
assert.equal(late.players[0].playCount, 1);
assert.equal(late.scheduled[0].delayMs, 1_000 + REST_TIMER_AUDIO_SEQUENCE_TAIL_MS);
late.controller.dispose();
assert.equal(late.players[0].releaseCount, 1, 'navigation cleanup must release the local player');

const createFailure = createHarness({ createError: new Error('create failed') });
assert.doesNotThrow(() => createFailure.controller.startAt(3));
assert.equal(createFailure.errors.length, 1);

const playFailure = createHarness({ playError: new Error('play failed') });
assert.doesNotThrow(() => playFailure.controller.startAt(3));
assert.equal(playFailure.errors.length, 1);
assert.equal(playFailure.players[0].releaseCount, 1);

const seekFailure = createHarness({ seekError: new Error('seek failed') });
assert.equal(seekFailure.controller.startAt(2), true);
await Promise.resolve();
await Promise.resolve();
assert.equal(seekFailure.errors.length, 1);
assert.equal(seekFailure.players[0].releaseCount, 1);

assert.equal(REST_TIMER_AUDIO_WINDOW_START_SECOND, 3);
assert.match(route, /import \{ createAudioPlayer \} from 'expo-audio'/);
assert.match(route, /rest-countdown-sequence\.wav/);
assert.match(route, /keepAudioSessionActive: false/);
assert.doesNotMatch(route, /useAudioPlayer|setAudioModeAsync|setIsAudioActiveAsync/);
assert.match(route, /const startRestTimer = \(seconds: number\) => \{[\s\S]*restCountdownAudioRef\.current\?\.reset\(\)/);
assert.match(route, /const stopRestTimer = \(\) => \{[\s\S]*restCountdownAudioRef\.current\?\.reset\(\)/);
assert.match(route, /restCountdownAudioRef\.current\?\.dispose\(\)/);
assert.match(route, /remaining <= 0[\s\S]*setRestActive\(false\)/);
assert.doesNotMatch(appLayout, /RestTimerProvider|RestTimerContext|rest-timer-runtime/);
assert.equal(fs.existsSync(path.join(root, 'context/RestTimerContext.tsx')), false);
assert.equal(fs.existsSync(path.join(root, 'lib/rest-timer-runtime.ts')), false);

const audioFactoryBody = route.slice(
  route.indexOf('const startRestCountdownAudio'),
  route.indexOf('const deliverRestTimerCue'),
);
assert.match(audioFactoryBody, /if \(!restCountdownAudioRef\.current\)/);
assert.match(audioFactoryBody, /new RestTimerCountdownAudioWindow/);
assert.match(audioFactoryBody, /createAudioPlayer/);

const sequence = fs.readFileSync(path.join(root, 'assets/audio/rest-countdown-sequence.wav'));
assert.equal(sequence.subarray(0, 4).toString(), 'RIFF');
assert.equal(sequence.subarray(8, 12).toString(), 'WAVE');
assert.equal(sequence.readUInt32LE(24), 44_100);
assert.equal(sequence.readUInt16LE(22), 1);
assert.equal(sequence.readUInt16LE(34), 16);

function peakNear(second, radiusSeconds = 0.08) {
  const sampleRate = sequence.readUInt32LE(24);
  const start = Math.max(0, Math.floor((second - radiusSeconds) * sampleRate));
  const end = Math.min(
    sequence.readUInt32LE(40) / 2,
    Math.ceil((second + radiusSeconds) * sampleRate),
  );
  let peak = 0;
  for (let sample = start; sample < end; sample += 1) {
    peak = Math.max(peak, Math.abs(sequence.readInt16LE(44 + sample * 2)));
  }
  return peak;
}

for (const second of [0.03, 1.03, 2.03, 3.03]) {
  assert.ok(peakNear(second) > 2_000, `expected audible cue near ${second}s`);
}
for (const second of [0.5, 1.5, 2.5]) {
  assert.equal(peakNear(second), 0, `expected silence between cues near ${second}s`);
}

console.log('Isolated rest-timer countdown audio tests passed.');
