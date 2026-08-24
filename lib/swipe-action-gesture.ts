export const SWIPE_ACTION_WIDTH = 104;
export const SWIPE_MAX_DRAG = 148;
export const SWIPE_ACTIVATION_DISTANCE = 12;
export const SWIPE_VERTICAL_FAILURE_DISTANCE = 14;
export const SWIPE_REVEAL_DISTANCE = 46;
export const SWIPE_COMMIT_DISTANCE = 132;
export const SWIPE_REVEAL_VELOCITY = -560;
export const SWIPE_COMMIT_VELOCITY = -1350;
export const SWIPE_CLOSE_VELOCITY = 560;

export type SwipeReleaseResolution = 'close' | 'open' | 'commit';

export function clampSwipeTranslation(value: number): number {
  'worklet';
  return Math.max(-SWIPE_MAX_DRAG, Math.min(0, value));
}

export function resolveSwipeRelease(
  translateX: number,
  velocityX: number,
): SwipeReleaseResolution {
  'worklet';
  if (
    translateX <= -SWIPE_COMMIT_DISTANCE
    || (translateX <= -SWIPE_REVEAL_DISTANCE && velocityX <= SWIPE_COMMIT_VELOCITY)
  ) {
    return 'commit';
  }
  if (velocityX >= SWIPE_CLOSE_VELOCITY) return 'close';
  if (translateX <= -SWIPE_REVEAL_DISTANCE || velocityX <= SWIPE_REVEAL_VELOCITY) {
    return 'open';
  }
  return 'close';
}
