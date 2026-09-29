/**
 * RescueMap.jsx
 *
 * A reusable map component for displaying a rescue location.
 * Uses Leaflet and OpenStreetMap.
 */

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icon in React
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

/**
 * Helper component to recenter map when coordinates change
 */
const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const RescueMap = ({ latitude, longitude, label = 'Reported Location', className = 'h-64 w-full rounded-lg z-0' }) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  const position = [latitude, longitude];

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <ChangeView center={position} zoom={15} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default RescueMap;
