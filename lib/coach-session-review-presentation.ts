export function canonicalCoachSessionReviewIdentity(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const raw = typeof candidate === 'number' ? String(candidate) : String(candidate ?? '').trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

export function coachSessionReviewPresentationKey(reviewIdentity: unknown, visitRevision: unknown): string {
  const identity = canonicalCoachSessionReviewIdentity(reviewIdentity) ?? 'invalid';
  const parsedRevision = Number(visitRevision);
  const revision = Number.isSafeInteger(parsedRevision) && parsedRevision >= 0 ? parsedRevision : 0;
  return `coach-session-review:${identity}:visit-${revision}`;
}

export function advanceCoachSessionReviewVisit(visitRevision: unknown): number {
  const parsedRevision = Number(visitRevision);
  return Number.isSafeInteger(parsedRevision) && parsedRevision >= 0 ? parsedRevision + 1 : 1;
}
