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

const INITIAL_FORM = {
  reporterName:    '',
  reporterContact: '',
  animalType:      '',
  emergencyType:   '',
  locationAddress: '',
  latitude:        null,
  longitude:       null,
  imageUrl:        '',
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
      const res = await api.post('/rescues', {
        reporterName:    form.reporterName.trim(),
        reporterContact: form.reporterContact.trim(),
        animalType:      form.animalType,
        emergencyType:   form.emergencyType,
        description:     form.description.trim(),
        location: {
          address: form.locationAddress.trim(),
          latitude: form.latitude,
          longitude: form.longitude,
        },
        imageUrl: form.imageUrl.trim() || undefined,
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="card text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold text-gray-900">Rescue Request Submitted!</h1>
            <p className="text-gray-600 text-sm">
              Your emergency has been reported. A rescue team will respond shortly.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Case ID</span>
                <span className="font-mono font-semibold text-primary-700">{submitted.caseId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Animal</span>
                <span className="font-medium">{submitted.animalType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Emergency</span>
                <span className="font-medium">{submitted.emergencyType}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                  {submitted.status}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {user && (
                <Link to="/my-rescues" className="btn-primary flex-1 text-center">
                  Track my rescues
                </Link>
              )}
              <button
                onClick={() => { setSubmitted(null); setForm({ ...INITIAL_FORM, reporterName: user?.name || '', reporterContact: user?.phone || '' }); }}
                className="btn-secondary flex-1"
              >
                Report another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-900">RescueLink</span>
          </Link>
          {user ? (
            <Link to="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
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
            </fieldset>

            {/* ─── Optional Image URL ────────────────────────────────── */}
            <div>
              <label htmlFor="imageUrl" className="form-label">
                Image URL <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                value={form.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/photo.jpg"
                className="form-input"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">
                Paste a photo URL if you have one. Image upload coming in a later phase.
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
