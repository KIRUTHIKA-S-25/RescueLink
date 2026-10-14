/**
 * geoUtils.js
 *
 * Geospatial utility functions for RescueLink.
 * - Haversine great-circle spherical distance formula (straight-line distance)
 * - Proximity-based responder matching with workload filtering and capacity caps
 *
 * NOTE ON DISTANCE MEASUREMENT:
 * Haversine calculates straight-line spherical Euclidean distance over the Earth's surface (R = 6371 km).
 * Actual road transit distance and travel time will vary depending on urban routing, road layout,
 * traffic, and natural obstacles. For field navigation, responders use deep-linked turn-by-turn
 * navigation (e.g. Google Maps / OpenStreetMap) provided on their terminal.
 */

const ResponderProfile = require('../models/ResponderProfile');

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return Infinity;
  }

  const R = 6371; // Earth's mean radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculates distance between two coordinates in meters.
 */
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  return calculateHaversineDistance(lat1, lon1, lat2, lon2) * 1000;
};

/**
 * Finds all eligible responders within a given radius, sorted by distance.
 * Checks availability, authorization, account status, and maximum active workload.
 *
 * @param {number} latitude Incident latitude
 * @param {number} longitude Incident longitude
 * @param {number} maxDistanceKm Maximum radius (default 15 km)
 * @param {number} maxWorkload Maximum active cases allowed (default 3)
 * @returns {Promise<Array>} List of eligible responders with calculated straight-line distance
 */
const findEligibleResponders = async (latitude, longitude, maxDistanceKm = 15, maxWorkload = 3) => {
  if (
    typeof latitude !== 'number' || typeof longitude !== 'number' ||
    isNaN(latitude) || isNaN(longitude)
  ) {
    return [];
  }

  // Find all available profiles with valid coordinates and activeCaseCount < maxWorkload
  const profiles = await ResponderProfile.find({
    availability: 'available',
    activeCaseCount: { $lt: maxWorkload },
    latitude: { $exists: true, $ne: null },
    longitude: { $exists: true, $ne: null },
  }).populate('user', 'name email phone role isActive');

  const eligible = [];

  for (const prof of profiles) {
    // Only active responders with role 'responder' or 'admin'
    if (!prof.user || !prof.user.isActive) continue;
    if (prof.user.role !== 'responder' && prof.user.role !== 'admin') continue;

    const distanceKm = calculateHaversineDistance(
      latitude,
      longitude,
      prof.latitude,
      prof.longitude
    );

    if (distanceKm <= maxDistanceKm) {
      eligible.push({
        responderId: prof.user._id,
        name: prof.user.name,
        email: prof.user.email,
        phone: prof.user.phone,
        profileId: prof._id,
        distanceKm: Math.round(distanceKm * 10) / 10, // 1 decimal place
        activeCaseCount: prof.activeCaseCount,
      });
    }
  }

  // Sort ascending by distance (nearest responder first)
  eligible.sort((a, b) => a.distanceKm - b.distanceKm);
  return eligible;
};

module.exports = {
  calculateHaversineDistance,
  calculateDistanceMeters,
  findEligibleResponders,
};
