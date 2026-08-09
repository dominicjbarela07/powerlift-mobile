/**
 * Pure movement-card material tokens. This module intentionally has no
 * React Native dependency so state resolution can be regression-tested in
 * Node without loading the native runtime.
 */
export const SLMovementCardMaterial = {
  base: '#070709',
  face: ['#141417', '#09090B', '#060608', '#0B0B0E'] as const,
  faceLocations: [0, 0.34, 0.7, 1] as const,
  neutralBorder: 'rgba(232, 234, 240, 0.16)',
  innerBevel: 'rgba(255, 255, 255, 0.075)',
  lowerBevel: 'rgba(0, 0, 0, 0.68)',
  /**
   * Canonical movement-workspace state language.
   * Movement identity stays in the artwork; the card surface communicates status.
   */
  stateAccent: {
    not_started: '#E83D9A',
    in_progress: '#C8AB72',
    complete: '#8FB29A',
    skipped: '#91A9B5',
    failed: '#CE8787',
  },
  edgeStrength: {
    not_started: 0.72,
    in_progress: 0.94,
    complete: 0.78,
    skipped: 0.42,
    failed: 0.88,
  },
  tintStrength: {
    not_started: 0.105,
    in_progress: 0.145,
    complete: 0.095,
    skipped: 0.045,
    failed: 0.12,
  },
  expandedTintMultiplier: 0.88,
  pressedTintMultiplier: 1.08,
  disabledOpacity: 0.62,
} as const;
