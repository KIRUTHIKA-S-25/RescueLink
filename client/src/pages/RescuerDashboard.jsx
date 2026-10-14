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
import { useParallax } from '../utils/useParallax';
import RescueLinkLogo from '../components/RescueLinkLogo';

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
    { label: 'Release Case',   icon: '↩️', next: 'RELEASE',     primary: false },
    { label: 'Cancel',         icon: '✕',  next: 'CANCELLED',   primary: false },
  ],
  IN_PROGRESS: [
    { label: 'Mark Rescued',   icon: '🎉', next: 'RESCUED',     primary: true  },
    { label: 'Release Case',   icon: '↩️', next: 'RELEASE',     primary: false },
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

const VALID_PRIORITY_KEYS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const getPriorityKey = (p) => {
  if (!p) return 'MEDIUM';
  if (typeof p === 'string') {
    const up = p.toUpperCase();
    return VALID_PRIORITY_KEYS.includes(up) ? up : 'MEDIUM';
  }
  if (typeof p === 'object') {
    const extracted = p.level || p.priority || p.value || p.name;
    if (typeof extracted === 'string') {
      const up = extracted.toUpperCase();
      return VALID_PRIORITY_KEYS.includes(up) ? up : 'MEDIUM';
    }
    return 'MEDIUM';
  }
  return 'MEDIUM';
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
  const priorityKey = getPriorityKey(r.priority);
  const pr = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.MEDIUM;
  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
  const isUrgent = ['CRITICAL', 'HIGH'].includes(priorityKey);
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
                    📡 {calculateDistance(Number(responderLoc.lat), Number(responderLoc.lng), Number(r.location.latitude), Number(r.location.longitude)).toFixed(1)} km away
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

  const {
    containerRef: bannerRef,
    parallaxBgStyle: bannerBgStyle,
    handleMouseMove: handleBannerMouseMove,
    handleMouseLeave: handleBannerMouseLeave,
  } = useParallax({ scrollSpeed: 0.22, mouseSensitivity: 14 });

  const [rescues, setRescues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState('ALL');
  const [updating, setUpdating] = useState({});
  const [responderLoc, setResponderLoc] = useState(null);
  const [locStatus, setLocStatus] = useState('');

  const [personalStats, setPersonalStats] = useState(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeCaseId, setCompleteCaseId] = useState(null);
  const [completeNote, setCompleteNote] = useState('Animal safely rescued and transferred to shelter.');
  const [completeDestination, setCompleteDestination] = useState('Veterinary Hospital');
  const [completeProofFile, setCompleteProofFile] = useState(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseCaseId, setReleaseCaseId] = useState(null);
  const [releaseReason, setReleaseReason] = useState('Encountered operational barrier / vehicle issue');
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, statsRes] = await Promise.all([
        api.get('/rescues'),
        api.get('/rescues/my-stats').catch(() => null),
      ]);
      setRescues(res.data.data);
      if (statsRes?.data?.data) {
        setPersonalStats(statsRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rescue cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusUpdate = async (id, nextStatus) => {
    if (nextStatus === 'RESCUED') {
      setCompleteCaseId(id);
      setCompleteModalOpen(true);
      return;
    }
    if (nextStatus === 'RELEASE') {
      setReleaseCaseId(id);
      setReleaseModalOpen(true);
      return;
    }
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

  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    if (!releaseCaseId) return;
    if (!releaseReason.trim()) {
      alert('Please provide a mandatory reason for releasing the case.');
      return;
    }
    setReleaseSubmitting(true);
    try {
      const res = await api.patch(`/rescues/${releaseCaseId}/status`, {
        status: 'PENDING',
        releaseReason: releaseReason.trim(),
      });
      setRescues((prev) => prev.map((r) => (r._id === releaseCaseId ? res.data.data : r)));
      setReleaseModalOpen(false);
      setReleaseReason('Encountered operational barrier / vehicle issue');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to release case.');
    } finally {
      setReleaseSubmitting(false);
    }
  };

  const handleCompleteRescue = async (e) => {
    e.preventDefault();
    if (!completeCaseId) return;
    if (!completeProofFile) {
      alert('Mandatory photographic proof is required before a case can be marked as RESCUED.');
      return;
    }
    setCompleteSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', 'RESCUED');
      formData.append('completionNote', completeNote.trim());
      formData.append('handoverDestination', completeDestination.trim());
      formData.append('proofImage', completeProofFile);
      const res = await api.patch(`/rescues/${completeCaseId}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRescues((prev) => prev.map((r) => (r._id === completeCaseId ? res.data.data : r)));
      setCompleteModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete rescue verification.');
    } finally {
      setCompleteSubmitting(false);
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
  const urgentCases = displayed.filter((r) => ['CRITICAL', 'HIGH'].includes(getPriorityKey(r.priority)));
  const otherCases  = displayed.filter((r) => !['CRITICAL', 'HIGH'].includes(getPriorityKey(r.priority)));

  const pendingCount = counts['PENDING'] || 0;
  const inProgressCount = counts['IN_PROGRESS'] || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RescueLinkLogo className="w-8 h-8" />
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

        {/* ── Header Banner with Parallax Animal Rescue Operations Background ── */}
        <div
          ref={bannerRef}
          onMouseMove={handleBannerMouseMove}
          onMouseLeave={handleBannerMouseLeave}
          className="relative rounded-3xl overflow-hidden mb-8 text-white shadow-2xl"
          style={{ background: '#0f172a', boxShadow: '0 12px 40px rgba(15,23,42,0.28)' }}
        >
          {/* Parallax Animal Rescue Background Image Layer */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src="/images/rescuer-banner.jpg"
              alt="Rescue Operations"
              className="parallax-bg-layer object-cover opacity-60 filter brightness-95 saturate-110"
              style={bannerBgStyle}
            />
            {/* Scrim Overlay */}
            <div className="absolute inset-0 header-scrim-dark" />
          </div>

          <div className="absolute top-0 right-0 w-72 h-72 -mr-20 -mt-20 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, transparent 70%)' }} />
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

        {/* ── Inspired by Northwest Wag Rescue Operations Dashboard (Image 3) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 1. Today's Focus (Dark Green Card matching Image 3) */}
          <div className="lg:col-span-1 bg-[#1a382e] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-emerald-300 border border-white/10">
                  Priority Directive
                </span>
                <span className="text-xs font-bold text-emerald-400">⚡ Live Dispatch</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight mb-4">Today's Focus</h2>
              
              <div className="space-y-3.5">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-xs font-semibold text-slate-200">
                    {pendingCount > 0 ? `${pendingCount} emergencies awaiting acceptance` : '3 animals need vitals review'}
                  </span>
                  <button
                    onClick={() => setFilterTab('PENDING')}
                    className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Review
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-xs font-semibold text-slate-200">
                    {inProgressCount > 0 ? `${inProgressCount} active field rescues en route` : '2 citizen requests arrived'}
                  </span>
                  <button
                    onClick={() => setFilterTab('IN_PROGRESS')}
                    className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Preview
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-xs font-semibold text-slate-200">
                    1 rescue requires destination proof
                  </span>
                  <button
                    onClick={() => setFilterTab('IN_PROGRESS')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Checklist
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>Shift: <b>Day Patrol (On-Duty)</b></span>
              <span className="text-emerald-400 font-bold">● GPS Synced</span>
            </div>
          </div>

          {/* 2. Due Soon & Recent Activity (Soft Peach Cards matching Image 3) */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Due Soon Card */}
            <div className="bg-[#fff1ee] border border-rose-200/80 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-rose-900">Due Soon</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-200/60 text-rose-800">
                    SLA Alert
                  </span>
                </div>
                <div className="space-y-2 mb-4 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>TEAM</span>
                    <span>TASK</span>
                    <span>DUE</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 bg-white/80 p-2 rounded-xl">
                    <span className="font-semibold">{user?.name?.split(' ')[0] || 'Patrol'}</span>
                    <span className="truncate max-w-[100px]">Field Triage</span>
                    <span className="text-rose-600 font-bold">12 mins</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-rose-200/60">
                <button
                  onClick={() => alert("Notified citizen reporter of responder arrival ETA.")}
                  className="flex-1 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Nudge Citizen
                </button>
                <a
                  href="tel:1962"
                  className="flex-1 py-2 text-xs font-bold text-center text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all"
                >
                  Call Ambulance
                </a>
              </div>
            </div>

            {/* Operational Calendar & Shift Widget */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-slate-900">Shift Telemetry</span>
                  <span className="text-[10px] font-bold text-slate-400">October 2026</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
                  <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-600">
                  <span className="p-1">11</span>
                  <span className="p-1">12</span>
                  <span className="p-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg">13 🐾</span>
                  <span className="p-1 bg-rose-500 text-white font-bold rounded-lg">14 ★</span>
                  <span className="p-1">15</span>
                  <span className="p-1">16</span>
                  <span className="p-1">17</span>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold">Patrol Corridor:</span>
                <span className="font-bold text-slate-800">Zone-4 Metropolitan</span>
              </div>
            </div>

            {/* Animals At-A-Glance Task Table matching Image 3 */}
            <div className="sm:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold text-slate-900">Animals At-A-Glance</h3>
                <span className="text-[10px] font-bold text-slate-400">Active Field Queue</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Stray Retriever', code: 'RC-1082', task: 'Triage Bio & Vitals Needed', action: 'Assign', color: 'bg-amber-500' },
                  { name: 'Injured Calico', code: 'RC-1083', task: 'Ready for Shelter Transfer', action: 'Navigate', color: 'bg-emerald-600' },
                  { name: 'Fractured Bull', code: 'RC-1084', task: 'Ambulance Transit Verification', action: 'Vitals', color: 'bg-blue-600' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <div>
                        <span className="font-extrabold text-slate-900">{item.name}</span>
                        <span className="ml-2 font-mono-case text-[10px] text-slate-400 font-bold">{item.code}</span>
                      </div>
                    </div>
                    <span className="hidden sm:inline text-slate-500 text-[11px] font-medium">{item.task}</span>
                    <button
                      onClick={() => setFilterTab('ALL')}
                      className={`px-3 py-1 rounded-xl text-white text-[11px] font-bold cursor-pointer transition-transform hover:scale-105 ${item.color}`}
                    >
                      {item.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Phase 15: Rescuer Personal Workload & Analytics Terminal ── */}
        {personalStats && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 mb-8 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">Personal Workload & Analytics Terminal</h2>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Active Patrol
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Authorized personal metrics for {user?.name} (Strict RBAC protected)</p>
              </div>

              {/* Workload Capacity Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 min-w-[220px]">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span>Workload Capacity:</span>
                  <span className={personalStats.summary.activeWorkload >= 3 ? 'text-red-600' : 'text-emerald-700'}>
                    {personalStats.summary.activeWorkload} / 3 slots
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      personalStats.summary.activeWorkload >= 3 ? 'bg-red-500' :
                      personalStats.summary.activeWorkload === 2 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${personalStats.summary.workloadPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Personal Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 text-center">
                <div className="text-xs font-bold text-blue-700">Currently Assigned</div>
                <div className="text-2xl font-black text-blue-900 mt-1">{personalStats.summary.currentlyAssigned}</div>
                <div className="text-[10px] text-blue-500 mt-0.5">In your patrol queue</div>
              </div>

              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 text-center">
                <div className="text-xs font-bold text-amber-700">Awaiting Action</div>
                <div className="text-2xl font-black text-amber-900 mt-1">{personalStats.summary.awaitingAction}</div>
                <div className="text-[10px] text-amber-500 mt-0.5">Accepted, not started</div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 text-center">
                <div className="text-xs font-bold text-indigo-700">In Progress</div>
                <div className="text-2xl font-black text-indigo-900 mt-1">{personalStats.summary.inProgress}</div>
                <div className="text-[10px] text-indigo-500 mt-0.5">Actively rescuing</div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 text-center">
                <div className="text-xs font-bold text-emerald-700">Completed Rescues</div>
                <div className="text-2xl font-black text-emerald-900 mt-1">{personalStats.summary.completedRescues}</div>
                <div className="text-[10px] text-emerald-500 mt-0.5">Proof verified</div>
              </div>

              <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3.5 text-center">
                <div className="text-xs font-bold text-purple-700">Avg Response Time</div>
                <div className="text-2xl font-black text-purple-900 mt-1">{personalStats.summary.avgResponseTimeMinutes} <span className="text-xs font-bold">min</span></div>
                <div className="text-[10px] text-purple-500 mt-0.5">Alert to acceptance</div>
              </div>

              <div className="bg-teal-50/70 border border-teal-100 rounded-2xl p-3.5 text-center">
                <div className="text-xs font-bold text-teal-700">Avg Rescue Time</div>
                <div className="text-2xl font-black text-teal-900 mt-1">{personalStats.summary.avgCompletionTimeMinutes} <span className="text-xs font-bold">min</span></div>
                <div className="text-[10px] text-teal-500 mt-0.5">Acceptance to finish</div>
              </div>
            </div>

            {/* Personal breakdown chips */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-500">Your Case History:</span>
                {personalStats.statusDistribution?.map((sd) => (
                  <span key={sd.status} className="px-2.5 py-1 bg-slate-100 rounded-xl font-bold text-slate-700 text-[11px]">
                    {sd.status}: {sd.count}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                <span>Released: <b className="text-slate-600">{personalStats.summary.releasedCases}</b></span>
                <span>Evidence Required: <b className="text-slate-600">{personalStats.summary.requiringEvidence}</b></span>
              </div>
            </div>
          </div>
        )}

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

      {/* ─── Mark Rescued Completion Modal ─── */}
      {completeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎉</span>
                <h3 className="text-lg font-extrabold text-slate-900">Complete Rescue Operation</h3>
              </div>
              <button
                onClick={() => setCompleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              To close this case as <strong>RESCUED</strong>, please provide completion notes and shelter / clinic handover details.
            </p>

            <form onSubmit={handleCompleteRescue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Handover Facility / Shelter
                </label>
                <input
                  type="text"
                  required
                  value={completeDestination}
                  onChange={(e) => setCompleteDestination(e.target.value)}
                  placeholder="e.g. Blue Cross Shelter, City Veterinary Clinic"
                  className="form-input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Completion & Treatment Note *
                </label>
                <textarea
                  required
                  rows={3}
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  placeholder="Describe rescue details and current medical condition..."
                  className="form-input w-full resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mandatory Proof Photo / Evidence *
                </label>
                <input
                  type="file"
                  required
                  accept="image/*"
                  onChange={(e) => setCompleteProofFile(e.target.files[0])}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Required: Upload clear photographic evidence of secured animal before closure.
                </p>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5 text-xs font-bold"
                  disabled={completeSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeSubmitting}
                  className="btn-emergency flex-1 py-2.5 text-xs font-bold justify-center"
                >
                  {completeSubmitting ? 'Verifying & Saving…' : 'Confirm Rescue ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Case Modal */}
      {releaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-slide-in-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">↩️</span>
                <h3 className="font-extrabold text-slate-900 text-lg">Release Rescue Case</h3>
              </div>
              <button
                onClick={() => setReleaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Releasing this case will return it back to the <strong>PENDING</strong> queue so other available responders can be dispatched.
            </p>

            <form onSubmit={handleReleaseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mandatory Reason for Release *
                </label>
                <textarea
                  required
                  rows={3}
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. Vehicle breakdown, medical equipment issue, assigned to another priority..."
                  className="form-input w-full resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReleaseModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5 text-xs font-bold"
                  disabled={releaseSubmitting}
                >
                  Keep Case
                </button>
                <button
                  type="submit"
                  disabled={releaseSubmitting}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold justify-center"
                >
                  {releaseSubmitting ? 'Releasing…' : 'Confirm Release ↩️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RescuerDashboard;
