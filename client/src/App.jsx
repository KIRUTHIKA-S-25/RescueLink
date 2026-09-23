/**
 * App.jsx — Phase 1 placeholder
 *
 * This is a temporary landing page that:
 * 1. Confirms React + Vite + Tailwind are working
 * 2. Calls the backend health check API to confirm frontend ↔ backend communication
 *
 * This will be completely replaced in Phase 3 (Auth) with the real app shell.
 */

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function App() {
  const [apiStatus, setApiStatus] = useState('checking...');
  const [apiDetails, setApiDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Call the backend health check when the component mounts
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setApiStatus('✅ Connected');
          setApiDetails(data);
        } else {
          setApiStatus('❌ Unexpected response');
        }
      })
      .catch((err) => {
        setApiStatus('❌ Cannot reach server');
        setError(err.message);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🐾</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RescueLink</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Intelligent Animal Rescue Coordination System
          </p>
        </div>

        {/* Status Card */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">
            Phase 1 – System Status Check
          </h2>

          {/* Frontend status */}
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600 font-medium">React + Vite</span>
            <span className="text-sm text-green-600 font-medium">✅ Running</span>
          </div>

          {/* Tailwind status */}
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600 font-medium">Tailwind CSS</span>
            <span className="text-sm text-green-600 font-medium">✅ Loaded</span>
          </div>

          {/* Backend API status */}
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600 font-medium">Backend API</span>
            <span
              className={`text-sm font-medium ${
                apiStatus.startsWith('✅')
                  ? 'text-green-600'
                  : apiStatus.startsWith('❌')
                  ? 'text-red-500'
                  : 'text-yellow-500'
              }`}
            >
              {apiStatus}
            </span>
          </div>

          {/* Extra details if connected */}
          {apiDetails && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <p><span className="font-medium">Message:</span> {apiDetails.message}</p>
              <p><span className="font-medium">Environment:</span> {apiDetails.environment}</p>
              <p><span className="font-medium">Server time:</span> {apiDetails.timestamp}</p>
            </div>
          )}

          {/* Error if not connected */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">
              <p className="font-medium mb-1">Connection Error:</p>
              <p>{error}</p>
              <p className="mt-2 text-red-400">
                Make sure the backend server is running: <code className="font-mono">npm run dev</code> in <code className="font-mono">server/</code>
              </p>
            </div>
          )}
        </div>

        {/* Phase indicator */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Phase 1 complete → Next: MongoDB schemas + Authentication
        </p>

        {/* Tailwind color palette test — confirms custom colors work */}
        <div className="flex justify-center gap-2 mt-4">
          <div className="w-6 h-6 rounded-full bg-rescue-critical" title="Critical" />
          <div className="w-6 h-6 rounded-full bg-rescue-high" title="High" />
          <div className="w-6 h-6 rounded-full bg-rescue-medium" title="Medium" />
          <div className="w-6 h-6 rounded-full bg-rescue-low" title="Low" />
        </div>
        <p className="text-center text-xs text-gray-400 mt-1">
          Priority color tokens: critical · high · medium · low
        </p>

      </div>
    </div>
  );
}

export default App;
