import assert from 'node:assert/strict';
import fs from 'node:fs';

import { movementScrollTarget } from '../lib/movement-transition.ts';

const screen = fs.readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
const stage5 = fs.readFileSync(new URL('../components/workout-logger/stage5-impact-summary.tsx', import.meta.url), 'utf8');
const feedback = fs.readFileSync(new URL('../lib/logger-feedback.ts', import.meta.url), 'utf8');

assert.equal(movementScrollTarget({
  cardTop: 320,
  cardHeight: 280,
  scrollY: 200,
  viewportHeight: 700,
  contentHeight: 1800,
}), null, 'a fully visible next movement must not cause scrolling');

assert.equal(movementScrollTarget({
  cardTop: 760,
  cardHeight: 300,
  scrollY: 200,
  viewportHeight: 700,
  contentHeight: 1800,
}), 560, 'a partially visible next movement should be centered');

assert.equal(movementScrollTarget({
  cardTop: 1500,
  cardHeight: 300,
  scrollY: 100,
  viewportHeight: 700,
  contentHeight: 1800,
}), 1100, 'off-screen movement focus must clamp to the available bottom range');

assert.equal(movementScrollTarget({
  cardTop: 500,
  cardHeight: 900,
  scrollY: 0,
  viewportHeight: 700,
  contentHeight: 1800,
}), 476, 'an oversized expanded movement should align its top with comfortable breathing room');

assert.match(screen, /markAutoAdvanceAfterLog\(itemId\)[\s\S]*await fetchWorkout\(\)/, 'accepted sets must refresh canonical completion before advancing');
assert.match(screen, /fromRow\?\.complete[\s\S]*configureNextMovementLayoutTransition\(\)[\s\S]*collapseMovementCard\(fromRow\.key\)[\s\S]*openMovementCard\(nextRow\.key\)[\s\S]*scheduleMovementFocus\(nextRow\.key\)/s, 'the completed movement must collapse while the next movement opens and receives focus');
assert.match(screen, /movementScrollTarget\([\s\S]*scrollTo\(\{ y: targetY, animated: !reduceMotion \}\)/s, 'movement focus must use bounded conditional scrolling');
assert.match(screen, /onLayout=\{\(event\) => \{[\s\S]*scrollViewportHeightRef\.current/s, 'the logger must track the visible scroll viewport');
assert.match(screen, /onContentSizeChange=\{\(_width, height\) => \{[\s\S]*scrollContentHeightRef\.current/s, 'the logger must track scrollable content bounds');
assert.doesNotMatch(screen, /MovementCompletionSurface|DISPLAY_MOVEMENT_COMPLETION|CONSUME_MOVEMENT_COMPLETION|movement_completion_displayed/, 'the workout logger must not mount or manage a Movement Complete banner');
assert.doesNotMatch(stage5, /MovementCompletionSurface|Movement complete|Dismiss movement summary/, 'the standalone banner component must be removed');
assert.doesNotMatch(feedback, /MovementCompletionSummary|movementCompletion|DISPLAY_MOVEMENT_COMPLETION|CONSUME_MOVEMENT_COMPLETION/, 'feedback state must not retain a hidden Movement Complete queue');

console.log('[movement-transition] collapse, next-focus, conditional scroll, and banner removal checks passed');
