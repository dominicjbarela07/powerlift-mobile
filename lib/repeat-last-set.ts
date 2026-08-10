export type RepeatableSetActuals = Readonly<{
  set_index?: number | null;
  actual_weight_kg?: number | null;
  actual_reps?: number | null;
  actual_rpe?: number | null;
  actual_rir?: number | null;
}>;

export type CoreRepeatDraft = Readonly<{
  weight: string;
  reps: string;
  rpe: string;
}>;

export type AccessoryRepeatDraft = Readonly<{
  weight: string;
  reps: string;
  rir: string;
}>;

function formatEffort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function latestRepeatableSet<T extends RepeatableSetActuals>(
  logs: readonly T[] | null | undefined,
): T | null {
  if (!logs?.length) return null;
  return [...logs].sort(
    (left, right) => Number(right.set_index || 0) - Number(left.set_index || 0),
  )[0] || null;
}

export function coreRepeatDraft(
  log: RepeatableSetActuals,
  displayedWeight: string,
): CoreRepeatDraft {
  return Object.freeze({
    weight: displayedWeight,
    reps: log.actual_reps == null ? '' : String(log.actual_reps),
    rpe: formatEffort(log.actual_rpe),
  });
}

export function accessoryRepeatDraft(
  log: RepeatableSetActuals,
  displayedWeight: string,
): AccessoryRepeatDraft {
  return Object.freeze({
    weight: displayedWeight,
    reps: log.actual_reps == null ? '' : String(log.actual_reps),
    rir: formatEffort(log.actual_rir),
  });
}
