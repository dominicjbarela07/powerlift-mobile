export type RepeatableSetActuals = Readonly<{
  id?: number | null;
  set_index?: number | null;
  actual_weight_kg?: number | null;
  actual_reps?: number | null;
  actual_rpe?: number | null;
  actual_rir?: number | null;
}>;

export type RepeatSetPreviewOptions = Readonly<{
  loadLabel: string;
  effort: 'RPE' | 'RIR';
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
  return [...logs].sort((left, right) => {
    const idDelta = Number(right.id || 0) - Number(left.id || 0);
    if (idDelta !== 0) return idDelta;
    return Number(right.set_index || 0) - Number(left.set_index || 0);
  })[0] || null;
}

export function repeatSetPreview(
  log: RepeatableSetActuals,
  options: RepeatSetPreviewOptions,
): string {
  const reps = log.actual_reps == null ? '—' : String(log.actual_reps);
  const effortValue = options.effort === 'RPE' ? log.actual_rpe : log.actual_rir;
  const effort = formatEffort(effortValue);
  return [
    `${options.loadLabel} × ${reps}`,
    effort ? `${options.effort} ${effort}` : null,
  ].filter(Boolean).join(' · ');
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
