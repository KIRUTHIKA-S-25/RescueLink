/**
 * rateLimitMiddleware.js
 *
 * Lightweight, zero-dependency in-memory rate limiter for public endpoints:
 * Protects against brute-force attacks and reporting spam.
 */

const { sendError } = require('../utils/apiResponse');

const rateLimitMap = new Map();

// Periodic cleanup of expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates an Express rate limiter middleware.
 *
 * @param {Object} options
 * @param {number} options.windowMs Time window in milliseconds (default: 15 minutes)
 * @param {number} options.maxRequests Maximum requests allowed per window (default: 100)
 * @param {string} options.message Error message returned upon exceeding limit
 */
const rateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 100,
  message = 'Too many requests from this IP, please try again later.',
} = {}) => {
  return (req, res, next) => {
    // Determine client IP
    const clientIp =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const routeKey = `${clientIp}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();

    let record = rateLimitMap.get(routeKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitMap.set(routeKey, record);
      return next();
    }

    record.count += 1;

    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return sendError(res, message, 429);
    }

    next();
  };
};

module.exports = {
  rateLimiter,
};
