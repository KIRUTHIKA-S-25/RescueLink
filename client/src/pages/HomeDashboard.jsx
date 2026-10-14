import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import { useParallax } from '../utils/useParallax';
import RescueLinkLogo from '../components/RescueLinkLogo';

/* ─── Static Data ────────────────────────────────────────────────────────── */

const TRIAGE_GUIDES = [
  {
    id: 'dogs',
    name: 'Dogs & Puppies',
    icon: '🐕',
    color: 'from-amber-500 to-orange-600',
    lightColor: 'bg-amber-50 text-amber-700 border-amber-200',
    severity: 'High Alert',
    steps: [
      'Keep your distance if the dog appears aggressive or panicked; speak in calm, low tones.',
      'If bleeding, apply gentle direct pressure using a clean towel or cloth.',
      'Do NOT offer food or solid treats if shock or surgery is suspected.',
      'Keep the dog warm using a blanket and keep bystanders away to minimize stress.',
    ],
    contact: 'Animal Welfare Dog Rescue Unit: 1800-425-DOGS',
  },
  {
    id: 'cats',
    name: 'Cats & Kittens',
    icon: '🐈',
    color: 'from-purple-500 to-violet-600',
    lightColor: 'bg-purple-50 text-purple-700 border-purple-200',
    severity: 'Urgent Care',
    steps: [
      'Use a cardboard box with air holes or a carrier to safely contain the cat.',
      'Hypothermia is fatal for tiny kittens: wrap in a warm cloth immediately.',
      'NEVER give cow\'s milk to newborn kittens — it causes severe dehydration.',
      'Check for shallow breathing or bleeding and report immediately.',
    ],
    contact: 'Feline Urgent Rescue Hotline: 1800-425-CATS',
  },
  {
    id: 'cattle',
    name: 'Cattle & Livestock',
    icon: '🐮',
    color: 'from-emerald-500 to-teal-600',
    lightColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    severity: 'Critical Hazard',
    steps: [
      'Position warning cones or flashlight if the animal is stranded on a highway.',
      'Do not attempt to pull heavy animals manually; wait for the hydraulic dispatch.',
      'Offer clean drinking water if the animal is conscious and not choking.',
      'Keep vehicle traffic slowed around the scene to prevent secondary accidents.',
    ],
    contact: 'Cattle Transit & Veterinary Mobile Unit: 1800-425-COWS',
  },
  {
    id: 'birds',
    name: 'Birds & Raptors',
    icon: '🦅',
    color: 'from-sky-500 to-blue-600',
    lightColor: 'bg-sky-50 text-sky-700 border-sky-200',
    severity: 'Delicate Handling',
    steps: [
      'Carefully place a lightweight cloth over the bird to calm its vision.',
      'Transfer to a dark, ventilated cardboard box lined with paper towels.',
      'Do NOT force-feed water with a dropper; liquid in lungs causes drowning.',
      'Keep in a quiet, warm room away from domestic pets and loud noises.',
    ],
    contact: 'Avian Trauma Center: 1800-425-BIRD',
  },
  {
    id: 'wildlife',
    name: 'Monkeys & Wildlife',
    icon: '🐒',
    color: 'from-rose-500 to-red-600',
    lightColor: 'bg-rose-50 text-rose-700 border-rose-200',
    severity: 'Forest Dept Required',
    steps: [
      'Keep a strict safe perimeter of at least 15–20 meters.',
      'Do not corner the animal or attempt self-capture without authorized gear.',
      'Note the exact landmarks and direction the animal is facing.',
      'Report through RescueLink; our dispatch immediately alerts Forest Wardens.',
    ],
    contact: 'Wildlife Rapid Response Team: 1800-425-WILD',
  },
];

const RECENT_SAMPLE_CASES = [
  {
    id: 'RL-1082',
    animal: 'Injured Golden Retriever',
    icon: '🐕',
    location: 'Anna Nagar West, Near Metro Gate 2',
    urgency: 'CRITICAL',
    status: 'IN_PROGRESS',
    time: '8 mins ago',
    responder: 'Kavitha R.',
  },
  {
    id: 'RL-1081',
    animal: 'Stranded Kitten in Drain',
    icon: '🐈',
    location: 'T. Nagar, South Usman Road',
    urgency: 'HIGH',
    status: 'ACCEPTED',
    time: '22 mins ago',
    responder: 'Arun K.',
  },
  {
    id: 'RL-1080',
    animal: 'Fractured Leg Bull',
    icon: '🐮',
    location: 'Guindy Industrial Estate Bypass',
    urgency: 'URGENT',
    status: 'PENDING',
    time: '35 mins ago',
    responder: 'Matching…',
  },
  {
    id: 'RL-1079',
    animal: 'Injured Barn Owl',
    icon: '🦉',
    location: 'Besant Nagar Beach Promenade',
    urgency: 'MEDIUM',
    status: 'RESCUED',
    time: '1 hr ago',
    responder: 'Dr. Meera',
  },
];

