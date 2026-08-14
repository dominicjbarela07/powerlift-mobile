import type { ImageSourcePropType } from 'react-native';

export type LedgerIndexChapterVisualKey =
  | 'journey'
  | 'strength'
  | 'achievements'
  | 'accessories'
  | 'variants'
  | 'archive';

export type LedgerCoreLiftVisualKey = 'squat' | 'bench' | 'deadlift';

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
  record: require('../assets/images/iOS_icon.png') as ImageSourcePropType,
  careerSets: require('../assets/images/ledger-index-v2/ledger-career-sets-counter-v1.png') as ImageSourcePropType,
  careerPr: require('../assets/images/ledger-index-v2/ledger-career-pr-medallion-v1.png') as ImageSourcePropType,
  coreLift: Object.freeze({
    squat: require('../assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png') as ImageSourcePropType,
    bench: require('../assets/images/ledger-index-v2/ledger-core-bench-station-v1.png') as ImageSourcePropType,
    deadlift: require('../assets/images/ledger-index-v2/ledger-core-deadlift-platform-v1.png') as ImageSourcePropType,
  } satisfies Readonly<Record<LedgerCoreLiftVisualKey, ImageSourcePropType>>),
  latestEntryFallback: require('../assets/images/ledger-index-v2/ledger-chapter-accessories-v1.png') as ImageSourcePropType,
});

export function ledgerIndexChapterAsset(key: LedgerIndexChapterVisualKey): ImageSourcePropType {
  return LEDGER_INDEX_ASSETS.chapter[key];
}

/**
 * Core-lift cards resolve by governed movement family, never by load. A valid
 * Squat therefore cannot degrade into an empty-collar or generic plate image.
 */
export function ledgerCoreLiftAsset(key?: string | null): ImageSourcePropType | null {
  const normalized = String(key || '').toLowerCase();
  if (normalized.includes('squat')) return LEDGER_INDEX_ASSETS.coreLift.squat;
  if (normalized.includes('bench')) return LEDGER_INDEX_ASSETS.coreLift.bench;
  if (normalized.includes('deadlift')) return LEDGER_INDEX_ASSETS.coreLift.deadlift;
  return null;
}

export const LEDGER_INDEX_ASSET_GOVERNANCE = Object.freeze({
  career_sets_counter_v1: Object.freeze({
    purpose: 'Lifetime logged-work and completed-set accumulation',
    path: 'assets/images/ledger-index-v2/ledger-career-sets-counter-v1.png',
    dimensions: '600x600',
    transparency: true,
    family: 'ledger-index-career-artifacts-v1',
    resolverKey: 'careerSets',
    surfaces: ['Ledger Index · Career Snapshot'],
  }),
  career_pr_medallion_v1: Object.freeze({
    purpose: 'Personal-record and best-performance recognition',
    path: 'assets/images/ledger-index-v2/ledger-career-pr-medallion-v1.png',
    dimensions: '600x600',
    transparency: true,
    family: 'ledger-index-career-artifacts-v1',
    resolverKey: 'careerPr',
    surfaces: ['Ledger Index · Career Snapshot', 'Ledger Index · Recent PR hero'],
  }),
  core_lift_equipment_v1: Object.freeze({
    purpose: 'Distinct loaded equipment identity for Squat, Bench, and Deadlift',
    paths: [
      'assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png',
      'assets/images/ledger-index-v2/ledger-core-bench-station-v1.png',
      'assets/images/ledger-index-v2/ledger-core-deadlift-platform-v1.png',
    ],
    dimensions: '600x600 each',
    transparency: true,
    family: 'ledger-index-core-lift-equipment-v1',
    resolverKey: 'coreLift.{squat|bench|deadlift}',
    surfaces: ['Ledger Index · Core Lifts', 'Ledger Index · Recent PR hero'],
  }),
});
