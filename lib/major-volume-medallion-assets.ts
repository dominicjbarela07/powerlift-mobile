import type { ImageSourcePropType } from 'react-native';
import { MAJOR_VOLUME_MEDALLION_KG_ASSETS } from './major-volume-medallion-kg-atlases';
export { MAJOR_VOLUME_MEDALLION_KG_ASSETS } from './major-volume-medallion-kg-atlases';

export type MajorVolumeMedallionImageSource = {
  source: ImageSourcePropType; columns: number; rows: number; column: number; row: number;
};
import { isMajorVolumeMedallionThresholdLb, type MajorVolumeMedallionFamily } from '@/lib/major-volume-milestones';

export {
  MAJOR_VOLUME_MEDALLION_THRESHOLDS_LB,
  isMajorVolumeMedallionThresholdLb,
  type MajorVolumeMedallionFamily,
  type MajorVolumeMedallionThresholdLb,
} from '@/lib/major-volume-milestones';

type MajorVolumeMedallionRegistry = Record<MajorVolumeMedallionFamily, Record<number, ImageSourcePropType>>;

/** Original LB artwork. KG owns separate round markers and lossless image tiles. */
export const MAJOR_VOLUME_MEDALLION_ASSETS: MajorVolumeMedallionRegistry = {
  total: {
    100_000: require('@/assets/images/major-volume-medallions/total/total-100k.png'),
    250_000: require('@/assets/images/major-volume-medallions/total/total-250k.png'),
    500_000: require('@/assets/images/major-volume-medallions/total/total-500k.png'),
    1_000_000: require('@/assets/images/major-volume-medallions/total/total-1m.png'),
    2_000_000: require('@/assets/images/major-volume-medallions/total/total-2m.png'),
    5_000_000: require('@/assets/images/major-volume-medallions/total/total-5m.png'),
    10_000_000: require('@/assets/images/major-volume-medallions/total/total-10m.png'),
    25_000_000: require('@/assets/images/major-volume-medallions/total/total-25m.png'),
    50_000_000: require('@/assets/images/major-volume-medallions/total/total-50m.png'),
    75_000_000: require('@/assets/images/major-volume-medallions/total/total-75m.png'),
    100_000_000: require('@/assets/images/major-volume-medallions/total/total-100m.png'),
    150_000_000: require('@/assets/images/major-volume-medallions/total/total-150m.png'),
    250_000_000: require('@/assets/images/major-volume-medallions/total/total-250m.png'),
    500_000_000: require('@/assets/images/major-volume-medallions/total/total-500m.png'),
    750_000_000: require('@/assets/images/major-volume-medallions/total/total-750m.png'),
    1_000_000_000: require('@/assets/images/major-volume-medallions/total/total-1b.png'),
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
  unit: 'lb' | 'kg' = 'lb',
): MajorVolumeMedallionImageSource {
  const asset = unit === 'kg' ? MAJOR_VOLUME_MEDALLION_KG_ASSETS[family]?.[thresholdLb]
    : MAJOR_VOLUME_MEDALLION_ASSETS[family]?.[thresholdLb];
  if (!isMajorVolumeMedallionThresholdLb(thresholdLb, family) || !asset) {
    throw new Error(`No canonical ${family} major-volume medallion exists for ${thresholdLb} ${unit}`);
  }
  return unit === 'kg' ? asset as MajorVolumeMedallionImageSource
    : { source: asset as ImageSourcePropType, columns: 1, rows: 1, column: 0, row: 0 };
}
