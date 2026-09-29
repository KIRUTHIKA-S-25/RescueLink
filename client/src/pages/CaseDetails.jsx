/**
 * CaseDetails.jsx — Phase 5
 *
 * Detailed view for a single rescue case.
 * Route: /rescues/:id (protected — requires auth)
 *
 * Shows:
 *   - Case information (animal, emergency, location, description, reporter)
 *   - Current status with visual badge
 *   - Responder assignment info
 *   - Activity/timeline feed (polled every 12 seconds while case is active)
 *   - "Add Update" form (shown only to assigned responder / admin)
 *   - Status action buttons (shown only to responder/admin)
 *
 * Security:
 *   Backend enforces all access control — this page simply shows/hides
 *   controls based on role for UX only.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RescueMap from '../components/RescueMap';
import NotificationBell from '../components/NotificationBell';

// ─── Shared constants ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-800',  dot: 'bg-yellow-400' },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-500'   },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-500' },
  RESCUED:     { label: 'Rescued ✓',  color: 'bg-green-100 text-green-800',    dot: 'bg-green-500'  },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600',      dot: 'bg-gray-400'   },
};

const STATUS_ACTIONS = {
  PENDING:     [{ label: '✅ Accept',       next: 'ACCEPTED',    style: 'btn-primary'   },
                { label: '✕ Cancel',        next: 'CANCELLED',   style: 'btn-secondary' }],
  ACCEPTED:    [{ label: '🚀 Start Rescue', next: 'IN_PROGRESS', style: 'btn-primary'   },
                { label: '✕ Cancel',        next: 'CANCELLED',   style: 'btn-secondary' }],
  IN_PROGRESS: [{ label: '🎉 Mark Rescued', next: 'RESCUED',     style: 'btn-primary'   }],
  RESCUED:     [],
  CANCELLED:   [],
};

const ACTIVITY_ICONS = {
  CASE_CREATED:   '📋',
  CASE_ACCEPTED:  '✅',
  RESCUE_STARTED: '🚀',
  CASE_RESCUED:   '🎉',
  CASE_CANCELLED: '✕',
  STATUS_CHANGED: '🔄',
  NOTE:           '💬',
};

const TERMINAL_STATUSES = ['RESCUED', 'CANCELLED'];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 py-2 border-b border-gray-50 last:border-0">
    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-36 shrink-0">{label}</span>
    <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
  </div>
);

const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const CaseDetails = () => {
  const { id }             = useParams();
  const { user, logout }   = useAuth();
  const navigate           = useNavigate();

  const [rescue,       setRescue]       = useState(null);
  const [activities,   setActivities]   = useState([]);
  const [loadingCase,  setLoadingCase]  = useState(true);
  const [loadingAct,   setLoadingAct]   = useState(true);
  const [caseError,    setCaseError]    = useState('');
  const [actError,     setActError]     = useState('');
  const [updating,     setUpdating]     = useState(false);
  const [noteMsg,      setNoteMsg]      = useState('');
  const [noteLoading,  setNoteLoading]  = useState(false);
  const [noteSuccess,  setNoteSuccess]  = useState('');
  const [noteError,    setNoteError]    = useState('');

  const pollRef = useRef(null);

  // ─── Fetch case ───────────────────────────────────────────────────────────

  const fetchCase = useCallback(async () => {
    try {
      const res = await api.get(`/rescues/${id}`);
      setRescue(res.data.data);
      setCaseError('');
    } catch (err) {
      setCaseError(err.response?.data?.message || 'Failed to load case details.');
    } finally {
      setLoadingCase(false);
    }
  }, [id]);

  // ─── Fetch activities ─────────────────────────────────────────────────────

  const fetchActivities = useCallback(async () => {
    try {
      const res = await api.get(`/rescues/${id}/activities`);
      setActivities(res.data.data);
      setActError('');
    } catch (err) {
      setActError(err.response?.data?.message || 'Could not load activity timeline.');
    } finally {
      setLoadingAct(false);
    }
  }, [id]);

  // ─── Initial load + polling ────────────────────────────────────────────────

  useEffect(() => {
    fetchCase();
    fetchActivities();
  }, [fetchCase, fetchActivities]);

  // Poll every 12 seconds while case is not terminal
  useEffect(() => {
    if (!rescue) return;
    if (TERMINAL_STATUSES.includes(rescue.status)) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      fetchCase();
      fetchActivities();
    }, 12000);
    return () => clearInterval(pollRef.current);
  }, [rescue?.status, fetchCase, fetchActivities]);

  // ─── Status update ────────────────────────────────────────────────────────

  const handleStatusUpdate = async (nextStatus) => {
    setUpdating(true);
    try {
      const res = await api.patch(`/rescues/${id}/status`, { status: nextStatus });
      setRescue(res.data.data);
      await fetchActivities();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  // ─── Add note ─────────────────────────────────────────────────────────────

  const handleAddNote = async (e) => {
    e.preventDefault();
    setNoteError('');
    setNoteSuccess('');
    if (!noteMsg.trim()) {
      setNoteError('Update message cannot be empty.');
      return;
    }
    setNoteLoading(true);
    try {
      await api.post(`/rescues/${id}/updates`, { message: noteMsg.trim() });
      setNoteMsg('');
      setNoteSuccess('Update added.');
      await fetchActivities();
    } catch (err) {
      setNoteError(err.response?.data?.message || 'Failed to add update.');
    } finally {
      setNoteLoading(false);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const isResponderOrAdmin = user?.role === 'responder' || user?.role === 'admin';


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              title="Go back"
            >
              ← Back
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-900">RescueLink</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</Link>
            <NotificationBell />
            <button onClick={() => { logout(); navigate('/login', { replace: true }); }} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Loading state */}
        {loadingCase && <Spinner />}

        {/* Error state */}
        {!loadingCase && caseError && (
          <div className="card border-red-100 bg-red-50">
            <p className="text-red-700 text-sm font-medium">{caseError}</p>
            <button onClick={fetchCase} className="btn-secondary text-sm mt-3">Try again</button>
          </div>
        )}

        {/* Main content */}
        {!loadingCase && !caseError && rescue && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ─── LEFT: Case info ───────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Case info card */}
              <div className="card">
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div>
                    <span className="font-mono text-xs text-gray-400">{rescue.caseId}</span>
                    <h1 className="text-xl font-bold text-gray-900 mt-0.5">
                      {rescue.animalType} — {rescue.emergencyType}
                    </h1>
                  </div>
                  <StatusBadge status={rescue.status} />
                </div>

                <div className="divide-y divide-gray-50">
                  <InfoRow label="Description"   value={rescue.description} />
                  <InfoRow label="Location"      value={rescue.location?.address} />
                  <InfoRow label="Reporter"      value={rescue.reporterName} />
                  <InfoRow label="Contact"       value={rescue.reporterContact} />
                  <InfoRow label="Reported at"   value={new Date(rescue.createdAt).toLocaleString()} />
                  <InfoRow label="Last updated"  value={new Date(rescue.updatedAt).toLocaleString()} />
                </div>

                {rescue.imageUrl && (
                  <div className="mt-4">
                    <a
                      href={rescue.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline"
                    >
                      📷 View photo
                    </a>
                  </div>
                )}
              </div>

              {/* ─── Map Card ─── */}
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>📍</span> Rescue Location
                </h2>
                
                {rescue.location?.latitude && rescue.location?.longitude ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-700">{rescue.location.address}</p>
                    
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <RescueMap 
                        latitude={rescue.location.latitude} 
                        longitude={rescue.location.longitude} 
                        label={rescue.location.address} 
                      />
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="text-gray-500 font-mono text-xs">
                        Lat: {rescue.location.latitude.toFixed(6)} | Lng: {rescue.location.longitude.toFixed(6)}
                      </div>
                      <a 
                        href={`https://www.google.com/maps?q=${rescue.location.latitude},${rescue.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 font-medium hover:underline flex items-center gap-1"
                      >
                        Open in Maps ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Map location is not available for this case.</p>
                )}
              </div>

              {/* Responder card */}
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-3">🦺 Responder</h2>
                {rescue.assignedResponder ? (
                  <div className="divide-y divide-gray-50">
                    <InfoRow label="Name"        value={rescue.assignedResponder.name} />
                    <InfoRow label="Contact"     value={rescue.assignedResponder.phone || rescue.assignedResponder.email} />
                    <InfoRow label="Assigned at" value={rescue.assignedAt ? new Date(rescue.assignedAt).toLocaleString() : '—'} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Waiting for responder assignment…</p>
                )}
              </div>

              {/* Status actions — responder/admin only */}
              {isResponderOrAdmin && (STATUS_ACTIONS[rescue.status] || []).length > 0 && (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3">⚡ Actions</h2>
                  <div className="flex flex-wrap gap-3">
                    {(STATUS_ACTIONS[rescue.status] || []).map((action) => (
                      <button
                        key={action.next}
                        onClick={() => handleStatusUpdate(action.next)}
                        disabled={updating}
                        className={`${action.style} text-sm`}
                      >
                        {updating ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Updating…
                          </span>
                        ) : action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add update — assigned responder / admin only */}
              {isResponderOrAdmin && !TERMINAL_STATUSES.includes(rescue.status) && (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3">💬 Add Progress Update</h2>
                  <form onSubmit={handleAddNote} className="space-y-3">
                    <textarea
                      id="update-message"
                      value={noteMsg}
                      onChange={(e) => { setNoteMsg(e.target.value); setNoteError(''); setNoteSuccess(''); }}
                      rows={3}
                      maxLength={500}
                      placeholder="Reached the location. Animal is stable…"
                      className={`form-input resize-none ${noteError ? 'border-red-400' : ''}`}
                      disabled={noteLoading}
                    />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        {noteError   && <p className="text-red-500 text-xs">{noteError}</p>}
                        {noteSuccess && <p className="text-green-600 text-xs">✓ {noteSuccess}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{noteMsg.length}/500</span>
                        <button
                          id="add-update-btn"
                          type="submit"
                          disabled={noteLoading}
                          className="btn-primary text-sm"
                        >
                          {noteLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Adding…
                            </span>
                          ) : 'Add Update'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

            </div>

            {/* ─── RIGHT: Activity timeline ──────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="card sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">📜 Activity Timeline</h2>
                  <button
                    onClick={() => { fetchCase(); fetchActivities(); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    title="Refresh"
                  >
                    ↻
                  </button>
                </div>

                {loadingAct && (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {!loadingAct && actError && (
                  <p className="text-red-500 text-xs">{actError}</p>
                )}

                {!loadingAct && !actError && activities.length === 0 && (
                  <p className="text-gray-400 text-sm italic">No activity yet.</p>
                )}

                {!loadingAct && !actError && activities.length > 0 && (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />

                    <ol className="space-y-4 relative">
                      {activities.map((act) => (
                        <li key={act._id} className="flex gap-3 pl-0">
                          {/* Icon dot */}
                          <div className="w-7 h-7 rounded-full bg-white border-2 border-primary-200 flex items-center justify-center text-sm shrink-0 z-10">
                            {ACTIVITY_ICONS[act.type] || '●'}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm text-gray-800 leading-snug">{act.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">
                                {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">
                                {new Date(act.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Polling indicator */}
                {!TERMINAL_STATUSES.includes(rescue.status) && (
                  <p className="text-xs text-gray-300 mt-4 text-center">
                    Auto-refreshes every 12s
                  </p>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default CaseDetails;
