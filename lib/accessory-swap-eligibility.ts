export type AccessorySwapAction = 'Swap' | 'Sub' | null;

type SetLogCollection = { set_logs?: readonly unknown[] | null };
type AccessoryGroupCollection = { items?: readonly SetLogCollection[] | null };

export type SessionSetLogProjection = {
  core_items?: readonly SetLogCollection[] | null;
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

export function sessionHasPersistedSetLogs(
  workout?: SessionSetLogProjection | null,
): boolean {
  if (!workout) return false;

  if ((workout.core_items || []).some((item) => (item.set_logs || []).length > 0)) {
    return true;
  }

  return (workout.accessory_groups || []).some((group) =>
    (group.items || []).some((item) => (item.set_logs || []).length > 0),
  );
}

export function accessorySwapActionForSession({
  canHotSwap,
  hasApprovedSubstitutions,
  isCoachPreview,
  sessionLifecycle,
  sessionHasSetLogs,
  acceptedPersistedSetLog,
}: {
  canHotSwap: boolean;
  hasApprovedSubstitutions: boolean;
  isCoachPreview: boolean;
  sessionLifecycle: string | null | undefined;
  sessionHasSetLogs: boolean;
  acceptedPersistedSetLog?: boolean;
}): AccessorySwapAction {
  if (isCoachPreview || sessionHasSetLogs || acceptedPersistedSetLog) return null;
  if (!SWAPPABLE_SESSION_LIFECYCLES.has(String(sessionLifecycle || '').trim().toLowerCase())) {
    return null;
  }
  if (canHotSwap) return 'Swap';
  if (hasApprovedSubstitutions) return 'Sub';
  return null;
}
