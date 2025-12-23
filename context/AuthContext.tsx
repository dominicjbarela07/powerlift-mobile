// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import * as SecureStore from 'expo-secure-store';

// Shape of the authenticated user coming from your Flask API
export type AuthUser = {
  email: string;
  user_name: string | null;
  role: 'coach' | 'athlete';
  is_coach: boolean;
  has_linked_athlete: boolean;
  athlete_id: number | null;
};

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
  }

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);

        if (storedToken) setToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
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