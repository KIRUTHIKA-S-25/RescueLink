require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const dns = require('dns');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ResponderProfile = require('../models/ResponderProfile');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const usersToSeed = [
  {
    name: 'Kavin',
    email: 'kavin@rescuelink.dev',
    password: 'Kavin@123',
    phone: '9876543210',
    role: 'citizen',
  },
  {
    name: 'Shavini',
    email: 'shavini@rescuelink.dev',
    password: 'Shavini@123',
    phone: '9876543211',
    role: 'responder',
    badgeNumber: 'RESP-SHAVINI-01',
    skills: ['Canine Rescue', 'Trauma First Aid', 'Avian Handling'],
    vehicleType: 'Animal Ambulance Van',
    latitude: 13.0827,
    longitude: 80.2707,
    serviceArea: 'Central Urban',
  },
  {
    name: 'Raksha',
    email: 'raksha@rescuelink.dev',
    password: 'Raksha@123',
    phone: '9876543212',
    role: 'admin',
  },
];

async function seedNamedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connected to MongoDB Atlas');

    for (const data of usersToSeed) {
      const salt = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(data.password, salt);

      const savedUser = await User.findOneAndUpdate(
        { email: data.email.toLowerCase() },
        {
          name: data.name,
          email: data.email.toLowerCase(),
          password: hashed,
          phone: data.phone,
          role: data.role,
          isActive: true,
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      console.log(`[SEED] Upserted ${data.role}: ${data.name} (${data.email})`);

      if (data.role === 'responder') {
        await ResponderProfile.findOneAndUpdate(
          { user: savedUser._id },
          {
            user: savedUser._id,
            availability: 'available',
            latitude: data.latitude,
            longitude: data.longitude,
            serviceArea: data.serviceArea,
            badgeNumber: data.badgeNumber,
            skills: data.skills,
            vehicleType: data.vehicleType,
            verified: true,
            activeCasesCount: 0,
            maxConcurrentCases: 3,
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log(`[SEED] Created/Updated ResponderProfile for ${data.name}`);
      }
    }

    console.log('[SEED] All test users (Kavin, Shavini, Raksha) seeded successfully!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  }
}

seedNamedUsers();
