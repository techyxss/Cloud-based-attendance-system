import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, TestAccount } from '../types/index.ts';
import { api, setStoredToken, getStoredToken } from '../lib/api.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  testAccounts: TestAccount[];
  login: (email: string, password: string) => Promise<User>;
  quickLogin: (role: UserRole) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);

  // Load test accounts
  useEffect(() => {
    api.get<{ accounts: TestAccount[] }>('/auth/test-accounts')
      .then(res => setTestAccounts(res.accounts || []))
      .catch(err => console.error('Failed to load test accounts:', err));
  }, []);

  // Check stored session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get<{ user: User }>('/auth/me');
        setUser(res.user);
      } catch (err) {
        console.warn('Session expired or invalid, logging out.');
        setStoredToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const quickLogin = async (role: UserRole): Promise<User> => {
    const res = await api.post<{ user: User; token: string }>('/auth/quick-login', { role });
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any): Promise<User> => {
    const res = await api.post<{ user: User; token: string }>('/auth/register', data);
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const res = await api.get<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        testAccounts,
        login,
        quickLogin,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
