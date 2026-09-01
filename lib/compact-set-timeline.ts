export type CompactSetTimelineState = 'completed' | 'active' | 'locked';

export function toggleCompletedSetSelection(
  currentKey: string | null,
  row: Readonly<{ key: string; state: CompactSetTimelineState }>,
) {
  if (row.state !== 'completed') return currentKey;
  return currentKey === row.key ? null : row.key;
}

export function compactTimelineScrollOffset(index: number) {
  return Math.max(0, (Math.max(0, index) * 70) - 70);
}
