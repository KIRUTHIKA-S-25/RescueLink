/**
 * server.js
 *
 * Entry point for the RescueLink backend.
 *
 * This file is intentionally minimal. Its only job is to:
 * 1. Import the configured Express app
 * 2. Create an HTTP server from it
 * 3. Start listening on the configured port
 *
 * WHY create an http.Server separately instead of just calling app.listen()?
 * → In Phase 10 (Socket.IO), we'll attach Socket.IO to this same HTTP server.
 *   Socket.IO needs access to the raw HTTP server, not just the Express app.
 *   Setting this up now means zero refactoring later.
 */

const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Create a standard Node.js HTTP server wrapping the Express app
const server = http.createServer(app);

// Start listening
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
