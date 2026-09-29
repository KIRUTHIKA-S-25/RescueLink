/**
 * rescueRoutes.js — Phase 5
 *
 * Routes for the rescue request workflow. Mounted at /api/rescues in app.js.
 *
 * Public:
 *   POST   /api/rescues              — Submit a rescue request (auth optional)
 *   GET    /api/rescues/:id          — Get a single rescue case
 *
 * Authenticated (any role):
 *   GET    /api/rescues/my           — Get rescue cases submitted by current user
 *   GET    /api/rescues/:id/activities — Timeline for a case (citizen: own case only)
 *
 * Authenticated (responder or admin):
 *   GET    /api/rescues              — Get all rescue cases (rescuer dashboard)
 *   PATCH  /api/rescues/:id/status   — Update rescue case status (+ auto-assign)
 *   POST   /api/rescues/:id/updates  — Add a progress note (assigned responder only)
 */

const express = require('express');
const {
  createRescue,
  getAllRescues,
  getRescueById,
  updateRescueStatus,
  getUserRescues,
} = require('../controllers/rescueController');

const { getActivities, addUpdate } = require('../controllers/activityController');

const { protect }        = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// POST /api/rescues — public (optionally attaches auth user if logged in)
router.post('/', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return protect(req, res, () => next());
  }
  next();
}, createRescue);

// GET /api/rescues/my — authenticated user's own cases (must be BEFORE /:id)
router.get('/my', protect, getUserRescues);

// GET /api/rescues — all cases for responder/admin dashboard
router.get('/', protect, authorizeRoles('responder', 'admin'), getAllRescues);

// GET /api/rescues/:id — single case (public but optionally checks auth for location security)
router.get('/:id', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return protect(req, res, () => next());
  }
  next();
}, getRescueById);

// PATCH /api/rescues/:id/status — responder or admin only (auto-assigns on ACCEPTED)
router.patch('/:id/status', protect, authorizeRoles('responder', 'admin'), updateRescueStatus);

// GET /api/rescues/:id/activities — timeline (citizen: own case only; responder/admin: any)
router.get('/:id/activities', protect, getActivities);

// POST /api/rescues/:id/updates — assigned responder or admin only
router.post('/:id/updates', protect, authorizeRoles('responder', 'admin'), addUpdate);

module.exports = router;
