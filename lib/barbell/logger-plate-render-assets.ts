import type { ImageSourcePropType, ImageStyle } from 'react-native';

import type { PlateClubLiftKey } from '@/lib/barbell/milestone-render-assets';

export const LOGGER_PLATE_RENDER_VERSION = 'plate-stack-studio-v1' as const;
export const LOGGER_PLATE_BLENDER_POC_VERSION = 'blender-cycles-poc-v1' as const;
export const LOGGER_PLATE_RENDER_OUTPUT_PROFILE = 'mobile-hero-240x160@3x' as const;

export const LOGGER_PLATE_RENDER_ORIENTATION_STYLE = {
  transform: [{ scaleX: -1 }],
};

export type LoggerPlateRenderAsset = {
  imageSource: ImageSourcePropType;
  artifactPath: string;
  width: 720;
  height: 480;
  source: 'canonical-glb-studio-v1' | 'canonical-blender-cycles-poc-v1';
  presentationStyle?: ImageStyle;
};

type LoggerPlateRenderRegistry = Record<PlateClubLiftKey, Record<number, LoggerPlateRenderAsset>>;

const artifact = (
  lift: PlateClubLiftKey,
  totalWeightLb: number,
  imageSource: ImageSourcePropType,
): LoggerPlateRenderAsset => ({
  imageSource,
  artifactPath: `logger-renders/${LOGGER_PLATE_RENDER_VERSION}/${LOGGER_PLATE_RENDER_OUTPUT_PROFILE}/${lift}/${totalWeightLb}.png`,
  width: 720,
  height: 480,
  source: 'canonical-glb-studio-v1',
  presentationStyle: LOGGER_PLATE_RENDER_ORIENTATION_STYLE,
});

const LOGGER_PLATE_RENDER_ASSETS: LoggerPlateRenderRegistry = {
  squat: {
    95: artifact('squat', 95, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/95.png')),
    110: artifact('squat', 110, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/110.png')),
    135: artifact('squat', 135, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/135.png')),
    185: artifact('squat', 185, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/185.png')),
    220: artifact('squat', 220, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/220.png')),
    225: artifact('squat', 225, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/225.png')),
    275: artifact('squat', 275, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/275.png')),
    315: artifact('squat', 315, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/315.png')),
    330: artifact('squat', 330, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/330.png')),
    365: artifact('squat', 365, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/365.png')),
    405: {
      imageSource: require('../../assets/images/logger-renders/blender-cycles-poc-v1/mobile-hero-240x160@3x/squat/405.png'),
      artifactPath: 'logger-renders/blender-cycles-poc-v1/mobile-hero-240x160@3x/squat/405.png',
      width: 720,
      height: 480,
      source: 'canonical-blender-cycles-poc-v1',
    },
    440: artifact('squat', 440, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/440.png')),
    455: artifact('squat', 455, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/455.png')),
    495: artifact('squat', 495, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/495.png')),
    545: artifact('squat', 545, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/545.png')),
    550: artifact('squat', 550, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/550.png')),
    585: artifact('squat', 585, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/585.png')),
    635: artifact('squat', 635, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/635.png')),
    660: artifact('squat', 660, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/660.png')),
    675: artifact('squat', 675, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/675.png')),
    725: artifact('squat', 725, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/squat/725.png')),
  },
  bench: {
    90: artifact('bench', 90, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/90.png')),
    95: artifact('bench', 95, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/95.png')),
    130: artifact('bench', 130, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/130.png')),
    135: artifact('bench', 135, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/135.png')),
    175: artifact('bench', 175, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/175.png')),
    185: artifact('bench', 185, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/185.png')),
    220: artifact('bench', 220, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/220.png')),
    225: artifact('bench', 225, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/225.png')),
    265: artifact('bench', 265, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/265.png')),
    275: artifact('bench', 275, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/275.png')),
    310: artifact('bench', 310, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/310.png')),
    315: artifact('bench', 315, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/315.png')),
    355: artifact('bench', 355, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/355.png')),
    365: artifact('bench', 365, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/365.png')),
    395: artifact('bench', 395, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/395.png')),
    405: artifact('bench', 405, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/405.png')),
    440: artifact('bench', 440, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/440.png')),
    455: artifact('bench', 455, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/455.png')),
    495: artifact('bench', 495, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/495.png')),
    545: artifact('bench', 545, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/545.png')),
    585: artifact('bench', 585, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/bench/585.png')),
  },
  deadlift: {
    95: artifact('deadlift', 95, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/95.png')),
    135: artifact('deadlift', 135, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/135.png')),
    185: artifact('deadlift', 185, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/185.png')),
    220: artifact('deadlift', 220, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/220.png')),
    225: artifact('deadlift', 225, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/225.png')),
    275: artifact('deadlift', 275, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/275.png')),
    315: artifact('deadlift', 315, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/315.png')),
    330: artifact('deadlift', 330, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/330.png')),
    365: artifact('deadlift', 365, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/365.png')),
    405: artifact('deadlift', 405, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/405.png')),
    440: artifact('deadlift', 440, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/440.png')),
    455: artifact('deadlift', 455, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/455.png')),
    495: artifact('deadlift', 495, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/495.png')),
    545: artifact('deadlift', 545, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/545.png')),
    550: artifact('deadlift', 550, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/550.png')),
    585: artifact('deadlift', 585, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/585.png')),
    635: artifact('deadlift', 635, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/635.png')),
    660: artifact('deadlift', 660, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/660.png')),
    675: artifact('deadlift', 675, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/675.png')),
    725: artifact('deadlift', 725, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/725.png')),
    765: artifact('deadlift', 765, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/765.png')),
    770: artifact('deadlift', 770, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/770.png')),
    815: artifact('deadlift', 815, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/815.png')),
    855: artifact('deadlift', 855, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/855.png')),
    880: artifact('deadlift', 880, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/880.png')),
    895: artifact('deadlift', 895, require('../../assets/images/logger-renders/plate-stack-studio-v1/mobile-hero-240x160@3x/deadlift/895.png')),
  },
};

export function resolveLoggerPlateRenderAsset(
  lift: PlateClubLiftKey,
  totalWeightLb: number,
): LoggerPlateRenderAsset | undefined {
  return LOGGER_PLATE_RENDER_ASSETS[lift][totalWeightLb];
}
