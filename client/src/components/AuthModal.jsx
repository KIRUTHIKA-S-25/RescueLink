import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Citizen', role: 'citizen', email: 'citizen@rescuelink.dev', pass: 'Citizen@123', icon: '👤', desc: 'Report & Track', color: 'from-emerald-500 to-teal-600' },
  { label: 'Responder', role: 'responder', email: 'responder@rescuelink.dev', pass: 'Responder@123', icon: '🦺', desc: 'Dispatch & Rescue', color: 'from-amber-500 to-orange-600' },
  { label: 'Admin', role: 'admin', email: 'admin@rescuelink.dev', pass: 'Admin@123', icon: '⚡', desc: 'System Monitor', color: 'from-purple-500 to-indigo-600' },
];

const AuthModal = ({ isOpen, onClose, initialMode = 'login', onAuthSuccess }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [regErrors, setRegErrors] = useState({});

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSuccessMessage('');
  }, [initialMode, isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginChange = (e) => {
    setLoginForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleQuickFill = async (acc) => {
    setLoginForm({ email: acc.email, password: acc.pass });
    setError('');
    setLoading(true);
    try {
      const user = await login(acc.email, acc.pass);
      onClose();
      if (onAuthSuccess) {
        onAuthSuccess(user);
      } else {
        if (user.role === 'responder') navigate('/rescuer');
        else if (user.role === 'admin') navigate('/admin');
        else navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Quick login failed. Check DB connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginForm.email.trim() || !loginForm.password) {
      setError('Please provide both email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(loginForm.email.trim(), loginForm.password);
      onClose();
      if (onAuthSuccess) {
        onAuthSuccess(user);
      } else {
        if (user.role === 'responder') navigate('/rescuer');
        else if (user.role === 'admin') navigate('/admin');
        else navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const validateRegField = (name, value, allValues = registerForm) => {
    let err = '';
    const trimmed = typeof value === 'string' ? value.trim() : '';

    switch (name) {
      case 'name':
        if (!trimmed) {
          err = 'Full name is required.';
        } else if (/\d/.test(trimmed)) {
          err = 'Name must contain letters only (numbers are not allowed).';
        } else if (!/^[a-zA-Z\s.'-]+$/.test(trimmed) || trimmed.length < 2) {
          err = 'Name must contain letters only (minimum 2 characters).';
        }
        break;

      case 'email':
        if (!trimmed) {
          err = 'Email address is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          err = 'Please enter a valid email address.';
        }
        break;

      case 'phone':
        if (trimmed) {
          if (/[a-zA-Z]/.test(trimmed)) {
            err = 'Phone number must contain numbers only.';
          } else {
            const digits = trimmed.replace(/\D/g, '');
            let core = digits;
            if (digits.length === 12 && digits.startsWith('91')) core = digits.slice(2);
            else if (digits.length === 11 && digits.startsWith('0')) core = digits.slice(1);
            if (core.length !== 10) {
              err = `Phone number must be exactly 10 digits (entered ${core.length}).`;
            }
          }
        }
        break;

      case 'password':
        if (!value) {
          err = 'Password is required.';
        } else if (value.length < 8) {
          err = 'Password must be at least 8 characters long.';
        }
        break;

      case 'confirmPassword':
        if (!value) {
          err = 'Please repeat password.';
        } else if (value !== allValues.password) {
          err = 'Passwords do not match.';
        }
        break;

      default:
        break;
    }
    return err;
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...registerForm, [name]: value };
    setRegisterForm(updated);
    if (error) setError('');

    const err = validateRegField(name, value, updated);
    setRegErrors((prev) => ({ ...prev, [name]: err }));

    if (name === 'password' && registerForm.confirmPassword) {
      const confirmErr = validateRegField('confirmPassword', registerForm.confirmPassword, updated);
      setRegErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = {
      name: validateRegField('name', registerForm.name, registerForm),
      email: validateRegField('email', registerForm.email, registerForm),
      phone: validateRegField('phone', registerForm.phone, registerForm),
      password: validateRegField('password', registerForm.password, registerForm),
      confirmPassword: validateRegField('confirmPassword', registerForm.confirmPassword, registerForm),
    };

    setRegErrors(errors);
    const firstErr = Object.values(errors).find(Boolean);
    if (firstErr) {
      setError(firstErr);
      return;
    }

    setLoading(true);
    try {
      await register({
        name: registerForm.name.trim(),
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim() ? registerForm.phone.replace(/\D/g, '').slice(-10) : undefined,
        password: registerForm.password,
      });
      setSuccessMessage('Account created! Logging you in…');
      const user = await login(registerForm.email.trim(), registerForm.password);
      setTimeout(() => {
        onClose();
        if (onAuthSuccess) onAuthSuccess(user);
        else navigate('/dashboard');
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[460px] rounded-3xl overflow-hidden animate-slide-in-up"
        style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header with Animal Backdrop ── */}
        <div className="relative overflow-hidden px-7 pt-7 pb-7"
          style={{
            background: '#0f172a',
          }}>
          {/* Animal Image Background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src="/images/form-bg-animals.jpg"
              alt="Rescue Animals"
              className="w-full h-full object-cover opacity-40 filter brightness-90 saturate-110"
            />
            <div className="absolute inset-0 header-scrim-dark" />
          </div>

          {/* Decorative orbs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.3) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)' }} />

          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(to right, white 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }} />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
            aria-label="Close"
          >
            ✕
          </button>

          {/* Brand */}
          <div className="relative flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', boxShadow: '0 6px 20px rgba(225,29,72,0.4)' }}>
              🐾
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">RescueLink Portal</h2>
              <p className="text-xs text-slate-400">Intelligent Emergency Coordination Network</p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="relative grid grid-cols-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className="relative py-2.5 text-xs font-bold rounded-lg transition-all duration-300 cursor-pointer"
                style={mode === m ? {
                  background: 'white',
                  color: '#0f172a',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                } : {
                  color: 'rgba(148,163,184,0.9)',
                }}
              >
                {m === 'login' ? '🔑 Sign In' : '✨ Create Account'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="px-7 pb-7 pt-6 max-h-[65vh] overflow-y-auto custom-scroll">

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl flex items-start gap-3 text-xs font-medium animate-fade-in-up"
              style={{ background: 'rgba(254,242,242,0.8)', border: '1px solid rgba(252,165,165,0.5)', color: '#b91c1c' }}>
              <span className="text-base shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl flex items-start gap-3 text-xs font-medium animate-fade-in-up"
              style={{ background: 'rgba(240,253,244,0.8)', border: '1px solid rgba(134,239,172,0.5)', color: '#166534' }}>
              <span className="text-base shrink-0">✅</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Quick Demo Login */}
          {mode === 'login' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Quick Test Access
                </span>
                <span className="text-[10px] text-slate-400">Click to login instantly</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleQuickFill(acc)}
                    disabled={loading}
                    className="group relative overflow-hidden flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer active:scale-95 hover:-translate-y-0.5"
                    style={{ background: 'rgba(248,250,252,0.8)', borderColor: 'rgba(226,232,240,0.8)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(203,213,225,0.9)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(226,232,240,0.8)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${acc.color} flex items-center justify-center text-base mb-1.5 group-hover:scale-110 transition-transform shadow-sm`}>
                      {acc.icon}
                    </div>
                    <span className="text-xs font-bold text-slate-800">{acc.label}</span>
                    <span className="text-[9px] text-slate-500 leading-tight text-center">{acc.desc}</span>
                  </button>
                ))}
              </div>

              <div className="relative flex items-center my-5">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="px-3 text-[11px] text-slate-400 font-medium">or sign in manually</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="form-label" htmlFor="modal-email">Email Address</label>
                <input
                  id="modal-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="e.g. citizen@rescuelink.dev"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  className="form-input"
                  disabled={loading}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0" htmlFor="modal-password">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-slate-400 hover:text-slate-700 font-medium transition-colors"
                  >
                    {showPassword ? '🙈 Hide' : '👁️ Show'}
                  </button>
                </div>
                <input
                  id="modal-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  className="form-input"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3.5 text-sm font-bold rounded-xl mt-2 justify-center"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Sign In to Dashboard</span>
                    <span>→</span>
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="form-label" htmlFor="reg-name">Full Name <span className="text-rose-500">*</span></label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={registerForm.name}
                  onChange={handleRegisterChange}
                  className={`form-input ${regErrors.name ? 'border-rose-400 bg-rose-50/10' : ''}`}
                  disabled={loading}
                />
                {regErrors.name ? (
                  <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                    <span>⚠️</span> {regErrors.name}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-0.5">Letters and spaces only (minimum 2 characters).</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="reg-email">Email <span className="text-rose-500">*</span></label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@email.com"
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                    className={`form-input ${regErrors.email ? 'border-rose-400 bg-rose-50/10' : ''}`}
                    disabled={loading}
                  />
                  {regErrors.email && (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <span>⚠️</span> {regErrors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label" htmlFor="reg-phone">Phone</label>
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    placeholder="10 digits, e.g. 9876543210"
                    value={registerForm.phone}
                    onChange={handleRegisterChange}
                    className={`form-input ${regErrors.phone ? 'border-rose-400 bg-rose-50/10' : ''}`}
                    disabled={loading}
                  />
                  {regErrors.phone ? (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <span>⚠️</span> {regErrors.phone}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">Digits only (10 digits).</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label mb-0" htmlFor="reg-password">Password <span className="text-rose-500">*</span></label>
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 8 chars"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                    className={`form-input ${regErrors.password ? 'border-rose-400 bg-rose-50/10' : ''}`}
                    disabled={loading}
                  />
                  {regErrors.password && (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <span>⚠️</span> {regErrors.password}
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label" htmlFor="reg-confirm">Confirm <span className="text-rose-500">*</span></label>
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={registerForm.confirmPassword}
                    onChange={handleRegisterChange}
                    className={`form-input ${regErrors.confirmPassword ? 'border-rose-400 bg-rose-50/10' : ''}`}
                    disabled={loading}
                  />
                  {regErrors.confirmPassword && (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <span>⚠️</span> {regErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3.5 text-sm font-bold rounded-xl mt-3 justify-center"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>✨ Create Citizen Account</span>
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Switch Mode */}
          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              {mode === 'login' ? "Don't have an account?" : 'Already registered?'}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="ml-1.5 font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer underline underline-offset-2"
              >
                {mode === 'login' ? 'Sign up here' : 'Sign in here'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
