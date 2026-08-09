export type RestTimerCueConfig = {
  promoteAtSeconds: number;
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  shortToneSeconds: readonly number[];
  finishToneSecond: number;
  lightHapticSeconds: readonly number[];
  strongHapticSecond: number;
  successHapticSecond: number;
};

export const REST_TIMER_ANTICIPATION_START_SECONDS = 10;
export const REST_TIMER_DRAMATIC_COUNTDOWN_START_SECONDS = 3;

export const DEFAULT_REST_TIMER_CUE_CONFIG: RestTimerCueConfig = {
  promoteAtSeconds: REST_TIMER_ANTICIPATION_START_SECONDS,
  audioEnabled: true,
  hapticsEnabled: true,
  shortToneSeconds: [3, 2, 1],
  finishToneSecond: 0,
  lightHapticSeconds: [3, 2, 1],
  strongHapticSecond: -1,
  successHapticSecond: 0,
};

export type RestTimerCue = {
  tone: 'short' | 'finish' | null;
  haptic: 'light' | 'strong' | 'success' | null;
};

export function shouldPromoteRestTimer(
  active: boolean,
  remainingSeconds: number,
  config: RestTimerCueConfig = DEFAULT_REST_TIMER_CUE_CONFIG,
) {
  return active && remainingSeconds > 0 && remainingSeconds <= config.promoteAtSeconds;
}

export function cueForRestTimerSecond(
  remainingSeconds: number,
  config: RestTimerCueConfig = DEFAULT_REST_TIMER_CUE_CONFIG,
): RestTimerCue {
  const tone = !config.audioEnabled
    ? null
    : config.shortToneSeconds.includes(remainingSeconds)
      ? 'short'
      : remainingSeconds === config.finishToneSecond
        ? 'finish'
        : null;
  const haptic = !config.hapticsEnabled
    ? null
    : config.lightHapticSeconds.includes(remainingSeconds)
      ? 'light'
      : remainingSeconds === config.strongHapticSecond
        ? 'strong'
        : remainingSeconds === config.successHapticSecond
          ? 'success'
          : null;
  return { tone, haptic };
}
