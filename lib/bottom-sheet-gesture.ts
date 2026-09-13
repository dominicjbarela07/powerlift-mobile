export const BOTTOM_SHEET_ACTIVATION_DISTANCE = 12;
export const BOTTOM_SHEET_DISMISS_DISTANCE = 96;
export const BOTTOM_SHEET_FLING_MIN_DISTANCE = 48;
export const BOTTOM_SHEET_DISMISS_VELOCITY = 0.85;
export const BOTTOM_SHEET_DRAG_REGION_HEIGHT = 44;

// RNGH reports points/second; this policy uses points/millisecond.
export function bottomSheetVelocityFromGestureHandler(velocityYPointsPerSecond: number) {
  return velocityYPointsPerSecond / 1000;
}

// A body-origin sequence is never eligible, including at the scroll boundary or
// after direction reversal. Callers must bind the pan to chrome, not a scroll view.
export function shouldCaptureBottomSheetDismissGesture({
  dx, dy, origin,
}: Readonly<{ dx: number; dy: number; origin: 'chrome' | 'body' }>) {
  return origin === 'chrome' && Number.isFinite(dx) && Number.isFinite(dy)
    && dy > BOTTOM_SHEET_ACTIVATION_DISTANCE && Math.abs(dy) > Math.abs(dx) * 1.15;
}

export function shouldDismissBottomSheet({ dy, vy }: Readonly<{ dy: number; vy: number }>) {
  return Number.isFinite(dy) && Number.isFinite(vy)
    && (dy >= BOTTOM_SHEET_DISMISS_DISTANCE
      || (dy >= BOTTOM_SHEET_FLING_MIN_DISTANCE && vy >= BOTTOM_SHEET_DISMISS_VELOCITY));
}
