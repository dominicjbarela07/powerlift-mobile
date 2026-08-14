import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_REST_TIMER_SECONDS,
  normalizeRestTimerSeconds,
  resolveRestTimerPickerInitialSeconds,
  restTimerPreferenceStorageKey,
} from '../lib/rest-timer-preference-core.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const workoutRoute = read('app/(tabs)/workout/[workoutId].tsx');
const preferenceStorage = read('lib/rest-timer-preference.ts');
const pickerModal = read('components/workout-logger/logger-modals.tsx');

assert.equal(DEFAULT_REST_TIMER_SECONDS, 120);
assert.equal(normalizeRestTimerSeconds(null), 120, 'first use must preserve the canonical default');
assert.equal(normalizeRestTimerSeconds(90), 90);
assert.equal(normalizeRestTimerSeconds(180), 180);
assert.equal(normalizeRestTimerSeconds(164), 150, 'unsupported remembered values resolve deterministically');
assert.equal(normalizeRestTimerSeconds(166), 180, 'nearest supported increment must win');

assert.equal(resolveRestTimerPickerInitialSeconds({}), 120);
assert.equal(resolveRestTimerPickerInitialSeconds({ lastUsedSeconds: 150 }), 150);
assert.equal(resolveRestTimerPickerInitialSeconds({ sessionSelectedSeconds: 180, lastUsedSeconds: 90 }), 180);
assert.equal(resolveRestTimerPickerInitialSeconds({ prescribedSeconds: 150, lastUsedSeconds: 90 }), 150);
assert.equal(
  resolveRestTimerPickerInitialSeconds({
    activeTimerSeconds: 77,
    sessionSelectedSeconds: 180,
    prescribedSeconds: 150,
    lastUsedSeconds: 90,
  }),
  90,
  'an active timer edit must resolve from the remaining timer value before historical preferences',
);

assert.notEqual(restTimerPreferenceStorageKey(41), restTimerPreferenceStorageKey(42));
assert.match(restTimerPreferenceStorageKey(41), /:user:41$/);
assert.equal(restTimerPreferenceStorageKey(null), null);

assert.match(preferenceStorage, /AsyncStorage\.getItem\(key\)/);
assert.match(preferenceStorage, /AsyncStorage\.setItem\(key, JSON\.stringify\(preference\)\)/);
assert.match(preferenceStorage, /parsed\.ownerUserId[\s\S]*normalizedOwnerUserId/);
assert.match(workoutRoute, /user\?\.id \?\? user\?\.user_id \?\? null/);
assert.match(workoutRoute, /restTimerPreferenceOwnerKeyRef\.current === ownerKey/);
assert.match(workoutRoute, /void loadScopedLastUsedRestTimer\(\)\.then\(presentPicker\)/);
assert.match(
  workoutRoute,
  /const presentPicker = \(lastUsedSeconds:[\s\S]*setTimerPickerValue\(initialSeconds\);[\s\S]*setTimerPickerVisible\(true\)/,
  'the initial selection must resolve before the modal becomes visible',
);
assert.match(workoutRoute, /activeTimerSeconds,[\s\S]*sessionSelectedSeconds:[\s\S]*lastUsedSeconds/);
assert.match(workoutRoute, /persistLastUsedRestTimerSeconds\([\s\S]*normalizedSeconds/);
assert.doesNotMatch(
  workoutRoute.slice(workoutRoute.indexOf('const openTimerPicker'), workoutRoute.indexOf('const startRestTimer')),
  /persistLastUsedRestTimerSeconds/,
  'opening or cancelling the picker must not rewrite the preference',
);
assert.match(workoutRoute, /startRestTimer=\{confirmRestTimerSelection\}/);
assert.match(pickerModal, /REST_TIMER_OPTIONS_SECONDS/);
assert.match(pickerModal, /contentOffset=\{\{[\s\S]*nearestRestTimerIndex\(timerPickerValue\)/);
assert.match(pickerModal, /animated: false/);

console.log('Rest timer last-used default and account-isolation tests passed.');
