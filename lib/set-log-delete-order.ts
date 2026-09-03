export type PersistedSetLogOrder = Readonly<{
  id: number;
  set_index?: number | null;
}>;

function validIdentity(log: PersistedSetLogOrder | null | undefined) {
  const id = Number(log?.id);
  const setIndex = Number(log?.set_index);
  return Number.isFinite(id) && id > 0 && Number.isFinite(setIndex) && setIndex > 0
    ? { id, setIndex }
    : null;
}

/**
 * Destructive SetLog rollback is movement-item scoped. The persisted set
 * sequence owns ordering; the database ID is the canonical tie-breaker for
 * legacy duplicate indexes, matching the server's delete-last-set policy.
 */
export function latestPersistedSetLogId(
  logs: readonly PersistedSetLogOrder[] | null | undefined,
): number | null {
  let latest: { id: number; setIndex: number } | null = null;
  for (const log of logs || []) {
    const candidate = validIdentity(log);
    if (!candidate) continue;
    if (
      latest == null
      || candidate.setIndex > latest.setIndex
      || (candidate.setIndex === latest.setIndex && candidate.id > latest.id)
    ) {
      latest = candidate;
    }
  }
  return latest?.id ?? null;
}

export function canDeletePersistedSetLog(
  log: PersistedSetLogOrder | null | undefined,
  movementLogs: readonly PersistedSetLogOrder[] | null | undefined,
): boolean {
  const identity = validIdentity(log);
  return identity != null && identity.id === latestPersistedSetLogId(movementLogs);
}
