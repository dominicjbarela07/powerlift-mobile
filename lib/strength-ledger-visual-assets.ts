import type { ImageSourcePropType } from 'react-native';

export type StrengthLiftVisualKey = 'squat' | 'bench' | 'deadlift';
export type StrengthLiftVisualDestination =
  | 'context-header'
  | 'overview-card'
  | 'selector-card'
  | 'achievement-card'
  | 'detail-hero'
  | 'tier-progression'
  | 'picker';

type DestinationAsset = Readonly<{
  source: ImageSourcePropType;
  fit: 'contain';
  semanticSubject: 'rack-loaded-bar' | 'bench-rack-loaded-bar' | 'floor-bar-platform';
}>;

const SUBJECTS = {
  squat: 'rack-loaded-bar',
  bench: 'bench-rack-loaded-bar',
  deadlift: 'floor-bar-platform',
} as const;

const CUTOUTS: Readonly<Record<StrengthLiftVisualKey, ImageSourcePropType>> = Object.freeze({
  squat: require('../assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png') as ImageSourcePropType,
  bench: require('../assets/images/ledger-index-v2/ledger-core-bench-station-v1.png') as ImageSourcePropType,
  deadlift: require('../assets/images/ledger-index-v2/ledger-core-deadlift-platform-v1.png') as ImageSourcePropType,
});

const DESTINATIONS: readonly StrengthLiftVisualDestination[] = [
  'context-header',
  'overview-card',
  'selector-card',
  'achievement-card',
  'detail-hero',
  'tier-progression',
  'picker',
];

export const STRENGTH_LIFT_DESTINATION_ASSETS = Object.freeze(
  Object.fromEntries((Object.keys(CUTOUTS) as StrengthLiftVisualKey[]).map((lift) => [
    lift,
    Object.freeze(Object.fromEntries(DESTINATIONS.map((destination) => [destination, Object.freeze({
      source: CUTOUTS[lift],
      fit: 'contain' as const,
      semanticSubject: SUBJECTS[lift],
    })])) as Record<StrengthLiftVisualDestination, DestinationAsset>),
  ])) as Record<StrengthLiftVisualKey, Readonly<Record<StrengthLiftVisualDestination, DestinationAsset>>>,
);

export const STRENGTH_LEDGER_ATMOSPHERE_ASSETS = Object.freeze({
  strength: require('../assets/images/ledger-atmosphere-v1/strength-header-v1.png') as ImageSourcePropType,
  achievements: require('../assets/images/ledger-atmosphere-v1/achievements-header-v1.png') as ImageSourcePropType,
});

export function strengthLiftDestinationAsset(
  lift: StrengthLiftVisualKey,
  destination: StrengthLiftVisualDestination,
): DestinationAsset {
  return STRENGTH_LIFT_DESTINATION_ASSETS[lift][destination];
}

export const STRENGTH_VISUAL_ASSET_GOVERNANCE = Object.freeze({
  destinationRule: 'Semantic strength artwork is composed for its destination and is never cover-cropped.',
  navigationRule: 'Contextual navigation is part of the page identity and is never a generic subheader widget.',
  atmosphere: Object.freeze({
    strength: Object.freeze({
      path: 'assets/images/ledger-atmosphere-v1/strength-header-v1.png',
      purpose: 'Non-semantic loaded-iron atmosphere with protected title space',
      generatedWith: 'OpenAI built-in image generation',
    }),
    achievements: Object.freeze({
      path: 'assets/images/ledger-atmosphere-v1/achievements-header-v1.png',
      purpose: 'Non-semantic metallic cabinet atmosphere with protected title space',
      generatedWith: 'OpenAI built-in image generation',
    }),
  }),
});
