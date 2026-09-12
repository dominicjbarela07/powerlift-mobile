import policy from '@/artwork-review/runtime-policy.json';
import { resolveCanonicalMovementArtwork, type CanonicalMovementArtworkInput, type CanonicalAccessoryArtworkKey } from './canonical-movement-artwork';

export type ApprovedExactArtwork = Readonly<{
  key: CanonicalAccessoryArtworkKey;
  movement_definition_id: number;
  candidate_id: string;
  app_sha256: string;
}>;
type ApprovalPolicy = Readonly<{
  denied_keys: readonly string[];
  approved_exact_artwork?: readonly Readonly<{ key: string; movement_definition_id: number; candidate_id: string; app_sha256: string }>[];
}>;

/** Positive receipt for the exact currently mapped candidate. A filename,
 * grandfathered DEV preview or broad Core family illustration is not approval.
 * The DEV startup byte guard verifies this projection against the review store.
 */
export function resolveApprovedExactMovementArtwork(
  movement?: CanonicalMovementArtworkInput | null,
  dev = typeof __DEV__ !== 'undefined' && __DEV__,
  approvals: ApprovalPolicy = policy,
): ApprovedExactArtwork | null {
  if (!dev) return null;
  const identity = resolveCanonicalMovementArtwork(movement);
  if (identity.kind !== 'accessory' || !identity.artworkKey) return null;
  if (approvals.denied_keys.includes(identity.artworkKey)) return null;
  const receipt = approvals.approved_exact_artwork?.find(row => row.key === identity.artworkKey
    && row.movement_definition_id === identity.canonicalIdentityId);
  if (!receipt?.candidate_id || !/^[a-f0-9]{64}$/.test(receipt.app_sha256)) return null;
  return receipt as ApprovedExactArtwork;
}

export function hasApprovedExactMovementArtwork(movement?: CanonicalMovementArtworkInput | null) {
  return resolveApprovedExactMovementArtwork(movement) != null;
}

export type MovementHeroFocal = Readonly<{ focalX: number; focalY: number; scale: number; biasX: number; biasY: number }>;
const DEFAULT_FOCAL: MovementHeroFocal = Object.freeze({ focalX: 0.5, focalY: 0.46, scale: 1, biasX: 0, biasY: 0 });
// One presentation owner; stable artwork keys, never display-name matching.
// These coordinates describe composition only and do not grant eligibility.
const FOCAL_BY_ARTWORK: Readonly<Partial<Record<CanonicalAccessoryArtworkKey, MovementHeroFocal>>> = {
  accessory_incline_dumbbell_bench_press: { focalX: 0.54, focalY: 0.43, scale: 1.06, biasX: 0, biasY: 0.03 },
  accessory_dumbbell_curl: { focalX: 0.51, focalY: 0.43, scale: 1, biasX: 0, biasY: 0 },
  accessory_one_arm_dumbbell_row: { focalX: 0.53, focalY: 0.45, scale: 1.03, biasX: 0, biasY: 0 },
  accessory_standing_dumbbell_curl: { focalX: 0.51, focalY: 0.43, scale: 1, biasX: 0, biasY: 0 },
  accessory_bulgarian_split_squat: { focalX: 0.53, focalY: 0.45, scale: 1, biasX: 0, biasY: 0 },
};
export function movementHeroFocal(key: CanonicalAccessoryArtworkKey): MovementHeroFocal {
  return FOCAL_BY_ARTWORK[key] || DEFAULT_FOCAL;
}

/** Bounded square-source placement around the right-hand subject target.
 * Absolute composition never adds height to the foreground's layout.
 */
export function movementHeroGeometry(width: number, height: number, focal: MovementHeroFocal) {
  const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
  const size = Math.min(360, height * 1.08) * clamp(focal.scale, 0.8, 1.25);
  const x = width * (0.77 + clamp(focal.biasX, -0.12, 0.12));
  const y = height * (0.48 + clamp(focal.biasY, -0.12, 0.12));
  return { width: size, height: size, left: x - size * clamp(focal.focalX, 0.2, 0.8), top: y - size * clamp(focal.focalY, 0.2, 0.8) };
}
