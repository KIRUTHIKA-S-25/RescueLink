/**
 * authRoutes.js
 *
 * Mounts authentication endpoints under /api/auth (configured in app.js).
 *
 * Public routes (no token required):
 *   POST /api/auth/register
 *   POST /api/auth/login
 *
 * Protected routes (valid JWT required):
 *   GET  /api/auth/me
 */

const express = require('express');
const { register, login, getCurrentUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/auth/register — create a new citizen account (public)
router.post('/register', register);

// POST /api/auth/login — authenticate and receive JWT (public)
router.post('/login', login);

// GET /api/auth/me — return current user's profile (protected)
router.get('/me', protect, getCurrentUser);

module.exports = router;
