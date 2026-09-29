/**
 * Register.jsx
 *
 * Registration page for RescueLink.
 *
 * Fields: Name, Email, Phone, Password, Confirm Password
 * NOTE: No role dropdown — all public registrations create citizens.
 * On success: navigate to /login
 * On error:   display clear error message
 *
 * Validation:
 *   - All required fields filled
 *   - Valid email format
 *   - Password ≥ 8 characters
 *   - Password matches Confirm Password
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  // ─── Client-side validation ──────────────────────────────────────────────────

  const validate = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return 'Name, email, and password are required.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'Please enter a valid email address.';
    }
    if (form.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await register({
        name:     form.name.trim(),
        email:    form.email.trim(),
        phone:    form.phone.trim() || undefined,
        password: form.password,
      });
      setSuccess('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl">🐾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join RescueLink and help save animals</p>
        </div>

        {/* Card */}
        <div className="card">
          <form id="register-form" onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Error banner */}
            {error && (
              <div id="register-error" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* Success banner */}
            {success && (
              <div id="register-success" className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                {success}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="register-name" className="form-label">Full name <span className="text-red-500">*</span></label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Smith"
                className="form-input"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="register-email" className="form-label">Email address <span className="text-red-500">*</span></label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="form-input"
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="register-phone" className="form-label">Phone number <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                id="register-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="9876543210"
                className="form-input"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="register-password" className="form-label">Password <span className="text-red-500">*</span></label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                className="form-input"
                disabled={loading}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="register-confirm-password" className="form-label">Confirm password <span className="text-red-500">*</span></label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                className="form-input"
                disabled={loading}
              />
            </div>

            {/* No role field — always citizen */}
            <p className="text-xs text-gray-400 text-center">
              All accounts created here are registered as <span className="font-medium text-gray-500">Citizen</span>.
            </p>

            {/* Submit */}
            <button
              id="register-submit"
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Link to login */}
          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link id="go-to-login" to="/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
