/**
 * app.js
 *
 * Express application setup.
 *
 * WHY separate from server.js?
 * - app.js configures Express: middleware, routes, error handling
 * - server.js creates the actual HTTP server and starts listening
 * - This separation makes the app easier to test and keeps concerns separate.
 *   (Later, Socket.IO will also need access to the HTTP server — having
 *    server.js as the entry point makes that integration clean.)
 */

require('dotenv').config();           // Load .env variables before anything else
require('express-async-errors');      // Automatically catches async errors — no need for try/catch in every route

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { sendError } = require('./src/utils/apiResponse');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * CORS — Cross-Origin Resource Sharing
 * Allows the React frontend (running on a different port) to call our API.
 * We restrict it to CLIENT_URL so random sites cannot call our API.
 */
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // Allow cookies/auth headers
  })
);

/**
 * express.json() — Parse incoming JSON request bodies
 * Without this, req.body would always be undefined when the client sends JSON.
 */
app.use(express.json());

/**
 * express.urlencoded() — Parse URL-encoded form data (e.g. from HTML forms)
 */
app.use(express.urlencoded({ extended: true }));

/**
 * morgan — HTTP request logger
 * In 'dev' mode it prints: GET /api/health 200 3ms
 * Very useful during development to see every request hitting the server.
 */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * Health Check Route
 * Purpose: A simple endpoint to confirm the API is running.
 * We'll call this from the browser/Postman to verify the server is up.
 * In later phases, all real routes will be mounted here (e.g. /api/auth, /api/cases).
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RescueLink API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────

/**
 * This middleware runs whenever an error is passed to next(error) or when
 * express-async-errors catches an unhandled async error.
 *
 * Having ONE global error handler means we don't need try/catch blocks in
 * every controller — errors bubble up automatically.
 *
 * Note: Express identifies error-handling middleware by the 4-argument signature (err, req, res, next).
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  // Handle Mongoose validation errors (we'll get these in Phase 2)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Validation failed', 400, messages);
  }

  // Handle duplicate key errors from MongoDB (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} already exists`, 409);
  }

  // JWT errors (will be relevant in Phase 3)
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired, please log in again', 401);
  }

  // Generic fallback
  sendError(
    res,
    err.message || 'Internal server error',
    err.statusCode || 500
  );
});

module.exports = app;
