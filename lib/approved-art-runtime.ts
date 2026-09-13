/** The publisher inlines this public, non-secret switch only for the governed
 * TestFlight channel. Production exports leave it disabled. Human approval is a
 * separate per-candidate decision and is still required by every exact consumer.
 */
export function approvedArtRuntimeEnabled(
  dev = typeof __DEV__ !== 'undefined' && __DEV__,
  channel = process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL,
): boolean {
  return dev || channel === 'testflight';
}
