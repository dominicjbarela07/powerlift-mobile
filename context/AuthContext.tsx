// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { fetchJson, subscribeAccountStateBlocks, type AccountStatePayload } from '@/lib/api';
import {
  isProductionIdealStateActive,
  productionIdealAuthUser,
  useDevLiveScreenSession,
} from '@/lib/release-preview-stubs';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';
import {
  parseDisplayWeightUnit,
  preferredUnitFromSettingsPayload,
  type DisplayWeightUnit,
} from '@/lib/display-units';
import { startVideoUploadQueue, stopVideoUploadQueue } from '@/lib/videoUploadQueue';

// Shape of the authenticated user coming from your Flask API
export type AuthUser = {
  id?: number | null;
  user_id?: number | null;
  email: string;
  user_name: string | null;
  role: 'coach' | 'athlete';
  is_coach: boolean;
  workspace_mode?: 'team' | 'individual';
  available_mobile_modes?: Array<'athlete' | 'coach' | 'individual' | string>;
  mobile_mode?: 'athlete' | 'coach' | 'individual' | string | null;
  can_access_internal_self_coach_mobile_mode?: boolean;
  is_individual_workspace?: boolean;
  is_self_coached?: boolean;
  self_athlete_id?: number | null;
  account_state?: string | null;
  next_url?: string | null;
  next_route?: string | null;
  can_access_product?: boolean;
  link_coach_required?: boolean;
  account_state_detail?: any;
  email_verified?: boolean;
  verification_required?: boolean;
  verification_url?: string | null;
  billing_required?: boolean;
  billing_url?: string | null;
  dev_onboarding_simulation_enabled?: boolean;
  has_linked_athlete: boolean;
  athlete_id: number | null;
  preferred_units?: DisplayWeightUnit | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
};

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const MANUAL_TIMEZONE_KEY = 'athlete_manual_timezone';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  authReady: boolean;
  login: (payload: { user: AuthUser; token: string | null }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccountState: () => Promise<AuthUser | null>;
  applyAccountStatePayload: (payload: AccountStatePayload) => Promise<AuthUser | null>;
  updateProfilePhoto: (payload: unknown) => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

// 👇 Named export – this is what you import in _layout.tsx:
// import { AuthProvider } from '@/context/AuthContext';
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const userRef = useRef<AuthUser | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshAccountStatePromiseRef = useRef<Promise<AuthUser | null> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const persistUser = useCallback(async (nextUser: AuthUser | null) => {
    setUser(nextUser);
    userRef.current = nextUser;
    if (nextUser) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  }, []);

  const mergeAccountStatePayload = useCallback((base: AuthUser, payload: AccountStatePayload = {}): AuthUser => {
    const payloadUser = (payload.user || {}) as Record<string, any>;
    const payloadAthlete = ((payload as any).athlete || {}) as Record<string, any>;
    const profilePhoto = normalizeProfilePhotoPayload(payloadUser);
    const accountState = payloadUser.account_state ?? payload.account_state ?? base.account_state ?? null;
    const payloadVerificationRequired =
      payloadUser.verification_required !== undefined
        ? payloadUser.verification_required
        : payload.verification_required;
    const blocked =
      payload.can_access_product === false ||
      payloadUser.can_access_product === false ||
      accountState === 'EMAIL_VERIFICATION_REQUIRED' ||
      accountState === 'ACTIVATION_REQUIRED' ||
      accountState === 'LINK_COACH_REQUIRED';
    const role = payloadUser.role === 'coach' || payload.role === 'coach' ? 'coach' : base.role;
    const isCoach = role === 'coach';
    const hasLinkedAthlete =
      payload.link_coach_required === true || payloadUser.link_coach_required === true
        ? false
        : payloadUser.has_linked_athlete === true
        ? true
        : base.has_linked_athlete;

    return {
      ...base,
      id: payloadUser.id ?? payloadUser.user_id ?? base.id ?? base.user_id ?? null,
      user_id: payloadUser.user_id ?? payloadUser.id ?? base.user_id ?? base.id ?? null,
      email: String(payloadUser.email || base.email || ''),
      user_name: payloadUser.name ?? payloadUser.user_name ?? base.user_name ?? null,
      role,
      is_coach: isCoach,
      workspace_mode: (payloadUser.workspace_mode ?? payload.workspace_mode ?? base.workspace_mode) as AuthUser['workspace_mode'],
      available_mobile_modes:
        Array.isArray(payloadUser.available_mobile_modes)
          ? payloadUser.available_mobile_modes
          : Array.isArray((payload as any).available_mobile_modes)
          ? (payload as any).available_mobile_modes
          : base.available_mobile_modes,
      mobile_mode: payloadUser.mobile_mode ?? (payload as any).mobile_mode ?? base.mobile_mode ?? null,
      can_access_internal_self_coach_mobile_mode:
        payloadUser.can_access_internal_self_coach_mobile_mode === true ||
        (payload as any).can_access_internal_self_coach_mobile_mode === true ||
        base.can_access_internal_self_coach_mobile_mode === true,
      is_individual_workspace:
        payloadUser.is_individual_workspace === true
          ? true
          : payloadUser.is_individual_workspace === false
          ? false
          : base.is_individual_workspace,
      is_self_coached:
        payloadAthlete.is_self_coached === true
          ? true
          : payloadAthlete.is_self_coached === false
          ? false
          : payloadUser.is_self_coached === true
          ? true
          : payloadUser.is_self_coached === false
          ? false
          : base.is_self_coached,
      self_athlete_id: payloadUser.self_athlete_id ?? base.self_athlete_id ?? null,
      account_state: accountState,
      next_url: payloadUser.next_url ?? payload.next_url ?? base.next_url ?? null,
      next_route: payloadUser.next_route ?? payload.next_route ?? base.next_route ?? null,
      can_access_product:
        payloadUser.can_access_product === false || payload.can_access_product === false
          ? false
          : payloadUser.can_access_product === true || payload.can_access_product === true
          ? true
          : blocked
          ? false
          : base.can_access_product,
      link_coach_required:
        payloadUser.link_coach_required === true || payload.link_coach_required === true || accountState === 'LINK_COACH_REQUIRED'
          ? true
          : payloadUser.link_coach_required === false || payload.link_coach_required === false
          ? false
          : base.link_coach_required,
      account_state_detail: payloadUser.account_state_detail ?? payload.account_state_detail ?? base.account_state_detail,
      email_verified:
        payloadUser.email_verified === false || payload.email_verified === false
          ? false
          : payloadUser.email_verified === true || payload.email_verified === true
          ? true
          : accountState === 'EMAIL_VERIFICATION_REQUIRED'
          ? false
          : payloadVerificationRequired === false && accountState
          ? true
          : base.email_verified,
      verification_required:
        payloadUser.verification_required === true ||
        payload.verification_required === true ||
        accountState === 'EMAIL_VERIFICATION_REQUIRED'
          ? true
          : payloadUser.verification_required === false || payload.verification_required === false
          ? false
          : base.verification_required,
      verification_url: payloadUser.verification_url ?? payload.verification_url ?? base.verification_url ?? null,
      billing_required:
        payloadUser.billing_required === true || payload.billing_required === true || accountState === 'ACTIVATION_REQUIRED'
          ? true
          : payloadUser.billing_required === false || payload.billing_required === false
          ? false
          : base.billing_required,
      billing_url: payloadUser.billing_url ?? payload.billing_url ?? base.billing_url ?? null,
      dev_onboarding_simulation_enabled:
        payloadUser.dev_onboarding_simulation_enabled === true ||
        payload.dev_onboarding_simulation_enabled === true ||
        base.dev_onboarding_simulation_enabled === true,
      has_linked_athlete: hasLinkedAthlete,
      athlete_id:
        payload.athlete_id !== undefined
          ? payload.athlete_id
          : payloadUser.athlete_id !== undefined
          ? payloadUser.athlete_id
          : base.athlete_id,
      preferred_units: parseDisplayWeightUnit(payloadUser.preferred_units) ?? base.preferred_units ?? null,
      profilePhotoUrl: profilePhoto.hasProfilePhotoValue
        ? profilePhoto.profilePhotoUrl
        : base.profilePhotoUrl ?? null,
      profilePhotoVersion: profilePhoto.hasProfilePhotoValue
        ? profilePhoto.profilePhotoVersion
        : base.profilePhotoVersion ?? null,
    };
  }, []);

  const updateProfilePhoto = useCallback(
    async (payload: unknown) => {
      const current = userRef.current;
      if (!current) return null;
      const profilePhoto = normalizeProfilePhotoPayload(payload);
      if (!profilePhoto.hasProfilePhotoValue) return current;
      const nextUser: AuthUser = {
        ...current,
        profilePhotoUrl: profilePhoto.profilePhotoUrl,
        profilePhotoVersion: profilePhoto.profilePhotoVersion,
      };
      await persistUser(nextUser);
      return nextUser;
    },
    [persistUser]
  );

  const applyAccountStatePayload = useCallback(
    async (payload: AccountStatePayload = {}) => {
      const current = userRef.current;
      if (!current) return null;
      const nextUser = mergeAccountStatePayload(current, payload);
      await persistUser(nextUser);
      return nextUser;
    },
    [mergeAccountStatePayload, persistUser]
  );

  const refreshAccountState = useCallback(async () => {
    if (refreshAccountStatePromiseRef.current) {
      return refreshAccountStatePromiseRef.current;
    }
    const current = userRef.current;
    const currentToken = tokenRef.current;
    if (!current || !currentToken) return current;

    refreshAccountStatePromiseRef.current = (async () => {
      const [profile, settings] = await Promise.all([
        fetchJson<any>('/mobile/me', { method: 'GET' }),
        fetchJson<any>('/mobile/settings', { method: 'GET' }),
      ]);
      const preferredUnits = preferredUnitFromSettingsPayload(settings.ok ? settings.json : null);
      const payload = profile.json || {};
      if (profile.ok && payload?.user) {
        const athlete = payload.athlete || {};
        const nextUser = mergeAccountStatePayload(current, {
          ...payload,
          user: payload.user,
          athlete_id: payload.athlete_id ?? (athlete.coach_id ? athlete.id : payload.athlete_id),
          link_coach_required:
            payload.link_coach_required === true ||
            payload.user?.link_coach_required === true ||
            (payload.user?.role === 'athlete' && !athlete.coach_id),
        });
        nextUser.has_linked_athlete = !!athlete.coach_id;
        nextUser.athlete_id = athlete.coach_id ? athlete.id ?? nextUser.athlete_id ?? null : nextUser.athlete_id ?? null;
        nextUser.preferred_units = preferredUnits ?? nextUser.preferred_units ?? null;
        await persistUser(nextUser);
        return nextUser;
      }
      if (profile.status === 401) {
        await logout();
        return null;
      }
      if (payload && typeof payload === 'object') {
        return applyAccountStatePayload(payload);
      }
      return current;
    })().finally(() => {
      refreshAccountStatePromiseRef.current = null;
    });

    return refreshAccountStatePromiseRef.current;
  }, [applyAccountStatePayload, mergeAccountStatePayload, persistUser]);

  async function login(payload: { user: AuthUser; token: string | null }) {
    const profilePhoto = normalizeProfilePhotoPayload(payload.user);
    await persistUser({
      ...payload.user,
      profilePhotoUrl: profilePhoto.hasProfilePhotoValue
        ? profilePhoto.profilePhotoUrl
        : payload.user.profilePhotoUrl ?? null,
      profilePhotoVersion: profilePhoto.hasProfilePhotoValue
        ? profilePhoto.profilePhotoVersion
        : payload.user.profilePhotoVersion ?? null,
    });
    setToken(payload.token);
    tokenRef.current = payload.token;

    if (payload.token) {
      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
      const settings = await fetchJson<any>('/mobile/settings', { method: 'GET' });
      const preferredUnits = preferredUnitFromSettingsPayload(settings.ok ? settings.json : null);
      if (preferredUnits && userRef.current) {
        await persistUser({ ...userRef.current, preferred_units: preferredUnits });
      }
    }
    startVideoUploadQueue();
  }

  async function logout() {
    stopVideoUploadQueue();
    await persistUser(null);
    setToken(null);
    tokenRef.current = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(MANUAL_TIMEZONE_KEY);
  }

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);

        if (storedToken) {
          setToken(storedToken);
          tokenRef.current = storedToken;
        }
        if (storedToken) startVideoUploadQueue();
        let restoredUser: AuthUser | null = null;
        if (storedUser) {
          restoredUser = JSON.parse(storedUser);
          setUser(restoredUser);
          userRef.current = restoredUser;
        }

        if (storedToken) {
          const [profile, settings] = await Promise.all([
            fetchJson<any>('/mobile/me', { method: 'GET' }),
            fetchJson<any>('/mobile/settings', { method: 'GET' }),
          ]);
          const preferredUnits = preferredUnitFromSettingsPayload(settings.ok ? settings.json : null);
          const profileUser = profile.json?.user;
          if (profile.ok && profileUser) {
            const profilePhoto = normalizeProfilePhotoPayload(profileUser);
            const refreshedUser: AuthUser = {
              id: profileUser.id ?? profileUser.user_id ?? restoredUser?.id ?? restoredUser?.user_id ?? null,
              user_id: profileUser.user_id ?? profileUser.id ?? restoredUser?.user_id ?? restoredUser?.id ?? null,
              email: String(profileUser.email || restoredUser?.email || ''),
              user_name: profileUser.name ?? restoredUser?.user_name ?? null,
              role: profileUser.role === 'coach' ? 'coach' : 'athlete',
              is_coach: profileUser.role === 'coach',
              workspace_mode: profileUser.workspace_mode,
              is_individual_workspace: profileUser.is_individual_workspace === true,
              is_self_coached:
                profile.json?.athlete?.is_self_coached === true
                || profileUser.is_self_coached === true,
              self_athlete_id:
                profileUser.self_athlete_id
                ?? (profile.json?.athlete?.is_self_coached === true ? profile.json?.athlete?.id : null),
              account_state: profileUser.account_state ?? profile.json?.account_state ?? restoredUser?.account_state ?? null,
              next_url: profileUser.next_url ?? profile.json?.next_url ?? restoredUser?.next_url ?? null,
              next_route: profileUser.next_route ?? profile.json?.next_route ?? restoredUser?.next_route ?? null,
              can_access_product:
                profileUser.can_access_product === false || profile.json?.can_access_product === false
                  ? false
                  : profileUser.can_access_product === true || profile.json?.can_access_product === true
                  ? true
                  : restoredUser?.can_access_product,
              link_coach_required:
                profileUser.link_coach_required === true || profile.json?.link_coach_required === true,
              account_state_detail:
                profileUser.account_state_detail ?? profile.json?.account_state_detail ?? restoredUser?.account_state_detail,
              email_verified: profileUser.email_verified !== false,
              verification_required: profileUser.verification_required === true,
              verification_url: profileUser.verification_url ?? restoredUser?.verification_url ?? null,
              billing_required:
                profileUser.billing_required === true
                  ? true
                  : profileUser.billing_required === false
                  ? false
                  : restoredUser?.billing_required === true,
              billing_url: profileUser.billing_url ?? restoredUser?.billing_url ?? null,
              dev_onboarding_simulation_enabled:
                profileUser.dev_onboarding_simulation_enabled === true ||
                restoredUser?.dev_onboarding_simulation_enabled === true,
              has_linked_athlete: !!profile.json?.athlete?.coach_id,
              athlete_id: profile.json?.athlete?.coach_id ? profile.json?.athlete?.id ?? null : null,
              preferred_units: preferredUnits ?? restoredUser?.preferred_units ?? null,
              profilePhotoUrl: profilePhoto.hasProfilePhotoValue
                ? profilePhoto.profilePhotoUrl
                : restoredUser?.profilePhotoUrl ?? null,
              profilePhotoVersion: profilePhoto.hasProfilePhotoValue
                ? profilePhoto.profilePhotoVersion
                : restoredUser?.profilePhotoVersion ?? null,
            };
            await persistUser(refreshedUser);
          } else if (restoredUser && (profile.status === 402 || profile.status === 403)) {
            const refreshedUser: AuthUser = {
              ...restoredUser,
              email_verified:
                profile.status === 403 && String((profile.json as any)?.error || '').includes('email verification')
                  ? false
                  : restoredUser.email_verified,
              verification_required:
                profile.status === 403 && String((profile.json as any)?.error || '').includes('email verification')
                  ? true
                  : restoredUser.verification_required,
              verification_url: (profile.json as any)?.verification_url ?? restoredUser.verification_url ?? null,
              billing_required:
                (profile.json as any)?.billing_required === true ||
                (profile.json as any)?.account_state === 'ACTIVATION_REQUIRED' ||
                (profile.status === 402 && String((profile.json as any)?.error || '').includes('billing'))
                  ? true
                  : restoredUser.billing_required,
              billing_url: (profile.json as any)?.billing_url ?? restoredUser.billing_url ?? null,
              account_state: (profile.json as any)?.account_state ?? restoredUser.account_state ?? null,
              next_url: (profile.json as any)?.next_url ?? restoredUser.next_url ?? null,
              next_route: (profile.json as any)?.next_route ?? restoredUser.next_route ?? null,
              can_access_product:
                (profile.json as any)?.can_access_product === false
                  ? false
                  : (profile.json as any)?.can_access_product === true
                  ? true
                  : restoredUser.can_access_product,
              link_coach_required:
                (profile.json as any)?.link_coach_required === true || restoredUser.link_coach_required === true,
              account_state_detail:
                (profile.json as any)?.account_state_detail ?? restoredUser.account_state_detail,
              dev_onboarding_simulation_enabled:
                (profile.json as any)?.dev_onboarding_simulation_enabled === true ||
                restoredUser.dev_onboarding_simulation_enabled === true,
            };
            await persistUser(refreshedUser);
          }
        }
      } catch (e) {
        console.warn('Failed to restore auth state', e);
      } finally {
        setAuthReady(true);
      }
    })();
  }, [persistUser]);

  useEffect(() => {
    return subscribeAccountStateBlocks((payload) => {
      void applyAccountStatePayload(payload);
    });
  }, [applyAccountStatePayload]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshAccountState();
      }
    });
    return () => subscription.remove();
  }, [refreshAccountState]);

  const value: AuthContextValue = {
    user,
    token,
    authReady,
    login,
    logout,
    refreshAccountState,
    applyAccountStatePayload,
    updateProfilePhoto,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to read auth state anywhere in the app
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  useDevLiveScreenSession();
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  if (
    typeof __DEV__ !== 'undefined'
    && __DEV__
    && isProductionIdealStateActive()
  ) {
    const idealUser = productionIdealAuthUser();
    if (idealUser !== undefined) {
      const currentIdealUser = () => Promise.resolve(idealUser);
      return {
        user: idealUser,
        token: idealUser ? 'dev-ideal-state-token' : null,
        authReady: true,
        login: async () => undefined,
        logout: async () => undefined,
        refreshAccountState: currentIdealUser,
        applyAccountStatePayload: currentIdealUser,
        updateProfilePhoto: currentIdealUser,
      };
    }
  }
  return ctx;
}

// ⚠️ No default export here on purpose – we only use named exports.
