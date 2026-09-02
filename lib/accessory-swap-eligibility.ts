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

  // Explicit Session permissions are relationship-authoritative, including
  // false. Cached account state is used only for older backends that omitted
  // both Session-level fields; presentation mode never grants authority.
  if (permissionIsSelfCoached != null) {
    return permissionIsSelfCoached ? 'self_governed' : 'coach_restricted';
  }
  if (canHotSwap != null) {
    return canHotSwap ? 'self_governed' : 'coach_restricted';
  }
  return accountIsSelfCoached ? 'self_governed' : 'coach_restricted';
}

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
  substitutionAuthority,
  hasApprovedSubstitutions,
  isCoachPreview,
  sessionLifecycle,
  targetItemHasSetLogs,
  targetItemHasRemainingSets = true,
  acceptedPersistedSetLogForItem,
}: {
  substitutionAuthority: SubstitutionAuthority;
  hasApprovedSubstitutions: boolean;
  isCoachPreview: boolean;
  sessionLifecycle: string | null | undefined;
  targetItemHasSetLogs: boolean;
  targetItemHasRemainingSets?: boolean;
  acceptedPersistedSetLogForItem?: boolean;
}): AccessorySwapAction {
  if (isCoachPreview) return null;
  if (!SWAPPABLE_SESSION_LIFECYCLES.has(String(sessionLifecycle || '').trim().toLowerCase())) {
    return null;
  }
  // Performed evidence is the permanent movement-level boundary. Once the
  // server has accepted any set for this item, neither a free self-coach swap
  // nor an approved substitution may remain reachable.
  if (targetItemHasSetLogs || acceptedPersistedSetLogForItem) return null;
  if (!targetItemHasRemainingSets) return null;
  if (substitutionAuthority === 'self_governed') return 'Swap';
  if (substitutionAuthority === 'coach_restricted' && hasApprovedSubstitutions) return 'Sub';
  return null;
}
