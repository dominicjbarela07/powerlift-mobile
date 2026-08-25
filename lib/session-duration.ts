export type SessionDurationSource = {
  actual_duration_minutes?: number | null;
  duration_display_minutes?: number | null;
  duration_is_estimate?: boolean | null;
  estimated_duration_minutes?: number | null;
  performance?: object | null;
  preview?: object | null;
};

type NestedDurationSource = {
  actual_duration_minutes?: number | null;
  duration_display_minutes?: number | null;
  estimated_duration_minutes?: number | null;
};

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function sessionDurationPresentation(source?: SessionDurationSource | null) {
  const performance = source?.performance as NestedDurationSource | null | undefined;
  const preview = source?.preview as NestedDurationSource | null | undefined;
  const actual = positiveNumber(
    source?.actual_duration_minutes
      ?? performance?.actual_duration_minutes
      ?? preview?.actual_duration_minutes,
  );
  if (actual != null) {
    const minutes = Math.round(actual);
    return { minutes, isEstimate: false, label: `${minutes} min` };
  }
  const estimate = positiveNumber(
    source?.duration_display_minutes
      ?? source?.estimated_duration_minutes
      ?? preview?.duration_display_minutes
      ?? preview?.estimated_duration_minutes,
  );
  if (estimate == null) return null;
  const minutes = Math.round(estimate);
  return { minutes, isEstimate: true, label: `~${minutes} min` };
}
