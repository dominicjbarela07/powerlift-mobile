export type SessionHeaderSetLog = Readonly<{
  id?: unknown;
  set_index?: unknown;
  client_submission_id?: unknown;
}>;

export type SessionHeaderItem = Readonly<{
  id?: unknown;
  set_logs?: readonly SessionHeaderSetLog[] | null;
}>;

export type SessionHeaderGroup = Readonly<{
  items?: readonly SessionHeaderItem[] | null;
}>;

function persistedSetIdentity(
  item: SessionHeaderItem,
  itemIndex: number,
  log: SessionHeaderSetLog,
): string | null {
  const persistedId = Number(log.id);
  const submissionId = String(log.client_submission_id || '').trim();
  if ((!Number.isFinite(persistedId) || persistedId <= 0) && !submissionId) return null;

  const itemIdentity = String(item.id ?? `item-${itemIndex}`);
  const setIndex = Number(log.set_index);
  if (Number.isFinite(setIndex) && setIndex > 0) {
    return `${itemIdentity}:set:${Math.floor(setIndex)}`;
  }
  if (Number.isFinite(persistedId) && persistedId > 0) {
    return `${itemIdentity}:log:${persistedId}`;
  }
  return `${itemIdentity}:submission:${submissionId}`;
}

/**
 * Counts canonical persisted set evidence once per movement/set position.
 * Local form drafts never enter the total, and a replayed duplicate response
 * cannot inflate progress. Superset rounds remain movement-atomic because each
 * persisted movement entry in the round contributes exactly one set.
 */
export function canonicalLoggedSetCountForSession({
  coreItems,
  accessoryGroups,
}: {
  coreItems?: readonly SessionHeaderItem[] | null;
  accessoryGroups?: readonly SessionHeaderGroup[] | null;
}): number {
  const items = [
    ...(coreItems || []),
    ...(accessoryGroups || []).flatMap((group) => group.items || []),
  ];
  const identities = new Set<string>();
  items.forEach((item, itemIndex) => {
    (item.set_logs || []).forEach((log) => {
      const identity = persistedSetIdentity(item, itemIndex, log);
      if (identity) identities.add(identity);
    });
  });
  return identities.size;
}

export function canonicalSessionStartedAtMs(value?: string | null): number | null {
  if (!value) return null;
  const normalized = /z$|[+-]\d\d:?\d\d$/i.test(value) ? value : `${value}Z`;
  const timestampMs = Date.parse(normalized);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

export function deriveSessionElapsedSeconds(
  startedAt?: string | null,
  nowMs = Date.now(),
): number | null {
  const startedAtMs = canonicalSessionStartedAtMs(startedAt);
  if (startedAtMs == null || !Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

export function formatSessionElapsed(totalSeconds?: number | null): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
