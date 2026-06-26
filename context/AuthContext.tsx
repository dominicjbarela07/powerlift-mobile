// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { fetchJson, subscribeBillingRequired } from '@/lib/api';
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
  has_linked_athlete: boolean;
  athlete_id: number | null;
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

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  async function login(payload: { user: AuthUser; token: string | null }) {
    setUser(payload.user);
    userRef.current = payload.user;
    setToken(payload.token);

    if (payload.token) {
      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(payload.user));
    startVideoUploadQueue();
  }

  async function logout() {
    stopVideoUploadQueue();
    setUser(null);
    userRef.current = null;
    setToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(MANUAL_TIMEZONE_KEY);
  }

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);

        if (storedToken) setToken(storedToken);
        if (storedToken) startVideoUploadQueue();
        let restoredUser: AuthUser | null = null;
        if (storedUser) {
          restoredUser = JSON.parse(storedUser);
          setUser(restoredUser);
          userRef.current = restoredUser;
        }

        if (storedToken) {
          const profile = await fetchJson<any>('/mobile/me', { method: 'GET' });
          const profileUser = profile.json?.user;
          if (profile.ok && profileUser) {
            const profileVerificationRequired = profileUser.verification_required === true;
            const profileEmailVerified = profileUser.email_verified !== false;
            const refreshedUser: AuthUser = {
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
              has_linked_athlete: !!profile.json?.athlete?.coach_id,
              athlete_id: profile.json?.athlete?.coach_id ? profile.json?.athlete?.id ?? null : null,
            };
            setUser(refreshedUser);
            userRef.current = refreshedUser;
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(refreshedUser));
          } else if (restoredUser && (profile.status === 402 || profile.status === 403)) {
            const profileError = String((profile.json as any)?.error || '');
            const profileBillingRequired =
              profile.status === 402 &&
              (((profile.json as any)?.billing_required === true) ||
                profileError.toLowerCase().includes('billing') ||
                profileError.toLowerCase().includes('activation'));
            const nextVerificationRequired =
              profile.status === 403 && profileError.includes('email verification')
                ? true
                : restoredUser.verification_required;
            const nextEmailVerified =
              profile.status === 403 && profileError.includes('email verification')
                ? false
                : restoredUser.email_verified;
            const refreshedUser: AuthUser = {
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
            };
            setUser(refreshedUser);
            userRef.current = refreshedUser;
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(refreshedUser));
          }
        }
      } catch (e) {
        console.warn('Failed to restore auth state', e);
      } finally {
        setAuthReady(true);
      }
    })();
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
