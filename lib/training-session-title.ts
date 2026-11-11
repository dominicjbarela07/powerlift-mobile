export const TRAINING_SESSION_TITLE = 'Training Session';

/** Display the previous generated default without rewriting saved Session titles. */
export function trainingSessionTitle(label?: string | null): string {
  if (!label?.trim() || label.trim().toLowerCase() === 'workout') return TRAINING_SESSION_TITLE;
  return label;
}
