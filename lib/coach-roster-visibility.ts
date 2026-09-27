/** A coaching pause keeps the relationship and historical access intact. */
export function isOnLeave(athlete: unknown): boolean {
  if (!athlete || typeof athlete !== 'object') return false;
  const row = athlete as { coaching_status?: string | null; status?: unknown };
  return row.coaching_status === 'paused' || row.status === 'paused';
}

export function activeCoachingAthletes<T>(athletes: T[]): T[] {
  return athletes.filter((athlete) => !isOnLeave(athlete));
}
