import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useParallax } from '../utils/useParallax';

const Register = () => {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const {
    containerRef,
    mouseBgStyle,
    cardTiltStyle,
    handleMouseMove,
    handleMouseLeave,
  } = useParallax({ mouseSensitivity: 18, enableScroll: false });

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateField = (fieldName, value, allValues = form) => {
    let err = '';
    const trimmed = typeof value === 'string' ? value.trim() : '';

    switch (fieldName) {
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
          err = 'Please enter a valid email address (e.g. name@domain.com).';
        }
        break;

      case 'phone':
        if (trimmed) {
          if (/[a-zA-Z]/.test(trimmed)) {
            err = 'Phone number must contain numbers only (letters are not allowed).';
          } else {
            const digits = trimmed.replace(/\D/g, '');
            let core = digits;
            if (digits.length === 12 && digits.startsWith('91')) core = digits.slice(2);
            else if (digits.length === 11 && digits.startsWith('0')) core = digits.slice(1);
            if (core.length !== 10) {
              err = `Phone number must be exactly 10 digits (currently ${core.length} digits).`;
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
          err = 'Please confirm your password.';
        } else if (value !== allValues.password) {
          err = 'Passwords do not match.';
        }
        break;

      default:
        break;
    }
    return err;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);

    if (error) setError('');

    // Instant validation on input
    const err = validateField(name, value, updatedForm);
    setFieldErrors((prev) => ({ ...prev, [name]: err }));

    // Re-check confirmPassword if password is modified
    if (name === 'password' && form.confirmPassword) {
      const confirmErr = validateField('confirmPassword', form.confirmPassword, updatedForm);
      setFieldErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const err = validateField(name, value, form);
    setFieldErrors((prev) => ({ ...prev, [name]: err }));
  };

  const validateAll = () => {
    const errors = {
      name: validateField('name', form.name, form),
      email: validateField('email', form.email, form),
      phone: validateField('phone', form.phone, form),
      password: validateField('password', form.password, form),
      confirmPassword: validateField('confirmPassword', form.confirmPassword, form),
    };

    setFieldErrors(errors);
    return Object.values(errors).find((err) => Boolean(err)) || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const firstError = validateAll();
    if (firstError) {
      setError(firstError);
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() ? form.phone.replace(/\D/g, '').slice(-10) : undefined,
        password: form.password,
      });

      // Log in immediately after register
      await login(form.email.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Try a different email address.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans"
    >
      {/* Parallax Animal Background Layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src="/images/form-bg-animals.jpg"
          alt="Rescue Animals Background"
          className="parallax-bg-layer object-cover opacity-45 filter brightness-90 saturate-110"
          style={mouseBgStyle}
        />
        {/* Cinematic Scrim Vignette for High Readability */}
        <div className="absolute inset-0 form-scrim-cinematic" />
      </div>

      <div className="absolute top-0 right-1/4 w-[500px] h-[350px] bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[450px] h-[350px] bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Back Link */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl bg-slate-900/60 border border-white/15 backdrop-blur-md transition-all shadow-lg hover:bg-slate-900/80"
        >
          <span>←</span>
          <span>Back to Operations Hub</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center mb-7">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 shadow-xl shadow-rose-600/30 mb-3 hover:scale-105 transition-transform">
            <span className="text-2xl">🐾</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
            Create Citizen Account
          </h1>
          <p className="mt-1 text-xs text-slate-300 drop-shadow">
            Join the community animal rescue network to report & track incidents
          </p>
        </div>

        <div
          className="glass-form-card-light rounded-3xl p-7 sm:p-8 shadow-2xl relative"
          style={cardTiltStyle}
        >
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-medium">
              <span className="text-rose-500">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="name">Full Name <span className="text-rose-500">*</span></label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Arun Kumar"
                className={`form-input ${fieldErrors.name ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/10' : ''}`}
                disabled={loading}
              />
              {fieldErrors.name ? (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                  <span>⚠️</span> {fieldErrors.name}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Letters and spaces only (minimum 2 characters).</p>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="email">Email Address <span className="text-rose-500">*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="arun@example.com"
                className={`form-input ${fieldErrors.email ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/10' : ''}`}
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                  <span>⚠️</span> {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="phone">Phone Number (Optional)</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="10-digit mobile number, e.g. 9876543210"
                className={`form-input ${fieldErrors.phone ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/10' : ''}`}
                disabled={loading}
              />
              {fieldErrors.phone ? (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                  <span>⚠️</span> {fieldErrors.phone}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Digits only. Exactly 10 digits required.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="password">Password (≥8 char) <span className="text-rose-500">*</span></label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  className={`form-input ${fieldErrors.password ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/10' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.password && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                    <span>⚠️</span> {fieldErrors.password}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label" htmlFor="confirmPassword">Confirm Password <span className="text-rose-500">*</span></label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  className={`form-input ${fieldErrors.confirmPassword ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/10' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                    <span>⚠️</span> {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Show passwords</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-sm font-semibold rounded-xl mt-3 shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating Account…
                </span>
              ) : (
                'Complete Registration'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-rose-600 hover:text-rose-700 underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
