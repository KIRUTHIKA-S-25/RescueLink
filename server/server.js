/**
 * server.js
 *
 * Entry point for the RescueLink backend.
 *
 * Startup order:
 *   1. Load environment variables (.env)
 *   2. Connect to MongoDB Atlas
 *   3. Start the HTTP server and listen on PORT
 *
 * WHY create an http.Server separately instead of just calling app.listen()?
 * → In a later phase, Socket.IO will attach to this same HTTP server.
 *   Socket.IO needs the raw HTTP server, not just the Express app.
 *   Setting this up now means zero refactoring later.
 */

require('dotenv').config(); // Must be first — loads .env before anything reads process.env

const http = require('http');
const app = require('./app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

/**
 * start()
 *
 * Async wrapper so we can await connectDB() before the server begins listening.
 * If the database connection fails, connectDB() exits the process — so the
 * server.listen() line below is only reached on successful connection.
 */
const start = async () => {
  // Step 1: Connect to MongoDB Atlas
  await connectDB();

  // Step 2: Create the HTTP server (Socket.IO-ready for later phases)
  const server = http.createServer(app);

  // Step 3: Start listening
  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║      RescueLink API Server           ║');
    console.log(`║      Running on port ${PORT}             ║`);
    console.log(`║      Environment: ${process.env.NODE_ENV || 'development'}        ║`);
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log(`  Health check: http://localhost:${PORT}/api/health`);
    console.log('');
  });

  // Handle unexpected server errors (e.g. port already in use)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[ERROR] Port ${PORT} is already in use.`);
      console.error('  → Close the other process using that port and try again.\n');
    } else {
      console.error('[ERROR] Server error:', err.message);
    }
    process.exit(1);
  });

  // Export for potential use in testing
  module.exports = server;
};

start();
