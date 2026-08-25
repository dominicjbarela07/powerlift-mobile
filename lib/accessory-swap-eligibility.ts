export type AccessorySwapAction = 'Swap' | 'Sub' | null;

export type ItemSetLogProjection = {
  id?: number | string | null;
  set_logs?: readonly unknown[] | null;
  has_performed_evidence?: boolean | null;
};

type AccessoryGroupCollection = {
  items?: readonly ItemSetLogProjection[] | null;
};

export type SessionSetLogProjection = {
  core_items?: readonly ItemSetLogProjection[] | null;
  accessory_groups?: readonly AccessoryGroupCollection[] | null;
};

const SWAPPABLE_SESSION_LIFECYCLES = new Set([
  'assigned',
  'draft',
  'tardy',
  'in_progress',
  'pre_session',
  'active_session',
]);

export function itemHasPersistedSetLogs(
  item?: ItemSetLogProjection | null,
): boolean {
  return item?.has_performed_evidence === true || (item?.set_logs || []).length > 0;
}

export function persistedSetLogItemIds(
  workout?: SessionSetLogProjection | null,
): number[] {
  if (!workout) return [];

  const items = [
    ...(workout.core_items || []),
    ...(workout.accessory_groups || []).flatMap((group) => group.items || []),
  ];

  return items
    .filter(itemHasPersistedSetLogs)
    .map((item) => Number(item.id || 0))
    .filter((itemId) => itemId > 0);
}

export function accessorySwapActionForItem({
  canHotSwap,
  hasApprovedSubstitutions,
  isCoachPreview,
  sessionLifecycle,
  targetItemHasSetLogs,
  acceptedPersistedSetLogForItem,
}: {
  canHotSwap: boolean;
  hasApprovedSubstitutions: boolean;
  isCoachPreview: boolean;
  sessionLifecycle: string | null | undefined;
  targetItemHasSetLogs: boolean;
  acceptedPersistedSetLogForItem?: boolean;
}): AccessorySwapAction {
  if (isCoachPreview) return null;
  if (targetItemHasSetLogs || acceptedPersistedSetLogForItem) return null;
  if (!SWAPPABLE_SESSION_LIFECYCLES.has(String(sessionLifecycle || '').trim().toLowerCase())) {
    return null;
  }
  if (canHotSwap) return 'Swap';
  if (hasApprovedSubstitutions) return 'Sub';
  return null;
}
