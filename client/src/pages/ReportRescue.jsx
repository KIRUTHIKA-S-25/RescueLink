/**
 * ReportRescue.jsx
 *
 * Public form for reporting an animal emergency.
 * Route: /report
 *
 * Any user (logged in or not) can submit a report.
 * If the user is logged in, their name and contact are pre-filled.
 * The form never exposes role or auth details.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ANIMAL_TYPES   = ['Dog', 'Cat', 'Bird', 'Cow', 'Horse', 'Other'];
const EMERGENCY_TYPES = ['Injured', 'Trapped', 'Abandoned', 'Accident', 'Sick', 'Other'];
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const INITIAL_FORM = {
  reporterName:    '',
  reporterContact: '',
  animalType:      '',
  emergencyType:   '',
  locationAddress: '',
  latitude:        null,
  longitude:       null,
  priority:        'MEDIUM',
  imageFile:       null,
};

const ReportRescue = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]           = useState({
    ...INITIAL_FORM,
    reporterName:    user?.name  || '',
    reporterContact: user?.phone || '',
  });
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(null); // holds created rescue on success
  const [geoStatus, setGeoStatus] = useState(''); // tracking geo api status

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    setForm(prev => ({ ...prev, imageFile: e.target.files[0] }));
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser does not support geolocation');
      return;
    }
    
    setGeoStatus('Detecting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setGeoStatus('Location detected');
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoStatus('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoStatus('Location unavailable');
            break;
          case error.TIMEOUT:
            setGeoStatus('Location request timed out');
            break;
          default:
            setGeoStatus('An unknown error occurred');
            break;
        }
      }
    );
  };

  // ─── Validation ────────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {};
    if (!form.reporterName.trim())    errs.reporterName    = 'Your name is required';
    if (!form.reporterContact.trim()) errs.reporterContact = 'Contact number is required';
    if (!form.animalType)             errs.animalType      = 'Please select an animal type';
    if (!form.emergencyType)          errs.emergencyType   = 'Please select an emergency type';
    if (!form.description.trim())     errs.description     = 'Please describe the emergency';
    if (!form.locationAddress.trim()) errs.locationAddress = 'Location is required';
    return errs;
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('reporterName', form.reporterName.trim());
      formData.append('reporterContact', form.reporterContact.trim());
      formData.append('animalType', form.animalType);
      formData.append('emergencyType', form.emergencyType);
      formData.append('description', form.description.trim());
      formData.append('locationAddress', form.locationAddress.trim());
      if (form.latitude) formData.append('latitude', form.latitude);
      if (form.longitude) formData.append('longitude', form.longitude);
      formData.append('priority', form.priority);
      if (form.imageFile) formData.append('image', form.imageFile);

      const res = await api.post('/rescues', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubmitted(res.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Submission failed. Please try again.';
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  // ─── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-slide-in-up">
          <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(226,232,240,0.7)', boxShadow: '0 16px 48px rgba(15,23,42,0.12)' }}>
            {/* Success header */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-5xl mx-auto mb-4 animate-float">
                ✅
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">Rescue Request Submitted!</h1>
              <p className="text-emerald-100 text-sm mt-2">
                Your emergency has been reported. A rescue team will respond shortly.
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-2xl p-5 space-y-3 mb-5" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.7)' }}>
                {[
                  { label: 'Case ID', value: submitted.caseId, mono: true, highlight: true },
                  { label: 'Animal', value: submitted.animalType },
                  { label: 'Emergency', value: submitted.emergencyType },
                  { label: 'Status', value: submitted.status, badge: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">{row.label}</span>
                    {row.badge ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">{row.value}</span>
                    ) : (
                      <span className={`font-bold ${row.mono ? 'font-mono-case text-rose-600' : 'text-slate-900'}`}>{row.value}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                {user && (
                  <Link to="/my-rescues" className="btn-primary flex-1 text-center py-3">
                    📋 Track My Rescues
                  </Link>
                )}
                <button
                  onClick={() => { setSubmitted(null); setForm({ ...INITIAL_FORM, reporterName: user?.name || '', reporterContact: user?.phone || '' }); }}
                  className="btn-secondary flex-1 py-3"
                >
                  Report Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen mesh-bg">

      {/* Nav */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
              🐾
            </div>
            <span className="font-extrabold text-slate-900 text-sm hidden sm:block">RescueLink</span>
          </Link>
          {user ? (
            <Link to="/dashboard" className="btn-secondary text-xs py-1.5 px-3.5">← Dashboard</Link>
          ) : (
            <Link to="/login" className="btn-secondary text-sm">Login</Link>
          )}
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Report an Animal Emergency</h1>
          <p className="text-gray-500 text-sm mt-1">
            Fill in the details below. Our rescue team will be notified immediately.
          </p>
        </div>

        <div className="card">
          <form id="report-rescue-form" onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Form-level error */}
            {errors.form && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {errors.form}
              </div>
            )}

            {/* ─── Reporter Info ─────────────────────────────────────── */}
            <fieldset>
              <legend className="text-base font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 w-full">
                Your Information
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label htmlFor="reporterName" className="form-label">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reporterName"
                    name="reporterName"
                    type="text"
                    value={form.reporterName}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className={`form-input ${errors.reporterName ? 'border-red-400' : ''}`}
                    disabled={loading}
                  />
                  {errors.reporterName && <p className="text-red-500 text-xs mt-1">{errors.reporterName}</p>}
                </div>

                <div>
                  <label htmlFor="reporterContact" className="form-label">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reporterContact"
                    name="reporterContact"
                    type="tel"
                    value={form.reporterContact}
                    onChange={handleChange}
                    placeholder="9876543210"
                    className={`form-input ${errors.reporterContact ? 'border-red-400' : ''}`}
                    disabled={loading}
                  />
                  {errors.reporterContact && <p className="text-red-500 text-xs mt-1">{errors.reporterContact}</p>}
                </div>

              </div>
            </fieldset>

            {/* ─── Emergency Details ─────────────────────────────────── */}
            <fieldset>
              <legend className="text-base font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 w-full">
                Emergency Details
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                <div>
                  <label htmlFor="animalType" className="form-label">
                    Animal Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="animalType"
                    name="animalType"
                    value={form.animalType}
                    onChange={handleChange}
                    className={`form-input ${errors.animalType ? 'border-red-400' : ''}`}
                    disabled={loading}
                  >
                    <option value="">Select animal…</option>
                    {ANIMAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.animalType && <p className="text-red-500 text-xs mt-1">{errors.animalType}</p>}
                </div>

                <div>
                  <label htmlFor="emergencyType" className="form-label">
                    Emergency Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="emergencyType"
                    name="emergencyType"
                    value={form.emergencyType}
                    onChange={handleChange}
                    className={`form-input ${errors.emergencyType ? 'border-red-400' : ''}`}
                    disabled={loading}
                  >
                    <option value="">Select emergency…</option>
                    {EMERGENCY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.emergencyType && <p className="text-red-500 text-xs mt-1">{errors.emergencyType}</p>}
                </div>

              </div>

              <div className="mb-4">
                <label htmlFor="description" className="form-label">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the situation — animal's condition, surroundings, urgency…"
                  className={`form-input resize-none ${errors.description ? 'border-red-400' : ''}`}
                  disabled={loading}
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <label htmlFor="locationAddress" className="form-label mb-0">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    disabled={loading || geoStatus === 'Detecting location...'}
                    className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md font-medium transition-colors"
                  >
                    📍 Use My Current Location
                  </button>
                </div>
                
                {geoStatus && (
                  <p className={`text-xs mb-2 ${geoStatus === 'Location detected' ? 'text-green-600' : 'text-orange-600'}`}>
                    {geoStatus}
                  </p>
                )}

                {form.latitude && form.longitude && (
                  <div className="bg-gray-50 border border-gray-100 rounded p-2 mb-3 text-xs text-gray-600 font-mono">
                    Latitude: {form.latitude.toFixed(6)} | Longitude: {form.longitude.toFixed(6)}
                  </div>
                )}

                <input
                  id="locationAddress"
                  name="locationAddress"
                  type="text"
                  value={form.locationAddress}
                  onChange={handleChange}
                  placeholder="Street address, landmark, or area name"
                  className={`form-input ${errors.locationAddress ? 'border-red-400' : ''}`}
                  disabled={loading}
                />
                {errors.locationAddress && <p className="text-red-500 text-xs mt-1">{errors.locationAddress}</p>}
              </div>

              <div className="mb-4">
                <label htmlFor="priority" className="form-label">
                  Severity / Priority <span className="text-red-500">*</span>
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className="form-input"
                  disabled={loading}
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

            </fieldset>

            {/* ─── Image Upload ──────────────────────────────────────── */}
            <div>
              <label htmlFor="imageFile" className="form-label">
                Upload Animal Image <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="imageFile"
                name="imageFile"
                type="file"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleFileChange}
                className="form-input"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">
                Upload a photo to help responders assess the situation.
              </p>
            </div>

            {/* Submit */}
            <button
              id="report-submit"
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : (
                '🚨 Report Emergency'
              )}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
};

export default ReportRescue;
