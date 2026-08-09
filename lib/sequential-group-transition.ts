export type SequentialGroupTransitionDirection = 'forward' | 'backward';

export const SEQUENTIAL_GROUP_STEP_TRANSITION_MS = 250;
export const SEQUENTIAL_GROUP_REDUCED_MOTION_TRANSITION_MS = 220;

export type SequentialGroupTransitionConfig = Readonly<{
  outgoingDurationMs: number;
  incomingDurationMs: number;
  outgoingTranslateX: number;
  incomingTranslateX: number;
  usesHorizontalMotion: boolean;
}>;

export function sequentialGroupTransitionConfig(
  direction: SequentialGroupTransitionDirection,
  reduceMotion: boolean,
): SequentialGroupTransitionConfig {
  if (reduceMotion) {
    return Object.freeze({
      outgoingDurationMs: 90,
      incomingDurationMs: 130,
      outgoingTranslateX: 0,
      incomingTranslateX: 0,
      usesHorizontalMotion: false,
    });
  }

  const movingForward = direction === 'forward';
  return Object.freeze({
    outgoingDurationMs: 100,
    incomingDurationMs: 150,
    outgoingTranslateX: movingForward ? -18 : 18,
    incomingTranslateX: movingForward ? 22 : -22,
    usesHorizontalMotion: true,
  });
}
