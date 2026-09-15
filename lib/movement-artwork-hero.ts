import { approvedArtRuntimeEnabled } from './approved-art-runtime';
import policyJson from '@/artwork-review/runtime-policy.json';
import { DEFAULT_FOCAL, thumbnailGeometry, type Presentation } from './movement-artwork-geometry.mjs';
export { movementHeroGeometry } from './movement-artwork-geometry.mjs';
import { normalizeCanonicalMovementArtSubject, resolveCanonicalMovementArtwork, type CanonicalMovementArtworkInput, type MovementArtInput, type CanonicalAccessoryArtworkKey } from './canonical-movement-artwork';

export type ApprovedExactArtwork = Readonly<{
  key: CanonicalAccessoryArtworkKey;
  movement_definition_id: number;
  candidate_id: string;
  app_sha256: string;
}>;
type ApprovalPolicy = Readonly<{
  denied_keys: readonly string[];
  approved_exact_artwork?: readonly Readonly<{ key: string; movement_definition_id: number; candidate_id: string; app_sha256: string; presentation?: Presentation }>[];
}>;
// JSON imports widen cropMode to string. Registration validates its enum and
// bounds; startup/export independently bind this projection to human receipts.
const policy = policyJson as ApprovalPolicy;

/** Positive receipt for the exact currently mapped candidate. A filename,
 * grandfathered DEV preview or broad Core family illustration is not approval.
 * The DEV startup byte guard verifies this projection against the review store.
 */
export function resolveApprovedExactMovementArtwork(
  movement?: MovementArtInput | null,
  dev = approvedArtRuntimeEnabled(),
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
  dev = approvedArtRuntimeEnabled(), approvals: ApprovalPolicy = policy) {
  const approved = resolveApprovedExactMovementArtwork(movement, dev, approvals);
  if (expanded && !complete) reportApprovedArtworkBypass(movement, approved?.key || null, `${surface}:hero`, approvals);
  return {
    thumbnailPresentation: expanded ? 'muscle-focus' as const : 'movement' as const,
    hero: expanded && !complete ? approved : null,
  };
}

export type MovementHeroFocal = Readonly<{ focalX: number; focalY: number; scale: number; biasX: number; biasY: number; cropMode?: 'contain' | 'focal' }>;
// One presentation owner; stable artwork keys, never display-name matching.
// These coordinates describe composition only and do not grant eligibility.
const FOCAL_BY_ARTWORK: Readonly<Partial<Record<CanonicalAccessoryArtworkKey, MovementHeroFocal & { thumbnailScale?: number; thumbnailFocalY?: number }>>> = {
  accessory_incline_dumbbell_bench_press: { focalX: 0.54, focalY: 0.43, scale: 1.06, biasX: 0, biasY: 0.03, thumbnailScale: 1.08 },
  accessory_dumbbell_curl: { focalX: 0.51, focalY: 0.43, scale: 1, biasX: 0, biasY: 0, thumbnailScale: 1.24, thumbnailFocalY: 0.36 },
  accessory_one_arm_dumbbell_row: { focalX: 0.53, focalY: 0.45, scale: 1.03, biasX: 0, biasY: 0, thumbnailScale: 1.08 },
  accessory_standing_dumbbell_curl: { focalX: 0.51, focalY: 0.43, scale: 1, biasX: 0, biasY: 0 },
  accessory_bulgarian_split_squat: { focalX: 0.53, focalY: 0.45, scale: 1, biasX: 0, biasY: 0, thumbnailScale: 1.08 },
};
function approvedPresentation(key: CanonicalAccessoryArtworkKey, approvals: ApprovalPolicy = policy) {
  if (approvals.denied_keys.includes(key)) return undefined;
  return approvals.approved_exact_artwork?.find(row => row.key === key)?.presentation;
}
export function movementHeroFocal(key: CanonicalAccessoryArtworkKey): MovementHeroFocal {
  return approvedPresentation(key) || FOCAL_BY_ARTWORK[key] || DEFAULT_FOCAL;
}

/** Modest square crop prioritizes the action at card size, using the same focal
 * owner and source as the hero. No stretching or consumer-owned crop offsets. */
export function movementThumbnailGeometry(size: number, key: CanonicalAccessoryArtworkKey) {
  const focal = movementHeroFocal(key);
  return thumbnailGeometry(size, focal, approvedPresentation(key) || FOCAL_BY_ARTWORK[key]);
}
