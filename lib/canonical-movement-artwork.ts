import { type FocusedAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { normalizeCanonicalMovementArtSubject, type MovementArtInput, type MovementArtFailure, type CanonicalCoreArtworkFamily } from './canonical-movement-art-subject';
import { isMovementArtworkReviewDenied } from '@/lib/movement-art-review-policy';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES, RETIRED_ACCESSORY_ARTWORK_IDENTITIES, REGISTERED_ACCESSORY_ARTWORK_KEYS, type CanonicalAccessoryArtworkKey } from './canonical-accessory-artwork-identities';

export { normalizeCanonicalMovementArtSubject, canonicalArtworkInputFromDefinition } from './canonical-movement-art-subject';
export type { CanonicalMovementArtworkInput, CanonicalMovementArtSubject, MovementArtInput, CanonicalCoreArtworkFamily } from './canonical-movement-art-subject';
export { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES, type CanonicalAccessoryArtworkKey } from './canonical-accessory-artwork-identities';

export type CanonicalMovementArtworkResolution =
  | Readonly<{
      kind: 'accessory';
      canonicalIdentityId: number | null;
      regionKey: FocusedAccessoryMuscleRegionKey;
      primaryMuscleGroup: string;
      secondaryMuscleGroups: readonly string[];
      artworkKey?: CanonicalAccessoryArtworkKey;
    }>
  | Readonly<{ kind: 'core' | 'core_variant'; canonicalIdentityId: number; family: CanonicalCoreArtworkFamily }>
  | Readonly<{ kind: 'neutral'; reason: MovementArtFailure }>;

/** Identity survives independently of exact-art coverage and human approval. */
export function resolveCanonicalMovementArtwork(
  movement?: MovementArtInput | null,
  artworkDenied: (key: string) => boolean = isMovementArtworkReviewDenied,
): CanonicalMovementArtworkResolution {
  const subject = normalizeCanonicalMovementArtSubject(movement);
  if (subject.reason) return { kind: 'neutral', reason: subject.reason };
  if (subject.domain === 'core' && subject.canonicalIdentityId && subject.coreFamily) {
    return { kind: subject.coreVariant ? 'core_variant' : 'core', canonicalIdentityId: subject.canonicalIdentityId, family: subject.coreFamily };
  }
  if (!subject.primaryMuscleGroup) return { kind: 'neutral', reason: 'missing_governed_taxonomy' };
  const id = subject.canonicalIdentityId;
  const active = id ? CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[id as keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES] : null;
  const registered = active || (id ? RETIRED_ACCESSORY_ARTWORK_IDENTITIES[id as keyof typeof RETIRED_ACCESSORY_ARTWORK_IDENTITIES] : null);
  // A contradiction stays closed. An absent exact-art key does not erase known taxonomy.
  if ((registered && subject.canonicalKey && subject.canonicalKey !== registered.key)
    || (!registered && id && REGISTERED_ACCESSORY_ARTWORK_KEYS.has(subject.canonicalKey || ''))) {
    return { kind: 'neutral', reason: 'conflicting_canonical_identity' };
  }
  const artworkKey = active && subject.canonicalKey === active.key && subject.primaryMuscleGroup === active.primary
    && !artworkDenied(active.key) ? active.key : undefined;
  return { kind: 'accessory', canonicalIdentityId: id, regionKey: subject.primaryMuscleGroup,
    primaryMuscleGroup: subject.primaryMuscleGroup, secondaryMuscleGroups: subject.secondaryMuscleGroups,
    ...(artworkKey ? { artworkKey } : {}) };
}
