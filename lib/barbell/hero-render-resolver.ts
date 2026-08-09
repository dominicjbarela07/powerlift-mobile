import type { ImageSourcePropType } from 'react-native';

import type { PlateDenominationLb } from '@/lib/barbell/plate-metadata';
import {
  PLATE_CLUB_HERO_OUTPUT_PROFILE,
  PLATE_CLUB_HERO_RENDERER_VERSION,
  PLATE_CLUB_HERO_SPEC_KEY,
  registeredHeroRenderAsset,
  type CanonicalLoadingIdentity,
  type HeroOutputProfile,
  type HeroRenderLift,
  type HeroRendererVersion,
  type HeroRenderSpecKey,
} from '@/lib/barbell/hero-render-registry';

export type HeroRenderDescriptor = {
  lift: HeroRenderLift;
  canonicalLoadingIdentity: CanonicalLoadingIdentity;
  rendererVersion: HeroRendererVersion;
  outputProfile: HeroOutputProfile;
  renderSpecKey: HeroRenderSpecKey;
  artifactKey: string;
  artifactPath: string | null;
  artifactSha256: string | null;
  readiness: 'ready' | 'missing';
  imageSource: ImageSourcePropType | null;
};

export type ResolveHeroRenderInput = {
  lift: HeroRenderLift;
  plates: readonly PlateDenominationLb[];
  rendererVersion?: HeroRendererVersion;
  outputProfile?: HeroOutputProfile;
};

/** Canonical, order-preserving, unit-independent identity for one loaded side. */
export function canonicalHeroLoadingIdentity(plates: readonly PlateDenominationLb[]): CanonicalLoadingIdentity {
  if (plates.length === 0) return 'bar-only';

  const groups: { denomination: PlateDenominationLb; count: number }[] = [];
  for (const denomination of plates) {
    const current = groups.at(-1);
    if (current?.denomination === denomination) {
      current.count += 1;
    } else {
      groups.push({ denomination, count: 1 });
    }
  }

  return groups.map(({ denomination, count }) => `${denomination}x${count}`).join('-');
}

/**
 * Sole client boundary for hero delivery. The DEV resolver reads the bundled
 * current registry; a production implementation can return an immutable CDN
 * ImageSourcePropType here without changing Plate Club UI code.
 */
export function resolveHeroRender({
  lift,
  plates,
  rendererVersion = PLATE_CLUB_HERO_RENDERER_VERSION,
  outputProfile = PLATE_CLUB_HERO_OUTPUT_PROFILE,
}: ResolveHeroRenderInput): HeroRenderDescriptor {
  const canonicalLoadingIdentity = canonicalHeroLoadingIdentity(plates);
  const renderSpecKey = PLATE_CLUB_HERO_SPEC_KEY;
  const artifactKey = `${renderSpecKey}/${lift}/${canonicalLoadingIdentity}`;
  const asset = registeredHeroRenderAsset(renderSpecKey, lift, canonicalLoadingIdentity);

  return {
    lift,
    canonicalLoadingIdentity,
    rendererVersion,
    outputProfile,
    renderSpecKey,
    artifactKey,
    artifactPath: asset?.artifactPath ?? null,
    artifactSha256: asset?.artifactSha256 ?? null,
    readiness: asset ? 'ready' : 'missing',
    imageSource: asset?.imageSource ?? null,
  };
}
