export const REST_TIMER_ANTICIPATION_START_SECONDS = 10;
export const REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS = 3;

/** Preserve the established visual focus window without any countdown audio. */
export function shouldPromoteRestTimer(active: boolean, remainingSeconds: number) {
  return active && remainingSeconds > 0
    && remainingSeconds <= REST_TIMER_ANTICIPATION_START_SECONDS;
}
