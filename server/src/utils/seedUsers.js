/**
 * seedUsers.js
 *
 * DEVELOPMENT ONLY — Seed script for Phase 3 testing.
 *
 * Creates one user for each role so all three roles can be tested:
 *   - citizen
 *   - responder
 *   - admin
 *
 * Because public registration always creates citizens, responder/admin
 * accounts MUST be created via this controlled script.
 *
 * HOW TO RUN:
 *   node src/utils/seedUsers.js
 *
 * Prerequisites:
 *   - server/.env must contain SEED_* variables (see .env.example)
 *   - MongoDB connection must be working
 *
 * SAFE TO RUN MULTIPLE TIMES:
 *   Uses upsert (findOneAndUpdate with upsert:true) — will not create
 *   duplicates if the email already exists.
 *
 * WHAT IT DOES NOT DO:
 *   - Does NOT auto-run on server start
 *   - Does NOT print any password values
 *   - Does NOT expose the MongoDB URI
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const dns      = require('dns');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

// Use Google public DNS (same fix as db.js — campus DNS doesn't support SRV)
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedData = [
  {
    name:  'Test Citizen',
    email: process.env.SEED_CITIZEN_EMAIL  || 'citizen@rescuelink.dev',
    password: process.env.SEED_CITIZEN_PASSWORD || 'Citizen@123',
    phone: '9000000001',
    role:  'citizen',
  },
  {
    name:  'Test Responder',
    email: process.env.SEED_RESPONDER_EMAIL  || 'responder@rescuelink.dev',
    password: process.env.SEED_RESPONDER_PASSWORD || 'Responder@123',
    phone: '9000000002',
    role:  'responder',
  },
  {
    name:  'Test Admin',
    email: process.env.SEED_ADMIN_EMAIL  || 'admin@rescuelink.dev',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    phone: '9000000003',
    role:  'admin',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connected to MongoDB Atlas');

    for (const data of seedData) {
      const salt   = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(data.password, salt);

      const savedUser = await User.findOneAndUpdate(
        { email: data.email.toLowerCase() },
        {
          name:     data.name,
          email:    data.email.toLowerCase(),
          password: hashed,
          phone:    data.phone,
          role:     data.role,
          isActive: true,
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      if (data.role === 'responder') {
        const ResponderProfile = require('../models/ResponderProfile');
        await ResponderProfile.findOneAndUpdate(
          { user: savedUser._id },
          {
            user: savedUser._id,
            availability: 'available',
            latitude: 13.0827,
            longitude: 80.2707,
            serviceArea: 'Central Urban',
            rescueCapabilities: ['dog', 'cat', 'cattle', 'bird'],
            activeCaseCount: 0,
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      // Log role and email — never log the password
      console.log(`[SEED] ✅ ${data.role.padEnd(10)} → ${data.email}`);
    }

    console.log('[SEED] Done. All seed users created/updated.');
    process.exit(0);
  } catch (err) {
    console.error('[SEED] Error:', err.message);
    process.exit(1);
  }
};

seed();
