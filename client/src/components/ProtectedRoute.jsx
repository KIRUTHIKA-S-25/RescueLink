/**
 * ProtectedRoute.jsx
 *
 * Wraps any route that requires authentication.
 *
 * Behavior:
 *   - While loading (session restore in progress): show a spinner
 *   - If not authenticated: redirect to /login
 *   - If authenticated: render children
 *
 * NOTE: Frontend protection is for UX only.
 *       The backend middleware is the real security layer.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Wait for session restoration before deciding whether to redirect
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
