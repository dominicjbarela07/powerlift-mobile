export type CoreSetTimelineKind = 'top' | 'backdown';

function positiveSetNumber(value: number): number {
  const normalized = Math.trunc(Number(value));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
}

export function coreSetTimelineLabel(
  kind: CoreSetTimelineKind,
  setIndex: number,
  totalSets: number,
): string {
  const index = positiveSetNumber(setIndex);
  const total = positiveSetNumber(totalSets);

  if (kind === 'top') {
    return total > 1 ? `TOP ${index}` : 'TOP';
  }

  return `BD ${index}`;
}