const HOW_STEPS = [
  {
    num: '01',
    icon: '📍',
    title: 'Citizen Reports',
    desc: 'Spot an animal in distress. Snap a photo and capture GPS coordinates in under 30 seconds.',
    color: 'from-rose-500 to-rose-600',
    glow: 'rgba(225,29,72,0.25)',
  },
  {
    num: '02',
    icon: '⚡',
    title: 'Priority Scoring',
    desc: 'System evaluates severity — Critical, High, or Medium — and dispatches alerts to nearby rescuers instantly.',
    color: 'from-amber-500 to-orange-500',
    glow: 'rgba(249,115,22,0.25)',
  },
  {
    num: '03',
    icon: '🚀',
    title: 'Rapid Transit',
    desc: 'A nearby responder accepts the incident and navigates directly using real-time GPS tracking.',
    color: 'from-blue-500 to-indigo-600',
    glow: 'rgba(59,130,246,0.25)',
  },
  {
    num: '04',
    icon: '🏥',
    title: 'Treatment & Verified',
    desc: 'Veterinary treatment is logged, the case lifecycle is verified, and the citizen is notified of recovery.',
    color: 'from-emerald-500 to-teal-600',
    glow: 'rgba(16,185,129,0.25)',
  },
];

/* ─── Animated Counter ───────────────────────────────────────────────────── */
const AnimatedCounter = ({ target, suffix = '', duration = 1500 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const step = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
            else setCount(target);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  const formatted = count >= 1000 ? count.toLocaleString() : count;
  return <span ref={ref}>{formatted}{suffix}</span>;
};

/* ─── Urgency / Status helpers ───────────────────────────────────────────── */
const getUrgencyStyle = (u) => {
  if (u === 'CRITICAL') return 'bg-red-500 text-white';
  if (u === 'HIGH')     return 'bg-orange-500 text-white';
  if (u === 'URGENT')   return 'bg-amber-500 text-white';
  return 'bg-slate-200 text-slate-700';
};

const getStatusMeta = (s) => {
  const m = {
    IN_PROGRESS: { label: 'In Progress', dot: 'bg-amber-500', bar: 'from-amber-400 to-orange-500' },
    ACCEPTED:    { label: 'Accepted',    dot: 'bg-blue-500',  bar: 'from-blue-400 to-indigo-500' },
    PENDING:     { label: 'Pending',     dot: 'bg-slate-400', bar: 'from-slate-300 to-slate-400' },
    RESCUED:     { label: 'Rescued ✓',  dot: 'bg-emerald-500', bar: 'from-emerald-400 to-teal-500' },
  };
  return m[s] || m.PENDING;
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const HomeDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [activeTriage, setActiveTriage] = useState('dogs');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Parallax hook for Hero Header
  const {
    containerRef: heroRef,
    parallaxBgStyle: heroBgStyle,
    handleMouseMove: handleHeroMouseMove,
    handleMouseLeave: handleHeroMouseLeave,
  } = useParallax({ scrollSpeed: 0.22, mouseSensitivity: 14 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openAuth = (mode) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const getPortalLink = () => {
    if (!user) return '/dashboard';
    if (user.role === 'responder') return '/rescuer';
    if (user.role === 'admin') return '/admin';
    return '/dashboard';
  };

  const currentTriage = TRIAGE_GUIDES.find((g) => g.id === activeTriage) || TRIAGE_GUIDES[0];

  return (
    <div className="relative min-h-screen bg-slate-900/5 text-slate-900 flex flex-col font-sans overflow-x-hidden">

      {/* ── Fixed Ambient Animal Background Wallpaper ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/images/sunset-sanctuary-friends.jpg"
          alt=""
          className="w-full h-full object-cover opacity-40 filter saturate-125 brightness-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-transparent to-slate-900/25" />
        {/* Soft glowing ambient orbs */}
        <div className="absolute -top-24 -left-24 w-[36rem] h-[36rem] rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-28 w-[34rem] h-[34rem] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-1/3 w-[30rem] h-[30rem] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* ─── High-Contrast Crystal-Clear Navigation Header ──────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 shadow-2xl transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo & Title (Always Visible) */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative">
              <RescueLinkLogo className="w-10 h-10 shadow-md rounded-2xl" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse shadow-sm" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow-sm">RescueLink</span>
                <span className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-500/40">
                  24/7 Live
                </span>
              </div>
              <span className="text-[11px] text-slate-300 font-semibold tracking-wide">Animal Emergency Dispatch</span>
            </div>
          </Link>

          {/* Desktop Nav Items (Always High-Contrast & Clearly Readable) */}
          <nav className="hidden md:flex items-center gap-1.5">
            {[
              { href: '#emergency', label: 'Emergency SOS', icon: '🚨' },
              { href: '#first-aid', label: 'First Aid Guide', icon: '🩺' },
              { href: '#live-feed', label: 'Live Incident Feed', icon: '📡' },
              { href: '#how-it-works', label: 'How It Works', icon: '⚙️' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          {/* Auth & Portal Buttons */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to={getPortalLink()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl text-xs font-black hover:brightness-110 transition-all shadow-lg shadow-rose-600/35 hover:-translate-y-0.5"
                >
                  <span>My Portal</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/25 text-[10px] uppercase font-black tracking-wide">{user.role}</span>
                </Link>
                <button
                  onClick={logout}
                  className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 border border-white/15 rounded-xl transition-all cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth('login')}
                  className="hidden sm:block px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/10 border border-white/20 rounded-xl transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-black rounded-xl cursor-pointer transition-all hover:scale-105 shadow-lg shadow-rose-600/35"
                  style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)' }}
                >
                  <span>Create Account</span>
                  <span>→</span>
                </button>
              </div>
            )}

            {/* Mobile menu button with high-visibility white bars */}
            <button
              className="md:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`block h-0.5 w-full bg-white rounded transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block h-0.5 w-full bg-white rounded transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-full bg-white rounded transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu with High Contrast */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-2xl px-4 py-4 space-y-2 animate-fade-in-down shadow-2xl">
            {[
              { href: '#emergency', label: '🚨 Emergency SOS' },
              { href: '#first-aid', label: '🩺 First Aid Guide' },
              { href: '#live-feed', label: '📡 Live Incident Feed' },
              { href: '#how-it-works', label: '⚙️ How It Works' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 text-sm font-bold text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                {item.label}
              </a>
            ))}
            {user ? (
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to={getPortalLink()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-xs font-black text-white rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 shadow-md"
                >
                  Open {user.role.toUpperCase()} Workspace →
                </Link>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 text-xs font-bold text-slate-300 hover:text-white border border-white/20 rounded-xl"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-200 border border-white/20 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { openAuth('register'); setMobileMenuOpen(false); }}
                  className="flex-1 py-2.5 text-xs font-black text-white rounded-xl cursor-pointer transition-all bg-gradient-to-r from-rose-600 to-rose-700 shadow-md"
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ─── Hero Section with Parallax Animal Background ──────────────── */}
      <section
        id="emergency"
        ref={heroRef}
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="relative pt-28 pb-20 overflow-hidden"
      >
        {/* Parallax Animal Hero Image Layer (Sunset Dog, Cat, and Rabbit Hillside Vista) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src="/images/sunset-sanctuary-friends.jpg"
            alt="RescueLink Sunset Animal Sanctuary"
            className="w-full h-full object-cover object-center absolute inset-0 opacity-100 filter brightness-105 saturate-115 contrast-105"
            style={heroBgStyle}
          />
          {/* Gentle cinematic vignette: edges shaded for navigation & stats, center crystal clear */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-slate-950/45" />
        </div>

        {/* Animated background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-orb absolute top-10 left-[10%] w-[500px] h-[500px] rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.15) 0%, transparent 70%)' }} />
          <div className="animate-orb-delay absolute bottom-0 right-[5%] w-[400px] h-[400px] rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.1) 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero headline (Removed "Animal Distress Emergency Network — Active India" badge) */}
          <div className="text-center max-w-4xl mx-auto mb-10 animate-fade-in-up pt-4">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white drop-shadow-lg leading-[1.06] mb-6">
              Immediate Care for
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-orange-300 bg-clip-text text-transparent drop-shadow-md">
                Animals in Distress.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-100 drop-shadow-md leading-relaxed max-w-2xl mx-auto font-medium">
              Spot an injured, trapped, or sick animal? File a 30-second report with your GPS
              location. Our system scores urgency and alerts the nearest rescue team{' '}
              <span className="font-extrabold text-white">instantly.</span>
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-fade-in-up delay-200">
            <Link
              to="/report"
              className="btn-emergency w-full sm:w-auto text-base px-8 py-4 rounded-2xl shadow-2xl"
              style={{ fontSize: '15px' }}
            >
              <span className="text-xl">🚨</span>
              <span>Report Animal in Distress</span>
              <span className="text-[11px] bg-black/25 px-2.5 py-1 rounded-lg font-semibold">No Login Needed</span>
            </Link>

            {!user ? (
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="btn-secondary w-full sm:w-auto px-7 py-4 text-sm font-bold rounded-2xl bg-white/95 backdrop-blur-md shadow-xl"
              >
                <span>🔐</span>
                <span>Responder / Citizen Sign In</span>
              </button>
            ) : (
              <Link
                to={getPortalLink()}
                className="btn-secondary w-full sm:w-auto px-7 py-4 text-sm font-bold rounded-2xl bg-white/95 backdrop-blur-md shadow-xl"
              >
                <span>Open {user.role.toUpperCase()} Dashboard</span>
                <span>→</span>
              </Link>
            )}
          </div>

          {/* Hotline */}
          <div className="flex justify-center mb-14 animate-fade-in-up delay-300">
            <div className="inline-flex items-center gap-3 text-xs text-white px-5 py-2.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/20 shadow-xl">
              <span>📞</span>
              <span className="font-bold text-slate-200">24/7 Animal Ambulance:</span>
              <a href="tel:1962" className="font-black text-rose-300 hover:text-rose-200 transition-colors">
                1962 — National Animal Helpline
              </a>
              <span className="text-white/40">|</span>
              <span className="text-emerald-300 font-bold">Free Service</span>
            </div>
          </div>

          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto animate-fade-in-up delay-400">
            {[
              { icon: '🐕', stat: 1482, suffix: '', label: 'Animals Rescued & Treated', tag: '+12 Today', tagColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { icon: '⚡', stat: 84, suffix: ' min', label: 'Avg Response Dispatch', tag: 'Real-time', tagColor: 'text-blue-600 bg-blue-50 border-blue-200', decimal: true },
              { icon: '🦺', stat: 94, suffix: '', label: 'Verified Responders Active', tag: 'On-Duty', tagColor: 'text-amber-600 bg-amber-50 border-amber-200' },
              { icon: '🩺', stat: 982, suffix: '%', label: 'Medical Rehabilitation Rate', tag: 'Verified', tagColor: 'text-purple-600 bg-purple-50 border-purple-200', div10: true },
            ].map((s, i) => (
              <div key={i} className="stat-card group bg-white/90 backdrop-blur-md border border-white/60 shadow-xl hover:shadow-2xl hover:bg-white/95 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                    {s.icon}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${s.tagColor}`}>
                    {s.tag}
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-slate-950 tracking-tight leading-none mb-1.5">
                  {s.div10 ? (
                    <AnimatedCounter target={982} suffix="%" />
                  ) : s.decimal ? (
                    <><AnimatedCounter target={84} />.<span className="text-2xl">4 min</span></>
                  ) : (
                    <AnimatedCounter target={s.stat} suffix={s.suffix} />
                  )}
                </div>
                <div className="text-xs font-medium text-slate-500 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── First Aid Citizen Emergency Guide (Prominently Featured) ────── */}
      <section id="first-aid" className="py-20 relative scroll-mt-16 bg-white/75 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="section-eyebrow block mb-2">Citizen Emergency Guide</span>
            <h2 className="section-title mb-3">What to Do While Help Is En Route</h2>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Immediate actions you can safely take before trained rescue responders reach the location.
            </p>
          </div>

          {/* Category Tabs — Species Names Always Visible */}
          <div className="flex items-center justify-center flex-wrap gap-3 mb-10">
            {TRIAGE_GUIDES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTriage(cat.id)}
                className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer shadow-sm ${
                  activeTriage === cat.id
                    ? 'text-white shadow-xl -translate-y-1 scale-105'
                    : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200/90 hover:-translate-y-0.5 hover:shadow-md'
                }`}
                style={activeTriage === cat.id ? {
                  background: `linear-gradient(135deg, ${cat.color.includes('amber') ? '#f59e0b,#ea580c' : cat.color.includes('purple') ? '#a855f7,#7c3aed' : cat.color.includes('emerald') ? '#10b981,#0d9488' : cat.color.includes('sky') ? '#0ea5e9,#2563eb' : '#f43f5e,#dc2626'})`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                } : {}}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="font-extrabold tracking-tight">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Triage Content Protocol Card */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl overflow-hidden animate-fade-in-up border border-slate-200/80 shadow-2xl">
              {/* Card Header with Always-Visible Severity Badge */}
              <div className={`bg-gradient-to-r ${currentTriage.color} p-6 text-white`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl shadow-sm">
                      {currentTriage.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold">{currentTriage.name} Protocol</h3>
                      <p className="text-sm text-white/90 mt-0.5 font-medium">Standard community triage procedure</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/30 backdrop-blur-sm text-xs sm:text-sm font-black border border-white/20 shrink-0 shadow-sm">
                    <span>⚡</span>
                    <span>{currentTriage.severity}</span>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {currentTriage.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0"
                        style={{ background: `linear-gradient(135deg, ${currentTriage.color.includes('amber') ? '#f59e0b,#ea580c' : currentTriage.color.includes('purple') ? '#a855f7,#7c3aed' : currentTriage.color.includes('emerald') ? '#10b981,#0d9488' : currentTriage.color.includes('sky') ? '#0ea5e9,#2563eb' : '#f43f5e,#dc2626'})` }}>
                        {idx + 1}
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold">{step}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl gap-3"
                  style={{ background: 'rgba(254,242,242,0.85)', border: '1px solid rgba(254,202,202,0.9)' }}>
                  <div className="flex items-center gap-2.5 text-xs font-bold text-rose-800">
                    <span>📞</span>
                    <span>{currentTriage.contact}</span>
                  </div>
                  <Link to="/report" className="btn-emergency text-xs py-2.5 px-5 whitespace-nowrap shrink-0 shadow-md">
                    Report {currentTriage.name} Now →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Live Incident Feed ─────────────────────────────────────────── */}
      <section id="live-feed" className="py-20 relative border-b border-slate-200/50 overflow-hidden scroll-mt-16 bg-white/70 backdrop-blur-md">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src="/images/rescuer-banner.jpg"
            alt=""
            className="w-full h-full object-cover opacity-[0.09] filter saturate-120"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/20 to-white/40" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                </span>
                <span className="section-eyebrow">Live Incident Ticker</span>
              </div>
              <h2 className="section-title mb-2">Active Rescue Operations</h2>
              <p className="text-sm text-slate-600 max-w-md font-medium">
                Real-time snapshot of incidents moving through the RescueLink coordination lifecycle.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to="/report" className="btn-primary text-xs py-2 px-4 shadow-sm">
                + File New Report
              </Link>
              {!user && (
                <button type="button" onClick={() => openAuth('login')} className="btn-secondary text-xs py-2 px-4 shadow-sm">
                  Rescuer Log In
                </button>
              )}
            </div>
          </div>

          {/* Incident Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {RECENT_SAMPLE_CASES.map((item, i) => {
              const sm = getStatusMeta(item.status);
              return (
                <div key={item.id} className="incident-card bg-white/95 backdrop-blur-sm shadow-md hover:shadow-xl" style={{ animationDelay: `${i * 0.08}s` }}>
                  {/* Priority bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${sm.bar}`} />

                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono-case font-bold text-slate-400 block">{item.id}</span>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">{item.animal}</h3>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 shrink-0">📍</span>
                      <span className="truncate font-medium">{item.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 shrink-0">🕒</span>
                      <span className="font-medium">{item.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 shrink-0">🦺</span>
                      <span className="font-semibold text-slate-700">{item.responder}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${getUrgencyStyle(item.urgency)}`}>
                      {item.urgency}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} animate-pulse`} />
                      <span className="text-[11px] font-bold text-slate-700">{sm.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 relative border-b border-slate-200/50 overflow-hidden scroll-mt-16 bg-white/70 backdrop-blur-md">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src="/images/hero-rescue-dog.jpg"
            alt=""
            className="w-full h-full object-cover opacity-[0.08] filter saturate-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/20 to-white/40" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="section-eyebrow block mb-2">Transparent Operations</span>
            <h2 className="section-title mb-3">How the Dispatch System Operates</h2>
            <p className="text-sm text-slate-500">
              From the moment a citizen spots an emergency to verified hospital rehabilitation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px"
              style={{ background: 'linear-gradient(to right, transparent, rgba(225,29,72,0.2), rgba(59,130,246,0.2), rgba(16,185,129,0.2), transparent)' }} />

            {HOW_STEPS.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                    style={{
                      background: `linear-gradient(135deg, ${step.color.replace('from-', '').replace(' to-', ',').split(',').map(c => c.trim()).join(',')})`,
                      boxShadow: `0 8px 32px ${step.glow}`,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center z-20 shadow-md">
                    {i + 1}
                  </div>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─────────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src="/images/rescuer-banner.jpg"
            alt="Rescue field mission"
            className="w-full h-full object-cover opacity-35 filter brightness-75 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-slate-950/90" />
        </div>
        <div className="absolute inset-0 mesh-bg-dark opacity-60" />
        {/* Decorative orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.3) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.3) 0%, transparent 70%)' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-slate-300 text-xs font-bold mb-6 border"
            style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}>
            🤝 Community Driven Response Network
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-5 leading-tight">
            Are you a trained rescuer
            <br />
            <span className="gradient-text">or animal hospital?</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-10 leading-relaxed">
            Join the verified RescueLink network to receive automated rescue dispatches in your
            neighborhood and save more lives every day.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="btn-emergency w-full sm:w-auto px-8 py-4 text-sm rounded-2xl"
            >
              <span>🦺</span>
              <span>Join as Volunteer / Rescuer</span>
            </button>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="btn-outline-light w-full sm:w-auto px-8 py-4 text-sm rounded-2xl"
            >
              <span>🔐</span>
              <span>Access Responder Terminal</span>
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
            {[
              { icon: '🔒', label: 'Verified Network' },
              { icon: '📍', label: 'GPS-Enabled Dispatch' },
              { icon: '⚡', label: '< 10 Min Response' },
              { icon: '🌐', label: 'Pan-India Coverage' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <span>{b.icon}</span>
                <span className="font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── High-Visibility Footer ─────────────────────────────────────── */}
      <footer className="bg-slate-900 border-t-2 border-slate-700/80 text-slate-200 py-12 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pb-10 border-b border-slate-800">
            {/* Brand info */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <RescueLinkLogo className="w-9 h-9" />
                <div>
                  <span className="text-lg font-black text-white tracking-tight">RescueLink</span>
                  <span className="text-xs text-rose-400 font-bold block">Animal Distress Emergency Network</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                Empowering citizens, certified rescuers, and veterinary hospitals with automated urgency triage, GPS telemetry dispatch, and rapid emergency intervention across India.
              </p>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>24/7 National Animal Helpline: 1962 (Toll-Free)</span>
              </div>
            </div>

            {/* Emergency & Citizen Links */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-xs font-semibold">
                <li><a href="#emergency" className="text-slate-300 hover:text-white transition-colors">🚨 Emergency SOS Dispatch</a></li>
                <li><a href="#live-feed" className="text-slate-300 hover:text-white transition-colors">📡 Live Incident Feed</a></li>
                <li><a href="#first-aid" className="text-slate-300 hover:text-white transition-colors">🩺 First Aid Emergency Guides</a></li>
                <li><a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">⚙️ Operational Flow</a></li>
                <li><Link to="/report" className="text-rose-400 hover:text-rose-300 font-bold">⚡ File 30-Sec SOS Report →</Link></li>
              </ul>
            </div>

            {/* Responder & Portal Links */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white mb-3">Responder Portals</h4>
              <ul className="space-y-2 text-xs font-semibold">
                <li><button onClick={() => openAuth('login')} className="text-slate-300 hover:text-white transition-colors cursor-pointer text-left">🔐 Rescuer Sign In</button></li>
                <li><button onClick={() => openAuth('register')} className="text-slate-300 hover:text-white transition-colors cursor-pointer text-left">🤝 Volunteer Registration</button></li>
                <li><Link to="/my-rescues" className="text-slate-300 hover:text-white transition-colors">📋 Citizen Incident Tracker</Link></li>
                <li><Link to="/rescuer" className="text-slate-300 hover:text-white transition-colors">🦺 Field Responder Terminal</Link></li>
                <li><Link to="/admin" className="text-slate-300 hover:text-white transition-colors">👑 Admin Analytics Hub</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300 font-medium">
            <div>
              © 2026 <b>RescueLink</b>. All rights reserved. Built with ❤️ for animals in distress.
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
              <span className="text-emerald-400 font-bold">● Network Active</span>
              <span>GPS Dispatches Verified</span>
              <span>Pan-India Coverage</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Auth Modal ──────────────────────────────────────────────────── */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
};

export default HomeDashboard;
