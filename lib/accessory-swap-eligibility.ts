export type AccessorySwapAction = 'Swap' | 'Sub' | null;

export type SubstitutionAuthority =
  | 'self_governed'
  | 'coach_restricted'
  | 'none';

export function resolveSubstitutionAuthority({
  serverAuthority,
  canHotSwap,
  permissionIsSelfCoached,
  accountIsSelfCoached,
  isCoachPreview,
}: {
  serverAuthority?: string | null;
  canHotSwap?: boolean | null;
  permissionIsSelfCoached?: boolean | null;
  accountIsSelfCoached?: boolean | null;
  isCoachPreview: boolean;
}): SubstitutionAuthority {
  if (isCoachPreview) return 'none';

  const normalized = String(serverAuthority || '').trim().toLowerCase();
  if (normalized === 'self_governed' || normalized === 'coach_restricted' || normalized === 'none') {
    return normalized;
  }

  // Compatibility for a TestFlight client talking to a backend deployed
  // before the explicit authority field. Both legacy signals are still
  // server-derived relationship facts; UI mode never grants authority.
  if (canHotSwap || permissionIsSelfCoached || accountIsSelfCoached) {
    return 'self_governed';
  }
  return 'coach_restricted';
}

export type ItemSetLogProjection = {
  id?: number | string | null;
  set_logs?: readonly unknown[] | null;
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
  return (item?.set_logs || []).length > 0;
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
  substitutionAuthority,
  hasApprovedSubstitutions,
  isCoachPreview,
  sessionLifecycle,
  targetItemHasSetLogs,
  acceptedPersistedSetLogForItem,
}: {
  substitutionAuthority: SubstitutionAuthority;
  hasApprovedSubstitutions: boolean;
  isCoachPreview: boolean;
  sessionLifecycle: string | null | undefined;
  targetItemHasSetLogs: boolean;
  acceptedPersistedSetLogForItem?: boolean;
}): AccessorySwapAction {
  // Existing SetLogs are immutable snapshots. They do not prevent changing
  // the governed movement used by future sets in the same active Session.
  if (isCoachPreview) return null;
  if (!SWAPPABLE_SESSION_LIFECYCLES.has(String(sessionLifecycle || '').trim().toLowerCase())) {
    return null;
  }
  if (substitutionAuthority === 'self_governed') return 'Swap';
  if (substitutionAuthority === 'coach_restricted' && hasApprovedSubstitutions) return 'Sub';
  return null;
}
