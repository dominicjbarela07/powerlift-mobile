/** Explicit lifecycle states outrank date-derived presentation. Reads never
 * assign a draft or change the server's execution permissions. */
export function unavailableSessionLifecycle(status?: string | null): 'draft' | 'canceled' | 'archived' | null {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'draft') return 'draft';
  if (value === 'canceled' || value === 'cancelled') return 'canceled';
  if (value === 'archived') return 'archived';
  return null;
}

export function sessionUnavailableExplanation(input: {
  status?: string | null;
  blockReason?: string | null;
  loggable?: boolean | null;
  canBegin?: boolean;
  selfCoached?: boolean;
}): string | null {
  const lifecycle = unavailableSessionLifecycle(input.status);
  if (lifecycle === 'draft') return 'This Session is a draft. It needs to be ready to train before you can begin.';
  if (lifecycle === 'canceled') return 'This Session was canceled and cannot be started.';
  if (lifecycle === 'archived') return 'This Session is archived and cannot be started.';
  if (input.loggable === false && input.blockReason?.trim()) return input.blockReason.trim();
  if (input.loggable === false) return input.selfCoached
    ? 'This Session is outside the logging window. Update its date in Programming.'
    : 'This Session is unavailable to log. Ask your coach to check its date and assignment.';
  if (input.canBegin === false) return 'This Session is not available to begin with your current access.';
  return null;
}
