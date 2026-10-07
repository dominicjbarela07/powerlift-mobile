/** Explicit version-scoped export policy. Legacy Production remains disabled;
 * the separate 3.0 native preparation target requires BOTH switches. Human
 * approval and exact per-movement crop receipts remain mandatory.
 */
export function approvedArtRuntimeEnabled(
  dev = typeof __DEV__ !== 'undefined' && __DEV__,
  channel = process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL,
  version = process.env.EXPO_PUBLIC_ART_RUNTIME_VERSION,
): boolean {
  return dev || channel === 'testflight' || (channel === 'production3' && version === '3.0.0');
}
