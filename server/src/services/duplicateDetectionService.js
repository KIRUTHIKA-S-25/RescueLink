/**
 * duplicateDetectionService.js
 *
 * Spatiotemporal Duplicate Incident Detection Engine:
 * - Spatial proximity: <= 100 meters (Haversine great-circle distance)
 * - Temporal window: <= 45 minutes
 * - Matching animal category (normalized case-insensitive)
 * - Compatible status: active cases only (PENDING, ACCEPTED, IN_PROGRESS, ESCALATED)
 *   Excludes terminal states (CANCELLED, RESCUED)
 */

const RescueCase = require('../models/RescueCase');
const { calculateDistanceMeters } = require('../utils/geoUtils');

const DUPLICATE_TIME_WINDOW_MS = 45 * 60 * 1000; // 45 minutes
const DUPLICATE_MAX_DISTANCE_METERS = 100;       // 100 meters
const COMPATIBLE_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ESCALATED'];

/**
 * Normalizes animal category for fuzzy matching (e.g., 'puppy' and 'dog' or 'kitten' and 'cat')
 */
const normalizeAnimalCategory = (animal = '') => {
  const a = animal.toLowerCase().trim();
  if (/dog|pup|hound/i.test(a)) return 'dog';
  if (/cat|kitten|feline/i.test(a)) return 'cat';
  if (/cow|cattle|bull|calf/i.test(a)) return 'cattle';
  if (/bird|pigeon|crow|eagle|owl|hawk/i.test(a)) return 'bird';
  return a;
};

/**
 * Checks if a newly reported incident is a duplicate of an existing active incident.
 *
 * @param {Object} report
 * @param {string} report.animalType
 * @param {number} report.latitude
 * @param {number} report.longitude
 * @param {string} [report.excludeCaseId] Optional ID to exclude from search
 * @returns {Promise<{ isDuplicate: boolean, primaryCase: Object | null, distanceMeters: number | null }>}
 */
const detectDuplicateCase = async ({ animalType, latitude, longitude, excludeCaseId = null }) => {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    !animalType
  ) {
    return { isDuplicate: false, primaryCase: null, distanceMeters: null };
  }

  const normalizedCategory = normalizeAnimalCategory(animalType);
  const since = new Date(Date.now() - DUPLICATE_TIME_WINDOW_MS);

  const query = {
    createdAt: { $gte: since },
    status: { $in: COMPATIBLE_STATUSES },
    'location.latitude': { $exists: true, $ne: null },
    'location.longitude': { $exists: true, $ne: null },
  };

  if (excludeCaseId) {
    query._id = { $ne: excludeCaseId };
  }

  // Find candidate active cases within the time window
  const recentCases = await RescueCase.find(query).sort({ createdAt: -1 });

  for (const candidate of recentCases) {
    // 1. Verify animal category compatibility
    const candidateCategory = normalizeAnimalCategory(candidate.animalType);
    if (candidateCategory !== normalizedCategory) {
      continue;
    }

    // 2. Geographic distance calculation
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
  normalizeAnimalCategory,
  DUPLICATE_TIME_WINDOW_MS,
  DUPLICATE_MAX_DISTANCE_METERS,
  COMPATIBLE_STATUSES,
};
