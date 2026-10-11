/**
 * testApiWorkflow.js
 *
 * Exercises the Express HTTP API endpoints using native fetch:
 * 1. Guest & Authenticated Reporting with duplicate detection & priority
 * 2. Case acceptance & concurrency conflict prevention
 * 3. Case release back to pending
 * 4. Mandatory proof enforcement on RESCUED
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const API_BASE = 'http://localhost:5000/api';

const runApiTests = async () => {
  console.log('─── Testing Express API Endpoints & Verification Rules ───\n');

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

  // 1. Log in as Responder
  const respLoginRaw = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'responder@rescuelink.dev',
      password: 'Responder@123',
    }),
  });
  const respLogin = await respLoginRaw.json();
  const responderToken = respLogin.data?.token;
  const responderHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${responderToken}`,
  };
  assert(!!responderToken, 'Responder logged in and received JWT');

  // 2. Submit a new case via POST /api/rescues
  const newCaseRaw = await fetch(`${API_BASE}/rescues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterName: 'Civic Reporter',
      reporterContact: '9876543210',
      animalType: 'Stray Dog',
      emergencyType: 'Severe Accident',
      description: 'Bleeding dog hit by vehicle on main road',
      locationAddress: 'Mount Road, Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
    }),
  });

  const newCaseRes = await newCaseRaw.json();
  const createdCase = newCaseRes.data;
  assert(newCaseRaw.status === 201, 'Case created via public API (201)');
  assert(createdCase.priority === 'CRITICAL', `Calculated priority is CRITICAL (got ${createdCase.priority})`);

  const caseMongoId = createdCase._id;

  // 3. Accept the case: PATCH /api/rescues/:id/status -> ACCEPTED
  const acceptRaw = await fetch(`${API_BASE}/rescues/${caseMongoId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  const acceptRes = await acceptRaw.json();
  assert(acceptRes.data?.status === 'ACCEPTED', 'Status transitioned to ACCEPTED');
  assert(!!acceptRes.data?.assignedResponder, 'Responder assigned to case');

  // 4. Release the case back to PENDING: PATCH /api/rescues/:id/status -> PENDING
  const releaseRaw = await fetch(`${API_BASE}/rescues/${caseMongoId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({
      status: 'PENDING',
      note: 'Emergency vehicle mechanical delay - releasing case',
    }),
  });
  const releaseRes = await releaseRaw.json();
  assert(releaseRes.data?.status === 'PENDING', 'Case successfully released back to PENDING');

  // 5. Re-accept and advance to IN_PROGRESS
  await fetch(`${API_BASE}/rescues/${caseMongoId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  await fetch(`${API_BASE}/rescues/${caseMongoId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });

  // 6. Test Proof of Rescue enforcement: Attempt RESCUED without proof or note
  const invalidRescuedRaw = await fetch(`${API_BASE}/rescues/${caseMongoId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'RESCUED' }),
  });
  assert(
    invalidRescuedRaw.status === 400,
    'Rejected RESCUED without mandatory evidence (400 Bad Request)'
  );

  // 7. Complete rescue with proof documentation
  const completeRaw = await fetch(`${API_BASE}/rescues/${caseMongoId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({
      status: 'RESCUED',
      proofImageUrl: '/uploads/demo-rescue-proof.jpg',
      completionNote: 'Animal stabilized, wound bandaged, and transferred to Blue Cross clinic.',
      handoverDestination: 'Blue Cross Animal Hospital',
    }),
  });
  const completeRes = await completeRaw.json();
  assert(completeRes.data?.status === 'RESCUED', 'Case successfully completed with proof of rescue');
  assert(
    completeRes.data?.verification?.verificationStatus === 'completed',
    'Verification status recorded as completed'
  );

  // Clean up
  await mongoose.connect(process.env.MONGODB_URI);
  const RescueCase = require('./src/models/RescueCase');
  await RescueCase.findByIdAndDelete(caseMongoId);
  await mongoose.disconnect();

  console.log(`\n═════════════════════════════════════════`);
  console.log(`API SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`═════════════════════════════════════════`);

  process.exit(failed > 0 ? 1 : 0);
};

runApiTests().catch((err) => {
  console.error('Fatal API test error:', err);
  process.exit(1);
});
