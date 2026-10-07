import type { AuthUser } from '@/context/AuthContext';
import type { MobileViewMode } from '@/lib/mobileViewMode';

export const MOBILE_EDUCATION_CAMPAIGN = 'mobile-3.0';

export type EducationRole = 'individual' | 'coach' | 'athlete';
export type EducationFeature = 'active-session-edit' | 'equipment-history' | 'athlete-workspace' | 'movement-history';
export type EducationDestination = 'ledger' | 'review-hub';

export type MobileEducationState = {
  campaign: typeof MOBILE_EDUCATION_CAMPAIGN;
  introductionComplete: boolean;
  guidanceEnabled: boolean;
  learned: EducationFeature[];
  dismissed: EducationFeature[];
  visited: EducationDestination[];
};

export const freshMobileEducationState = (): MobileEducationState => ({
  campaign: MOBILE_EDUCATION_CAMPAIGN,
  introductionComplete: false,
  guidanceEnabled: true,
  learned: [],
  dismissed: [],
  visited: [],
});

export function mobileEducationStorageKey(user: AuthUser): string | null {
  const id = user.id ?? user.user_id;
  return id == null ? null : `strength-ledger.education.${MOBILE_EDUCATION_CAMPAIGN}.user-${id}`;
}

export function restoreMobileEducationState(raw: string | null): MobileEducationState {
  if (!raw) return freshMobileEducationState();
  try {
    const parsed = JSON.parse(raw) as Partial<MobileEducationState>;
    if (parsed.campaign !== MOBILE_EDUCATION_CAMPAIGN) return freshMobileEducationState();
    const features: EducationFeature[] = ['active-session-edit', 'equipment-history', 'athlete-workspace', 'movement-history'];
    const destinations: EducationDestination[] = ['ledger', 'review-hub'];
    return {
      campaign: MOBILE_EDUCATION_CAMPAIGN,
      introductionComplete: parsed.introductionComplete === true,
      guidanceEnabled: parsed.guidanceEnabled !== false,
      learned: features.filter((item) => parsed.learned?.includes(item)),
      dismissed: features.filter((item) => parsed.dismissed?.includes(item)),
      visited: destinations.filter((item) => parsed.visited?.includes(item)),
    };
  } catch {
    return freshMobileEducationState();
  }
}

export function educationRoleForMode(user: AuthUser | null, mode: MobileViewMode): EducationRole | null {
  if (!user || !String(user.account_state || '').startsWith('READY') || user.can_access_product === false) return null;
  const available = user.available_mobile_modes || [];
  if (mode === 'individual') return available.includes('individual') || user.workspace_mode === 'individual' || user.is_individual_workspace === true ? 'individual' : null;
  if (mode === 'coach') return user.is_coach === true && (available.length === 0 || available.includes('coach')) ? 'coach' : null;
  return !user.is_coach || available.includes('athlete') ? 'athlete' : null;
}

export function hasMultipleEducationModes(user: AuthUser | null): boolean {
  if (!user?.is_coach) return false;
  const modes = user.available_mobile_modes || [];
  return modes.includes('coach') && modes.includes('individual');
}

export function shouldPresentMobileIntroduction({
  authReady, role, storageKey, loadedKey, onReadyHome, state,
}: {
  authReady: boolean;
  role: EducationRole | null;
  storageKey: string | null;
  loadedKey: string | null;
  onReadyHome: boolean;
  state: MobileEducationState;
}): boolean {
  return authReady && !!role && !!storageKey && loadedKey === storageKey && onReadyHome && !state.introductionComplete;
}

export function canOfferEducationFeature(role: EducationRole, feature: EducationFeature): boolean {
  if (feature === 'athlete-workspace') return role === 'coach';
  if (feature === 'movement-history') return role === 'athlete';
  return role === 'individual' || role === 'athlete';
}

export function shouldOfferEducationHint(state: MobileEducationState, role: EducationRole | null, feature: EducationFeature): boolean {
  return !!role && state.introductionComplete && state.guidanceEnabled && canOfferEducationFeature(role, feature)
    && !state.learned.includes(feature) && !state.dismissed.includes(feature);
}

export function shouldShowEducationMarker(state: MobileEducationState, role: EducationRole | null, destination: EducationDestination): boolean {
  if (!role || !state.introductionComplete || state.visited.includes(destination)) return false;
  return destination === 'review-hub' ? role === 'coach' : role !== 'coach';
}

export function markEducationLearned(state: MobileEducationState, feature: EducationFeature): MobileEducationState {
  return state.learned.includes(feature) ? state : { ...state, learned: [...state.learned, feature] };
}

export function dismissEducationHint(state: MobileEducationState, feature: EducationFeature): MobileEducationState {
  return state.dismissed.includes(feature) ? state : { ...state, dismissed: [...state.dismissed, feature] };
}

export function visitEducationDestination(state: MobileEducationState, destination: EducationDestination): MobileEducationState {
  return state.visited.includes(destination) ? state : { ...state, visited: [...state.visited, destination] };
}

export function resetEducationGuidance(state: MobileEducationState): MobileEducationState {
  return { ...state, learned: [], dismissed: [] };
}

export function completeEducationIntroduction(state: MobileEducationState): MobileEducationState {
  return state.introductionComplete ? state : { ...state, introductionComplete: true };
}
