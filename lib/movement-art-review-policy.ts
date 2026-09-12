import policy from '@/artwork-review/runtime-policy.json';

/** Human rejections affect DEV previews only. No account or movement identity changes. */
export function isMovementArtworkReviewDenied(
  key: string,
  dev = typeof __DEV__ !== 'undefined' && __DEV__,
  deniedKeys: readonly string[] = policy.denied_keys,
): boolean {
  return dev && deniedKeys.includes(key);
}
