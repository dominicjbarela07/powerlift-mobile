export type ProgrammedSetItem = Readonly<{
  variant?: unknown;
  scheme?: unknown;
  sets?: unknown;
  planned_sets?: readonly unknown[] | null;
}>;

export type ProgrammedSetGroup = Readonly<{
  items?: readonly ProgrammedSetItem[] | null;
}>;

export type ProgrammedSetDraft = Readonly<{
  sourceVariant?: unknown;
  scheme?: unknown;
  sets?: unknown;
  backdownSets?: unknown;
  plannedSets?: readonly unknown[] | null;
}>;

function positiveProgrammedSetCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function isFullCustom(item: ProgrammedSetItem): boolean {
  return [item.variant, item.scheme]
    .some((value) => String(value || '').trim().toUpperCase() === 'FULL_CUSTOM');
}

/**
 * Canonical programmed-set count shared by the Session Logger and coach
 * programming workspace. Full Custom rows are the authoritative set model;
 * every other prescription uses the persisted set count.
 */
export function programmedSetCountForItem(item: ProgrammedSetItem): number {
  if (isFullCustom(item) && Array.isArray(item.planned_sets) && item.planned_sets.length > 0) {
    return item.planned_sets.length;
  }
  return positiveProgrammedSetCount(item.sets);
}

export function programmedSetCountForDraft(
  draft: ProgrammedSetDraft,
  kind: 'core' | 'accessory',
): number {
  if (kind === 'accessory' || String(draft.sourceVariant || '').trim().toUpperCase() === 'BK') {
    return programmedSetCountForItem({ sets: draft.sets });
  }
  const scheme = String(draft.scheme || '').trim().toUpperCase();
  if (scheme === 'FULL_CUSTOM') {
    return programmedSetCountForItem({
      variant: 'FULL_CUSTOM',
      sets: draft.sets,
      planned_sets: draft.plannedSets,
    });
  }
  if (scheme === 'TOP_BACKDOWN') {
    return programmedSetCountForItem({ sets: draft.sets })
      + programmedSetCountForItem({ sets: draft.backdownSets });
  }
  return programmedSetCountForItem({ sets: draft.sets });
}

export function programmedSetCountForSession({
  coreItems,
  accessoryGroups,
}: {
  coreItems?: readonly ProgrammedSetItem[] | null;
  accessoryGroups?: readonly ProgrammedSetGroup[] | null;
}): number {
  const coreTotal = (coreItems || []).reduce(
    (total, item) => total + programmedSetCountForItem(item),
    0,
  );
  const accessoryTotal = (accessoryGroups || []).reduce(
    (total, group) => total + (group.items || []).reduce(
      (groupTotal, item) => groupTotal + programmedSetCountForItem(item),
      0,
    ),
    0,
  );
  return coreTotal + accessoryTotal;
}
