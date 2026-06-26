// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import {
  AppState,
  type AppStateStatus,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { fetchJson, subscribeBillingRequired } from '@/lib/api';
import { activationRefreshLog, bootDuration, bootLog, bootNow } from '@/lib/bootLogger';
import { resolveMobileLifecycle } from '@/lib/mobileLifecycle';
import { startVideoUploadQueue, stopVideoUploadQueue } from '@/lib/videoUploadQueue';

// Shape of the authenticated user coming from your Flask API
export type AuthUser = {
  email: string;
  user_name: string | null;
  role: 'coach' | 'athlete';
  is_coach: boolean;
  workspace_mode?: 'team' | 'individual';
  is_individual_workspace?: boolean;
  is_self_coached?: boolean;
  self_athlete_id?: number | null;
  email_verified?: boolean;
  verification_required?: boolean;
  verification_url?: string | null;
  billing_required?: boolean;
  billing_url?: string | null;
  account_state_verified?: boolean;
  has_linked_athlete: boolean;
  athlete_id: number | null;
};

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const MANUAL_TIMEZONE_KEY = 'athlete_manual_timezone';
const BOOT_PROFILE_TIMEOUT_MS = 5000;

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  authReady: boolean;
  accountStateError: string | null;
  accountStateRefreshing: boolean;
  refreshAccountState: (source?: AccountRefreshSource) => Promise<boolean>;
  login: (payload: { user: AuthUser; token: string | null }) => Promise<void>;
  logout: () => Promise<void>;
};

