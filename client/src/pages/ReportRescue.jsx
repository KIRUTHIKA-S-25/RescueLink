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
import { useParallax } from '../utils/useParallax';
import LocationPickerMap from '../components/LocationPickerMap';

const ANIMAL_TYPES   = ['Dog', 'Cat', 'Bird', 'Cow', 'Horse', 'Other'];
const EMERGENCY_TYPES = ['Injured', 'Trapped', 'Abandoned', 'Accident', 'Sick', 'Other'];

const INITIAL_FORM = {
  reporterName:    '',
  reporterContact: '',
  animalType:      '',
  emergencyType:   '',
  locationAddress: '',
  latitude:        null,
  longitude:       null,
  imageFile:       null,
};

const ReportRescue = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const {
    containerRef: bannerRef,
    parallaxBgStyle: bannerBgStyle,
    handleMouseMove: handleBannerMouseMove,
    handleMouseLeave: handleBannerMouseLeave,
  } = useParallax({ scrollSpeed: 0.2, mouseSensitivity: 12 });

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

  // ─── Field Validation ─────────────────────────────────────────────────────

  const validateField = (name, value) => {
    let err = '';
    const trimmed = typeof value === 'string' ? value.trim() : '';

    switch (name) {
      case 'reporterName':
        if (!trimmed) {
          err = 'Your name is required';
        } else if (/\d/.test(trimmed)) {
          err = 'Name must contain letters only (numbers are not allowed)';
        } else if (!/^[a-zA-Z\s.'-]+$/.test(trimmed) || trimmed.length < 2) {
          err = 'Name must contain letters only (minimum 2 characters)';
        }
        break;

      case 'reporterContact':
        if (!trimmed) {
          err = 'Contact number is required';
        } else if (/[a-zA-Z]/.test(trimmed)) {
          err = 'Phone number must contain numbers only (letters are not allowed)';
        } else {
          const digits = trimmed.replace(/\D/g, '');
          let core = digits;
          if (digits.length === 12 && digits.startsWith('91')) core = digits.slice(2);
          else if (digits.length === 11 && digits.startsWith('0')) core = digits.slice(1);
          if (core.length !== 10) {
            err = `Phone number must be exactly 10 digits (currently ${core.length} digits)`;
          }
        }
        break;

      case 'animalType':
        if (!trimmed) err = 'Please select an animal type';
        break;

      case 'emergencyType':
        if (!trimmed) err = 'Please select an emergency type';
        break;

      case 'description':
        if (!trimmed) {
          err = 'Please describe the emergency';
        } else if (trimmed.length < 10) {
          err = 'Please provide more details about the emergency (minimum 10 characters)';
        }
        break;

      case 'locationAddress':
        if (!trimmed) {
          err = 'Location address is required';
        } else if (trimmed.length < 5) {
          err = 'Location address must be at least 5 characters long';
        }
        break;

      default:
        break;
    }
    return err;
  };

  const validate = () => {
    const errs = {};
    const nameErr = validateField('reporterName', form.reporterName);
    if (nameErr) errs.reporterName = nameErr;

    const contactErr = validateField('reporterContact', form.reporterContact);
    if (contactErr) errs.reporterContact = contactErr;

    const animalErr = validateField('animalType', form.animalType);
    if (animalErr) errs.animalType = animalErr;

    const emergencyErr = validateField('emergencyType', form.emergencyType);
    if (emergencyErr) errs.emergencyType = emergencyErr;

    const descErr = validateField('description', form.description);
    if (descErr) errs.description = descErr;

    const locErr = validateField('locationAddress', form.locationAddress);
    if (locErr) errs.locationAddress = locErr;

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
    const isCorroborating = submitted.isDuplicate;

    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <div className="w-full max-w-lg animate-slide-in-up">
          <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(226,232,240,0.7)', boxShadow: '0 16px 48px rgba(15,23,42,0.12)' }}>
            {/* Success header */}
            <div className={`p-8 text-center text-white ${isCorroborating ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-5xl mx-auto mb-4 animate-float">
                {isCorroborating ? '🤝' : '✅'}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {isCorroborating ? 'Corroborating Report Linked!' : 'Rescue Request Submitted!'}
              </h1>
              <p className="text-white/90 text-sm mt-2">
                {isCorroborating
                  ? 'A matching rescue incident is already active nearby. Your report and photo were attached as corroborating evidence!'
                  : 'Your emergency has been reported. Automated triage is evaluating priority and alerting responders.'}
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-2xl p-5 space-y-3 mb-5" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.7)' }}>
                {[
                  { label: 'Case Reference', value: submitted.caseId, mono: true, highlight: true },
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

              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <Link to="/my-rescues" className="btn-primary flex-1 text-center py-3">
                    📋 Track My Rescues
                  </Link>
                ) : (
                  <Link to="/" className="btn-secondary flex-1 text-center py-3">
                    🏠 Return to Home
                  </Link>
                )}
                <button
                  onClick={() => { setSubmitted(null); setForm({ ...INITIAL_FORM, reporterName: user?.name || '', reporterContact: user?.phone || '' }); }}
                  className="btn-emergency flex-1 py-3 text-center justify-center cursor-pointer"
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

        {/* Parallax Animal Emergency Header Banner */}
        <div
          ref={bannerRef}
          onMouseMove={handleBannerMouseMove}
          onMouseLeave={handleBannerMouseLeave}
          className="relative rounded-3xl overflow-hidden mb-8 text-white shadow-2xl"
          style={{ minHeight: '180px' }}
        >
          {/* Parallax Animal Background Layer */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              src="/images/rescuer-banner.jpg"
              alt="Animal Emergency Rescue"
              className="parallax-bg-layer object-cover filter brightness-95 saturate-110"
              style={bannerBgStyle}
            />
            {/* Scrim Overlay */}
            <div className="absolute inset-0 header-scrim-dark" />
          </div>

          <div className="relative z-10 p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/25 border border-rose-500/40 text-rose-300 mb-3 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>🚨 Live Emergency Dispatch</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
              Report an Animal Emergency
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-xl drop-shadow">
              Fill in the details below. Our automated system calculates priority and alerts the nearest active rescue responder immediately.
            </p>
          </div>
        </div>

        <div className="glass-form-card-light rounded-3xl p-6 sm:p-8 shadow-xl border border-white/60 relative overflow-hidden mb-12">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />
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
                  <p className={`text-xs mb-2 ${geoStatus.includes('detected') || geoStatus.includes('pinned') ? 'text-green-600' : 'text-orange-600'}`}>
                    {geoStatus}
                  </p>
                )}

                {form.latitude && form.longitude && (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 mb-3 text-xs text-gray-600 font-mono flex items-center justify-between">
                    <span>📍 Pin: {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}</span>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, latitude: null, longitude: null }))}
                      className="text-red-500 hover:text-red-700 text-xs font-sans font-semibold cursor-pointer"
                    >
                      Clear Pin
                    </button>
                  </div>
                )}

                <input
                  id="locationAddress"
                  name="locationAddress"
                  type="text"
                  value={form.locationAddress}
                  onChange={handleChange}
                  placeholder="Street address, landmark, or area name"
                  className={`form-input mb-3 ${errors.locationAddress ? 'border-red-400' : ''}`}
                  disabled={loading}
                />
                {errors.locationAddress && <p className="text-red-500 text-xs mb-3">{errors.locationAddress}</p>}

                {/* Interactive Leaflet Map Fallback */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                    🗺️ Pinpoint Incident Location on Map (Click on map to drop or adjust pin):
                  </label>
                  <LocationPickerMap
                    latitude={form.latitude}
                    longitude={form.longitude}
                    onLocationSelect={(lat, lng) => {
                      setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
                      setGeoStatus('Location pinned on map');
                    }}
                  />
                </div>
              </div>

              {/* Automated Triage Urgency Notice (Backend Algorithmic Scoring) */}
              <div className="mb-4 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-3">
                <span className="text-xl">🧠</span>
                <div>
                  <h4 className="font-bold text-indigo-950 mb-0.5">Automated Emergency Triage (TUS Engine)</h4>
                  <p className="text-indigo-800/80 leading-relaxed">
                    Severity is computed objectively on submission based on animal vulnerability, trauma type, and environmental hazards. Client overrides are disabled to ensure priority life-saving dispatch.
                  </p>
                </div>
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
