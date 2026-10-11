/**
 * App.jsx — Phase 4
 *
 * Application shell with React Router.
 * Wraps everything in AuthProvider so any component can access auth state.
 *
 * Routes:
 *   /           → redirect to /dashboard
 *   /login      → Login page (public)
 *   /register   → Register page (public)
 *   /report     → Report rescue form (public — works without login too)
 *   /dashboard  → Home dashboard (protected)
 *   /my-rescues → User's own rescue cases (protected)
 *   /rescuer    → Rescue team dashboard (protected: responder or admin)
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute    from './components/ProtectedRoute';
import RoleRoute         from './components/RoleRoute';
import HomeDashboard   from './pages/HomeDashboard';
import Login             from './pages/Login';
import Register          from './pages/Register';
import Dashboard         from './pages/Dashboard';
import ReportRescue      from './pages/ReportRescue';
import MyRescues         from './pages/MyRescues';
import RescuerDashboard  from './pages/RescuerDashboard';
import CaseDetails       from './pages/CaseDetails';
import Notifications     from './pages/Notifications';
import AdminDashboard    from './pages/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Root → Public Interactive Command Dashboard */}
          <Route path="/" element={<HomeDashboard />} />

          {/* Public routes */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Report rescue — public (works for guests too) */}
          <Route path="/report" element={<ReportRescue />} />

          {/* Protected: any authenticated user */}
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/my-rescues"
            element={<ProtectedRoute><MyRescues /></ProtectedRoute>}
          />
          <Route
            path="/notifications"
            element={<ProtectedRoute><Notifications /></ProtectedRoute>}
          />

          {/* Protected: responder or admin only */}
          <Route
            path="/rescuer"
            element={
              <RoleRoute allowedRoles={['responder', 'admin']}>
                <RescuerDashboard />
              </RoleRoute>
            }
          />

          {/* Protected: admin only */}
          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </RoleRoute>
            }
          />

          {/* Protected: any authenticated user — case details */}
          <Route
            path="/rescues/:id"
            element={<ProtectedRoute><CaseDetails /></ProtectedRoute>}
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
