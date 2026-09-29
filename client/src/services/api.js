/**
 * api.js
 *
 * Axios instance pre-configured for the RescueLink API.
 *
 * - baseURL uses the Vite proxy (/api) so no hardcoded ports in requests.
 * - Request interceptor automatically attaches the JWT from localStorage
 *   to every request as: Authorization: Bearer <token>
 * - Response interceptor handles 401 responses (expired/invalid token)
 *   by clearing storage so the user is implicitly logged out.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── Request interceptor ──────────────────────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rescuelink_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor ─────────────────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server says our token is invalid or expired, clear local storage.
    // AuthContext will handle the redirect to /login.
    if (error.response?.status === 401) {
      localStorage.removeItem('rescuelink_token');
    }
    return Promise.reject(error);
  }
);

export default api;
