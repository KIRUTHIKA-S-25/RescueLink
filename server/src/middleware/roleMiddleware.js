/**
 * roleMiddleware.js
 *
 * Role-based authorization middleware.
 *
 * Usage:
 *   router.get('/admin-only', protect, authorizeRoles('admin'), handler);
 *   router.get('/staff',      protect, authorizeRoles('responder', 'admin'), handler);
 *
 * IMPORTANT: This middleware MUST be used AFTER authMiddleware (protect),
 * because it reads req.user.role which is set by protect.
 *
 * HTTP status codes:
 *   401 = Not authenticated (handled by authMiddleware)
 *   403 = Authenticated but not authorized (handled here)
 *
 * WHY a factory function?
 * authorizeRoles('admin') returns a middleware function rather than being a
 * middleware itself. This lets us pass different role lists per route while
 * keeping the logic in one place.
 */

const { sendError } = require('../utils/apiResponse');

/**
 * authorizeRoles
 *
 * @param  {...string} allowedRoles - One or more roles that may access the route
 * @returns {Function} Express middleware
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user is guaranteed to exist here because protect() runs first
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
        403
      );
    }
    next();
  };
};

module.exports = { authorizeRoles };
