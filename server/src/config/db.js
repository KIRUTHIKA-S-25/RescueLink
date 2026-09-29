/**
 * db.js
 *
 * MongoDB Atlas connection using Mongoose.
 *
 * WHY a separate file?
 * - Keeps database connection logic isolated from app setup.
 * - Easy to import and call connectDB() from server.js at startup.
 * - If connection logic ever changes (e.g. adding replica set options),
 *   there is exactly one place to update it.
 */

const dns = require('dns');
const mongoose = require('mongoose');

/**
 * connectDB
 *
 * Reads MONGODB_URI from environment variables and connects to MongoDB Atlas.
 * Logs a success or failure message — but NEVER logs the URI or credentials.
 *
 * Call this once at server startup (before listening on a port).
 *
 * WHY dns.setServers()?
 * The mongodb+srv:// scheme requires a DNS SRV record lookup to discover
 * cluster nodes. Some local/campus DNS servers don't support SRV records and
 * return ECONNREFUSED. Setting Google's public DNS (8.8.8.8) as the resolver
 * for Node.js's built-in dns module fixes this without changing system settings.
 */
const connectDB = async () => {
  // Guard: make sure the URI is configured before attempting a connection.
  if (!process.env.MONGODB_URI) {
    console.error('[DB] Configuration error: MONGODB_URI is not set in your .env file.');
    console.error('[DB] Add MONGODB_URI=mongodb+srv://... to server/.env and restart.');
    process.exit(1); // Stop the server — running without a database makes no sense.
  }

  // Use Google public DNS so that the SRV lookup for mongodb+srv:// works
  // even on networks whose local DNS doesn't support SRV records.
  dns.setServers(['8.8.8.8', '8.8.4.4']);

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Only log the host (no username, password, or full URI)
    const host = mongoose.connection.host;
    console.log(`[DB] MongoDB connected successfully → ${host}`);
  } catch (err) {
    // Log the error type/message — NOT the URI or credentials
    console.error(`[DB] MongoDB connection failed: ${err.message}`);
    console.error('[DB] Check that MONGODB_URI in server/.env is correct and your IP is whitelisted in Atlas.');
    process.exit(1); // Stop the server — a failed DB connection is unrecoverable at startup.
  }
};

module.exports = connectDB;
