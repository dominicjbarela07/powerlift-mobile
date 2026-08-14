import type { ImageSourcePropType } from 'react-native';

export type LedgerIndexChapterVisualKey =
  | 'journey'
  | 'strength'
  | 'achievements'
  | 'accessories'
  | 'variants'
  | 'archive';

/**
 * Governed, decorative Ledger Index artwork.
 *
 * These images establish domain identity only. They must never be described as
 * athlete evidence, and they intentionally contain no generated people.
 */
export const LEDGER_INDEX_ASSETS = Object.freeze({
  hero: require('../assets/images/ledger-index-v2/ledger-hero-plate-v1.png') as ImageSourcePropType,
  chapter: Object.freeze({
    journey: require('../assets/images/ledger-index-v2/ledger-chapter-journey-v1.png') as ImageSourcePropType,
    strength: require('../assets/images/plate-stack-catalog/blender-cycles-catalog-v1/lb/455.png') as ImageSourcePropType,
    achievements: require('../assets/images/total-tier-gold-cutout.png') as ImageSourcePropType,
    accessories: require('../assets/images/ledger-index-v2/ledger-chapter-accessories-v1.png') as ImageSourcePropType,
    variants: require('../assets/images/ledger-index-v2/ledger-chapter-variants-v1.png') as ImageSourcePropType,
    archive: require('../assets/images/ledger-index-v2/ledger-chapter-archive-v1.png') as ImageSourcePropType,
  } satisfies Readonly<Record<LedgerIndexChapterVisualKey, ImageSourcePropType>>),
  muscleGroups: require('../assets/images/muscle-regions/full-body.png') as ImageSourcePropType,
  record: require('../assets/images/st_ledger_icon.png') as ImageSourcePropType,
  prMedallion: require('../assets/images/plate-stack-catalog/blender-cycles-catalog-v1/lb/135.png') as ImageSourcePropType,
  fallbackPlate: require('../assets/images/plate-stack-catalog/blender-cycles-catalog-v1/lb/45.png') as ImageSourcePropType,
});

export function ledgerIndexChapterAsset(key: LedgerIndexChapterVisualKey): ImageSourcePropType {
  return LEDGER_INDEX_ASSETS.chapter[key];
}
