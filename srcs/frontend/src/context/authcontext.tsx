import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { authApi, setAccessToken, type UserProfile } from '../api/auth';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // si au lancement un refreshToken est en localStorage, on tente de se reconnecter pour rester co si rafraichissement page
  useEffect(() => {
    const stored = localStorage.getItem('refreshToken');
    if (!stored) {
      setIsLoading(false);
      return;
    }
    authApi.refresh(stored)
      .then(async (tokens) => {
        setAccessToken(tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        // 2e requête GET /users/me pour récupérer le profil et crée user minimal depuis le token
        setUser({ id: 0, username: 'Utilisateur', email: '', avatarUrl: null, createdAt: '' });
      })
      .catch(() => {
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser({ id: 0, username: email.split('@')[0], email, avatarUrl: null, createdAt: new Date().toISOString() });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const tokens = await authApi.register(username, email, password);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser({ id: 0, username, email, avatarUrl: null, createdAt: new Date().toISOString() });
  }, []);

  const logout = useCallback(async () => {
    const stored = localStorage.getItem('refreshToken');
    if (stored) {
      try { await authApi.logout(stored); } catch { /* on déconnecte quoiqu'il arrive */ }
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('refreshToken');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user,
      login, register, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être utilisé dans un <AuthProvider>');
  return ctx;
}
