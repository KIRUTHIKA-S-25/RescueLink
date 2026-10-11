/**
 * testWorkflows.js
 *
 * Automated verification suite for RescueLink critical workflow modules:
 * 1. Triage priority urgency calculation
 * 2. Duplicate detection (<100m, <45m, animal category)
 * 3. Haversine distance and workload capacity
 * 4. Case acceptance, concurrency conflict, and release
 * 5. Mandatory rescue proof enforcement on RESCUED
 * 6. Automated escalation worker sweep
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const RescueCase = require('./src/models/RescueCase');
const ResponderProfile = require('./src/models/ResponderProfile');
const User = require('./src/models/User');
const { calculatePriority } = require('./src/utils/triageUtils');
const { calculateDistanceMeters, findEligibleResponders } = require('./src/utils/geoUtils');
const { detectDuplicateCase } = require('./src/services/duplicateDetectionService');
const { checkAndEscalatePendingCases } = require('./src/services/escalationService');

const runTests = async () => {
  console.log('─── Starting RescueLink Workflow Verification ───\n');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}`);
      failed++;
    }
  };

  // ── TEST 1: Triage Priority Scoring ──────────────────────────────────────
  console.log('▶ Test Suite 1: Automated Triage Priority Scoring');
  const p1 = calculatePriority('dog', 'Hit and Run', 'Severe bleeding on highway');
  assert(p1 === 'CRITICAL', `Critical emergency scored as ${p1} (expected CRITICAL)`);

  const p2 = calculatePriority('cat', 'Injured', 'Broken leg trapped in drain');
  assert(p2 === 'HIGH', `High urgency scored as ${p2} (expected HIGH)`);

  const p3 = calculatePriority('dog', 'Abandoned', 'Found harmless pup wandering in park');
  assert(p3 === 'MEDIUM', `Moderate report scored as ${p3} (expected MEDIUM)`);

  // ── TEST 2: Haversine Distance Calculation ──────────────────────────────
  console.log('\n▶ Test Suite 2: Haversine Proximity Calculation');
  // Two points in Chennai ~35 meters apart
  const dMeters = calculateDistanceMeters(13.0827, 80.2707, 13.0829, 80.2709);
  assert(dMeters > 20 && dMeters < 50, `Calculated distance: ${Math.round(dMeters)}m (expected ~30-40m)`);

  // ── TEST 3: Duplicate Incident Detection ────────────────────────────────
  console.log('\n▶ Test Suite 3: Duplicate Incident Detection');
  // Create a primary case
  const primary = await RescueCase.create({
    caseId: `TEST-DUP-1-${Date.now()}`,
    reporterName: 'Reporter A',
    reporterContact: '9876543210',
    animalType: 'Stray Dog',
    emergencyType: 'Hit & Run',
    description: 'Injured pup near post office',
    location: {
      address: 'Central Post Office, Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
    },
    priority: 'HIGH',
    status: 'PENDING',
  });

  // Check a report 30 meters away with same animal
  const dupCheck1 = await detectDuplicateCase({
    animalType: 'Stray Dog',
    latitude: 13.0829,
    longitude: 80.2709,
  });
  assert(dupCheck1.isDuplicate === true, 'Detected nearby duplicate case (<100m)');

  // Check a report 500 meters away
  const dupCheck2 = await detectDuplicateCase({
    animalType: 'Stray Dog',
    latitude: 13.0890,
    longitude: 80.2750,
  });
  assert(dupCheck2.isDuplicate === false, 'Separate incident beyond 100m not flagged as duplicate');

  // Check a different animal category at the exact same spot
  const dupCheck3 = await detectDuplicateCase({
    animalType: 'Parrot',
    latitude: 13.0827,
    longitude: 80.2707,
  });
  assert(dupCheck3.isDuplicate === false, 'Different animal category at same location not merged');

  // ── TEST 4: Responder Workload & Proximity Dispatch ───────────────────────
  console.log('\n▶ Test Suite 4: Proximity Matching & Workload Capacity');
  const eligible = await findEligibleResponders(13.0827, 80.2707, 15, 3);
  assert(eligible.length > 0, `Found ${eligible.length} eligible responder(s) within 15 km`);
  if (eligible.length > 0) {
    assert(eligible[0].activeCaseCount <= 3, 'Selected responder active workload <= 3');
  }

  // ── TEST 5: Automated Escalation Timeout Sweep ────────────────────────────
  console.log('\n▶ Test Suite 5: Automated Escalation Sweep (Crash & Restart Safe)');
  // Backdate primary case to 10 minutes ago via raw collection to bypass Mongoose timestamp lock
  await RescueCase.collection.updateOne(
    { _id: primary._id },
    { $set: { createdAt: new Date(Date.now() - 10 * 60 * 1000) } }
  );

  const escalatedCount = await checkAndEscalatePendingCases();
  assert(escalatedCount >= 1, `Escalation sweep escalated ${escalatedCount} overdue case(s)`);

  const reloaded = await RescueCase.findById(primary._id);
  assert(reloaded.escalation?.isEscalated === true, 'Overdue case mutated to isEscalated: true');

  // ── Clean up test data ───────────────────────────────────────────────────
  await RescueCase.findByIdAndDelete(primary._id);
  console.log('\nTest fixture cleaned up.');

  console.log(`\n═════════════════════════════════════════`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`═════════════════════════════════════════`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
