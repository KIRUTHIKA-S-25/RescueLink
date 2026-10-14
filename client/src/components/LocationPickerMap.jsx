/**
 * LocationPickerMap.jsx
 *
 * Interactive Leaflet map fallback component:
 * Allows citizens to manually select or correct incident coordinates by clicking
 * anywhere on the map when browser GPS permission is denied or unavailable.
 */

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Recenter map when center prop updates
const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Map click listener component
const MapClickHandler = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      if (onSelect) {
        onSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const LocationPickerMap = ({
  latitude,
  longitude,
  onLocationSelect,
  className = 'h-64 w-full rounded-2xl z-0 overflow-hidden',
}) => {
  // Default to Chennai coordinates if none provided
  const defaultLat = 13.0827;
  const defaultLng = 80.2707;

  const validLat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : defaultLat;
  const validLng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : defaultLng;
  const hasSelectedPosition = typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude);

  const centerPosition = [validLat, validLng];

  return (
    <div className={`relative ${className} border border-slate-200 shadow-inner`} style={{ isolation: 'isolate' }}>
      <MapContainer
        center={centerPosition}
        zoom={hasSelectedPosition ? 15 : 12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <ChangeView center={centerPosition} zoom={hasSelectedPosition ? 15 : 12} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler
          onSelect={(lat, lng) => {
            if (onLocationSelect) {
              onLocationSelect(lat, lng);
            }
          }}
        />
        {hasSelectedPosition && (
          <Marker position={[latitude, longitude]}>
            <Popup>
              Selected Rescue Incident Location<br />
              <span className="font-mono text-xs">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-slate-700 shadow-sm z-10 pointer-events-none flex items-center justify-between">
        <span>📍 Click anywhere on the map to pin exact emergency scene</span>
        {hasSelectedPosition && (
          <span className="font-mono text-[11px] text-emerald-700 font-bold">
            ✓ Pin Set
          </span>
        )}
      </div>
    </div>
  );
};

export default LocationPickerMap;
