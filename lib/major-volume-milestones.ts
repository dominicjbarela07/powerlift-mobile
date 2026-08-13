export const MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB = [
  100_000,
  250_000,
  500_000,
  1_000_000,
  2_000_000,
  5_000_000,
  10_000_000,
] as const;

export type MajorVolumeMedallionThresholdLb =
  (typeof MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB)[number];
export type MajorVolumeMedallionFamily = 'total' | 'squat' | 'bench' | 'deadlift';

export function isMajorVolumeMedallionThresholdLb(
  thresholdLb: number,
): thresholdLb is MajorVolumeMedallionThresholdLb {
  return MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB.some((threshold) => threshold === thresholdLb);
}
