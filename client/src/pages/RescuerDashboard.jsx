/**
 * RescuerDashboard.jsx
 * Route: /rescuer (protected: responder or admin only)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { calculateDistance } from '../utils/haversine';
import NotificationBell from '../components/NotificationBell';

/* ─── Config ─────────────────────────────────────────────────────────────── */

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     dot: 'bg-yellow-400', pill: 'bg-yellow-100 text-yellow-800 border-yellow-200', bar: 'from-yellow-400 to-amber-500' },
  ACCEPTED:    { label: 'Accepted',    dot: 'bg-blue-500',   pill: 'bg-blue-100 text-blue-800 border-blue-200',       bar: 'from-blue-400 to-indigo-500' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-800 border-orange-200', bar: 'from-orange-400 to-red-500' },
  RESCUED:     { label: 'Rescued ✓',  dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', bar: 'from-emerald-400 to-teal-500' },
  CANCELLED:   { label: 'Cancelled',   dot: 'bg-slate-400',  pill: 'bg-slate-100 text-slate-600 border-slate-200',    bar: 'from-slate-300 to-slate-400' },
};

const STATUS_ACTIONS = {
  PENDING:     [
    { label: 'Accept Case',    icon: '✅', next: 'ACCEPTED',    primary: true  },
    { label: 'Cancel',         icon: '✕',  next: 'CANCELLED',   primary: false },
  ],
  ACCEPTED:    [
    { label: 'Start Rescue',   icon: '🚀', next: 'IN_PROGRESS', primary: true  },
    { label: 'Cancel',         icon: '✕',  next: 'CANCELLED',   primary: false },
  ],
  IN_PROGRESS: [
    { label: 'Mark Rescued',   icon: '🎉', next: 'RESCUED',     primary: true  },
  ],
  RESCUED:   [],
  CANCELLED: [],
};

const PRIORITY_CONFIG = {
  CRITICAL: { pill: 'bg-red-500 text-white',       border: 'border-l-red-500',   label: 'Critical' },
  HIGH:     { pill: 'bg-orange-500 text-white',    border: 'border-l-orange-500', label: 'High' },
  MEDIUM:   { pill: 'bg-amber-400 text-slate-900', border: 'border-l-amber-400', label: 'Medium' },
  LOW:      { pill: 'bg-slate-200 text-slate-700', border: 'border-l-slate-300', label: 'Low' },
};

const TABS = ['ALL', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED', 'CANCELLED'];

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const StatusPill = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const CaseCard = ({ r, handleStatusUpdate, updating, responderLoc }) => {
  const pr = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.MEDIUM;
  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
  const isUrgent = ['CRITICAL', 'HIGH'].includes(r.priority);
  const actions = STATUS_ACTIONS[r.status] || [];

  return (
    <div
      className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 border-l-4 ${pr.border}`}
      style={{
        border: '1px solid rgba(226,232,240,0.7)',
        borderLeftWidth: '4px',
        boxShadow: isUrgent
          ? '0 4px 20px rgba(239,68,68,0.08), 0 1px 4px rgba(15,23,42,0.04)'
          : '0 2px 8px rgba(15,23,42,0.04)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(15,23,42,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isUrgent ? '0 4px 20px rgba(239,68,68,0.08)' : '0 2px 8px rgba(15,23,42,0.04)'; }}
    >
      {/* Status gradient bar */}
      <div className={`h-0.5 bg-gradient-to-r ${sc.bar}`} />

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Case Info */}
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="font-mono-case text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                {r.caseId}
              </span>
              <StatusPill status={r.status} />
              <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg ${pr.pill}`}>
                {pr.label}
              </span>
              {isUrgent && (
                <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 animate-status-blink">
                  ⚡ Urgent
                </span>
              )}
            </div>

            <h2 className="font-bold text-slate-900 text-base mb-1.5">
              {r.animalType} — {r.emergencyType}
            </h2>

            {r.description && (
              <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{r.description}</p>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">📍</span>
                <span className="font-medium">{r.location?.address || 'Unknown location'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">👤</span>
                <span>{r.reporterName}</span>
                {r.reporterContact && <span className="text-rose-600 font-semibold">{r.reporterContact}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">🕒</span>
                <span>{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </span>
            </div>

            {/* Distance badge */}
            {r.location?.latitude && r.location?.longitude && (
              <div className="mt-2.5">
                {responderLoc && !['RESCUED', 'CANCELLED'].includes(r.status) ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                    📡 {calculateDistance(responderLoc.lat, responderLoc.lng, r.location.latitude, r.location.longitude).toFixed(1)} km away
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                    📍 GPS Available
                  </span>
                )}
              </div>
            )}

            {/* Photo & Details links */}
            <div className="flex items-center gap-4 mt-3">
              {r.imageUrl && (
                <a
                  href={`http://localhost:5000${r.imageUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1"
                >
                  📷 View Photo
                </a>
              )}
              <Link
                to={`/rescues/${r._id}`}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
              >
                📄 Full Details →
              </Link>
            </div>
          </div>

          {/* Action Buttons */}
          {actions.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              {actions.map((action) => (
                <button
                  key={action.next}
                  onClick={() => handleStatusUpdate(r._id, action.next)}
                  disabled={updating[r._id]}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    action.primary
                      ? 'text-white hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-50'
                  }`}
                  style={action.primary ? {
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
                  } : {}}
                >
                  {updating[r._id] ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Updating…
                    </span>
                  ) : (
                    <>
                      <span>{action.icon}</span>
                      <span>{action.label}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */

const RescuerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rescues, setRescues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState('ALL');
  const [updating, setUpdating] = useState({});
  const [responderLoc, setResponderLoc] = useState(null);
  const [locStatus, setLocStatus] = useState('');

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

  const handleStatusUpdate = async (id, nextStatus) => {
    setUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await api.patch(`/rescues/${id}/status`, { status: nextStatus });
      setRescues((prev) => prev.map((r) => (r._id === id ? res.data.data : r)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  const handleEnableLocation = () => {
    if (!navigator.geolocation) { setLocStatus('Unavailable'); return; }
    setLocStatus('Detecting...');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setResponderLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocStatus('Enabled'); },
      () => setLocStatus('Denied')
    );
  };

  const counts = rescues.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const displayed = filterTab === 'ALL' ? rescues : rescues.filter((r) => r.status === filterTab);
  const urgentCases = displayed.filter((r) => ['CRITICAL', 'HIGH'].includes(r.priority));
  const otherCases  = displayed.filter((r) => !['CRITICAL', 'HIGH'].includes(r.priority));

  const pendingCount = counts['PENDING'] || 0;
  const inProgressCount = counts['IN_PROGRESS'] || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm">
              🐾
            </div>
            <div className="hidden sm:block">
              <span className="font-extrabold text-slate-900 text-sm">RescueLink</span>
              <span className="ml-2 text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                Rescue Team
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-slate-500 font-medium">{user?.name}</span>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3.5 cursor-pointer">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header Banner ── */}
        <div className="relative rounded-3xl overflow-hidden mb-8 text-white"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', boxShadow: '0 12px 40px rgba(15,23,42,0.2)' }}>
          <div className="absolute top-0 right-0 w-72 h-72 -mr-20 -mt-20 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(to right, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                    style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c' }}>
                    🦺 Rescue Terminal
                  </span>
                  {pendingCount > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-status-blink"
                      style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                      {pendingCount} Pending
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Rescue Operations Center
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  {rescues.length} total case{rescues.length !== 1 ? 's' : ''}
                  {pendingCount > 0 && ` · ${pendingCount} awaiting acceptance`}
                  {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {!responderLoc ? (
                  <button
                    onClick={handleEnableLocation}
                    className="btn-outline-light text-xs py-2.5 px-4"
                  >
                    📍 {locStatus === 'Detecting...' ? 'Detecting…' : 'Enable Location'}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-300"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Location Active
                  </span>
                )}
                <button
                  onClick={load}
                  className="btn-outline-light text-xs py-2.5 px-4"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Mini stats */}
          <div className="relative z-10 grid grid-cols-3 sm:grid-cols-5 border-t border-white/10 divide-x divide-white/10">
            {TABS.filter(t => t !== 'ALL').map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`py-3 px-2 text-center transition-all cursor-pointer ${filterTab === tab ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className="text-lg font-extrabold text-white">{counts[tab] || 0}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">
                  {STATUS_CONFIG[tab]?.label?.split(' ')[0] || tab}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 custom-scroll">
          {TABS.map((tab) => {
            const isActive = filterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                style={isActive ? {} : { border: '1px solid rgba(226,232,240,0.8)' }}
              >
                <span>{tab === 'ALL' ? 'All Cases' : STATUS_CONFIG[tab]?.label || tab}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {tab === 'ALL' ? rescues.length : (counts[tab] || 0)}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-rose-500 animate-spin" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Loading rescue cases…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: 'rgba(254,242,242,0.8)', border: '1px solid rgba(252,165,165,0.4)' }}>
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-red-700 text-sm font-medium mb-4">{error}</p>
            <button onClick={load} className="btn-secondary text-xs py-2 px-4">Try Again</button>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl">📭</div>
            <h2 className="text-base font-bold text-slate-800">No cases found</h2>
            <p className="text-sm text-slate-500">
              {filterTab === 'ALL' ? 'No rescue cases have been submitted yet.' : `No cases with status "${filterTab}".`}
            </p>
          </div>
        )}

        {/* ── Case Lists ── */}
        {!loading && !error && displayed.length > 0 && (
          <div className="space-y-10">
            {urgentCases.length > 0 && (
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-red-600">
                    🚨 Urgent Cases — Immediate Action Required
                  </h2>
                  <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                    {urgentCases.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {urgentCases.map((r) => (
                    <CaseCard key={r._id} r={r} handleStatusUpdate={handleStatusUpdate} updating={updating} responderLoc={responderLoc} />
                  ))}
                </div>
              </div>
            )}

            {otherCases.length > 0 && (
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">
                    📋 Other Cases
                  </h2>
                  <span className="text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                    {otherCases.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {otherCases.map((r) => (
                    <CaseCard key={r._id} r={r} handleStatusUpdate={handleStatusUpdate} updating={updating} responderLoc={responderLoc} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RescuerDashboard;
