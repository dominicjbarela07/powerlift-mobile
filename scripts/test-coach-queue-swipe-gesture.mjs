import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  clampSwipeTranslation,
  resolveSwipeRelease,
  SWIPE_ACTION_WIDTH,
  SWIPE_ACTIVATION_DISTANCE,
  SWIPE_VERTICAL_FAILURE_DISTANCE,
} from '../lib/swipe-action-gesture.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [home, primitive] = await Promise.all([
  read('components/coach-mobile/CoachActivityHome.tsx'),
  read('components/gestures/SwipeActionRow.tsx'),
]);

assert.equal(resolveSwipeRelease(-20, -100), 'close', 'short slow motion closes');
assert.equal(resolveSwipeRelease(-60, -200), 'open', 'deliberate slow swipe reveals the action');
assert.equal(resolveSwipeRelease(-48, -700), 'open', 'intentional flick reveals without a long drag');
assert.equal(resolveSwipeRelease(-140, -200), 'commit', 'full swipe commits the existing clear action');
assert.equal(resolveSwipeRelease(-60, -1500), 'commit', 'fast committed flick clears');
assert.equal(resolveSwipeRelease(-90, 700), 'close', 'rightward close intent wins');
assert.equal(clampSwipeTranslation(20), 0);
assert.ok(clampSwipeTranslation(-500) < -SWIPE_ACTION_WIDTH);

assert.equal(SWIPE_ACTIVATION_DISTANCE, 12);
assert.ok(SWIPE_VERTICAL_FAILURE_DISTANCE > SWIPE_ACTIVATION_DISTANCE);
assert.match(primitive, /Gesture\.Pan\(\)/);
assert.match(primitive, /\.minPointers\(1\)/);
assert.match(primitive, /\.maxPointers\(1\)/);
assert.match(primitive, /\.activeOffsetX\(\[-SWIPE_ACTIVATION_DISTANCE, SWIPE_ACTIVATION_DISTANCE\]\)/);
assert.match(primitive, /\.failOffsetY\(\[-SWIPE_VERTICAL_FAILURE_DISTANCE, SWIPE_VERTICAL_FAILURE_DISTANCE\]\)/);
assert.match(primitive, /\.cancelsTouchesInView\(true\)/);
assert.match(primitive, /useSharedValue/);
assert.match(primitive, /callbacksRef/);
assert.match(primitive, /onFinalize/);
assert.doesNotMatch(primitive, /PanResponder/);

assert.match(home, /key=\{activity\.key\}/);
assert.match(home, /isOpen=\{openQueueKey === activity\.key\}/);
assert.match(home, /onScrollBeginDrag=\{\(\) => setOpenQueueKey\(null\)\}/);
assert.match(home, /return \(\) => setOpenQueueKey\(null\)/);
assert.match(home, /<SwipeActionRow/);
assert.match(home, /accessibilityActions=\{\[\{ name: 'dismiss'/);
assert.doesNotMatch(home, /PanResponder\.create/);

console.log('Coaching Queue one-finger swipe arbitration checks passed.');
