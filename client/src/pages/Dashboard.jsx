import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const ROLE_CONFIG = {
  citizen: {
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'rgba(16,185,129,0.3)',
    icon: '👤',
    title: 'Citizen Reporter Portal',
    desc: 'Submit animal rescue requests and track their progress in real-time.',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  responder: {
    gradient: 'from-amber-500 to-orange-600',
    glow: 'rgba(249,115,22,0.3)',
    icon: '🦺',
    title: 'Rescue Responder Terminal',
    desc: 'Access live dispatch, case assignment, and animal rescue tracking.',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  admin: {
    gradient: 'from-purple-500 to-indigo-600',
    glow: 'rgba(139,92,246,0.3)',
    icon: '👑',
    title: 'System Administrator',
    desc: 'Full system oversight, responder approvals, analytics, and operational audits.',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
  },
};

const QuickAction = ({ to, icon, iconBg, title, desc, accentHover }) => (
  <Link
    to={to}
    className="group relative overflow-hidden bg-white rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1"
    style={{
      border: '1px solid rgba(226,232,240,0.7)',
      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 12px 40px rgba(15,23,42,0.1)';
      e.currentTarget.style.borderColor = 'rgba(203,213,225,0.9)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)';
      e.currentTarget.style.borderColor = 'rgba(226,232,240,0.7)';
    }}
  >
    {/* Hover shimmer */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)' }} />

    <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
    <div>
      <h3 className={`font-bold text-slate-900 text-sm mb-1 ${accentHover} transition-colors duration-200`}>
        {title}
      </h3>
      <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
    </div>
  </Link>
);

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const roleInfo = ROLE_CONFIG[user?.role] || ROLE_CONFIG.citizen;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-30 nav-glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm shadow-rose-500/25 group-hover:scale-110 transition-transform">
                🐾
              </div>
              <span className="font-extrabold text-slate-900 text-sm tracking-tight hidden sm:block">RescueLink</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-slate-500">Member Workspace</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border capitalize ${roleInfo.badge}`}>
                {user?.role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-all"
            >
              <span>🌐</span>
              <span>Public Hub</span>
            </Link>
            <NotificationBell />
            <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="btn-secondary text-xs py-1.5 px-3.5 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">

        {/* ── Welcome Banner ── */}
        <div className="relative rounded-3xl overflow-hidden mb-8 text-white"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            boxShadow: '0 16px 48px rgba(15,23,42,0.25)',
          }}>
          {/* Orbs */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${roleInfo.glow} 0%, transparent 70%)` }} />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(to right, white 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 p-7 sm:p-9">
            <div>
              {/* Role tag */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full mb-4 text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-base">{roleInfo.icon}</span>
                <span className="text-slate-300">{roleInfo.title}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                {getGreeting()}, <span className="gradient-text">{user?.name?.split(' ')[0] || 'Partner'}</span> 👋
              </h1>
              <p className="text-slate-400 text-sm max-w-md leading-relaxed">{roleInfo.desc}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link to="/report" className="btn-emergency text-sm px-6 py-3 whitespace-nowrap">
                <span>🚨</span>
                <span>Report Emergency</span>
              </Link>
              {(user?.role === 'responder' || user?.role === 'admin') && (
                <Link to="/rescuer"
                  className="btn-outline-light text-sm px-5 py-3 whitespace-nowrap">
                  <span>🦺</span>
                  <span>Rescue Terminal</span>
                </Link>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="relative z-10 grid grid-cols-3 border-t border-white/10 divide-x divide-white/10">
            {[
              { label: 'Active Cases', val: '12', sub: 'this area' },
              { label: 'Responders', val: '94', sub: 'on duty now' },
              { label: 'Avg Response', val: '8.4m', sub: 'dispatch time' },
            ].map((s, i) => (
              <div key={i} className="px-5 py-4 text-center">
                <div className="text-xl font-extrabold text-white">{s.val}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{s.label}</div>
                <div className="text-[9px] text-slate-600 uppercase tracking-wider">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5">
            Operational Quick Actions
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickAction
              to="/report"
              id="report-emergency-link"
              icon="🚨"
              iconBg="bg-rose-50"
              title="Report Emergency"
              desc="Submit a new animal incident with GPS location and photo upload."
              accentHover="group-hover:text-rose-600"
            />
            <QuickAction
              to="/my-rescues"
              id="my-rescues-link"
              icon="📋"
              iconBg="bg-blue-50"
              title="My Reported Rescues"
              desc="Track real-time rescue status, assigned responder, and recovery timeline."
              accentHover="group-hover:text-blue-600"
            />
            {(user?.role === 'responder' || user?.role === 'admin') && (
              <QuickAction
                to="/rescuer"
                id="rescuer-dashboard-link"
                icon="🦺"
                iconBg="bg-amber-50"
                title="Rescue Team Terminal"
                desc="View active emergency queue, accept dispatches, and log medical updates."
                accentHover="group-hover:text-amber-600"
              />
            )}
            {user?.role === 'admin' && (
              <QuickAction
                to="/admin"
                id="admin-dashboard-link"
                icon="👑"
                iconBg="bg-purple-50"
                title="Admin Command Hub"
                desc="System metrics, responder approvals, analytics, and audit logs."
                accentHover="group-hover:text-purple-600"
              />
            )}
            <QuickAction
              to="/"
              icon="🌐"
              iconBg="bg-emerald-50"
              title="Live Operations Hub"
              desc="Network statistics, community first-aid guides, and hotline channels."
              accentHover="group-hover:text-emerald-600"
            />
            <QuickAction
              to="/notifications"
              icon="🔔"
              iconBg="bg-indigo-50"
              title="Notifications"
              desc="View all updates, dispatch alerts, and system messages."
              accentHover="group-hover:text-indigo-600"
            />
          </div>
        </div>

        {/* ── System Status ── */}
        <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(240,253,244,0.8) 0%, rgba(236,253,245,0.6) 100%)',
            border: '1px solid rgba(167,243,208,0.6)',
          }}>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-6 h-6">
              <span className="absolute w-6 h-6 rounded-full bg-emerald-500/20 animate-ping" />
              <span className="relative w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            </div>
            <div>
              <span className="text-sm font-bold text-emerald-800">All Systems Operational</span>
              <div className="flex items-center gap-2 text-[11px] text-emerald-600 mt-0.5">
                <span>Database Connected</span>
                <span className="text-emerald-300">·</span>
                <span>API Responsive</span>
                <span className="text-emerald-300">·</span>
                <span>Notifications Active</span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-emerald-600 font-mono-case shrink-0">
            {user?.email}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
