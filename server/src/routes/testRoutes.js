/**
 * testRoutes.js
 *
 * DEVELOPMENT / TESTING ONLY
 *
 * These routes exist SOLELY to verify Phase 3 authentication and
 * role-based authorization. They have NO business logic.
 *
 * Remove or disable in production.
 *
 * Routes:
 *   GET /api/test/protected  — any authenticated user
 *   GET /api/test/citizen    — citizen role only
 *   GET /api/test/responder  — responder role only
 *   GET /api/test/admin      — admin role only
 */

const express = require('express');
const { protect }        = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { sendSuccess }    = require('../utils/apiResponse');

const router = express.Router();

// Any authenticated user
router.get('/protected', protect, (req, res) => {
  sendSuccess(res, { userId: req.user.userId, role: req.user.role }, 'Access granted — authenticated user');
});

// Citizen only
router.get('/citizen', protect, authorizeRoles('citizen'), (req, res) => {
  sendSuccess(res, { userId: req.user.userId, role: req.user.role }, 'Access granted — citizen route');
});

// Responder only
router.get('/responder', protect, authorizeRoles('responder'), (req, res) => {
  sendSuccess(res, { userId: req.user.userId, role: req.user.role }, 'Access granted — responder route');
});

// Admin only
router.get('/admin', protect, authorizeRoles('admin'), (req, res) => {
  sendSuccess(res, { userId: req.user.userId, role: req.user.role }, 'Access granted — admin route');
});

module.exports = router;
