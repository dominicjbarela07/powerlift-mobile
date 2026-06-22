// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import { fetchJson } from '@/lib/api';

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
  refreshUser: () => Promise<void>;
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

  async function login(payload: { user: AuthUser; token: string | null }) {
    setUser(payload.user);
    setToken(payload.token);

    if (payload.token) {
      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(payload.user));
  }

  async function logout() {
    setUser(null);
    setToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(MANUAL_TIMEZONE_KEY);
  }

  async function refreshUser() {
    const storedUser = await SecureStore.getItemAsync(USER_KEY);
    const restoredUser: AuthUser | null = storedUser ? JSON.parse(storedUser) : user;
    const profile = await fetchJson<any>('/mobile/me', { method: 'GET' });
    const profileUser = profile.json?.user;
    if (profile.ok && profileUser) {
      const refreshedUser: AuthUser = {
        email: String(profileUser.email || restoredUser?.email || ''),
        user_name: profileUser.name ?? restoredUser?.user_name ?? null,
        role: profileUser.role === 'coach' ? 'coach' : 'athlete',
        is_coach: profileUser.role === 'coach',
        workspace_mode: profileUser.workspace_mode,
        is_individual_workspace: profileUser.is_individual_workspace === true,
        is_self_coached: profileUser.is_self_coached === true,
        self_athlete_id: profileUser.self_athlete_id ?? null,
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
        has_linked_athlete: !!profile.json?.athlete?.coach_id || !!restoredUser?.has_linked_athlete,
        athlete_id: profile.json?.athlete?.id ?? restoredUser?.athlete_id ?? null,
      };
      setUser(refreshedUser);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(refreshedUser));
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
          profile.status === 402 && String((profile.json as any)?.error || '').includes('billing')
            ? true
            : restoredUser.billing_required,
        billing_url: (profile.json as any)?.billing_url ?? restoredUser.billing_url ?? null,
      };
      setUser(refreshedUser);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(refreshedUser));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);

        if (storedToken) setToken(storedToken);
        let restoredUser: AuthUser | null = null;
        if (storedUser) {
          restoredUser = JSON.parse(storedUser);
          setUser(restoredUser);
        }

        if (storedToken) {
          await refreshUser();
        }
      } catch (e) {
        console.warn('Failed to restore auth state', e);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    authReady,
    login,
    refreshUser,
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
