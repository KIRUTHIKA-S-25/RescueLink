/**
 * AdminIncidentMap.jsx
 *
 * Leaflet interactive map visualizing geographic distribution of rescue cases for Admins.
 * Pins are colored by severity (CRITICAL: Red, HIGH: Orange, MEDIUM: Amber, LOW: Green).
 */

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

// Create a custom SVG marker generator
const createCustomMarker = (priority = 'MEDIUM') => {
  const color = SEVERITY_COLORS[priority] || '#f59e0b';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="11" r="4.5" fill="#ffffff"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-admin-marker',
    html: svg,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32],
  });
};

const AdminIncidentMap = ({ cases = [], className = 'h-96 w-full rounded-2xl overflow-hidden' }) => {
  const validCases = cases.filter(
    (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number' && !isNaN(c.latitude) && !isNaN(c.longitude)
  );

  const defaultCenter = validCases.length > 0 ? [validCases[0].latitude, validCases[0].longitude] : [13.0827, 80.2707];

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
      <MapContainer
        center={defaultCenter}
        zoom={validCases.length > 0 ? 12 : 11}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validCases.map((c) => (
          <Marker
            key={c._id || c.caseId}
            position={[c.latitude, c.longitude]}
            icon={createCustomMarker(c.priority)}
          >
            <Popup>
              <div className="p-1 text-slate-800 text-xs">
                <div className="font-extrabold text-slate-900 flex items-center justify-between gap-2 border-b border-slate-100 pb-1 mb-1">
                  <span>{c.caseId}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                    style={{ backgroundColor: SEVERITY_COLORS[c.priority] || '#f59e0b' }}
                  >
                    {c.priority}
                  </span>
                </div>
                <div><b>Animal:</b> {c.animalType}</div>
                <div><b>Emergency:</b> {c.emergencyType}</div>
                <div><b>Status:</b> <span className="font-bold text-emerald-700">{c.status}</span></div>
                <div className="text-slate-500 mt-1 truncate max-w-[200px]">{c.address || 'Address on record'}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default AdminIncidentMap;
