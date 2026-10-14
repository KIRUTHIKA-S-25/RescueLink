/**
 * MyRescues.jsx
 * Shows rescue requests submitted by the authenticated user.
 * Route: /my-rescues (protected)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     pill: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400', bar: 'from-yellow-400 to-amber-500' },
  ACCEPTED:    { label: 'Accepted',    pill: 'bg-blue-100 text-blue-800 border-blue-200',       dot: 'bg-blue-500',   bar: 'from-blue-400 to-indigo-500' },
  IN_PROGRESS: { label: 'In Progress', pill: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500', bar: 'from-orange-400 to-red-500' },
  RESCUED:     { label: 'Rescued ✓',  pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', bar: 'from-emerald-400 to-teal-500' },
  CANCELLED:   { label: 'Cancelled',   pill: 'bg-slate-100 text-slate-600 border-slate-200',    dot: 'bg-slate-400',  bar: 'from-slate-300 to-slate-400' },
};

const WORKFLOW = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED'];

const PRIORITY_CONFIG = {
  CRITICAL: { pill: 'bg-red-100 text-red-700 border-red-200' },
  HIGH:     { pill: 'bg-orange-100 text-orange-700 border-orange-200' },
  MEDIUM:   { pill: 'bg-amber-100 text-amber-700 border-amber-200' },
  LOW:      { pill: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const StatusTimeline = ({ status }) => {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
        <span className="text-slate-400 text-xs font-medium italic">This case was cancelled</span>
      </div>
    );
  }

  const currentIdx = WORKFLOW.indexOf(status);
  return (
    <div className="mt-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Progress</div>
      <div className="relative flex items-center">
        {/* Background track */}
        <div className="absolute left-5 right-5 h-1 bg-slate-100 rounded-full" />
        {/* Progress fill */}
        {currentIdx >= 0 && (
          <div
            className="absolute left-5 h-1 rounded-full bg-gradient-to-r from-rose-400 to-emerald-500 transition-all duration-700"
            style={{ width: `${(currentIdx / (WORKFLOW.length - 1)) * (100 - (10 / WORKFLOW.length))}%` }}
          />
        )}

        {WORKFLOW.map((s, i) => {
          const done   = i <= currentIdx;
          const active = i === currentIdx;
          const cfg    = STATUS_CONFIG[s];
          return (
            <div key={s} className="relative flex-1 flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-300 z-10 ${
                done
                  ? active
                    ? `bg-gradient-to-br ${cfg.bar} text-white border-transparent shadow-md`
                    : 'bg-emerald-500 text-white border-transparent shadow-sm'
                  : 'bg-white text-slate-400 border-slate-200'
              }`}>
                {done && !active ? '✓' : i + 1}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider text-center hidden sm:block ${done ? 'text-slate-700' : 'text-slate-400'}`}>
                {s.replace('_', ' ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const getPriorityLabel = (p) => {
  if (!p) return 'MEDIUM';
  if (typeof p === 'string') {
    const up = p.toUpperCase();
    return VALID_PRIORITIES.includes(up) ? up : 'MEDIUM';
  }
  if (typeof p === 'object') {
    const extracted = p.level || p.priority || p.value || p.name;
    if (typeof extracted === 'string') {
      const up = extracted.toUpperCase();
      return VALID_PRIORITIES.includes(up) ? up : 'MEDIUM';
    }
    return 'MEDIUM';
  }
  const s = String(p).toUpperCase();
  return VALID_PRIORITIES.includes(s) ? s : 'MEDIUM';
};

const MyRescues = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rescues, setRescues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm">
              🐾
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">RescueLink</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-slate-500">My Reports</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="hidden sm:flex btn-secondary text-xs py-1.5 px-3.5">
              ← Dashboard
            </Link>
            <Link to="/report" className="btn-primary text-xs py-1.5 px-3.5 hidden sm:flex">
              + Report
            </Link>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3.5 cursor-pointer hidden sm:block">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">My Rescue Reports</h1>
            <p className="text-sm text-slate-500 mt-1">
              Track the real-time status of your submitted animal emergency cases
            </p>
          </div>
          <button onClick={load} className="btn-secondary text-xs py-2 px-4 cursor-pointer">
            ↻ Refresh
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-rose-500 animate-spin" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Loading your cases…</p>
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

        {/* ── Empty State ── */}
        {!loading && !error && rescues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center text-4xl">🔍</div>
            <h2 className="text-lg font-bold text-slate-800">No rescue reports yet</h2>
            <p className="text-sm text-slate-500 max-w-xs">
              When you report an animal emergency, it will appear here with live tracking.
            </p>
            <Link to="/report" className="btn-emergency text-sm px-6 py-3 mt-2">
              🚨 Report an Emergency
            </Link>
          </div>
        )}

        {/* ── Case List ── */}
        {!loading && !error && rescues.length > 0 && (
          <div className="space-y-4">
            {rescues.map((r, i) => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
              const pLabel = getPriorityLabel(r.priority);
              const pc = PRIORITY_CONFIG[pLabel] || PRIORITY_CONFIG.MEDIUM;
              return (
                <div
                  key={r._id}
                  className="bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    border: '1px solid rgba(226,232,240,0.7)',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                    animationDelay: `${i * 0.05}s`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(15,23,42,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'; }}
                >
                  {/* Status bar */}
                  <div className={`h-1 bg-gradient-to-r ${sc.bar}`} />

                  <div className="p-5 sm:p-6">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div>
                        <span className="font-mono-case text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md block mb-1">
                          {r.caseId}
                        </span>
                        <h2 className="font-bold text-slate-900 text-base">
                          {r.animalType} — {r.emergencyType}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg border ${pc.pill}`}>
                          {pLabel}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>

                    {r.description && (
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{r.description}</p>
                    )}

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">📍</span>
                        <span>{r.location?.address || 'Unknown location'}</span>
                      </span>
                      {r.location?.latitude && r.location?.longitude && (
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-md">
                          GPS ✓
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">🕒</span>
                        <span>{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </span>
                    </div>

                    {/* Progress timeline */}
                    <StatusTimeline status={r.status} />

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Link
                        to={`/rescues/${r._id}`}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1.5"
                      >
                        View Full Details →
                      </Link>
                      {r.status === 'RESCUED' && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Successfully Rescued
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyRescues;
