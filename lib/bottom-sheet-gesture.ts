export const BOTTOM_SHEET_DISMISS_DISTANCE = 96;
export const BOTTOM_SHEET_DISMISS_VELOCITY = 0.85;

// Gesture Handler reports velocity in points/second. The canonical dismissal
// threshold is expressed in points/millisecond to preserve the interaction
// contract established by React Native's PanResponder.
export function bottomSheetVelocityFromGestureHandler(velocityYPointsPerSecond: number) {
  return velocityYPointsPerSecond / 1000;
}

export function shouldCaptureBottomSheetDismissGesture({
  dx,
  dy,
  scrollOffsetY = 0,
}: Readonly<{ dx: number; dy: number; scrollOffsetY?: number }>) {
  return scrollOffsetY <= 0.5 && dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.15;
}

export function shouldDismissBottomSheet({ dy, vy }: Readonly<{ dy: number; vy: number }>) {
  return dy >= BOTTOM_SHEET_DISMISS_DISTANCE || vy >= BOTTOM_SHEET_DISMISS_VELOCITY;
}
