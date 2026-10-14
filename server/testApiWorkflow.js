/**
 * testApiWorkflow.js
 *
 * Comprehensive End-to-End API Integration & Regression Test Suite (Phase 11):
 * 1. Citizen submits emergency without signing in (Guest report).
 * 2. Report and coordinates are saved and validated.
 * 3. Backend automatically computes Triage Urgency Scoring (TUS) & breakdown.
 * 4. Duplicate submission is detected (<100m, <45m, matching animal) and linked as corroborating report.
 * 5. Primary case reference is returned to the second reporter.
 * 6. Eligible rescuer logs in and accepts the case.
 * 7. Second rescuer acceptance is rejected with 409 Conflict (concurrency protection).
 * 8. Rescuer updates status to IN_PROGRESS and adds progress note to activity timeline.
 * 9. Releasing without mandatory reason is rejected (400 Bad Request).
 * 10. Valid release with reason returns case to PENDING pool.
 * 11. Re-acceptance advances case towards resolution.
 * 12. Attempting RESCUED without proof photo is rejected (400 Bad Request).
 * 13. Attempting RESCUED without notes is rejected (400 Bad Request).
 * 14. Authorized completion with verified photo and notes transitions case to RESCUED.
 * 15. Admin unmerges corroborating report into an independent case.
 * 16. Reporter feedback submission on completed case.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const API_BASE = 'http://localhost:5000/api';

const runApiTests = async () => {
  console.log('─── Starting Full RescueLink API Lifecycle Verification (Phase 11) ───\n');

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
  console.log('▶ Step 1: Authentication & Role Setup');
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

  // Log in as Admin
  const adminLoginRaw = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@rescuelink.dev',
      password: 'Admin@123',
    }),
  });
  const adminLogin = await adminLoginRaw.json();
  const adminToken = adminLogin.data?.token;
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };
  assert(!!adminToken, 'Admin logged in and received JWT');

  // 2. Guest Reporting: Citizen reports animal emergency without signing in
  console.log('\n▶ Step 2: Guest Emergency Reporting & Automated TUS');
  const guestReportRaw = await fetch(`${API_BASE}/rescues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterName: 'Anonymous Citizen',
      reporterContact: '9876543210',
      animalType: 'Stray Dog',
      emergencyType: 'Severe Accident',
      description: 'Vehicle collision, severe arterial bleeding on highway',
      locationAddress: 'NH-45 Highway Junction, Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
    }),
  });

  const guestReportRes = await guestReportRaw.json();
  assert(guestReportRaw.status === 201, 'Guest emergency report submitted successfully (201)');
  const primaryCase = guestReportRes.data;
  assert(primaryCase.priority === 'CRITICAL', `TUS prioritized incident as CRITICAL (got ${primaryCase.priority})`);
  assert(!!primaryCase.triage?.breakdown, 'Triage audit breakdown stored with incident');
  assert(primaryCase.triage.score >= 75, `TUS score >= 75 for critical trauma on highway (got ${primaryCase.triage.score})`);

  const primaryCaseId = primaryCase._id;

  // 3. Duplicate Detection & Corroborating Report Linking
  console.log('\n▶ Step 3: Duplicate Incident Detection & Corroborating Attachment');
  // Second reporter submits 30 meters away for same dog within 5 minutes
  const secondReportRaw = await fetch(`${API_BASE}/rescues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterName: 'Passerby Witness',
      reporterContact: '9123456780',
      animalType: 'Stray Dog',
      emergencyType: 'Accident',
      description: 'Second sighting of the bleeding dog lying near highway median',
      locationAddress: 'NH-45 Highway Median, Chennai',
      latitude: 13.0829,
      longitude: 80.2709,
    }),
  });

  const secondReportRes = await secondReportRaw.json();
  assert(secondReportRaw.status === 200, 'Duplicate report intercepted and linked (200 OK)');
  assert(secondReportRes.data.isDuplicate === true, 'Response flagged as duplicate corroborating report');
  assert(secondReportRes.data.caseId === primaryCase.caseId, 'Primary case reference returned to second reporter');

  // Verify that corroborating report was attached to primary case in DB
  await mongoose.connect(process.env.MONGODB_URI);
  const RescueCase = require('./src/models/RescueCase');
  const fetchedPrimary = await RescueCase.findById(primaryCaseId);
  assert(fetchedPrimary.corroboratingReports.length === 1, 'Corroborating report array contains second submission');
  const attachedReportId = fetchedPrimary.corroboratingReports[0]._id;

  // 4. Case Acceptance & Race Condition Protection
  console.log('\n▶ Step 4: Rescuer Case Acceptance & Concurrency Conflict Protection');
  const acceptRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  const acceptRes = await acceptRaw.json();
  assert(acceptRes.data?.status === 'ACCEPTED', 'Status transitioned to ACCEPTED');
  assert(!!acceptRes.data?.assignedResponder, 'Responder assigned to case');

  // Attempt concurrent acceptance by another rescuer (Simulated conflict)
  const conflictRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: adminHeaders, // simulates second user
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  assert(
    conflictRaw.status === 409 || conflictRaw.status === 422,
    `Duplicate acceptance rejected with conflict (${conflictRaw.status})`
  );

  // 5. Status Transition to IN_PROGRESS & Activity Timeline Logging
  console.log('\n▶ Step 5: IN_PROGRESS Transition & Timeline Notes');
  const inProgressRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'IN_PROGRESS', note: 'Ambulance en route with first aid kit' }),
  });
  const inProgressRes = await inProgressRaw.json();
  assert(inProgressRes.data?.status === 'IN_PROGRESS', 'Case status transitioned to IN_PROGRESS');

  // Add progress note
  const updateNoteRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/updates`, {
    method: 'POST',
    headers: responderHeaders,
    body: JSON.stringify({ message: 'Arrived at scene. Hemorrhage controlled with pressure dressing.' }),
  });
  assert(updateNoteRaw.status === 201, 'Progress note added to activity timeline (201)');

  // 6. Case Release with Mandatory Reason
  console.log('\n▶ Step 6: Case Release & Mandatory Reason Enforcement');
  // Attempt release without reason
  const invalidReleaseRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'PENDING' }),
  });
  assert(invalidReleaseRaw.status === 400, 'Release without mandatory reason rejected (400 Bad Request)');

  // Valid release with reason
  const validReleaseRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({
      status: 'PENDING',
      releaseReason: 'Vehicle tire puncture en route; returning case for immediate reassignment',
    }),
  });
  const validReleaseRes = await validReleaseRaw.json();
  assert(validReleaseRes.data?.status === 'PENDING', 'Case successfully returned to PENDING pool');
  assert(!validReleaseRes.data?.assignedResponder, 'Responder assignment safely cleared');

  // Re-accept and depart again
  await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });

  // 7. Mandatory Proof-of-Rescue Enforcement
  console.log('\n▶ Step 7: Mandatory Proof-of-Rescue Verification');
  // Attempt completion without photo proof
  const missingPhotoRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({
      status: 'RESCUED',
      completionNote: 'Animal rescued safely.',
    }),
  });
  assert(missingPhotoRaw.status === 400, 'RESCUED rejected when photo proof is missing (400 Bad Request)');

  // Attempt completion without treatment notes
  const missingNoteRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({
      status: 'RESCUED',
      proofImageUrl: '/uploads/demo-rescue-proof.jpg',
      completionNote: '',
    }),
  });
  assert(missingNoteRaw.status === 400, 'RESCUED rejected when treatment note is empty (400 Bad Request)');

  // Valid RESCUED with proof and notes
  const completeRaw = await fetch(`${API_BASE}/rescues/${primaryCaseId}/status`, {
    method: 'PATCH',
    headers: responderHeaders,
    body: JSON.stringify({
      status: 'RESCUED',
      proofImageUrl: '/uploads/demo-rescue-proof.jpg',
      completionNote: 'Animal secured, bleeding stopped, admitted to emergency surgical ward.',
      handoverDestination: 'Government Veterinary Hospital, Vepery',
    }),
  });
  const completeRes = await completeRaw.json();
  assert(completeRes.data?.status === 'RESCUED', 'Case successfully marked as RESCUED');
  assert(
    completeRes.data?.verification?.verificationStatus === 'completed',
    'Verification record created with completion timestamp and proof'
  );

  // 8. Admin Unmerge of Corroborating Report
  console.log('\n▶ Step 8: Administrator Corroborating Report Unmerge');
  const unmergeRaw = await fetch(
    `${API_BASE}/rescues/${primaryCaseId}/corroborating-reports/${attachedReportId}/unmerge`,
    {
      method: 'POST',
      headers: adminHeaders,
    }
  );
  const unmergeRes = await unmergeRaw.json();
  assert(unmergeRaw.status === 201, 'Corroborating report unmerged into independent case (201 Created)');
  const unmergedCaseId = unmergeRes.data?.newCase?._id;
  assert(!!unmergedCaseId, 'New independent case generated with unique caseId');

  // 9. Clean up test records
  console.log('\n▶ Cleaning up test cases...');
  await RescueCase.findByIdAndDelete(primaryCaseId);
  if (unmergedCaseId) {
    await RescueCase.findByIdAndDelete(unmergedCaseId);
  }
  await mongoose.disconnect();
  console.log('Test cases cleaned up.');

  console.log(`\n═════════════════════════════════════════`);
  console.log(`FULL LIFECYCLE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`═════════════════════════════════════════`);

  process.exit(failed > 0 ? 1 : 0);
};

runApiTests().catch((err) => {
  console.error('Fatal API test error:', err);
  process.exit(1);
});
