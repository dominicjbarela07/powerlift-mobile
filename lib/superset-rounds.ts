export type SupersetRoundLog = Readonly<{
  set_index?: number | null;
}>;

export type SupersetRoundSourceItem = Readonly<{
  id: number;
  movement?: string | null;
  sets?: number | null;
  superset_pos?: number | null;
  set_logs?: readonly SupersetRoundLog[] | null;
}>;

export type SupersetRoundEntry<T extends SupersetRoundSourceItem> = Readonly<{
  item: T;
  itemId: number;
  position: number;
  log: SupersetRoundLog | null;
  state: 'complete' | 'ready' | 'upcoming';
}>;

export type SupersetRound<T extends SupersetRoundSourceItem> = Readonly<{
  index: number;
  state: 'complete' | 'current' | 'upcoming';
  entries: readonly SupersetRoundEntry<T>[];
  complete: boolean;
}>;

export type SupersetMovementProgress<T extends SupersetRoundSourceItem> = Readonly<{
  item: T;
  itemId: number;
  position: number;
  requiredSets: number;
  loggedSetIndexes: readonly number[];
  loggedRequiredSets: number;
  nextSetIndex: number | null;
  complete: boolean;
}>;

export type SupersetRoundModel<T extends SupersetRoundSourceItem> = Readonly<{
  items: readonly T[];
  movements: readonly SupersetMovementProgress<T>[];
  rounds: readonly SupersetRound<T>[];
  roundCount: number;
  completedRounds: number;
  currentRoundIndex: number | null;
  suggestedNextItemId: number | null;
  totalRequiredSets: number;
  loggedRequiredSets: number;
  status: 'not_started' | 'in_progress' | 'complete';
}>;

function positiveSetCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizedPosition(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredLoggedSetIndexes(
  logs: readonly SupersetRoundLog[] | null | undefined,
  requiredSets: number,
): number[] {
  return Array.from(new Set(
    (logs || [])
      .map((log) => Number(log.set_index || 0))
      .filter((index) => Number.isFinite(index) && index > 0 && index <= requiredSets),
  )).sort((a, b) => a - b);
}

function firstMissingSetIndex(indexes: readonly number[], requiredSets: number): number | null {
  const completed = new Set(indexes);
  for (let index = 1; index <= requiredSets; index += 1) {
    if (!completed.has(index)) return index;
  }
  return null;
}

export function buildSupersetRoundModel<T extends SupersetRoundSourceItem>(
  sourceItems: readonly T[],
): SupersetRoundModel<T> {
  const items = sourceItems
    .map((item, sourceIndex) => ({
      item,
      sourceIndex,
      position: normalizedPosition(item.superset_pos, sourceIndex + 1),
    }))
    .sort((a, b) => a.position - b.position || a.sourceIndex - b.sourceIndex);
  const roundCount = items.reduce(
    (maximum, entry) => Math.max(maximum, positiveSetCount(entry.item.sets)),
    0,
  );
  const movements = items.map(({ item, position }) => {
    const requiredSets = positiveSetCount(item.sets);
    const loggedSetIndexes = requiredLoggedSetIndexes(item.set_logs, requiredSets);
    const nextSetIndex = firstMissingSetIndex(loggedSetIndexes, requiredSets);
    return Object.freeze({
      item,
      itemId: item.id,
      position,
      requiredSets,
      loggedSetIndexes: Object.freeze(loggedSetIndexes),
      loggedRequiredSets: loggedSetIndexes.length,
      nextSetIndex,
      complete: requiredSets > 0 && nextSetIndex == null,
    });
  });
  const movementByItemId = new Map(
    movements.map((movement) => [movement.itemId, movement]),
  );

  const draftRounds = Array.from({ length: roundCount }, (_, offset) => {
    const index = offset + 1;
    const entries = items
      .filter(({ item }) => index <= positiveSetCount(item.sets))
      .map(({ item, position }) => {
        const log = (item.set_logs || []).find(
          (candidate) => Number(candidate.set_index || 0) === index,
        ) || null;
        return { item, itemId: item.id, position, log };
      });
    return {
      index,
      entries,
      complete: entries.length > 0 && entries.every((entry) => entry.log != null),
    };
  });
  const firstIncomplete = draftRounds.find((round) => !round.complete) || null;
  const rounds = draftRounds.map((round) => {
    const state = round.complete
      ? 'complete' as const
      : round.index === firstIncomplete?.index
        ? 'current' as const
        : 'upcoming' as const;
    return Object.freeze({
      index: round.index,
      state,
      complete: round.complete,
      entries: Object.freeze(round.entries.map((entry) => Object.freeze({
        ...entry,
        // A movement is ready when this is its own first missing set. A sibling
        // at a different ordinal never locks it behind a shared round cursor.
        state: entry.log
          ? 'complete' as const
          : movementByItemId.get(entry.itemId)?.nextSetIndex === round.index
            ? 'ready' as const
            : 'upcoming' as const,
      }))),
    });
  });
  const completedRounds = rounds.filter((round) => round.complete).length;
  const totalRequiredSets = movements.reduce(
    (total, movement) => total + movement.requiredSets,
    0,
  );
  const loggedRequiredSets = movements.reduce(
    (total, movement) => total + movement.loggedRequiredSets,
    0,
  );
  // Traditional alternating execution remains the suggested fast path: choose
  // the earliest missing set, then the programmed movement position. This is a
  // suggestion only; every incomplete movement remains independently loggable.
  const suggestedNextItemId = rounds
    .flatMap((round) => round.entries)
    .find((entry) => entry.state === 'ready')?.itemId || null;

  return Object.freeze({
    items: Object.freeze(items.map(({ item }) => item)),
    movements: Object.freeze(movements),
    rounds: Object.freeze(rounds),
    roundCount,
    completedRounds,
    currentRoundIndex: firstIncomplete?.index || null,
    suggestedNextItemId,
    totalRequiredSets,
    loggedRequiredSets,
    status: totalRequiredSets > 0 && loggedRequiredSets >= totalRequiredSets
      ? 'complete'
      : loggedRequiredSets > 0
        ? 'in_progress'
        : 'not_started',
  });
}

export function missingSupersetRoundItemIds<T extends SupersetRoundSourceItem>(
  model: SupersetRoundModel<T>,
  roundIndex: number,
): number[] {
  const round = model.rounds.find((candidate) => candidate.index === roundIndex);
  if (!round) return [];
  return round.entries
    .filter((entry) => !entry.log)
    .map((entry) => entry.itemId);
}
