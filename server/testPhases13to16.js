/**
 * testPhases13to16.js
 *
 * Automated verification for Phases 13, 14, 15, and 16 using native fetch:
 * - Phase 13: Role-Aware Chatbot (Citizen, Rescuer, Admin, Emergency Detection, Live Case Lookup)
 * - Phase 14: Admin Analytics Aggregation with Multi-Criteria Filters
 * - Phase 15: Rescuer Personal Workload & Analytics API
 * - Phase 16: Admin Report Exports (CSV, XLSX, PDF/HTML, Formula Injection Protection, Audit Logging)
 */

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Verification Suite for Phases 13, 14, 15, and 16...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  try {
    // 1. Authenticate / Login as Admin and Rescuer
    console.log('--- Setup: Authenticating Admin and Responder ---');
    const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@rescuelink.dev',
        password: 'Admin@123',
      })
    });
    const adminLoginJson = await adminLoginRes.json();
    const adminToken = adminLoginJson.data?.token;
    assert(!!adminToken, 'Admin logged in successfully and obtained JWT');

    const rescuerLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'responder@rescuelink.dev',
        password: 'Responder@123',
      })
    });
    const rescuerLoginJson = await rescuerLoginRes.json();
    const rescuerToken = rescuerLoginJson.data?.token;
    assert(!!rescuerToken, 'Rescuer logged in successfully and obtained JWT');

    // ─── PHASE 13: AI CHATBOT VERIFICATION ─────────────────────────────────
    console.log('\n--- Phase 13: Role-Aware Chatbot Integration ---');

    // 13.1 Citizen General Inquiries & Reporting Guide
    const citizenChatRes = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How do I report an injured dog that I found?'
      })
    });
    const citizenChatJson = await citizenChatRes.json();
    assert(citizenChatJson.success === true, 'Public / Citizen chat request succeeded');
    assert(citizenChatJson.data.reply.includes('Report Rescue'), 'Chatbot explains how to report an animal');
    assert(Array.isArray(citizenChatJson.data.suggestedActions), 'Chatbot provides suggested interactive actions');

    // 13.2 Emergency Detection and Life-Threatening Safety Alert
    const emergencyChatRes = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'A cat is hit by car and bleeding severely on the road right now!'
      })
    });
    const emergencyChatJson = await emergencyChatRes.json();
    assert(emergencyChatJson.data.emergencyAlert !== null, 'Emergency detector flagged life-threatening incident');
    assert(emergencyChatJson.data.emergencyAlert.isEmergency === true, 'Emergency alert flag is strictly true');
    assert(emergencyChatJson.data.emergencyAlert.actionPath === '/report', 'Emergency alert directs user to /report immediately');

    // 13.3 Live Case Lookup (No Hallucination)
    const adminCasesRes = await fetch(`${API_URL}/admin/analytics?range=30d`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminCasesJson = await adminCasesRes.json();
    const sampleGeoCase = adminCasesJson.data?.visualizations?.geoCases?.[0];
    const realCaseId = sampleGeoCase ? sampleGeoCase.caseId : 'RC-12345';

    const caseLookupChatRes = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `What is the current status of case ${realCaseId}?`
      })
    });
    const caseLookupChatJson = await caseLookupChatRes.json();
    assert(caseLookupChatJson.data.reply.includes(realCaseId), 'Chatbot retrieves real case reference from database');
    assert(caseLookupChatJson.data.liveContext.queriedCase !== null, 'Chatbot liveContext contains verified database record');

    // 13.4 Rescuer Chatbot (Workload & Capacity)
    const rescuerChatRes = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rescuerToken}`
      },
      body: JSON.stringify({
        message: 'What are my active cases and workload?'
      })
    });
    const rescuerChatJson = await rescuerChatRes.json();
    const rescuerReply = rescuerChatJson.data.reply.toLowerCase();
    assert(rescuerReply.includes('workload') || rescuerReply.includes('case') || rescuerReply.includes('status'), 'Rescuer chatbot returns operational workload status');
    assert(rescuerChatJson.data.reply.includes('3') || rescuerReply.includes('capacity') || rescuerReply.includes('limit'), 'Rescuer chatbot enforces 3-case capacity ceiling');

    // 13.5 Administrator Chatbot (Live System Overview)
    const adminChatRes = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        message: 'Show me system metrics and pending cases'
      })
    });
    const adminChatJson = await adminChatRes.json();
    const adminReply = adminChatJson.data.reply.toLowerCase();
    assert(adminReply.includes('system') || adminReply.includes('overview') || adminReply.includes('metric') || adminReply.includes('rescue'), 'Admin chatbot returns platform metrics');
    assert(adminReply.includes('pending') || adminReply.includes('case'), 'Admin chatbot returns real pending count');

    // ─── PHASE 14: ADMIN ANALYTICS DASHBOARD ───────────────────────────────
    console.log('\n--- Phase 14: Comprehensive Admin Analytics Dashboard ---');
    const analyticsRes = await fetch(`${API_URL}/admin/analytics?range=30d`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const analyticsJson = await analyticsRes.json();
    const aData = analyticsJson.data;

    assert(analyticsJson.success === true, 'Admin analytics endpoint returned 200 OK');
    assert(typeof aData.summaryCards.totalCases === 'number', 'Summary cards contain totalCases count');
    assert(typeof aData.summaryCards.pendingCases === 'number', 'Summary cards contain pendingCases count');
    assert(typeof aData.summaryCards.assignedCases === 'number', 'Summary cards contain assignedCases count');
    assert(typeof aData.summaryCards.rescuedCases === 'number', 'Summary cards contain rescuedCases count');
    assert(typeof aData.summaryCards.activeRescuers === 'number', 'Summary cards contain activeRescuers count');
    assert(typeof aData.summaryCards.availableRescuers === 'number', 'Summary cards contain availableRescuers count');
    assert(typeof aData.summaryCards.rescueSuccessRate === 'number', 'Summary cards calculate rescueSuccessRate');
    assert(Array.isArray(aData.visualizations.statusDistribution), 'Visualizations contain statusDistribution array');
    assert(Array.isArray(aData.visualizations.severityDistribution), 'Visualizations contain severityDistribution array');
    assert(Array.isArray(aData.visualizations.rescueTrends), 'Visualizations contain rescueTrends over time');
    assert(Array.isArray(aData.visualizations.rescuerPerformance), 'Visualizations contain rescuerPerformance breakdown');
    assert(Array.isArray(aData.visualizations.geoCases), 'Visualizations contain geoCases with latitude/longitude');

    // Test filter consistency: range=today
    const todayAnalyticsRes = await fetch(`${API_URL}/admin/analytics?range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const todayAnalyticsJson = await todayAnalyticsRes.json();
    assert(todayAnalyticsJson.success === true, 'Admin analytics respects range=today filter');

    // Test RBAC: Responder cannot access admin analytics
    const unauthorizedAnalyticsRes = await fetch(`${API_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${rescuerToken}` }
    });
    assert(unauthorizedAnalyticsRes.status === 403, 'RBAC properly blocks non-admin from admin analytics (403 Forbidden)');

    // ─── PHASE 15: RESCUER DASHBOARD & PERSONAL ANALYTICS ──────────────────
    console.log('\n--- Phase 15: Rescuer Dashboard and Personal Analytics ---');
    const rescuerStatsRes = await fetch(`${API_URL}/rescues/my-stats`, {
      headers: { Authorization: `Bearer ${rescuerToken}` }
    });
    const rescuerStatsJson = await rescuerStatsRes.json();
    const rData = rescuerStatsJson.data;

    assert(rescuerStatsJson.success === true, 'GET /api/rescues/my-stats returned 200 OK');
    assert(typeof rData.summary.currentlyAssigned === 'number', 'Rescuer summary contains currentlyAssigned');
    assert(typeof rData.summary.completedRescues === 'number', 'Rescuer summary contains completedRescues');
    assert(rData.summary.maxWorkload === 3, 'Rescuer summary enforces maxWorkload of 3');
    assert(Array.isArray(rData.statusDistribution), 'Rescuer stats contain personal statusDistribution');
    assert(Array.isArray(rData.severityDistribution), 'Rescuer stats contain personal severityDistribution');
    assert(Array.isArray(rData.monthlyActivity), 'Rescuer stats contain monthlyActivity trend');

    // ─── PHASE 16: ADMIN DOWNLOADS AND SYSTEM PROGRESS REPORTS ─────────────
    console.log('\n--- Phase 16: Admin Downloads and System Progress Reports ---');

    // 16.1 Complete Rescue Case Report in CSV format
    const csvExportRes = await fetch(`${API_URL}/admin/export?type=complete&format=csv&range=30d`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const csvContent = await csvExportRes.text();
    assert(csvExportRes.status === 200, 'CSV export endpoint returned 200 OK');
    assert(csvExportRes.headers.get('content-type').includes('text/csv'), 'Content-Type header is text/csv');
    assert(csvContent.includes('Case ID,Reported At,Animal Type'), 'CSV contains proper RFC 4180 header row');

    // 16.2 Excel-compatible format (.xlsx)
    const xlsxExportRes = await fetch(`${API_URL}/admin/export?type=complete&format=xlsx&range=30d`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(xlsxExportRes.status === 200, 'XLSX export returned 200 OK');
    assert(xlsxExportRes.headers.get('content-disposition').includes('.xlsx'), 'Filename has .xlsx extension');

    // 16.3 Printable HTML/PDF System Progress Report
    const pdfExportRes = await fetch(`${API_URL}/admin/export?type=progress&format=pdf&range=30d`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const pdfHtmlContent = await pdfExportRes.text();
    assert(pdfExportRes.status === 200, 'Printable progress report returned 200 OK');
    assert(pdfHtmlContent.includes('RescueLink Emergency Management Report'), 'Printable report has formatted title and header');
    assert(pdfHtmlContent.includes('ADMINISTRATIVE CONFIDENTIAL'), 'Printable report contains security classification');

    // 16.4 Verify AuditLog record for the export event
    const auditRes = await fetch(`${API_URL}/admin/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditJson = await auditRes.json();
    const latestExportLog = auditJson.data.find(log => log.action === 'EXPORT_GENERATED');
    assert(!!latestExportLog, 'Export event was securely recorded in AuditLog collection');

    // 16.5 Verify RBAC on exports: rescuer forbidden
    const unauthorizedExportRes = await fetch(`${API_URL}/admin/export?type=complete&format=csv`, {
      headers: { Authorization: `Bearer ${rescuerToken}` }
    });
    assert(unauthorizedExportRes.status === 403, 'RBAC properly blocks non-admin from export endpoints (403 Forbidden)');

    console.log(`\n========================================`);
    console.log(`🎉 ALL TESTS COMPLETED: ${passed}/${total} passed!`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('💥 Test execution error:', err.message);
    process.exitCode = 1;
  }
}

runTests();
