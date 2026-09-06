import type { ImageSourcePropType } from 'react-native';

export const SL_TROPHY_TIERS = ['steel', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'obsidian'] as const;

export type SLTrophyTier = typeof SL_TROPHY_TIERS[number];

/**
 * The one canonical Strength Ledger trophy family.
 *
 * Keep every trophy surface pointed here so milestone, recognition, and
 * navigation treatments cannot drift into competing cup illustrations.
 */
export const SL_TROPHY_ASSETS: Record<SLTrophyTier, ImageSourcePropType> = {
  steel: require('@/assets/images/total-tier-steel-cutout.png'),
  bronze: require('@/assets/images/total-tier-bronze-cutout.png'),
  silver: require('@/assets/images/total-tier-silver-cutout.png'),
  gold: require('@/assets/images/total-tier-gold-cutout.png'),
  platinum: require('@/assets/images/total-tier-platinum-cutout.png'),
  diamond: require('@/assets/images/total-tier-diamond-cutout.png'),
  obsidian: require('@/assets/images/total-tier-obsidian.png'),
};

/**
 * Presentation art indexed by the governed Strength Tier number (I–VII).
 * The metal filenames are historical art-production details only; no metal
 * name or pound-club requirement crosses this strength-achievement boundary.
 */
export const SL_STRENGTH_TIER_ASSETS = SL_TROPHY_TIERS.map((tier) => SL_TROPHY_ASSETS[tier]);

export function isLegacyTrophyGlyph(name: string) {
  return name === 'trophy'
    || name === 'trophy-outline'
    || name === 'ribbon'
    || name === 'ribbon-outline'
    || name === 'medal'
    || name === 'medal-outline';
}
