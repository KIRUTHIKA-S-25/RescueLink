/**
 * MyRescues.jsx
 *
 * Shows rescue requests submitted by the currently authenticated user.
 * Route: /my-rescues (protected)
 *
 * Displays each case with its current status and a visual status timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-800',  dot: 'bg-yellow-400' },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-500'   },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-500' },
  RESCUED:     { label: 'Rescued ✓',  color: 'bg-green-100 text-green-800',    dot: 'bg-green-500'  },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600',      dot: 'bg-gray-400'   },
};

const WORKFLOW = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED'];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const StatusTimeline = ({ status }) => {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-400 italic">Case was cancelled</span>
      </div>
    );
  }
  const currentIdx = WORKFLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-3">
      {WORKFLOW.map((s, i) => {
        const done   = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0
              ${done ? (active ? 'bg-primary-600 text-white' : 'bg-green-500 text-white') : 'bg-gray-200 text-gray-400'}`}>
              {done && !active ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${done ? 'text-gray-700' : 'text-gray-400'}`}>
              {STATUS_CONFIG[s]?.label || s}
            </span>
            {i < WORKFLOW.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 ${i < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const MyRescues = () => {
  const { logout } = useAuth();
  const navigate          = useNavigate();

  const [rescues,  setRescues]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/rescues/my');
      setRescues(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your rescue requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-900">RescueLink</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</Link>
            <Link to="/report" className="btn-primary text-sm hidden sm:block">+ Report</Link>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-sm hidden sm:block">Logout</button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Rescue Reports</h1>
            <p className="text-gray-500 text-sm mt-0.5">Track the status of your submitted cases</p>
          </div>
          <button onClick={load} className="btn-secondary text-sm">↻ Refresh</button>
        </div>

        {/* States */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading your cases…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="card border-red-100 bg-red-50">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={load} className="btn-secondary text-sm mt-3">Try again</button>
          </div>
        )}

        {!loading && !error && rescues.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No rescue reports yet</h2>
            <p className="text-gray-500 text-sm mb-4">When you report an animal emergency, it will appear here.</p>
            <Link to="/report" className="btn-primary">Report an emergency</Link>
          </div>
        )}

        {!loading && !error && rescues.length > 0 && (
          <div className="space-y-4">
            {rescues.map((r) => (
              <div key={r._id} className="card hover:shadow-md transition-shadow">

                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="font-mono text-xs text-gray-400">{r.caseId}</span>
                    <h2 className="font-semibold text-gray-900 mt-0.5">
                      {r.animalType} — {r.emergencyType}
                    </h2>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                {/* Details */}
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{r.description}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500 items-center">
                  <span>📍 {r.location?.address}</span>
                  {r.location?.latitude && r.location?.longitude && (
                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium text-[10px]">
                      Map Available
                    </span>
                  )}
                  <span>🕒 {new Date(r.createdAt).toLocaleString()}</span>
                </div>

                {/* Timeline */}
                <StatusTimeline status={r.status} />

                {/* View Details button */}
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <Link
                    to={`/rescues/${r._id}`}
                    className="text-sm text-primary-600 font-medium hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default MyRescues;
