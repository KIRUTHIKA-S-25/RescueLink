/**
 * RoleRoute.jsx
 *
 * Wraps a route that requires authentication AND a specific role.
 *
 * Usage:
 *   <RoleRoute allowedRoles={['admin']}>
 *     <AdminPanel />
 *   </RoleRoute>
 *
 * Behavior:
 *   - Loading → spinner
 *   - Not authenticated → redirect to /login
 *   - Wrong role → redirect to /dashboard (or show 403)
 *
 * REMINDER: This is for UX routing only.
 *           Backend middleware enforces the real authorization.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RoleRoute;
