// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react';

// Shape of the authenticated user coming from your Flask API
export type AuthUser = {
  email: string;
  user_name: string | null;
  role: 'coach' | 'athlete';
  is_coach: boolean;
  has_linked_athlete: boolean;
  athlete_id: number | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  login: (payload: { user: AuthUser; token: string | null }) => void;
  logout: () => void;
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

  function login(payload: { user: AuthUser; token: string | null }) {
    setUser(payload.user);
    setToken(payload.token);
  }

  function logout() {
    setUser(null);
    setToken(null);
  }

  const value: AuthContextValue = {
    user,
    token,
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