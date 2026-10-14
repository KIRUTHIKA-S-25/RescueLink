import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import { useParallax } from '../utils/useParallax';
import RescueLinkLogo from '../components/RescueLinkLogo';

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
    className="group relative overflow-hidden bg-white/80 backdrop-blur-md rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1"
    style={{
      border: '1px solid rgba(226,232,240,0.8)',
      boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 16px 40px rgba(15,23,42,0.1)';
      e.currentTarget.style.borderColor = 'rgba(203,213,225,1)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.04)';
      e.currentTarget.style.borderColor = 'rgba(226,232,240,0.8)';
    }}
  >
    {/* Hover shimmer */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 60%)' }} />

    <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-xs`}>
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

  const {
    containerRef: bannerRef,
    parallaxBgStyle: bannerBgStyle,
    handleMouseMove: handleBannerMouseMove,
    handleMouseLeave: handleBannerMouseLeave,
  } = useParallax({ scrollSpeed: 0.22, mouseSensitivity: 14 });

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
    <div className="relative min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-x-hidden">
      {/* ── Fixed Ambient Background Image & Scrim ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/images/form-bg-animals.jpg"
          alt="RescueLink Animal Sanctuary"
          className="w-full h-full object-cover opacity-[0.24] filter contrast-125 saturate-150"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/88 via-slate-50/70 to-slate-100/90" />
        
        {/* Soft glowing ambient orbs */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-rose-500/12 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-24 w-[32rem] h-[32rem] rounded-full bg-emerald-500/12 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-30 nav-glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <RescueLinkLogo className="w-8 h-8" />
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

        {/* ── Welcome Banner with Parallax Animal Background ── */}
        <div
          ref={bannerRef}
          onMouseMove={handleBannerMouseMove}
          onMouseLeave={handleBannerMouseLeave}
          className="relative rounded-3xl overflow-hidden mb-8 text-white shadow-2xl"
          style={{
            background: '#0f172a',
            boxShadow: '0 16px 48px rgba(15,23,42,0.25)',
          }}
        >
          {/* Parallax Animal Image Layer */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src="/images/hero-rescue-dog.jpg"
              alt="Animal Sanctuary"
              className="parallax-bg-layer object-cover opacity-50 filter brightness-95 saturate-110"
              style={bannerBgStyle}
            />
            {/* Scrim Overlay */}
            <div className="absolute inset-0 header-scrim-dark" />
          </div>

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

        {/* ── Inspired by Rescuify Citizen Dashboard (Image 1) ── */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 mb-8 border border-emerald-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-3">
                🐾 Empower Change
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Rescue, Rehabilitate, <span className="text-emerald-700">Rehome Together</span>
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Join our citizen rescue mission to protect endangered animals. Every incident reported, foster inquiry, and first-aid intervention saves precious lives in your neighborhood.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-5">
                <Link
                  to="/report"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  Report Distress Incident
                </Link>
                <Link
                  to="/my-rescues"
                  className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                >
                  Track My Reports
                </Link>
                <Link
                  to="/#first-aid"
                  className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all"
                >
                  🩺 First Aid Guide
                </Link>
              </div>
            </div>

            {/* Featured Rescued Animal Spotlight matching Image 1 */}
            <div className="shrink-0 w-full md:w-64 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center">
              <div className="relative h-36 rounded-xl overflow-hidden mb-3">
                <img
                  src="/images/hero-rescue-dog.jpg"
                  alt="Rescued companion"
                  className="w-full h-full object-cover filter brightness-95"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-600 text-white shadow-xs">
                  Rehabilitated
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-xs">Buddy · Golden Mix</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Rescued in Chennai · Ready for foster</p>
            </div>
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

        {/* ── Visual Rescue Field Missions & Impact Showcase ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Active Field Missions & Sanctuary Updates</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Real photographic documentation from our volunteer dispatch network</p>
            </div>
            <Link to="/report" className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 group">
              <span>Report An Animal</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Showcase 1 */}
            <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/images/hero-rescue-dog.jpg"
                  alt="Rescued Golden Retriever"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm">
                  ✓ Rescued & Treated
                </span>
                <span className="absolute bottom-2.5 left-3 text-[11px] font-semibold text-slate-300">
                  Case RC-1082 · Chennai
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-extrabold text-slate-900 text-sm mb-1 group-hover:text-rose-600 transition-colors">
                  Trauma Stabilization & Care
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Severe fracture case rapidly located using spatial coordinates, transported by certified responders, and fully rehabilitated.
                </p>
              </div>
            </div>

            {/* Showcase 2 */}
            <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/images/rescuer-banner.jpg"
                  alt="Rescue Patrol In Action"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white shadow-sm">
                  ⚡ 24/7 Mobile Squad
                </span>
                <span className="absolute bottom-2.5 left-3 text-[11px] font-semibold text-slate-300">
                  Patrol Sector · 15km Radius
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-extrabold text-slate-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">
                  Rapid Transit & Equipment
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Volunteers equipped with specialized animal trauma stretchers, emergency oxygen, and safe humane containment gear.
                </p>
              </div>
            </div>

            {/* Showcase 3 */}
            <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="/images/form-bg-animals.jpg"
                  alt="Community Animal Welfare"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white shadow-sm">
                  🏡 Sanctuary Network
                </span>
                <span className="absolute bottom-2.5 left-3 text-[11px] font-semibold text-slate-300">
                  Partner Shelters & Vets
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-extrabold text-slate-900 text-sm mb-1 group-hover:text-purple-600 transition-colors">
                  Verified Handovers & Fosters
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every animal handover is documented with required photographic evidence and verified medical handover receipts.
                </p>
              </div>
            </div>
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
