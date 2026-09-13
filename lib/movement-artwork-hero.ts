import policy from '@/artwork-review/runtime-policy.json';
import { normalizeCanonicalMovementArtSubject, resolveCanonicalMovementArtwork, type CanonicalMovementArtworkInput, type MovementArtInput, type CanonicalAccessoryArtworkKey } from './canonical-movement-artwork';

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
  movement?: MovementArtInput | null,
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

const warnedBypasses = new Set<string>();
/** Intentional target cues never call this: only consumers promising exact art.
 * A positive receipt does not override contradictory identity or missing assets.
 */
export function reportApprovedArtworkBypass(movement: MovementArtInput | null | undefined, renderedKey: string | null,
  surface: string, approvals: ApprovalPolicy = policy, dev = typeof __DEV__ !== 'undefined' && __DEV__) {
  if (!dev) return;
  const subject = normalizeCanonicalMovementArtSubject(movement);
  const expected = approvals.approved_exact_artwork?.find(row => row.movement_definition_id === subject.canonicalIdentityId);
  if (!expected || approvals.denied_keys.includes(expected.key) || expected.key === renderedKey) return;
  const warningKey = `${surface}:${expected.movement_definition_id}:${expected.candidate_id}`;
  if (warnedBypasses.has(warningKey)) return;
  if (warnedBypasses.size >= 200) warnedBypasses.clear();
  warnedBypasses.add(warningKey);
  console.warn('[MovementArt] Approved exact artwork unexpectedly bypassed', {
    surface, movement_definition_id: expected.movement_definition_id, key: expected.key,
    candidate_id: expected.candidate_id, resolved_key: renderedKey, subject_source: subject.source,
  });
}

/** Presentation is independent of Session phase. The expanded title is a target
 * cue; the same approved identity owns the hero. Compact rows own exact identity.
 */
export function resolveMovementArtworkPresentation(movement: MovementArtInput | null | undefined,
  expanded: boolean, complete: boolean, surface: string,
  dev = typeof __DEV__ !== 'undefined' && __DEV__, approvals: ApprovalPolicy = policy) {
  const approved = resolveApprovedExactMovementArtwork(movement, dev, approvals);
  if (expanded && !complete) reportApprovedArtworkBypass(movement, approved?.key || null, `${surface}:hero`, approvals, dev);
  return {
    thumbnailPresentation: expanded ? 'muscle-focus' as const : 'movement' as const,
    hero: expanded && !complete ? approved : null,
  };
}

export type MovementHeroFocal = Readonly<{ focalX: number; focalY: number; scale: number; biasX: number; biasY: number }>;
const DEFAULT_FOCAL: MovementHeroFocal = Object.freeze({ focalX: 0.5, focalY: 0.46, scale: 1, biasX: 0, biasY: 0 });
// One presentation owner; stable artwork keys, never display-name matching.
// These coordinates describe composition only and do not grant eligibility.
const FOCAL_BY_ARTWORK: Readonly<Partial<Record<CanonicalAccessoryArtworkKey, MovementHeroFocal & { thumbnailScale?: number; thumbnailFocalY?: number }>>> = {
  accessory_incline_dumbbell_bench_press: { focalX: 0.54, focalY: 0.43, scale: 1.06, biasX: 0, biasY: 0.03, thumbnailScale: 1.08 },
  accessory_dumbbell_curl: { focalX: 0.51, focalY: 0.43, scale: 1, biasX: 0, biasY: 0, thumbnailScale: 1.24, thumbnailFocalY: 0.36 },
  accessory_one_arm_dumbbell_row: { focalX: 0.53, focalY: 0.45, scale: 1.03, biasX: 0, biasY: 0, thumbnailScale: 1.08 },
  accessory_standing_dumbbell_curl: { focalX: 0.51, focalY: 0.43, scale: 1, biasX: 0, biasY: 0 },
  accessory_bulgarian_split_squat: { focalX: 0.53, focalY: 0.45, scale: 1, biasX: 0, biasY: 0, thumbnailScale: 1.08 },
};
export function movementHeroFocal(key: CanonicalAccessoryArtworkKey): MovementHeroFocal {
  return FOCAL_BY_ARTWORK[key] || DEFAULT_FOCAL;
}

/** Modest square crop prioritizes the action at card size, using the same focal
 * owner and source as the hero. No stretching or consumer-owned crop offsets. */
export function movementThumbnailGeometry(size: number, key: CanonicalAccessoryArtworkKey) {
  const focal = movementHeroFocal(key);
  const preset = FOCAL_BY_ARTWORK[key];
  const edge = size * (preset?.thumbnailScale || 1);
  return { width: edge, height: edge,
    left: Math.min(0, Math.max(size - edge, size * 0.5 - edge * focal.focalX)),
    top: Math.min(0, Math.max(size - edge, size * 0.48 - edge * (preset?.thumbnailFocalY ?? focal.focalY))) };
}

/** Bounded square-source placement around the right-hand subject target.
 * Absolute composition never adds height to the foreground's layout.
 */
export function movementHeroGeometry(width: number, height: number, focal: MovementHeroFocal) {
  const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
  const size = Math.min(360, height * 1.08) * clamp(focal.scale, 0.8, 1.25);
  const x = width * (0.77 + clamp(focal.biasX, -0.12, 0.12));
  const y = height * (0.68 + clamp(focal.biasY, -0.12, 0.12));
  return { width: size, height: size, left: x - size * clamp(focal.focalX, 0.2, 0.8), top: y - size * clamp(focal.focalY, 0.2, 0.8) };
}
