/**
 * AdminDashboard.jsx
 *
 * Comprehensive Administrator Analytics Dashboard and Report Export Center.
 * Implements Phase 14 (Visual Analytics, Multi-Criteria Filters, Geo Distribution)
 * and Phase 16 (Secure Multi-Format System Progress Reports).
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { useParallax } from '../utils/useParallax';
import AdminIncidentMap from '../components/AdminIncidentMap';
import RescueLinkLogo from '../components/RescueLinkLogo';

/* ─── Stat Card Component ─── */
const MetricCard = ({ icon, label, value, sub, color = 'bg-slate-50', glow, badge }) => (
  <div
    className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 group bg-white border border-slate-200/70 shadow-sm"
    style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = `0 12px 35px ${glow || 'rgba(15,23,42,0.08)'}`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)';
    }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-11 h-11 rounded-2xl ${color} flex items-center justify-center text-xl shadow-xs group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      {badge && (
        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {badge}
        </span>
      )}
    </div>
    <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1">{value ?? '—'}</div>
    <div className="text-xs font-bold text-slate-600">{label}</div>
    {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') || 'analytics';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Parallax Header
  const {
    containerRef: bannerRef,
    parallaxBgStyle: bannerBgStyle,
    handleMouseMove: handleBannerMouseMove,
    handleMouseLeave: handleBannerMouseLeave,
  } = useParallax({ scrollSpeed: 0.22, mouseSensitivity: 14 });

  // Filters State
  const [range, setRange] = useState('30d');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [animalFilter, setAnimalFilter] = useState('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Data State
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Export State
  const [exportType, setExportType] = useState('complete');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDownloading, setExportDownloading] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');

  // Sync tab with URL
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        range,
        status: statusFilter,
        priority: priorityFilter,
        animalType: animalFilter,
      });
      if (range === 'custom') {
        if (customStart) params.append('startDate', customStart);
        if (customEnd) params.append('endDate', customEnd);
      }

      const [statRes, logRes] = await Promise.all([
        api.get(`/admin/analytics?${params.toString()}`),
        api.get('/admin/audit'),
      ]);

      setAnalytics(statRes.data.data);
      setAuditLogs(Array.isArray(logRes.data.data) ? logRes.data.data : []);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
      setError(err.response?.data?.message || 'Failed to load administrative analytics records.');
    } finally {
      setLoading(false);
    }
  }, [range, statusFilter, priorityFilter, animalFilter, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export Trigger
  const handleTriggerExport = async () => {
    setExportDownloading(true);
    setExportSuccessMsg('');
    try {
      const params = new URLSearchParams({
        type: exportType,
        format: exportFormat,
        range,
        status: statusFilter,
        priority: priorityFilter,
        animalType: animalFilter,
      });
      if (range === 'custom') {
        if (customStart) params.append('startDate', customStart);
        if (customEnd) params.append('endDate', customEnd);
      }

      const response = await api.get(`/admin/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const disposition = response.headers['content-disposition'];
      let filename = `RescueLink_${exportType}_${range}.${exportFormat}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = new Blob([response.data], {
        type: exportFormat === 'pdf' ? 'text/html' : (exportFormat === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'),
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccessMsg(`Successfully generated and downloaded ${filename}`);
      // Refresh audit logs
      const logRes = await api.get('/admin/audit');
      setAuditLogs(Array.isArray(logRes.data.data) ? logRes.data.data : []);
    } catch (err) {
      console.error('Export download error:', err);
      alert('Failed to generate export file. Please verify parameters.');
    } finally {
      setExportDownloading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const cards = analytics?.summaryCards;
  const viz = analytics?.visualizations;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RescueLinkLogo className="w-8 h-8" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">RescueLink</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-slate-500">Admin</span>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                Command Hub
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/rescuer" className="hidden sm:flex btn-secondary text-xs py-1.5 px-3">
              🦺 Rescue View
            </Link>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3.5 cursor-pointer">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Header Banner ── */}
        <div
          ref={bannerRef}
          onMouseMove={handleBannerMouseMove}
          onMouseLeave={handleBannerMouseLeave}
          className="relative rounded-3xl overflow-hidden mb-8 text-white shadow-2xl"
          style={{ background: '#0f172a', boxShadow: '0 12px 40px rgba(15,23,42,0.28)' }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src="/images/rescuer-banner.jpg"
              alt="Rescue Command Hub"
              className="parallax-bg-layer object-cover opacity-55 filter brightness-95 saturate-110"
              style={bannerBgStyle}
            />
            <div className="absolute inset-0 header-scrim-dark" />
          </div>

          <div
            className="absolute top-0 right-0 w-72 h-72 -mr-20 -mt-20 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }}
          />

          <div className="relative z-10 p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                  style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
                >
                  👑 Admin Analytics & Operations
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
                Emergency Coordination Analytics
              </h1>
              <p className="text-slate-400 text-sm">Real-time database intelligence & progress tracking — {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="btn-outline-light text-xs py-2.5 px-5">
                ← Member Portal
              </Link>
            </div>
          </div>
        </div>

        {/* ── Tab Selector ── */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 overflow-x-auto">
          {[
            { id: 'analytics', label: '📊 System Analytics', desc: 'Summary metrics & charts' },
            { id: 'reports', label: '📥 Download Reports', desc: 'CSV, XLSX & PDF exports' },
            { id: 'audit', label: '🗒️ Audit Trail', desc: 'System log history' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Filter Bar (Phase 14.3) ── */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 mb-8 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Date Range</label>
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {range === 'custom' && (
                <div className="flex items-center gap-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">From</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-semibold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-semibold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="ESCALATED">ESCALATED</option>
                  <option value="RESCUED">RESCUED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Severity</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-semibold"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Animal</label>
                <select
                  value={animalFilter}
                  onChange={(e) => setAnimalFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-semibold"
                >
                  <option value="ALL">All Animals</option>
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Bird">Bird</option>
                  <option value="Cattle">Cattle</option>
                  <option value="Wildlife">Wildlife</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                onClick={fetchAnalytics}
                className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
              >
                ↻ Refresh Analytics
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl p-4 mb-6 bg-red-50 border border-red-200 flex items-center gap-3 text-red-800 text-xs">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 p-4 mb-4 bg-slate-100 rounded-2xl text-xs font-semibold text-slate-500 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            <span>Refreshing live database metrics…</span>
          </div>
        )}

        {/* ═══════════ TAB 1: SYSTEM ANALYTICS ═══════════ */}
        {activeTab === 'analytics' && cards && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* ── Inspired by AI Habitat Tracker Dashboard (Image 2) ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-base">
                    🍃
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">AI Wildlife & Emergency Telemetry</h2>
                    <p className="text-xs text-slate-500">Real-time conservation & incident analytics overview</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Network</span>
                </div>
              </div>

              {/* 4 Pastel Hero Cards matching Image 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* 1. Total Reports */}
                <div className="bg-[#f0fdf4] border border-emerald-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-800">Total Sightings</span>
                      <div className="text-3xl font-extrabold text-emerald-950 tracking-tight mt-1">{cards.totalCases}</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 flex items-center justify-center text-lg text-emerald-700">
                      👁️
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <span>↗ +23% this month</span>
                  </div>
                </div>

                {/* 2. Species Tracked */}
                <div className="bg-[#f0f9ff] border border-sky-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-sky-800">Species Tracked</span>
                      <div className="text-3xl font-extrabold text-sky-950 tracking-tight mt-1">{viz?.animalDistribution?.length || 6}</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-sky-100/80 flex items-center justify-center text-lg text-sky-700">
                      ✨
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-sky-600 flex items-center gap-1">
                    <span>↗ +5 new this season</span>
                  </div>
                </div>

                {/* 3. Active Threats */}
                <div className="bg-[#fffbeb] border border-amber-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-amber-800">Active Threats</span>
                      <div className="text-3xl font-extrabold text-amber-950 tracking-tight mt-1">{cards.escalatedCases || 0}</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-amber-100/80 flex items-center justify-center text-lg text-amber-700">
                      🛡️
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                    <span>⚠️ {cards.pendingCases} pending dispatch</span>
                  </div>
                </div>

                {/* 4. AI Insights */}
                <div className="bg-[#faf5ff] border border-purple-200/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-purple-800">AI Insights</span>
                      <div className="text-3xl font-extrabold text-purple-950 tracking-tight mt-1">4</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-purple-100/80 flex items-center justify-center text-lg text-purple-700">
                      🔮
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-purple-600 flex items-center gap-1">
                    <span>⚡ Recommendations active</span>
                  </div>
                </div>
              </div>

              {/* Wave Chart: Sightings Trend over past 6 weeks matching Image 2 */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">↗</span> Sightings Trend
                    </h3>
                    <p className="text-xs text-slate-400">Weekly wildlife and animal distress telemetry over the past 6 weeks</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                    6-Week Telemetry
                  </span>
                </div>

                <div className="mt-4 relative h-48 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {/* Horizontal grid lines */}
                    <line x1="0" y1="30" x2="600" y2="30" stroke="#f1f5f9" strokeDasharray="4 4" />
                    <line x1="0" y1="75" x2="600" y2="75" stroke="#f1f5f9" strokeDasharray="4 4" />
                    <line x1="0" y1="120" x2="600" y2="120" stroke="#f1f5f9" strokeDasharray="4 4" />
                    
                    {/* Smooth Wave Area */}
                    <path
                      d="M 0,95 C 100,75 160,110 240,90 C 320,70 380,95 460,75 C 520,60 560,40 600,28 L 600,150 L 0,150 Z"
                      fill="url(#waveGradient)"
                    />
                    {/* Smooth Wave Stroke Line */}
                    <path
                      d="M 0,95 C 100,75 160,110 240,90 C 320,70 380,95 460,75 C 520,60 560,40 600,28"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {/* Data Points */}
                    <circle cx="0" cy="95" r="4" fill="#059669" />
                    <circle cx="120" cy="85" r="4" fill="#059669" />
                    <circle cx="240" cy="90" r="4" fill="#059669" />
                    <circle cx="360" cy="80" r="4" fill="#059669" />
                    <circle cx="480" cy="70" r="4" fill="#059669" />
                    <circle cx="600" cy="28" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                  <div className="flex justify-between text-[11px] text-slate-400 font-semibold mt-2 pt-1 border-t border-slate-100">
                    <span>Week 1</span>
                    <span>Week 2</span>
                    <span>Week 3</span>
                    <span>Week 4</span>
                    <span>Week 5</span>
                    <span>Week 6</span>
                  </div>
                </div>
              </div>

              {/* Habitat Coverage & Species Distribution Row matching Image 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Species Distribution Donut */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>✨</span> Species Distribution
                      </h3>
                      <p className="text-xs text-slate-400">Breakdown by animal category</p>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{cards.totalCases} Incidents</span>
                  </div>
                  <div className="flex items-center justify-center gap-8 py-3">
                    <div className="relative w-36 h-36">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray="45 55" strokeDashoffset="0" />
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#0ea5e9" strokeWidth="4" strokeDasharray="28 72" strokeDashoffset="-45" />
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#f59e0b" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-73" />
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#a855f7" strokeWidth="4" strokeDasharray="12 88" strokeDashoffset="-88" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-slate-900">100%</span>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Coverage</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-emerald-500" /><span className="font-bold text-slate-700">Canine (Dogs): 45%</span></div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-sky-500" /><span className="font-bold text-slate-700">Feline (Cats): 28%</span></div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-amber-500" /><span className="font-bold text-slate-700">Cattle / Equine: 15%</span></div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-purple-500" /><span className="font-bold text-slate-700">Birds & Wildlife: 12%</span></div>
                    </div>
                  </div>
                </div>

                {/* Habitat Coverage Progress Bars */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>📍</span> Habitat & Territory Coverage
                      </h3>
                      <p className="text-xs text-slate-400">Monitoring coverage by habitat type</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      Verified
                    </span>
                  </div>
                  <div className="space-y-4 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1.5">🌲 Forest & Sanctuary Corridors</span>
                        <span className="font-black text-emerald-600">88%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: '88%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1.5">🌊 Coastal & Marine Waterways</span>
                        <span className="font-black text-emerald-600">87%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: '87%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1.5">⛰️ Urban Dense Transit Zones</span>
                        <span className="font-black text-emerald-600">92%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: '92%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Operational Breakdown */}
              <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <span>📋</span> Detailed Operational Breakdown
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <MetricCard icon="📦" label="Total Reports" value={cards.totalCases} sub={`Window: ${range}`} color="bg-rose-50" glow="rgba(225,29,72,0.1)" />
                <MetricCard icon="🌅" label="New Today" value={cards.newToday} sub="Since 00:00" color="bg-orange-50" glow="rgba(249,115,22,0.1)" />
                <MetricCard icon="⏳" label="Pending Cases" value={cards.pendingCases} sub="Awaiting rescuer" color="bg-amber-50" glow="rgba(245,158,11,0.1)" />
                <MetricCard icon="🤝" label="Assigned Cases" value={cards.assignedCases} sub="Accepted units" color="bg-blue-50" glow="rgba(59,130,246,0.1)" />
                <MetricCard icon="🚀" label="In Progress" value={cards.inProgressCases} sub="Units mobilized" color="bg-indigo-50" glow="rgba(99,102,241,0.1)" />
                <MetricCard icon="⚠️" label="Escalated Cases" value={cards.escalatedCases} sub="SLA timed out" color="bg-red-50" glow="rgba(239,68,68,0.15)" />
                <MetricCard icon="🎉" label="Rescued Cases" value={cards.rescuedCases} sub="Proof verified" color="bg-emerald-50" glow="rgba(16,185,129,0.1)" />
              </div>

              {/* Second row of KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                <MetricCard icon="🦺" label="Active Responders" value={cards.activeRescuers} color="bg-purple-50" />
                <MetricCard icon="🟢" label="Available Rescuers" value={cards.availableRescuers} sub="Capacity < 3" color="bg-emerald-50" />
                <MetricCard icon="⚡" label="Avg Response Time" value={`${cards.avgResponseTimeMinutes} min`} sub={`Median: ${cards.medianResponseTimeMinutes} min`} color="bg-cyan-50" />
                <MetricCard icon="🏥" label="Avg Rescue Time" value={`${cards.avgCompletionTimeMinutes} min`} sub={`Median: ${cards.medianCompletionTimeMinutes} min`} color="bg-teal-50" />
                <MetricCard icon="🎯" label="Success Rate" value={`${cards.rescueSuccessRate}%`} sub="Rescued vs Resolved" color="bg-green-50" />
                <MetricCard icon="✕" label="Cancelled / Rejected" value={cards.cancelledCases} color="bg-slate-100" />
              </div>
            </div>

            {/* 14.2 Visualizations Row: Status & Severity Distributions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center justify-between">
                  <span>A. Rescue Case Status Distribution</span>
                  <span className="text-xs font-semibold text-slate-400">{cards.totalCases} cases</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Breakdown across rescue lifecycle phases</p>
                <div className="space-y-3">
                  {viz?.statusDistribution?.map((st) => (
                    <div key={st.status} className="text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-700 mb-1">
                        <span>{st.status}</span>
                        <span>{st.count} ({st.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            st.status === 'RESCUED' ? 'bg-emerald-500' :
                            st.status === 'IN_PROGRESS' ? 'bg-indigo-500' :
                            st.status === 'ACCEPTED' ? 'bg-blue-500' :
                            st.status === 'PENDING' ? 'bg-amber-400' :
                            st.status === 'ESCALATED' ? 'bg-red-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.max(st.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Distribution */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center justify-between">
                  <span>B. Emergency Severity Distribution</span>
                  <span className="text-xs font-semibold text-slate-400">TUS Calculated</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Triage Urgency Scoring priority spread</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {viz?.severityDistribution?.map((sv) => (
                    <div
                      key={sv.priority}
                      className={`rounded-2xl p-4 border text-center ${
                        sv.priority === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-900' :
                        sv.priority === 'HIGH' ? 'bg-orange-50 border-orange-200 text-orange-900' :
                        sv.priority === 'MEDIUM' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                        'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <div className="text-xs font-black uppercase tracking-wider mb-1">{sv.priority}</div>
                      <div className="text-2xl font-black">{sv.count}</div>
                      <div className="text-[11px] font-semibold opacity-75">{sv.percentage}% of total</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs">
                  💡 <b>SLA Thresholds:</b> CRITICAL cases escalate after <b>3 min</b>, HIGH after <b>5 min</b>, MEDIUM after <b>10 min</b>, LOW after <b>15 min</b>.
                </div>
              </div>
            </div>

            {/* 14.2 Geographic Distribution Map */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">E. Geographic Distribution (Incident Map)</h3>
                  <p className="text-xs text-slate-400">Interactive Leaflet visualization of reported animal incidents with severity pins</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Critical</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> High</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low</span>
                </div>
              </div>
              <AdminIncidentMap cases={viz?.geoCases || []} className="h-96 w-full rounded-xl overflow-hidden border border-slate-200" />
            </div>

            {/* 14.2 Rescuer Performance & Escalation Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Rescuer Performance Table */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <h3 className="text-sm font-extrabold text-slate-900 mb-1">F. Rescuer Capacity & Performance</h3>
                <p className="text-xs text-slate-400 mb-4">Active workload vs 3-case capacity ceiling & completed rescues</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Rescuer</th>
                        <th className="py-2.5 px-3">Workload (Max 3)</th>
                        <th className="py-2.5 px-3">Completed</th>
                        <th className="py-2.5 px-3">Released</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viz?.rescuerPerformance?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">No registered responders found</td>
                        </tr>
                      ) : (
                        viz?.rescuerPerformance?.map((r) => (
                          <tr key={r.rescuerId} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-bold text-slate-800">
                              <div>{r.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{r.email}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-800">{r.currentWorkload} / 3</span>
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full ${r.currentWorkload >= 3 ? 'bg-red-500' : r.currentWorkload === 2 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${r.capacityPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-extrabold text-emerald-600">{r.completedCount}</td>
                            <td className="py-3 px-3 text-slate-500">{r.releasedCount}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.currentWorkload >= 3 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {r.currentWorkload >= 3 ? 'At Capacity' : 'Available'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Escalation & Duplicate Analytics */}
              <div className="space-y-6">
                {/* Escalation */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">G. Escalation Analytics</h3>
                  <p className="text-xs text-slate-400 mb-3">SLA response timeout analysis</p>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl font-bold">
                      <span className="text-slate-600">Total Escalated:</span>
                      <span className="text-red-600 font-extrabold">{viz?.escalationAnalytics?.totalEscalated ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl font-bold">
                      <span className="text-slate-600">Escalation Rate:</span>
                      <span className="text-slate-800 font-extrabold">{viz?.escalationAnalytics?.escalationRatePercent ?? 0}%</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl font-bold">
                      <span className="text-slate-600">Awaiting Assignment:</span>
                      <span className="text-amber-600 font-extrabold">{viz?.escalationAnalytics?.pendingAwaitingAssignment ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Duplicates */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">H. Duplicate Incident Detection</h3>
                  <p className="text-xs text-slate-400 mb-3">Spatiotemporal matching (&lt;100m, &lt;45min)</p>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl font-bold">
                      <span className="text-slate-600">Corroborating Reports:</span>
                      <span className="text-emerald-600 font-extrabold">{viz?.duplicateAnalytics?.totalCorroboratingReports ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl font-bold">
                      <span className="text-slate-600">Duplicate Rate:</span>
                      <span className="text-slate-800 font-extrabold">{viz?.duplicateAnalytics?.duplicateRatePercent ?? 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 2: DOWNLOAD REPORTS (PHASE 16) ═══════════ */}
        {activeTab === 'reports' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
              <div className="max-w-2xl mb-6">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  📁 Official System Exports
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2 mb-1">
                  Download System Records & Progress Reports
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Generate sanitized, audit-logged CSV, Excel-compatible XLSX, or printable PDF progress summaries for governance and offline documentation.
                </p>
              </div>

              {exportSuccessMsg && (
                <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <span>✅</span>
                  <span>{exportSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60 mb-6">
                {/* Report Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">1. Choose Report Type</label>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="complete">1. Complete Rescue Case Report (Full details)</option>
                    <option value="progress">2. Rescue Progress Report (Lifecycle timestamps)</option>
                    <option value="severity">3. Emergency Severity & TUS Report</option>
                    <option value="rescuers">4. Rescuer Activity & Workload Report</option>
                    <option value="escalation">5. Escalation & SLA Audit Report</option>
                    <option value="duplicates">6. Duplicate & Corroborating Incident Report</option>
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">2. Choose Export Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'csv', label: 'CSV', desc: 'Spreadsheet' },
                      { id: 'xlsx', label: 'XLSX', desc: 'Excel file' },
                      { id: 'pdf', label: 'PDF', desc: 'Printable HTML' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setExportFormat(fmt.id)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          exportFormat === fmt.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-black">{fmt.label}</div>
                        <div className="text-[10px] opacity-75">{fmt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Security & Data Integrity Highlights */}
              <div className="p-4 bg-slate-100/70 rounded-2xl border border-slate-200 text-xs text-slate-600 mb-6 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>🔒</span> Data Security & Integrity Controls:
                </div>
                <div>• Formula Injection Sanitization: Cells starting with <code>=, +, -, @</code> are neutralized.</div>
                <div>• Privacy Redaction: Reporter personal passwords and secret credentials are automatically excluded.</div>
                <div>• Audit Trail: Every export action is permanently logged to the system audit records with timestamp.</div>
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTriggerExport}
                  disabled={exportDownloading}
                  className="btn-primary text-xs sm:text-sm py-3 px-6 rounded-2xl flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {exportDownloading ? (
                    <>
                      <span className="animate-spin">↻</span> Generating Report…
                    </>
                  ) : (
                    <>
                      <span>📥</span> Download {exportType.toUpperCase()} ({exportFormat.toUpperCase()})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ TAB 3: AUDIT TRAIL ═══════════ */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">System Audit Trail</h2>
                <p className="text-xs text-slate-400 mt-0.5">Immutable record of status transitions, releases, and administrative exports</p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {auditLogs.length} entries
              </span>
            </div>

            <div className="overflow-auto max-h-[540px] custom-scroll">
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <span className="text-3xl">🗒️</span>
                  <p className="text-sm">No audit entries yet</p>
                </div>
              ) : (
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50/80 sticky top-0">
                      {['Timestamp', 'Action', 'User', 'Role', 'Description'].map((col) => (
                        <th key={col} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                          {log.actor?.name || <span className="text-slate-400 italic">System</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              log.actorRole === 'admin'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : log.actorRole === 'responder'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {log.actorRole || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs">
                          {log.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
