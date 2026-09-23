/**
 * apiResponse.js
 *
 * Utility functions for sending consistent HTTP responses throughout the app.
 *
 * WHY: Without a standard format, different routes might return data in
 * different shapes (some with `data`, some with `result`, etc.), making the
 * frontend code messy and hard to maintain.
 *
 * EVERY response from this API follows the same shape:
 * {
 *   success: true | false,
 *   message: "Human-readable message",
 *   data: <payload> | null
 * }
 */

/**
 * Send a successful response.
 * @param {object} res  - Express response object
 * @param {*}      data - The payload to send (object, array, etc.)
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send an error response.
 * @param {object} res  - Express response object
 * @param {string} message - Human-readable error description
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {*}      errors - Optional extra error details (e.g. validation errors)
 */
const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const body = {
    success: false,
    message,
    data: null,
  };

  // Only include `errors` field if extra details were provided
  if (errors) {
    body.errors = errors;
  }

  return res.status(statusCode).json(body);
};

module.exports = { sendSuccess, sendError };
