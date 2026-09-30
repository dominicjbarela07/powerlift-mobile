import type {
  CanonicalHistoryExposure,
  CanonicalHistoryExposureDetail,
  CanonicalMovementHistory,
  MovementHistoryQuery,
} from '@/lib/canonical-movement-history';

export type RecentSessionSetHistory = Readonly<{
  sessionId: number;
  date: string;
  title: string;
  exposures: CanonicalHistoryExposureDetail[];
}>;

type HistoryReader = (query: MovementHistoryQuery) => Promise<CanonicalMovementHistory>;
type ExposureReader = (query: MovementHistoryQuery, exposureId: string) => Promise<CanonicalHistoryExposureDetail>;

// The canonical history service orders exposures newest first and groups each
// exposure by Session ID + equipment identity. Read every exposure in the
// selected Session so an unselected equipment context cannot drop its Sets.
export async function fetchRecentSessionSetHistory({
  athleteId,
  movementDefinitionId,
  coreMovementId,
  currentSessionId,
  equipmentDefinitionId,
  fetchHistory,
  fetchExposure,
}: {
  athleteId: number;
  movementDefinitionId?: number | null;
  coreMovementId?: number | null;
  currentSessionId: number;
  equipmentDefinitionId?: number | null;
  fetchHistory: HistoryReader;
  fetchExposure: ExposureReader;
}): Promise<RecentSessionSetHistory | null> {
  const query: MovementHistoryQuery = {
    athleteId,
    ...(coreMovementId ? { coreMovementId } : { movementDefinitionId }),
    ...(coreMovementId || equipmentDefinitionId == null ? {} : { equipmentDefinitionId }),
    range: 'all',
    limit: 30,
  };
  let cursor: string | null = null;
  let sessionId: number | null = null;
  const selected: CanonicalHistoryExposure[] = [];
  do {
    const page = await fetchHistory({ ...query, ...(cursor ? { cursor } : {}) });
    for (const exposure of page.exposures) {
      if (exposure.workout_id === currentSessionId) continue;
      if (sessionId === null) sessionId = exposure.workout_id;
      if (exposure.workout_id !== sessionId) break;
      selected.push(exposure);
    }
    if (!page.has_more || !page.next_cursor) break;
    if (sessionId !== null && selected.length > 0 && page.exposures.some((row) => row.workout_id !== currentSessionId && row.workout_id !== sessionId)) break;
    if (page.next_cursor === cursor) throw new Error('Movement History pagination could not advance.');
    cursor = page.next_cursor;
  } while (true);
  if (!selected.length || sessionId === null) return null;

  const details = await Promise.all(selected.map((row) => fetchExposure(query, row.id)));
  for (let index = 0; index < details.length; index += 1) {
    if (details[index].id !== selected[index].id
      || details[index].workout_id !== sessionId
      || details[index].session.id !== sessionId
      || details[index].sets.length !== selected[index].set_count) {
      throw new Error('Last Session evidence did not match its canonical Session.');
    }
  }
  return {
    sessionId,
    date: selected[0].date,
    title: selected[0].session_title,
    exposures: details,
  };
}
