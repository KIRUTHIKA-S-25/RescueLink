import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const StatCard = ({ icon, label, value, sub, color, glow }) => (
  <div
    className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 group"
    style={{
      background: 'white',
      border: '1px solid rgba(226,232,240,0.7)',
      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 12px 40px ${glow || 'rgba(15,23,42,0.1)'}`; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'; }}
  >
    <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
      {icon}
    </div>
    <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">{value}</div>
    <div className="text-sm font-semibold text-slate-700">{label}</div>
    {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
  </div>
);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statRes, logRes] = await Promise.all([
          api.get('/admin/analytics'),
          api.get('/admin/audit'),
        ]);
        setAnalytics(statRes.data.data);
        setAuditLogs(logRes.data.data);
      } catch (err) {
        console.error('Failed to load admin data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Loading admin data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm">
              🐾
            </div>
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

        {/* ── Admin Banner ── */}
        <div className="relative rounded-3xl overflow-hidden mb-8 text-white"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', boxShadow: '0 12px 40px rgba(15,23,42,0.2)' }}>
          <div className="absolute top-0 right-0 w-72 h-72 -mr-20 -mt-20 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(to right, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

          <div className="relative z-10 p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                  style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                  👑 Admin Access
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
                System Command Hub
              </h1>
              <p className="text-slate-400 text-sm">Full operational oversight — {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="btn-outline-light text-xs py-2.5 px-5">
                ← Member Portal
              </Link>
            </div>
          </div>
        </div>

        {/* ── KPI Stats ── */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <StatCard
              icon="📦"
              label="Total Rescue Cases"
              value={analytics.caseStats?.totalCases ?? '—'}
              sub="All time submissions"
              color="bg-rose-50"
              glow="rgba(225,29,72,0.1)"
            />
            <StatCard
              icon="🦺"
              label="Active Responders"
              value={analytics.responderStats?.activeResponders ?? '—'}
              sub={`of ${analytics.responderStats?.totalResponders ?? '?'} registered`}
              color="bg-amber-50"
              glow="rgba(249,115,22,0.1)"
            />
            <StatCard
              icon="⚡"
              label="Avg Response Time"
              value={analytics.performanceStats?.avgResponseTimeMinutes != null ? `${analytics.performanceStats.avgResponseTimeMinutes} min` : '—'}
              sub="From report to acceptance"
              color="bg-blue-50"
              glow="rgba(59,130,246,0.1)"
            />
            <StatCard
              icon="🏥"
              label="Avg Rescue Time"
              value={analytics.performanceStats?.avgRescueCompletionTimeMinutes != null ? `${analytics.performanceStats.avgRescueCompletionTimeMinutes} min` : '—'}
              sub="From acceptance to rescued"
              color="bg-emerald-50"
              glow="rgba(16,185,129,0.1)"
            />
          </div>
        )}

        {/* ── Audit Logs ── */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(226,232,240,0.7)', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
          {/* Table header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Audit Logs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Recent system activity trail</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {auditLogs.length} entries
            </span>
          </div>

          <div className="overflow-auto max-h-[480px] custom-scroll">
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
                    <tr key={log._id} className="table-row-hover group">
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono-case whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
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
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          log.actorRole === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          log.actorRole === 'responder' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
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
      </main>
    </div>
  );
};

export default AdminDashboard;
