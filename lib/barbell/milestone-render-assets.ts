import type { ImageSourcePropType } from 'react-native';

export type PlateClubLiftKey = 'squat' | 'bench' | 'deadlift';

type MilestoneRenderRegistry = Record<PlateClubLiftKey, Record<number, ImageSourcePropType>>;

export const MILESTONE_RENDER_MATERIAL_VERSION = 'plate-club-material-v2' as const;

/**
 * The approved renderer captures are authored inverted on the vertical axis.
 * Every product surface must apply this shared presentation correction instead
 * of rendering the raw PNG orientation.
 */
export const MILESTONE_RENDER_ORIENTATION_STYLE = {
  transform: [{ scaleY: -1 }],
};

/**
 * Logger hero composition faces the approved render inward while preserving
 * the renderer's canonical vertical correction.
 */
export const INWARD_FACING_MILESTONE_RENDER_ORIENTATION_STYLE = {
  transform: [{ scaleX: -1 }, { scaleY: -1 }],
};

/**
 * Lossless captures of the approved milestone GLB renderer at its native
 * 94 x 60 point window on a 3x display. Keys are canonical supported total
 * pounds after the existing unit-boundary conversion.
 */
export const MILESTONE_RENDER_ASSETS: MilestoneRenderRegistry = {
  squat: {
    95: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-95.png'),
    110: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-110.png'),
    135: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-135.png'),
    185: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-185.png'),
    220: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-220.png'),
    225: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-225.png'),
    275: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-275.png'),
    315: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-315.png'),
    330: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-330.png'),
    365: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-365.png'),
    405: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-405.png'),
    440: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-440.png'),
    455: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-455.png'),
    495: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-495.png'),
    545: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-545.png'),
    550: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-550.png'),
    585: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-585.png'),
    635: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-635.png'),
    660: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-660.png'),
    675: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-675.png'),
    725: require('../../assets/images/milestone-renders/plate-club-material-v2/squat-725.png'),
  },
  bench: {
    90: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-90.png'),
    95: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-95.png'),
    130: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-130.png'),
    135: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-135.png'),
    175: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-175.png'),
    185: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-185.png'),
    220: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-220.png'),
    225: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-225.png'),
    265: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-265.png'),
    275: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-275.png'),
    310: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-310.png'),
    315: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-315.png'),
    355: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-355.png'),
    365: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-365.png'),
    395: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-395.png'),
    405: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-405.png'),
    440: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-440.png'),
    455: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-455.png'),
    495: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-495.png'),
    545: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-545.png'),
    585: require('../../assets/images/milestone-renders/plate-club-material-v2/bench-585.png'),
  },
  deadlift: {
    95: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-95.png'),
    135: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-135.png'),
    185: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-185.png'),
    220: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-220.png'),
    225: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-225.png'),
    275: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-275.png'),
    315: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-315.png'),
    330: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-330.png'),
    365: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-365.png'),
    405: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-405.png'),
    440: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-440.png'),
    455: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-455.png'),
    495: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-495.png'),
    545: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-545.png'),
    550: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-550.png'),
    585: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-585.png'),
    635: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-635.png'),
    660: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-660.png'),
    675: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-675.png'),
    725: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-725.png'),
    765: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-765.png'),
    770: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-770.png'),
    815: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-815.png'),
    855: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-855.png'),
    880: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-880.png'),
    895: require('../../assets/images/milestone-renders/plate-club-material-v2/deadlift-895.png'),
  },
};

export function resolveMilestoneRenderAsset(
  lift: PlateClubLiftKey,
  totalWeightLb: number,
): ImageSourcePropType | undefined {
  return MILESTONE_RENDER_ASSETS[lift][totalWeightLb];
}

export function milestoneRenderAsset(lift: PlateClubLiftKey, totalWeightLb: number): ImageSourcePropType {
  const asset = resolveMilestoneRenderAsset(lift, totalWeightLb);
  if (!asset) throw new Error(`Missing ${lift} milestone render asset for ${totalWeightLb} lb`);
  return asset;
}
