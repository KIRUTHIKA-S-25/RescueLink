/**
 * Dashboard.jsx — Phase 4
 *
 * User home page. Shows role-appropriate quick actions and links.
 * Citizens see: Report an emergency, My rescues
 * Responders/Admins see: Rescue Dashboard + citizen links
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const ROLE_BADGE = {
  citizen:   'bg-blue-100 text-blue-700',
  responder: 'bg-orange-100 text-orange-700',
  admin:     'bg-purple-100 text-purple-700',
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-900 text-lg">RescueLink</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button id="logout-btn" onClick={handleLogout} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Welcome card */}
        <div className="card mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name} 👋</h1>
              <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${ROLE_BADGE[user?.role] || 'bg-gray-100 text-gray-600'}`}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

          {/* Report emergency — all roles */}
          <Link
            to="/report"
            id="report-emergency-link"
            className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-200"
          >
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
              🚨
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Report Emergency</h2>
              <p className="text-gray-500 text-xs mt-0.5">Submit a new rescue request</p>
            </div>
          </Link>

          {/* My rescues — all roles */}
          <Link
            to="/my-rescues"
            id="my-rescues-link"
            className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-200"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
              📋
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">My Rescues</h2>
              <p className="text-gray-500 text-xs mt-0.5">Track your submitted cases</p>
            </div>
          </Link>

          {/* Rescue team dashboard — responder / admin only */}
          {(user?.role === 'responder' || user?.role === 'admin') && (
            <Link
              to="/rescuer"
              id="rescuer-dashboard-link"
              className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-orange-200"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
                🦺
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Rescue Dashboard</h2>
                <p className="text-gray-500 text-xs mt-0.5">Manage all rescue cases</p>
              </div>
            </Link>
          )}

        </div>

        {/* Phase info */}
        <div className="card bg-green-50 border-green-100">
          <h2 className="font-semibold text-green-800 mb-1">Phase 4 — Rescue Workflow Active ✅</h2>
          <ul className="mt-1 text-sm text-green-700 space-y-0.5 list-disc list-inside">
            <li>Citizens can report animal emergencies</li>
            <li>Responders can accept and manage cases</li>
            <li>Status workflow: PENDING → ACCEPTED → IN_PROGRESS → RESCUED</li>
            <li>All data persisted in MongoDB Atlas</li>
          </ul>
        </div>

      </main>
    </div>
  );
};

export default Dashboard;
