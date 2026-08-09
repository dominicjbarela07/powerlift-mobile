import * as Haptics from 'expo-haptics';

import { acceptedSetHapticKind, safelyRunHaptic, type LoggerRecognitionEvent } from './logger-feedback';

export async function triggerAcceptedSetHaptic(events: LoggerRecognitionEvent[]) {
  const kind = acceptedSetHapticKind(events);
  if (kind === 'career') {
    await safelyRunHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    return 'career';
  }
  if (kind === 'block') {
    await safelyRunHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    return 'block';
  }
  await safelyRunHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  return kind;
}

export async function triggerSubmissionFailureHaptic() {
  return safelyRunHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export async function triggerSessionCompletionHaptic() {
  return safelyRunHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export async function triggerMajorVolumeMilestoneHaptic() {
  return safelyRunHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}
