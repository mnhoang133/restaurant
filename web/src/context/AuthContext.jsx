import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('accessToken'));
  });

  const refreshUser = useCallback(async (signal) => {
    if (typeof localStorage === 'undefined') {
      setUser(null);
      setIsLoadingAuth(false);
      return null;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      setIsLoadingAuth(false);
      return null;
    }

    setIsLoadingAuth(true);
    const res = await apiClient.auth.me(signal);
    if (res.isAborted) return null;

    if (res.ok && res.data) {
      const resolvedUser = res.data.user || res.data;
      setUser(resolvedUser);
      setIsLoadingAuth(false);
      return resolvedUser;
    }

    localStorage.removeItem('accessToken');
    setUser(null);
    setIsLoadingAuth(false);
    return null;
  }, []);

  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setUser(null);
      setIsLoadingAuth(false);
      return undefined;
    }

    const controller = new AbortController();
    refreshUser(controller.signal);
    return () => controller.abort();
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('accessToken');
      }
      setUser(null);
      setIsLoadingAuth(false);

      // Nếu đang ở trang ngoài các trang auth thì đẩy về /login
      if (typeof window !== 'undefined') {
        const hashPath = (window.location.hash || '').replace(/^#/, '').split('?')[0];
        const authPaths = [
          '/login',
          '/register',
          '/activate',
          '/forgot-password',
          '/forgot',
          '/reset-password',
          '/reset',
        ];
        if (!authPaths.includes(hashPath)) {
          window.location.hash = '#/login';
        }
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const loginSuccess = useCallback((accessToken, userData) => {
    if (accessToken && typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
    }
    setUser(userData || null);
    setIsLoadingAuth(false);
  }, []);

  const clearAuth = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken');
    }
    setUser(null);
    setIsLoadingAuth(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch (_) {
      // Bỏ qua lỗi mạng khi đăng xuất, vẫn xóa token ở client
    } finally {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('accessToken');
      }
      setUser(null);
      setIsLoadingAuth(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      loginSuccess,
      logout,
      clearAuth,
      refreshUser,
    }),
    [user, isLoadingAuth, loginSuccess, logout, clearAuth, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return ctx;
}
