import { VOLUME_ACHIEVEMENT_THRESHOLDS_LB, volumeMilestonesForContext } from './volume-achievements';

// Both units use round markers. Each unit owns independent earned events;
// switching the visible unit never creates or converts an award.
export const MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB = VOLUME_ACHIEVEMENT_THRESHOLDS_LB;

export type MajorVolumeMedallionThresholdLb =
  (typeof MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB)[number];
export type MajorVolumeMedallionFamily = 'total' | 'squat' | 'bench' | 'deadlift';

export function majorVolumeThresholdsForFamily(family: MajorVolumeMedallionFamily = 'total'): readonly number[] {
  return volumeMilestonesForContext(family).map((landmark) => landmark.thresholdLb);
}

export function isMajorVolumeMedallionThresholdLb(
  thresholdLb: number,
  family: MajorVolumeMedallionFamily = 'total',
): thresholdLb is MajorVolumeMedallionThresholdLb {
  return majorVolumeThresholdsForFamily(family).some((threshold) => threshold === thresholdLb);
}

/** Keep the recognition ceremony readable while centering its earned landmark. */
export function majorVolumeMedallionRail(thresholdLb: number, family: MajorVolumeMedallionFamily): readonly number[] {
  const thresholds = majorVolumeThresholdsForFamily(family);
  const index = Math.max(0, thresholds.indexOf(thresholdLb));
  const start = Math.max(0, Math.min(index - 3, thresholds.length - 7));
  return thresholds.slice(start, start + 7);
}
