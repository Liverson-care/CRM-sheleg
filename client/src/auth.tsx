import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

interface AuthState {
  user: { name: string } | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ name: string } | null>(
    getToken() ? { name: 'Commercial' } : null
  );

  async function login(username: string, password: string) {
    const res = await api.login(username, password);
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
