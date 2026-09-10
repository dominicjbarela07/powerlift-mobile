export function moveSessionItemIds(
  ids: readonly number[],
  id: number,
  targetIndex: number,
): number[] {
  const currentIndex = ids.indexOf(id);
  if (currentIndex < 0 || ids.length < 2) return [...ids];
  const nextIndex = Math.max(0, Math.min(ids.length - 1, targetIndex));
  if (nextIndex === currentIndex) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}
