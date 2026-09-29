/**
 * authMiddleware.js
 *
 * Authentication middleware for protected routes.
 *
 * Flow:
 *   Request → Read Authorization header → Verify JWT → Attach req.user → next()
 *
 * Returns HTTP 401 if:
 *   - No Authorization header
 *   - Header is not "Bearer <token>"
 *   - Token is malformed
 *   - Token signature is invalid
 *   - Token is expired
 *
 * WHY attach to req.user?
 * Downstream middleware and controllers can then read req.user.userId and
 * req.user.role without needing to re-verify the token every time.
 *
 * Security:
 *   - We NEVER expose the JWT secret or the full error object in the response.
 *   - Stack traces are not sent to the client.
 */

const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/apiResponse');

const protect = (req, res, next) => {
  // --- Step 1: Read Authorization header ---
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required. Please log in.', 401);
  }

  // --- Step 2: Extract token ---
  const token = authHeader.split(' ')[1];

  if (!token) {
    return sendError(res, 'Authentication required. Please log in.', 401);
  }

  // --- Step 3: Verify JWT ---
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // --- Step 4: Attach to req.user ---
    // Only store the minimum needed: userId and role.
    req.user = {
      userId: decoded.userId,
      role:   decoded.role,
      name:   decoded.name,
    };

    next();
  } catch (err) {
    // Handle specific JWT errors with clear but safe messages
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Your session has expired. Please log in again.', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token. Please log in again.', 401);
    }
    // Fallback — do not expose err.message
    return sendError(res, 'Authentication failed.', 401);
  }
};

module.exports = { protect };
