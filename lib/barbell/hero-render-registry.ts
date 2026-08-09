import type { ImageSourcePropType } from 'react-native';

export const PLATE_CLUB_HERO_RENDERER_VERSION = 'plate-club-hero-v2' as const;
export const PLATE_CLUB_HERO_OUTPUT_PROFILE = 'mobile-card-180x120@3x' as const;
export const PLATE_CLUB_HERO_LOADING_POLICY_VERSION = 'canonical-performance-kg-loading-v1' as const;
export const PLATE_CLUB_HERO_PLATE_INVENTORY_SIGNATURE = 'sl-plate-inventory-v1' as const;
export const PLATE_CLUB_HERO_CAMERA_VERSION = 'hero-camera-v1' as const;
export const PLATE_CLUB_HERO_MATERIAL_LIGHTING_VERSION = 'achievement-material-v2' as const;

export type HeroRenderLift = 'squat' | 'bench' | 'deadlift';
export type HeroRendererVersion = typeof PLATE_CLUB_HERO_RENDERER_VERSION;
export type HeroOutputProfile = typeof PLATE_CLUB_HERO_OUTPUT_PROFILE;
export type CanonicalLoadingIdentity = string;
export type HeroRenderSpecKey = string;

export type HeroRenderAsset = {
  imageSource: ImageSourcePropType;
  artifactPath: string;
  artifactSha256: string;
};

type LiftAssetRegistry = Partial<Record<CanonicalLoadingIdentity, HeroRenderAsset>>;
type OutputProfileRegistry = Record<HeroRenderLift, LiftAssetRegistry>;
type HeroRenderRegistry = Partial<Record<HeroRenderSpecKey, OutputProfileRegistry>>;

/**
 * Every visual input is represented in the immutable catalog namespace. A
 * renderer, inventory, loading policy, camera, material, lighting, or output
 * change therefore produces a different artifact key instead of mutating an
 * existing capture in place.
 */
export const PLATE_CLUB_HERO_SPEC_KEY: HeroRenderSpecKey = [
  PLATE_CLUB_HERO_RENDERER_VERSION,
  PLATE_CLUB_HERO_LOADING_POLICY_VERSION,
  PLATE_CLUB_HERO_PLATE_INVENTORY_SIGNATURE,
  PLATE_CLUB_HERO_CAMERA_VERSION,
  PLATE_CLUB_HERO_MATERIAL_LIGHTING_VERSION,
  PLATE_CLUB_HERO_OUTPUT_PROFILE,
].join('__');

/**
 * Immutable local implementation of the Hero Render Catalog contract:
 * complete render spec -> lift -> canonical loading -> immutable asset.
 * A production resolver can replace these bundled sources with CDN sources
 * without changing the consumer or descriptor shape.
 */
const HERO_RENDER_REGISTRY: HeroRenderRegistry = {
  [PLATE_CLUB_HERO_SPEC_KEY]: {
    squat: {
      '45x4': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/squat/45x4.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/squat/45x4.png',
        artifactSha256: '19866cb30543e2b09a0bedd131a72a5b55e2fddb4d2006270dfa7271bc373374',
      },
      '45x7-25x1': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/squat/45x7-25x1.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/squat/45x7-25x1.png',
        artifactSha256: '2d236ab6b1bb33979cc1a76a070a5ec38bda27fb3c64ea144d610544e2874b38',
      },
      '45x4-25x1': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/squat/45x4-25x1.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/squat/45x4-25x1.png',
        artifactSha256: 'e3eac9d8c6bfe232bfd94f774313a228eee658f0ff10803151524ab3d4dd5c9b',
      },
    },
    bench: {
      '45x2-25x1': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/bench/45x2-25x1.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/bench/45x2-25x1.png',
        artifactSha256: '7e93acf7c6bb724f6b9233acc4cce37f6e64f53f8dce5a68fe9c9c81d8fa6d6b',
      },
      '45x3': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/bench/45x3.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/bench/45x3.png',
        artifactSha256: 'ef6afa2a9a9ac8b8bf2eec339d3f840a64911abb193eb6e6cd5c3db69ea30eb3',
      },
    },
    deadlift: {
      '45x5': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/deadlift/45x5.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/deadlift/45x5.png',
        artifactSha256: 'a691492c2f922b70034e661cbb74caf9232b701e5b234092ad0dc3e7475b529c',
      },
      '45x4-25x1': {
        imageSource: require('../../assets/images/hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/deadlift/45x4-25x1.png'),
        artifactPath: 'hero-renders/plate-club-hero-v2/mobile-card-180x120@3x/deadlift/45x4-25x1.png',
        artifactSha256: 'bba40de3646aa12c17326afe4fb2ce5bbebc6429f9c288653a8832bfa2824f5b',
      },
    },
  },
};

export function registeredHeroRenderAsset(
  renderSpecKey: HeroRenderSpecKey,
  lift: HeroRenderLift,
  loadingIdentity: CanonicalLoadingIdentity,
): HeroRenderAsset | undefined {
  return HERO_RENDER_REGISTRY[renderSpecKey]?.[lift]?.[loadingIdentity];
}
