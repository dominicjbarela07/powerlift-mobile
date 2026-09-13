import { approvedArtRuntimeEnabled } from './approved-art-runtime';
import policy from '@/artwork-review/runtime-policy.json';

/** Denials remain authoritative wherever this approved family is enabled. */
export function isMovementArtworkReviewDenied(
  key: string,
  dev = approvedArtRuntimeEnabled(),
  deniedKeys: readonly string[] = policy.denied_keys,
): boolean {
  return dev && deniedKeys.includes(key);
}
