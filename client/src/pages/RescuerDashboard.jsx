/**
 * RescuerDashboard.jsx
 *
 * Rescue team dashboard — shows all incoming rescue requests.
 * Route: /rescuer (protected, responder or admin only)
 *
 * Features:
 * - Lists all rescue cases, newest first
 * - Status filter tabs
 * - Action buttons that enforce the correct workflow transitions
 * - Calls PATCH /api/rescues/:id/status to update status
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { calculateDistance } from '../utils/haversine';
import NotificationBell from '../components/NotificationBell';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-800',  border: 'border-yellow-200' },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-blue-100 text-blue-800',      border: 'border-blue-200'   },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-orange-100 text-orange-800',  border: 'border-orange-200' },
  RESCUED:     { label: 'Rescued ✓',  color: 'bg-green-100 text-green-800',    border: 'border-green-200'  },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-500',      border: 'border-gray-200'   },
};

/**
 * Action buttons shown for each status.
 * Matches the server-side ALLOWED_TRANSITIONS exactly.
 */
const STATUS_ACTIONS = {
  PENDING:     [{ label: '✅ Accept',         next: 'ACCEPTED',    style: 'btn-primary' },
                { label: '✕ Cancel',          next: 'CANCELLED',   style: 'btn-secondary' }],
  ACCEPTED:    [{ label: '🚀 Start Rescue',   next: 'IN_PROGRESS', style: 'btn-primary' },
                { label: '✕ Cancel',          next: 'CANCELLED',   style: 'btn-secondary' }],
  IN_PROGRESS: [{ label: '🎉 Mark Rescued',   next: 'RESCUED',     style: 'btn-primary' }],
  RESCUED:     [],
  CANCELLED:   [],
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const RescuerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();

  const [rescues,     setRescues]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [filterTab,   setFilterTab]   = useState('ALL');
  const [updating,    setUpdating]    = useState({}); // { [id]: true } while PATCH in flight
  
  // Phase 6: Optional responder location
  const [responderLoc, setResponderLoc] = useState(null); // { lat, lng }
  const [locStatus,    setLocStatus]    = useState('');

  // ─── Load all rescues ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/rescues');
      setRescues(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rescue cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Update status ─────────────────────────────────────────────────────────

  const handleStatusUpdate = async (id, nextStatus) => {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await api.patch(`/rescues/${id}/status`, { status: nextStatus });
      setRescues((prev) =>
        prev.map((r) => (r._id === id ? res.data.data : r))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // ─── Phase 6: Responder Location ───────────────────────────────────────────
  
  const handleEnableLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Not supported');
      return;
    }
    setLocStatus('Detecting...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResponderLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus('Enabled');
      },
      () => {
        setLocStatus('Denied');
      }
    );
  };

  // ─── Filter ────────────────────────────────────────────────────────────────

  const TABS = ['ALL', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED', 'CANCELLED'];
  const displayed = filterTab === 'ALL'
    ? rescues
    : rescues.filter((r) => r.status === filterTab);

  // ─── Counts for tabs ──────────────────────────────────────────────────────

  const counts = rescues.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-900">RescueLink</span>
            <span className="hidden sm:inline px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-semibold">
              Rescue Team
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.name}</span>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-sm">Logout</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rescue Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {rescues.length} total case{rescues.length !== 1 ? 's' : ''}
              {counts.PENDING ? ` · ${counts.PENDING} pending` : ''}
            </p>
          </div>
          <div className="flex gap-3">
            {!responderLoc ? (
              <button onClick={handleEnableLocation} className="btn-secondary text-sm flex items-center gap-1">
                📍 {locStatus === 'Detecting...' ? 'Detecting...' : 'Use My Location'}
              </button>
            ) : (
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded border border-green-200 flex items-center">
                📍 Location Enabled
              </span>
            )}
            <button onClick={load} className="btn-secondary text-sm">↻ Refresh</button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab === 'ALL' ? 'All' : (STATUS_CONFIG[tab]?.label || tab)}
              {tab !== 'ALL' && counts[tab] ? (
                <span className="ml-1.5 bg-white/20 text-current rounded-full px-1.5 text-xs">
                  {counts[tab]}
                </span>
              ) : null}
              {tab === 'ALL' && <span className="ml-1.5 opacity-70 text-xs">{rescues.length}</span>}
            </button>
          ))}
        </div>

        {/* States */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading cases…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="card border-red-100 bg-red-50">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={load} className="btn-secondary text-sm mt-3">Try again</button>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No cases found</h2>
            <p className="text-gray-500 text-sm">
              {filterTab === 'ALL' ? 'No rescue cases have been submitted yet.' : `No cases with status "${filterTab}".`}
            </p>
          </div>
        )}

        {!loading && !error && displayed.length > 0 && (
          <div className="space-y-4">
            {displayed.map((r) => (
              <div
                key={r._id}
                className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${STATUS_CONFIG[r.status]?.border || 'border-gray-100'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">

                  {/* Left: case info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-400">{r.caseId}</span>
                      <StatusBadge status={r.status} />
                    </div>

                    <h2 className="font-semibold text-gray-900 text-base">
                      {r.animalType} — {r.emergencyType}
                    </h2>

                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{r.description}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>📍 {r.location?.address}</span>
                      <span>👤 {r.reporterName} · {r.reporterContact}</span>
                      <span>🕒 {new Date(r.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Phase 6: Location indicator */}
                    {r.location?.latitude && r.location?.longitude && (
                      <div className="mt-2 text-xs">
                        {responderLoc && !['RESCUED', 'CANCELLED'].includes(r.status) ? (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium">
                            Approx. distance: {calculateDistance(
                              responderLoc.lat, 
                              responderLoc.lng, 
                              r.location.latitude, 
                              r.location.longitude
                            ).toFixed(1)} km
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
                            📍 Location available
                          </span>
                        )}
                      </div>
                    )}

                    {r.imageUrl && (
                      <a
                        href={r.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:underline mt-1 inline-block"
                      >
                        📷 View photo
                      </a>
                    )}

                    {/* View case details */}
                    <div className="mt-2">
                      <Link
                        to={`/rescues/${r._id}`}
                        className="text-xs text-primary-600 font-medium hover:underline"
                      >
                        📄 View Case Details
                      </Link>
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {(STATUS_ACTIONS[r.status] || []).map((action) => (
                      <button
                        key={action.next}
                        onClick={() => handleStatusUpdate(r._id, action.next)}
                        disabled={updating[r._id]}
                        className={`${action.style} text-sm whitespace-nowrap`}
                      >
                        {updating[r._id] ? (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Updating…
                          </span>
                        ) : action.label}
                      </button>
                    ))}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default RescuerDashboard;
