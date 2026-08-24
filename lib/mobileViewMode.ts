import AsyncStorage from '@react-native-async-storage/async-storage';

export type MobileViewMode = 'coach' | 'athlete' | 'individual';

export type MobileModeIdentity = {
  role?: string | null;
  is_coach?: boolean | null;
  workspace_mode?: string | null;
  is_individual_workspace?: boolean | null;
  is_self_coached?: boolean | null;
  available_mobile_modes?: string[] | null;
  mobile_mode?: string | null;
  can_access_internal_self_coach_mobile_mode?: boolean | null;
};

export const MOBILE_VIEW_MODE_KEY = 'mobile_view_mode';

export function normalizeMobileViewMode(value: unknown): MobileViewMode | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'coach' || normalized === 'athlete' || normalized === 'individual'
    ? normalized
    : null;
}

/**
 * Resolve presentation mode without rewriting relationship truth. In particular,
 * `is_self_coached` describes authority/relationships and must never force the
 * Athlete/Self-Coach shell when an account is currently in Coach presentation.
 */
export function resolveActiveMobileMode(user?: MobileModeIdentity | null): MobileViewMode {
  if (!user) return 'athlete';

  const available = Array.isArray(user.available_mobile_modes)
    ? user.available_mobile_modes
        .map(normalizeMobileViewMode)
        .filter((mode): mode is MobileViewMode => mode !== null)
    : [];
  const selected = normalizeMobileViewMode(user.mobile_mode);
  if (selected && (!available.length || available.includes(selected))) return selected;

  const isCoach = user.is_coach === true || user.role === 'coach';
  const isDedicatedIndividual =
    (user.workspace_mode === 'individual' || user.is_individual_workspace === true) &&
    user.can_access_internal_self_coach_mobile_mode !== true;
  if (available.length === 1) return available[0];
  if (isDedicatedIndividual) return 'individual';
  return isCoach ? 'coach' : 'athlete';
}

export async function saveMobileViewMode(mode: MobileViewMode) {
  await AsyncStorage.setItem(MOBILE_VIEW_MODE_KEY, mode);
}
