/**
 * AuthContext.jsx
 *
 * Global authentication state for the RescueLink frontend.
 *
 * Provides:
 *   user     — current user object (or null)
 *   token    — current JWT (or null)
 *   loading  — true while restoring session or waiting for API
 *   login()  — authenticate and store token
 *   register() — create account
 *   logout() — clear token and user state
 *
 * Session persistence:
 *   The JWT is stored in localStorage under the key "rescuelink_token".
 *   On app load, if a token exists, GET /api/auth/me is called to restore
 *   the user object. If the token is expired/invalid, the storage is cleared.
 *
 * Security note:
 *   localStorage is acceptable for a college prototype.
 *   The actual authorization is always enforced by the backend middleware.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rescuelink_token';

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true); // true until session is restored

  // ─── Restore session on mount ────────────────────────────────────────────────

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data);
        setToken(storedToken);
      } catch {
        // Token is invalid or expired — clear everything
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ─── login ───────────────────────────────────────────────────────────────────

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  // ─── register ────────────────────────────────────────────────────────────────

  const register = useCallback(async ({ name, email, phone, password }) => {
    const res = await api.post('/auth/register', { name, email, phone, password });
    return res.data.data; // Returns the created user (no auto-login)
  }, []);

  // ─── logout ──────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = { user, token, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
