import type { ImageSourcePropType } from 'react-native';
import {
  isMajorVolumeMedallionThresholdLb,
  type MajorVolumeMedallionFamily,
  type MajorVolumeMedallionThresholdLb,
} from '@/lib/major-volume-milestones';

export {
  MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB,
  isMajorVolumeMedallionThresholdLb,
  type MajorVolumeMedallionFamily,
  type MajorVolumeMedallionThresholdLb,
} from '@/lib/major-volume-milestones';

type MajorVolumeMedallionRegistry = Record<
  MajorVolumeMedallionFamily,
  Record<MajorVolumeMedallionThresholdLb, ImageSourcePropType>
>;

/**
 * Canonical, swappable milestone artwork.
 *
 * Each require is intentionally literal so Metro bundles the exact handcrafted
 * threshold asset. The engraved threshold and lift identity are part of the
 * artwork; the recognition surface must not reconstruct them with overlays.
 */
export const MAJOR_VOLUME_MEDALLION_ASSETS: MajorVolumeMedallionRegistry = {
  total: {
    100_000: require('@/assets/images/major-volume-medallions/total/total-100k.png'),
    250_000: require('@/assets/images/major-volume-medallions/total/total-250k.png'),
    500_000: require('@/assets/images/major-volume-medallions/total/total-500k.png'),
    1_000_000: require('@/assets/images/major-volume-medallions/total/total-1m.png'),
    2_000_000: require('@/assets/images/major-volume-medallions/total/total-2m.png'),
    5_000_000: require('@/assets/images/major-volume-medallions/total/total-5m.png'),
    10_000_000: require('@/assets/images/major-volume-medallions/total/total-10m.png'),
  },
  squat: {
    100_000: require('@/assets/images/major-volume-medallions/squat/squat-100k.png'),
    250_000: require('@/assets/images/major-volume-medallions/squat/squat-250k.png'),
    500_000: require('@/assets/images/major-volume-medallions/squat/squat-500k.png'),
    1_000_000: require('@/assets/images/major-volume-medallions/squat/squat-1m.png'),
    2_000_000: require('@/assets/images/major-volume-medallions/squat/squat-2m.png'),
    5_000_000: require('@/assets/images/major-volume-medallions/squat/squat-5m.png'),
    10_000_000: require('@/assets/images/major-volume-medallions/squat/squat-10m.png'),
  },
  bench: {
    100_000: require('@/assets/images/major-volume-medallions/bench/bench-100k.png'),
    250_000: require('@/assets/images/major-volume-medallions/bench/bench-250k.png'),
    500_000: require('@/assets/images/major-volume-medallions/bench/bench-500k.png'),
    1_000_000: require('@/assets/images/major-volume-medallions/bench/bench-1m.png'),
    2_000_000: require('@/assets/images/major-volume-medallions/bench/bench-2m.png'),
    5_000_000: require('@/assets/images/major-volume-medallions/bench/bench-5m.png'),
    10_000_000: require('@/assets/images/major-volume-medallions/bench/bench-10m.png'),
  },
  deadlift: {
    100_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-100k.png'),
    250_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-250k.png'),
    500_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-500k.png'),
    1_000_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-1m.png'),
    2_000_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-2m.png'),
    5_000_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-5m.png'),
    10_000_000: require('@/assets/images/major-volume-medallions/deadlift/deadlift-10m.png'),
  },
};

export function majorVolumeMedallionAsset(
  family: MajorVolumeMedallionFamily,
  thresholdLb: number,
): ImageSourcePropType {
  if (!isMajorVolumeMedallionThresholdLb(thresholdLb)) {
    throw new Error(`No canonical ${family} major-volume medallion exists for ${thresholdLb} lb`);
  }
  return MAJOR_VOLUME_MEDALLION_ASSETS[family][thresholdLb];
}
