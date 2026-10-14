/**
 * chatRoutes.js
 *
 * Routes for the AI Chatbot assistant. Mounted at /api/chat.
 */

const express = require('express');
const { handleChat } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Optional authentication middleware:
 * If a valid Bearer token is provided, attach req.user so the chatbot knows
 * the user's role (citizen, responder, admin).
 * If no token or invalid, simply proceed as anonymous guest.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return protect(req, res, (err) => {
      // If token expired or invalid, continue as anonymous rather than throwing 401
      if (err) req.user = null;
      next();
    });
  }
  next();
};

router.post('/', optionalAuth, handleChat);

module.exports = router;
