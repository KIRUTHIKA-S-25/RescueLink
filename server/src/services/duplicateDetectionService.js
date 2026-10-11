/**
 * duplicateDetectionService.js
 *
 * Detects duplicate rescue reports based on:
 * - Spatial proximity: <= 100 meters
 * - Temporal window: <= 45 minutes
 * - Matching animal category
 * - Excludes CANCELLED cases
 */

const RescueCase = require('../models/RescueCase');
const { calculateDistanceMeters } = require('../utils/geoUtils');

const DUPLICATE_TIME_WINDOW_MS = 45 * 60 * 1000; // 45 minutes
const DUPLICATE_MAX_DISTANCE_METERS = 100;       // 100 meters

/**
 * Checks if a newly reported incident is a duplicate of an existing active incident.
 *
 * @param {Object} report
 * @param {string} report.animalType
 * @param {number} report.latitude
 * @param {number} report.longitude
 * @returns {Promise<{ isDuplicate: boolean, primaryCase: Object | null, distanceMeters: number | null }>}
 */
const detectDuplicateCase = async ({ animalType, latitude, longitude }) => {
  // If coordinates are missing, spatial duplicate detection cannot be evaluated
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return { isDuplicate: false, primaryCase: null, distanceMeters: null };
  }

  const since = new Date(Date.now() - DUPLICATE_TIME_WINDOW_MS);

  // Query recent active cases with the same animal type
  const recentCases = await RescueCase.find({
    animalType: new RegExp(`^${animalType.trim()}$`, 'i'),
    createdAt: { $gte: since },
    status: { $ne: 'CANCELLED' },
    'location.latitude': { $exists: true, $ne: null },
    'location.longitude': { $exists: true, $ne: null },
  }).lean();

  for (const candidate of recentCases) {
    const dist = calculateDistanceMeters(
      latitude,
      longitude,
      candidate.location.latitude,
      candidate.location.longitude
    );

    if (dist <= DUPLICATE_MAX_DISTANCE_METERS) {
      return {
        isDuplicate: true,
        primaryCase: candidate,
        distanceMeters: Math.round(dist),
      };
    }
  }

  return { isDuplicate: false, primaryCase: null, distanceMeters: null };
};

module.exports = {
  detectDuplicateCase,
  DUPLICATE_TIME_WINDOW_MS,
  DUPLICATE_MAX_DISTANCE_METERS,
};
