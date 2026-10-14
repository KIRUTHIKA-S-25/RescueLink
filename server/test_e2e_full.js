/**
 * test_e2e_full.js
 *
 * Full End-to-End Test Suite for RescueLink.
 * Tests Citizen (Kavin), Rescuer (Shavini), and Admin (Raksha) across all workflows:
 * - Authentication & Role Verification
 * - Incident Reporting & Spatial Urgency Triage
 * - Live Chatbot AI Status & First-Aid Queries
 * - Rescuer Case Acceptance, Progress Notes, and Verified Completion Proofs
 * - Citizen Feedback Submission
 * - Admin Analytics, Audit Trails, and CSV/PDF Data Exports
 */

const BASE_URL = 'http://localhost:5000/api';

const results = [];
function record(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} | ${testName}${details ? ' → ' + details : ''}`);
}

async function runFullE2ETest() {
  console.log('================================================================');
  console.log('   RescueLink End-to-End System Audit (Kavin, Shavini, Raksha)   ');
  console.log('================================================================\n');

  let kavinToken = null;
  let shaviniToken = null;
  let rakshaToken = null;

  let createdCaseId = null;

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: Authentication & User Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- PHASE 1: Authenticating Test Personas ---');

  // 1.1 Kavin (Citizen)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kavin@rescuelink.dev', password: 'Kavin@123' }),
    });
    const data = await res.json();
    kavinToken = data.data?.token;
    record('Citizen Login (Kavin)', res.status === 200 && kavinToken, `Role: ${data.data?.user?.role}, Name: ${data.data?.user?.name}`);
  } catch (err) {
    record('Citizen Login (Kavin)', false, err.message);
  }

  // 1.2 Shavini (Rescuer)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shavini@rescuelink.dev', password: 'Shavini@123' }),
    });
    const data = await res.json();
    shaviniToken = data.data?.token;
    record('Rescuer Login (Shavini)', res.status === 200 && shaviniToken, `Role: ${data.data?.user?.role}, Name: ${data.data?.user?.name}`);
  } catch (err) {
    record('Rescuer Login (Shavini)', false, err.message);
  }

  // 1.3 Raksha (Admin)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'raksha@rescuelink.dev', password: 'Raksha@123' }),
    });
    const data = await res.json();
    rakshaToken = data.data?.token;
    record('Admin Login (Raksha)', res.status === 200 && rakshaToken, `Role: ${data.data?.user?.role}, Name: ${data.data?.user?.name}`);
  } catch (err) {
    record('Admin Login (Raksha)', false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 2: Citizen Workflow (Kavin)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- PHASE 2: Citizen Workflow (Kavin) ---');

  // 2.1 Citizen views workspace notifications & my rescues
  try {
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${kavinToken}` },
    });
    const data = await res.json();
    record('Citizen Notification Center', res.status === 200, `Fetched ${data.data?.length || 0} notifications`);
  } catch (err) {
    record('Citizen Notification Center', false, err.message);
  }

  // 2.2 Citizen files emergency rescue report (with locationAddress, animal, urgency)
  try {
    const res = await fetch(`${BASE_URL}/rescues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kavinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        animalType: 'Dog',
        emergencyType: 'Accident',
        description: 'Injured Golden Retriever near Anna Nagar Roundtana, leg bleeding',
        latitude: 13.0850,
        longitude: 80.2100,
        locationAddress: 'Anna Nagar Roundtana, 2nd Avenue, Chennai',
        reporterName: 'Kavin',
        reporterContact: '9876543210',
      }),
    });

    const data = await res.json();
    if (res.status === 201 && data.data) {
      createdCaseId = data.data.caseId;
      record('Citizen Reports Distress Animal', true, `Case ID: ${createdCaseId}, Priority: ${data.data.priority}, Status: ${data.data.status}`);
    } else {
      record('Citizen Reports Distress Animal', false, data.message || `Status ${res.status}`);
    }
  } catch (err) {
    record('Citizen Reports Distress Animal', false, err.message);
  }

  // 2.3 Citizen verifies case in "My Reported Rescues"
  try {
    const res = await fetch(`${BASE_URL}/rescues/my`, {
      headers: { Authorization: `Bearer ${kavinToken}` },
    });
    const data = await res.json();
    const found = data.data?.some(c => c.caseId === createdCaseId);
    record('Citizen Incident History (My Rescues)', found, `Found ${data.data?.length || 0} cases on record`);
  } catch (err) {
    record('Citizen Incident History (My Rescues)', false, err.message);
  }

  // 2.4 Citizen opens Case Details and Timeline History via Human-Readable Reference
  try {
    const resCase = await fetch(`${BASE_URL}/rescues/${createdCaseId}`, {
      headers: { Authorization: `Bearer ${kavinToken}` },
    });
    const dataCase = await resCase.json();

    const resAct = await fetch(`${BASE_URL}/rescues/${createdCaseId}/activities`, {
      headers: { Authorization: `Bearer ${kavinToken}` },
    });
    const dataAct = await resAct.json();

    const pass = resCase.status === 200 && resAct.status === 200 && dataCase.data?.status === 'PENDING';
    record('Citizen View Case & Timeline History Details', pass, `Milestones on timeline: ${dataAct.data?.length}`);
  } catch (err) {
    record('Citizen View Case & Timeline History Details', false, err.message);
  }

  // 2.5 Citizen tests AI Chatbot Assistant for case tracking and first aid
  try {
    const resChat = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kavinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `What is the status of ${createdCaseId}?` }),
    });
    const dataChat = await resChat.json();
    const actions = dataChat.data?.suggestedActions || [];
    const hasNavButton = actions.some(a => a.path === `/rescues/${createdCaseId}`);
    record('AI Chatbot Case Status & Navigation Button', hasNavButton, `Action button: ${actions[0]?.label} (${actions[0]?.path})`);
  } catch (err) {
    record('AI Chatbot Case Status & Navigation Button', false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 3: Rescuer Workflow (Shavini)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- PHASE 3: Rescuer Workflow (Shavini) ---');

  // 3.1 Rescuer checks incoming available cases board
  try {
    const res = await fetch(`${BASE_URL}/rescues`, {
      headers: { Authorization: `Bearer ${shaviniToken}` },
    });
    const data = await res.json();
    const exists = data.data?.some(c => c.caseId === createdCaseId);
    record('Rescuer Incoming Incident Feed', res.status === 200 && exists, `Found ${data.data?.length} active pool cases`);
  } catch (err) {
    record('Rescuer Incoming Incident Feed', false, err.message);
  }

  // 3.2 Rescuer accepts the case (Atomic acceptance & capacity lock)
  try {
    const res = await fetch(`${BASE_URL}/rescues/${createdCaseId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${shaviniToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.data?.status === 'ACCEPTED' && data.data?.assignedResponder?.name === 'Shavini';
    record('Rescuer Accepts Incident (Atomic Lock)', pass, `Status: ${data.data?.status}, Assigned: ${data.data?.assignedResponder?.name}`);
  } catch (err) {
    record('Rescuer Accepts Incident (Atomic Lock)', false, err.message);
  }

  // 3.3 Rescuer starts the rescue (IN_PROGRESS)
  try {
    const res = await fetch(`${BASE_URL}/rescues/${createdCaseId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${shaviniToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.data?.status === 'IN_PROGRESS';
    record('Rescuer Starts Field Transit (IN_PROGRESS)', pass, `Status updated to: ${data.data?.status}`);
  } catch (err) {
    record('Rescuer Starts Field Transit (IN_PROGRESS)', false, err.message);
  }

  // 3.4 Rescuer adds an on-scene progress update note
  try {
    const res = await fetch(`${BASE_URL}/rescues/${createdCaseId}/updates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${shaviniToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Rescuer Shavini reached Anna Nagar roundtana. Dog secured with muzzle and calming blanket.' }),
    });
    const data = await res.json();
    record('Rescuer Posts Field Progress Note', res.status === 201, data.message || 'Note recorded');
  } catch (err) {
    record('Rescuer Posts Field Progress Note', false, err.message);
  }

  // 3.5 Rescuer marks case as RESCUED with proof and completion note
  try {
    const res = await fetch(`${BASE_URL}/rescues/${createdCaseId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${shaviniToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'RESCUED',
        proofImageUrl: 'https://res.cloudinary.com/cqiw2jt1/image/upload/v1791920151/rescuelink_test/jypn3mixuzcqmopzlisr.png',
        completionNote: 'Dog admitted to Anna Nagar Emergency Veterinary Clinic. Bleeding stopped, splint applied.',
        handoverDestination: 'Anna Nagar Veterinary Clinic',
      }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.data?.status === 'RESCUED';
    record('Rescuer Completes Mission (RESCUED)', pass, `Outcome: ${data.data?.status}, Handover: ${data.data?.verification?.handoverDestination}`);
  } catch (err) {
    record('Rescuer Completes Mission (RESCUED)', false, err.message);
  }

  // 3.6 Rescuer personal workload & performance metrics check
  try {
    const res = await fetch(`${BASE_URL}/rescues/my-stats`, {
      headers: { Authorization: `Bearer ${shaviniToken}` },
    });
    const data = await res.json();
    const stats = data.data?.summary;
    const pass = res.status === 200 && stats && stats.completedRescues >= 1;
    record('Rescuer Personal Metrics & Analytics Hub', pass, `Completed Rescues: ${stats?.completedRescues}, Active Concurrency: ${stats?.activeCases}/3`);
  } catch (err) {
    record('Rescuer Personal Metrics & Analytics Hub', false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 4: Citizen Feedback Submission (Kavin)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- PHASE 4: Citizen Post-Rescue Feedback (Kavin) ---');

  try {
    const res = await fetch(`${BASE_URL}/rescues/${createdCaseId}/feedback`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kavinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating: 5,
        comment: 'Outstanding and compassionate response by Shavini! The dog is now safe at the clinic.',
      }),
    });
    const data = await res.json();
    record('Citizen Rating & Feedback Submission', res.status === 200, `Feedback: 5 Stars saved`);
  } catch (err) {
    record('Citizen Rating & Feedback Submission', false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 5: Admin Workflow (Raksha)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- PHASE 5: Administrator Workflow (Raksha) ---');

  // 5.1 Admin Analytics KPIs (Total cases, resolution rate, escalation breakdown)
  let analyticsData = null;
  try {
    const res = await fetch(`${BASE_URL}/admin/analytics?range=30d`, {
      headers: { Authorization: `Bearer ${rakshaToken}` },
    });
    const data = await res.json();
    analyticsData = data.data;
    const cards = analyticsData?.summaryCards;
    const pass = res.status === 200 && cards && cards.totalCases > 0;
    record('Admin Analytics KPIs', pass, `Total Cases: ${cards?.totalCases}, Today: ${cards?.newToday}, Rescued: ${cards?.rescuedCases}, Success Rate: ${cards?.rescueSuccessRate}%`);
  } catch (err) {
    record('Admin Analytics KPIs', false, err.message);
  }

  // 5.2 Admin Live System Audit Log
  try {
    const res = await fetch(`${BASE_URL}/admin/audit`, {
      headers: { Authorization: `Bearer ${rakshaToken}` },
    });
    const data = await res.json();
    const pass = res.status === 200 && Array.isArray(data.data);
    record('Admin Security & Audit Trail', pass, `Audit events captured: ${data.data?.length}`);
  } catch (err) {
    record('Admin Security & Audit Trail', false, err.message);
  }

  // 5.3 Admin Rescuer Performance Monitoring
  try {
    const responders = analyticsData?.visualizations?.rescuerPerformance || [];
    const shavini = responders.find(r => r.name === 'Shavini');
    const pass = shavini && shavini.completedCount >= 1;
    record('Admin Rescuer Directory & Performance Monitoring', pass, `Found Shavini with completed rescues: ${shavini?.completedCount}, current workload: ${shavini?.currentWorkload}`);
  } catch (err) {
    record('Admin Rescuer Directory & Performance Monitoring', false, err.message);
  }

  // 5.4 Admin CSV Report Export Download
  try {
    const res = await fetch(`${BASE_URL}/admin/export?type=complete&format=csv&range=30d`, {
      headers: { Authorization: `Bearer ${rakshaToken}` },
    });
    const csvText = await res.text();
    const pass = res.status === 200 && csvText.includes('Case ID') && csvText.includes('Animal Type');
    record('Admin CSV Incident Report Export', pass, `Downloaded CSV size: ${csvText.length} bytes`);
  } catch (err) {
    record('Admin CSV Incident Report Export', false, err.message);
  }

  // 5.5 Admin PDF Report Export Download
  try {
    const res = await fetch(`${BASE_URL}/admin/export?type=complete&format=pdf&range=30d`, {
      headers: { Authorization: `Bearer ${rakshaToken}` },
    });
    const pdfBuffer = await res.arrayBuffer();
    const pass = res.status === 200 && pdfBuffer.byteLength > 1000;
    record('Admin PDF Incident Report Export', pass, `Generated PDF document size: ${pdfBuffer.byteLength} bytes`);
  } catch (err) {
    record('Admin PDF Incident Report Export', false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('                    E2E TEST SUMMARY RESULTS                    ');
  console.log('================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(`Total Scenarios Tested : ${totalCount}`);
  console.log(`Passed                 : ${passedCount}`);
  console.log(`Failed                 : ${totalCount - passedCount}`);
  console.log(`Success Rate           : ${((passedCount / totalCount) * 100).toFixed(1)}%\n`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL END-TO-END SCENARIOS PASSED WITH 100% SUCCESS!');
  } else {
    console.log('⚠️ Some scenarios had issues. Review logs above.');
  }
}

runFullE2ETest().catch(err => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