export type AccountRefreshSource = 'bootstrap' | 'background' | 'foreground' | 'poll' | 'manual' | 'verification';

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
  const [accountStateError, setAccountStateError] = useState<string | null>(null);
  const [accountStateRefreshing, setAccountStateRefreshing] = useState(false);
  const userRef = useRef<AuthUser | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  async function login(payload: { user: AuthUser; token: string | null }) {
    bootLog('auth_login_state_update', {
      has_token: !!payload.token,
      role: payload.user.role,
      verification_required: payload.user.verification_required === true,
      billing_required: payload.user.billing_required === true,
    });
    setUser(payload.user);
    userRef.current = payload.user;
    setToken(payload.token);
    tokenRef.current = payload.token;

    if (payload.token) {
      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(payload.user));
    startVideoUploadQueue();
  }

  async function logout() {
    bootLog('auth_logout');
    stopVideoUploadQueue();
    setUser(null);
    userRef.current = null;
    setToken(null);
    tokenRef.current = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(MANUAL_TIMEZONE_KEY);
  }

  function buildUserFromProfile(profileJson: any, restoredUser: AuthUser | null): AuthUser | null {
    const profileUser = profileJson?.user;
    if (!profileUser) return null;

    const profileVerificationRequired = profileUser.verification_required === true;
    const profileEmailVerified = profileUser.email_verified !== false;
    return {
      email: String(profileUser.email || restoredUser?.email || ''),
      user_name: profileUser.name ?? restoredUser?.user_name ?? null,
      role: profileUser.role === 'coach' ? 'coach' : 'athlete',
      is_coach: profileUser.role === 'coach',
      workspace_mode: profileUser.workspace_mode,
      is_individual_workspace: profileUser.is_individual_workspace === true,
      is_self_coached: profileUser.is_self_coached === true,
      self_athlete_id: profileUser.self_athlete_id ?? null,
      email_verified: profileEmailVerified,
      verification_required: profileVerificationRequired,
      verification_url: profileUser.verification_url ?? restoredUser?.verification_url ?? null,
      billing_required:
        profileVerificationRequired && !profileEmailVerified
          ? false
          : profileUser.billing_required === true
          ? true
          : profileUser.billing_required === false
          ? false
          : restoredUser?.billing_required === true,
      billing_url: profileUser.billing_url ?? restoredUser?.billing_url ?? null,
      account_state_verified: true,
      has_linked_athlete: !!profileJson?.athlete?.coach_id,
      athlete_id: profileJson?.athlete?.coach_id ? profileJson?.athlete?.id ?? null : null,
    };
  }

  function buildGuardedUserFromProfileStatus(profile: any, restoredUser: AuthUser): AuthUser {
    const profileError = String((profile.json as any)?.error || '');
    const normalizedError = profileError.toLowerCase();
    const profileBillingRequired =
      profile.status === 402 &&
      (((profile.json as any)?.billing_required === true) ||
        normalizedError.includes('billing') ||
        normalizedError.includes('activation'));
    const nextVerificationRequired =
      profile.status === 403 && profileError.includes('email verification')
        ? true
        : restoredUser.verification_required;
    const nextEmailVerified =
      profile.status === 403 && profileError.includes('email verification')
        ? false
        : restoredUser.email_verified;

    return {
      ...restoredUser,
      email_verified: nextEmailVerified,
      verification_required: nextVerificationRequired,
      verification_url: (profile.json as any)?.verification_url ?? restoredUser.verification_url ?? null,
      billing_required:
        nextVerificationRequired && nextEmailVerified === false
          ? false
          : profileBillingRequired
          ? true
          : restoredUser.billing_required,
      billing_url: (profile.json as any)?.billing_url ?? restoredUser.billing_url ?? null,
      account_state_verified: true,
    };
  }

  async function applyUser(nextUser: AuthUser, persist: boolean) {
    setUser(nextUser);
    userRef.current = nextUser;
    if (persist) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    }
  }

  async function refreshAccountState(source: AccountRefreshSource = 'manual'): Promise<boolean> {
    if (refreshInFlightRef.current) {
      activationRefreshLog(source, 'joined_in_flight');
      return refreshInFlightRef.current;
    }

    const run = (async () => {
      const currentToken = tokenRef.current || await SecureStore.getItemAsync(TOKEN_KEY);
      if (!currentToken) {
        activationRefreshLog(source, 'skipped_no_token');
        return false;
      }

      const currentUser = userRef.current;
      setAccountStateRefreshing(true);
      setAccountStateError(null);
      const profileStart = bootNow();
      bootLog('account_state_fetch_start', { source });
      activationRefreshLog(source, 'start');

      try {
        const profile = await fetchJson<any>('/mobile/me', {
          method: 'GET',
          timeoutMs: BOOT_PROFILE_TIMEOUT_MS,
        });
        bootDuration('account_state_fetch_done', profileStart, {
          source,
          status: profile.status,
          ok: profile.ok,
        });

        const refreshedFromProfile = profile.ok
          ? buildUserFromProfile(profile.json, currentUser)
          : null;
        const nextUser = refreshedFromProfile
          ? refreshedFromProfile
          : currentUser && (profile.status === 402 || profile.status === 403)
          ? buildGuardedUserFromProfileStatus(profile, currentUser)
          : null;

        if (nextUser) {
          const resolution = resolveMobileLifecycle({ user: nextUser, token: currentToken });
          bootLog('workspace_resolution', {
            role: nextUser.role,
            workspace_mode: nextUser.workspace_mode || 'unset',
            linked_athlete: nextUser.has_linked_athlete,
          });
          bootLog('email_verification_check', {
            required: nextUser.verification_required === true,
            verified: nextUser.email_verified !== false,
          });
          bootLog('billing_resolution', {
            required: nextUser.billing_required === true,
          });
          bootLog('route_resolution', {
            source,
            result: resolution.route,
          });
          await applyUser(nextUser, true);
          activationRefreshLog(source, resolution.route, { http_status: profile.status });
          return true;
        }

        if (!currentUser) {
          setAccountStateError("We're having trouble loading your account.");
        }
        activationRefreshLog(source, 'unresolved', { http_status: profile.status });
        return false;
      } catch (e) {
        bootDuration('account_state_fetch_failed', profileStart, {
          source,
          error: (e as Error)?.message || 'unknown',
        });
        if (!currentUser) {
          setAccountStateError("We're having trouble loading your account.");
        }
        activationRefreshLog(source, 'failed', { error: (e as Error)?.message || 'unknown' });
        return false;
      } finally {
        setAccountStateRefreshing(false);
      }
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = run;
    return run;
  }

  useEffect(() => {
    (async () => {
      const authStart = bootNow();
      bootLog('auth_restore_start');
      try {
        const storageStart = bootNow();
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        bootDuration('auth_restore_storage_done', storageStart, {
          has_token: !!storedToken,
          has_cached_user: !!storedUser,
        });

        if (storedToken) {
          setToken(storedToken);
          tokenRef.current = storedToken;
        }

        if (storedToken && storedUser) {
          const parsedCachedUser = JSON.parse(storedUser) as AuthUser;
          const cachedUser = parsedCachedUser.is_coach
            ? { ...parsedCachedUser, account_state_verified: parsedCachedUser.billing_required === true }
            : parsedCachedUser;
          await applyUser(cachedUser, false);
          bootLog('token_validation', { mode: 'cached_token_present' });
          const cachedResolution = resolveMobileLifecycle({ user: cachedUser, token: storedToken });
          bootLog('route_resolution', {
            source: 'cached_user',
            result: cachedResolution.route,
            role: cachedUser.role,
            verification_required: cachedUser.verification_required === true,
            billing_required: cachedUser.billing_required === true,
          });
          setAuthReady(true);
          void refreshAccountState('background');
        } else if (!storedToken && storedUser) {
          bootLog('token_validation', { mode: 'cached_user_without_token_cleared' });
          await SecureStore.deleteItemAsync(USER_KEY);
        } else if (storedToken) {
          const resolved = await refreshAccountState('bootstrap');
          bootLog('route_resolution', {
            source: resolved ? 'profile_fetch' : 'profile_fetch_failed',
          });
        }

        if (storedToken) {
          const queueStart = bootNow();
          startVideoUploadQueue();
          bootDuration('upload_queue_start', queueStart);
        }
      } catch (e) {
        console.warn('Failed to restore auth state', e);
        setAccountStateError("We're having trouble loading your account.");
      } finally {
        bootDuration('auth_restore_complete', authStart);
        setAuthReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
        void refreshAccountState('foreground');
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return subscribeBillingRequired((event) => {
      const currentUser = userRef.current;
      if (!currentUser) return;

      if (currentUser.verification_required === true && currentUser.email_verified === false) {
        const nextUser: AuthUser = {
          ...currentUser,
          billing_required: false,
        };
        userRef.current = nextUser;
        setUser(nextUser);
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser)).catch((err) => {
          console.warn('Failed to persist verification-first billing state', err);
        });
        return;
      }

      if (!currentUser.is_coach) return;

      const nextUser: AuthUser = {
        ...currentUser,
        billing_required: true,
        billing_url: event.billingUrl ?? currentUser.billing_url ?? null,
        account_state_verified: true,
      };

      userRef.current = nextUser;
      setUser(nextUser);
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser)).catch((err) => {
        console.warn('Failed to persist billing activation state', err);
      });
      router.replace('/');
    });
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    authReady,
    accountStateError,
    accountStateRefreshing,
    refreshAccountState,
    login,
    logout,
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
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// ⚠️ No default export here on purpose – we only use named exports.
