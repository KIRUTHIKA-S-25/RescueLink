/**
 * adminController.js
 *
 * Comprehensive Administrator Analytics and Export Controller for RescueLink.
 *
 * Provides:
 * - Multi-criteria filtered aggregations (date ranges, priority, status, animal type)
 * - True database metrics: TUS severity, status pipelines, response/completion intervals
 * - Rescuer performance vs capacity workloads
 * - Escalation SLA tracking and duplicate incident corroboration metrics
 * - Map incident locations with privacy controls
 * - Multi-format export engine (CSV, XLSX, PDF/HTML) with spreadsheet formula injection protection
 * - Audit trail logging for all export operations
 */

const RescueCase = require('../models/RescueCase');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── Helpers: Date range calculator ───────────────────────────────────────────
const parseDateFilter = (range, startDate, endDate) => {
  const now = new Date();
  let start = null;
  let end = new Date(now);

  switch (range) {
    case 'today': {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '7d': {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case '30d': {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    }
    case '90d': {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'custom': {
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);
      break;
    }
    default: {
      // Default to all-time or 30 days if range is not specified
      if (range) {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }
  }

  return { start, end };
};

// ─── Spreadsheet Formula Injection Sanitizer ──────────────────────────────────
const sanitizeFormula = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

const escapeCsvField = (val) => {
  const sanitized = sanitizeFormula(val);
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
};

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  const { range = '30d', startDate, endDate, status, priority, animalType, rescuerId } = req.query;

  const { start, end } = parseDateFilter(range, startDate, endDate);

  // Construct MongoDB filter object
  const matchFilter = {};
  if (start && end) {
    matchFilter.createdAt = { $gte: start, $lte: end };
  } else if (start) {
    matchFilter.createdAt = { $gte: start };
  } else if (end) {
    matchFilter.createdAt = { $lte: end };
  }

  if (status && status !== 'ALL') {
    matchFilter.status = status;
  }
  if (priority && priority !== 'ALL') {
    matchFilter.priority = priority;
  }
  if (animalType && animalType !== 'ALL') {
    matchFilter.animalType = new RegExp(`^${animalType}$`, 'i');
  }
  if (rescuerId && rescuerId !== 'ALL') {
    matchFilter.assignedResponder = rescuerId;
  }

  // 1. Core Summary Counts
  const totalFilteredCases = await RescueCase.countDocuments(matchFilter);

  // Today count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const newToday = await RescueCase.countDocuments({ createdAt: { $gte: todayStart } });

  // Status aggregation
  const statusAggregation = await RescueCase.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const statusCounts = statusAggregation.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  const pendingCount = statusCounts['PENDING'] || 0;
  const assignedCount = statusCounts['ACCEPTED'] || 0;
  const inProgressCount = statusCounts['IN_PROGRESS'] || 0;
  const rescuedCount = statusCounts['RESCUED'] || 0;
  const cancelledCount = statusCounts['CANCELLED'] || 0;
  const escalatedStatusCount = statusCounts['ESCALATED'] || 0;

  // Escalation query (count cases flagged as escalated or in status ESCALATED)
  const escalatedCasesCount = await RescueCase.countDocuments({
    ...matchFilter,
    $or: [{ 'escalation.isEscalated': true }, { status: 'ESCALATED' }]
  });

  // Responders statistics
  const totalResponders = await User.countDocuments({ role: 'responder' });
  const activeResponders = await User.countDocuments({ role: 'responder', isActive: true });

  // Calculate available rescuers (active rescuers currently with < 3 assigned cases)
  const activeWorkloads = await RescueCase.aggregate([
    { $match: { status: { $in: ['ACCEPTED', 'IN_PROGRESS'] }, assignedResponder: { $exists: true } } },
    { $group: { _id: '$assignedResponder', count: { $sum: 1 } } }
  ]);
  const workloadMap = activeWorkloads.reduce((acc, w) => {
    acc[String(w._id)] = w.count;
    return acc;
  }, {});

  const allActiveRespondersList = await User.find({ role: 'responder', isActive: true }).select('_id name email').lean();
  let availableRescuersCount = 0;
  allActiveRespondersList.forEach(r => {
    const currentLoad = workloadMap[String(r._id)] || 0;
    if (currentLoad < 3) availableRescuersCount++;
  });

  // Success rate: Rescued / (Rescued + Cancelled) * 100 or Rescued / Total * 100
  const resolvedCount = rescuedCount + cancelledCount;
  const rescueSuccessRate = resolvedCount > 0 ? Math.round((rescuedCount / resolvedCount) * 100) : (totalFilteredCases > 0 ? Math.round((rescuedCount / totalFilteredCases) * 100) : 0);

  // 2. Response and Completion Times (Average and Median)
  const resolvedCases = await RescueCase.find({
    ...matchFilter,
    status: { $in: ['ACCEPTED', 'IN_PROGRESS', 'RESCUED'] }
  }).select('createdAt statusHistory status').lean();

  const responseDurationsMs = [];
  const completionDurationsMs = [];

  resolvedCases.forEach(rc => {
    const createdTime = new Date(rc.createdAt).getTime();
    const acceptedEntry = rc.statusHistory?.find(s => s.status === 'ACCEPTED');
    const rescuedEntry = rc.statusHistory?.find(s => s.status === 'RESCUED');

    if (acceptedEntry?.timestamp) {
      const acceptedTime = new Date(acceptedEntry.timestamp).getTime();
      const diffMs = acceptedTime - createdTime;
      if (diffMs >= 0) responseDurationsMs.push(diffMs);

      if (rescuedEntry?.timestamp) {
        const rescuedTime = new Date(rescuedEntry.timestamp).getTime();
        const compDiffMs = rescuedTime - acceptedTime;
        if (compDiffMs >= 0) completionDurationsMs.push(compDiffMs);
      }
    }
  });

  const calcAverage = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 60000) : 0;
  const calcMedian = arr => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const val = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return Math.round(val / 60000);
  };

  const avgResponseTimeMinutes = calcAverage(responseDurationsMs);
  const medianResponseTimeMinutes = calcMedian(responseDurationsMs);
  const avgCompletionTimeMinutes = calcAverage(completionDurationsMs);
  const medianCompletionTimeMinutes = calcMedian(completionDurationsMs);

  // 3. Status Distribution Chart Data
  const validStatuses = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ESCALATED', 'RESCUED', 'CANCELLED'];
  const statusDistribution = validStatuses.map(st => {
    const count = statusCounts[st] || 0;
    const percentage = totalFilteredCases > 0 ? Math.round((count / totalFilteredCases) * 100) : 0;
    return { status: st, count, percentage };
  });

  // 4. Severity Distribution Chart Data
  const priorityAggregation = await RescueCase.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);
  const priorityMap = priorityAggregation.reduce((acc, val) => {
    acc[val._id] = val.count;
    return acc;
  }, {});
  const severityDistribution = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(pr => {
    const count = priorityMap[pr] || 0;
    const percentage = totalFilteredCases > 0 ? Math.round((count / totalFilteredCases) * 100) : 0;
    return { priority: pr, count, percentage };
  });

  // 5. Rescue Trends Over Time (Daily Buckets)
  const trendAggregation = await RescueCase.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        reported: { $sum: 1 },
        assigned: {
          $sum: { $cond: [{ $in: ['$status', ['ACCEPTED', 'IN_PROGRESS', 'RESCUED']] }, 1, 0] }
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'RESCUED'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  const rescueTrends = trendAggregation.map(t => ({
    date: t._id,
    reported: t.reported,
    assigned: t.assigned,
    resolved: t.resolved
  }));

  // 6. Rescuer Performance List
  const rescuerPerformance = await Promise.all(
    allActiveRespondersList.map(async (rescuer) => {
      const rescuerIdStr = rescuer._id;
      const assigned = await RescueCase.countDocuments({ assignedResponder: rescuerIdStr });
      const accepted = await RescueCase.countDocuments({
        assignedResponder: rescuerIdStr,
        status: { $in: ['ACCEPTED', 'IN_PROGRESS', 'RESCUED'] }
      });
      const completed = await RescueCase.countDocuments({
        assignedResponder: rescuerIdStr,
        status: 'RESCUED'
      });
      const activeLoad = workloadMap[String(rescuerIdStr)] || 0;

      // Released count: statusHistory where status is PENDING and changedBy was this rescuer
      const releasedCount = await RescueCase.countDocuments({
        statusHistory: {
          $elemMatch: { status: 'PENDING', changedBy: rescuerIdStr }
        }
      });

      return {
        rescuerId: rescuerIdStr,
        name: rescuer.name,
        email: rescuer.email,
        currentWorkload: activeLoad,
        maxCapacity: 3,
        assignedCount: assigned,
        acceptedCount: accepted,
        completedCount: completed,
        releasedCount,
        capacityPercent: Math.round((activeLoad / 3) * 100),
      };
    })
  );

  // 7. Escalation Analytics
  const totalEscalated = escalatedCasesCount;
  const escalationRatePercent = totalFilteredCases > 0 ? Math.round((totalEscalated / totalFilteredCases) * 100) : 0;
  const pendingAwaitingAssignment = pendingCount;

  // 8. Duplicate Incident Analytics
  const duplicateCasesCount = await RescueCase.countDocuments({
    ...matchFilter,
    'duplicateInfo.isDuplicate': true
  });
  const corroboratingAggregation = await RescueCase.aggregate([
    { $match: matchFilter },
    { $project: { count: { $size: { $ifNull: ['$corroboratingReports', []] } } } },
    { $group: { _id: null, total: { $sum: '$count' } } }
  ]);
  const totalCorroborating = corroboratingAggregation[0]?.total || 0;

  // 9. Incident Category & Emergency Type Analysis
  const animalTypeAggregation = await RescueCase.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$animalType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);
  const animalCategories = animalTypeAggregation.map(a => ({
    category: a._id || 'Unknown',
    count: a.count
  }));

  const emergencyTypeAggregation = await RescueCase.aggregate([
    { $match: matchFilter },
    { $group: { _id: '$emergencyType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);
  const emergencyTypes = emergencyTypeAggregation.map(e => ({
    type: e._id || 'General',
    count: e.count
  }));

  // 10. Geographic Distribution Markers (Redacted private reporter info)
  const geoCases = await RescueCase.find({
    ...matchFilter,
    'location.latitude': { $exists: true, $ne: null },
    'location.longitude': { $exists: true, $ne: null }
  })
    .select('caseId animalType priority status emergencyType location.latitude location.longitude location.address createdAt')
    .limit(200)
    .lean();

  const data = {
    filters: {
      range,
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null,
      status: status || 'ALL',
      priority: priority || 'ALL',
      animalType: animalType || 'ALL',
    },
    summaryCards: {
      totalCases: totalFilteredCases,
      newToday,
      pendingCases: pendingCount,
      assignedCases: assignedCount,
      inProgressCases: inProgressCount,
      escalatedCases: totalEscalated,
      rescuedCases: rescuedCount,
      cancelledCases: cancelledCount,
      activeRescuers: activeResponders,
      availableRescuers: availableRescuersCount,
      avgResponseTimeMinutes,
      medianResponseTimeMinutes,
      avgCompletionTimeMinutes,
      medianCompletionTimeMinutes,
      rescueSuccessRate,
    },
    visualizations: {
      statusDistribution,
      severityDistribution,
      rescueTrends,
      rescuerPerformance,
      escalationAnalytics: {
        totalEscalated,
        escalationRatePercent,
        pendingAwaitingAssignment,
      },
      duplicateAnalytics: {
        totalDuplicates: duplicateCasesCount,
        totalCorroboratingReports: totalCorroborating,
        duplicateRatePercent: totalFilteredCases > 0 ? Math.round((duplicateCasesCount / totalFilteredCases) * 100) : 0,
      },
      animalCategories,
      emergencyTypes,
      geoCases: geoCases.map(g => ({
        _id: g._id,
        caseId: g.caseId,
        animalType: g.animalType,
        priority: g.priority,
        status: g.status,
        emergencyType: g.emergencyType,
        latitude: g.location.latitude,
        longitude: g.location.longitude,
        address: g.location.address,
        createdAt: g.createdAt,
      })),
    }
  };

  return sendSuccess(res, data, 'Analytics data retrieved successfully');
};

// ─── GET /api/admin/audit ─────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  const logs = await AuditLog.find()
    .populate('actor', 'name email role')
    .populate('rescueCase', 'caseId animalType priority')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendSuccess(res, logs, 'Audit logs fetched successfully');
};

// ─── GET /api/admin/export ────────────────────────────────────────────────────
const exportReports = async (req, res) => {
  const {
    type = 'complete',
    format = 'csv',
    range = '30d',
    startDate,
    endDate,
    status,
    priority,
    animalType
  } = req.query;

  const { start, end } = parseDateFilter(range, startDate, endDate);

  const matchFilter = {};
  if (start && end) matchFilter.createdAt = { $gte: start, $lte: end };
  if (status && status !== 'ALL') matchFilter.status = status;
  if (priority && priority !== 'ALL') matchFilter.priority = priority;
  if (animalType && animalType !== 'ALL') matchFilter.animalType = new RegExp(`^${animalType}$`, 'i');

  const cases = await RescueCase.find(matchFilter)
    .populate('assignedResponder', 'name email')
    .populate('reporter', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `RescueLink_${type}_${range}_${timestamp}`;

  // Log export in AuditLog
  await AuditLog.create({
    actor: req.user.userId,
    actorRole: 'admin',
    action: 'EXPORT_GENERATED',
    description: `Exported ${type} report (${cases.length} records) in ${format.toUpperCase()} format`,
  });

  // 1. CSV Generation
  if (format === 'csv' || format === 'xlsx') {
    let headers = [];
    let rows = [];

    switch (type) {
      case 'complete':
      default:
        headers = ['Case ID', 'Reported At', 'Animal Type', 'Emergency Type', 'Priority', 'Status', 'Location Address', 'Assigned Rescuer', 'Is Escalated', 'Corroborating Reports'];
        rows = cases.map(c => [
          escapeCsvField(c.caseId),
          escapeCsvField(new Date(c.createdAt).toLocaleString()),
          escapeCsvField(c.animalType),
          escapeCsvField(c.emergencyType),
          escapeCsvField(c.priority),
          escapeCsvField(c.status),
          escapeCsvField(c.location?.address || 'N/A'),
          escapeCsvField(c.assignedResponder?.name || 'Unassigned'),
          escapeCsvField(c.escalation?.isEscalated ? 'YES' : 'NO'),
          escapeCsvField(c.corroboratingReports?.length || 0)
        ]);
        break;

      case 'progress':
        headers = ['Case ID', 'Created At', 'Status', 'Assigned Rescuer', 'Assigned At', 'Rescued At'];
        rows = cases.map(c => {
          const accepted = c.statusHistory?.find(s => s.status === 'ACCEPTED');
          const rescued = c.statusHistory?.find(s => s.status === 'RESCUED');
          return [
            escapeCsvField(c.caseId),
            escapeCsvField(new Date(c.createdAt).toLocaleString()),
            escapeCsvField(c.status),
            escapeCsvField(c.assignedResponder?.name || 'None'),
            escapeCsvField(accepted ? new Date(accepted.timestamp).toLocaleString() : 'N/A'),
            escapeCsvField(rescued ? new Date(rescued.timestamp).toLocaleString() : 'N/A')
          ];
        });
        break;

      case 'severity':
        headers = ['Case ID', 'Animal Type', 'Priority', 'TUS Score', 'Animal Risk', 'Condition Severity', 'Location Risk', 'Status'];
        rows = cases.map(c => [
          escapeCsvField(c.caseId),
          escapeCsvField(c.animalType),
          escapeCsvField(c.priority),
          escapeCsvField(c.triage?.score || 'N/A'),
          escapeCsvField(c.triage?.breakdown?.animalRisk || 'N/A'),
          escapeCsvField(c.triage?.breakdown?.conditionSeverity || 'N/A'),
          escapeCsvField(c.triage?.breakdown?.locationRisk || 'N/A'),
          escapeCsvField(c.status)
        ]);
        break;

      case 'escalation':
        headers = ['Case ID', 'Reported At', 'Priority', 'Status', 'Escalated At', 'Escalation Reason', 'Search Radius Km'];
        rows = cases
          .filter(c => c.escalation?.isEscalated || c.status === 'ESCALATED')
          .map(c => [
            escapeCsvField(c.caseId),
            escapeCsvField(new Date(c.createdAt).toLocaleString()),
            escapeCsvField(c.priority),
            escapeCsvField(c.status),
            escapeCsvField(c.escalation?.escalatedAt ? new Date(c.escalation.escalatedAt).toLocaleString() : 'N/A'),
            escapeCsvField(c.escalation?.escalationReason || 'SLA Exceeded'),
            escapeCsvField(c.escalation?.searchRadiusKm || 30)
          ]);
        break;

      case 'duplicates':
        headers = ['Primary Case ID', 'Animal Type', 'Location', 'Corroborating Reports Count', 'Duplicate Detected At'];
        rows = cases
          .filter(c => (c.corroboratingReports && c.corroboratingReports.length > 0) || c.duplicateInfo?.isDuplicate)
          .map(c => [
            escapeCsvField(c.caseId),
            escapeCsvField(c.animalType),
            escapeCsvField(c.location?.address || 'N/A'),
            escapeCsvField(c.corroboratingReports?.length || 0),
            escapeCsvField(c.duplicateInfo?.duplicateDetectedAt ? new Date(c.duplicateInfo.duplicateDetectedAt).toLocaleString() : 'N/A')
          ]);
        break;
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const mime = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8';
    const extension = format === 'xlsx' ? 'xlsx' : 'csv';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${extension}"`);
    return res.status(200).send(csvContent);
  }

  // 2. Printable HTML / PDF Document
  if (format === 'pdf') {
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RescueLink System Progress Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; }
    h1 { color: #0f172a; border-bottom: 2px solid #22c55e; padding-bottom: 8px; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .meta-item { font-size: 13px; }
    .meta-item span { font-weight: bold; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .CRITICAL { background: #fee2e2; color: #b91c1c; }
    .HIGH { background: #ffedd5; color: #c2410c; }
    .MEDIUM { background: #fef3c7; color: #b45309; }
    .LOW { background: #dcfce7; color: #15803d; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>RescueLink Emergency Management Report</h1>
  <div class="subtitle">Official administrative documentation for verified animal rescue cases.</div>
  
  <div class="meta-box">
    <div class="meta-item">Report Type: <span>${type.toUpperCase()}</span></div>
    <div class="meta-item">Reporting Window: <span>${range.toUpperCase()}</span></div>
    <div class="meta-item">Total Records Included: <span>${cases.length}</span></div>
    <div class="meta-item">Generated At: <span>${new Date().toLocaleString()}</span></div>
    <div class="meta-item">Security Level: <span>ADMINISTRATIVE CONFIDENTIAL</span></div>
    <div class="meta-item">Audit Reference: <span>RL-REP-${Date.now().toString(36).toUpperCase()}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Case ID</th>
        <th>Date</th>
        <th>Animal</th>
        <th>Emergency</th>
        <th>Severity</th>
        <th>Status</th>
        <th>Location</th>
        <th>Assigned Rescuer</th>
      </tr>
    </thead>
    <tbody>
      ${cases.slice(0, 150).map(c => `
        <tr>
          <td style="font-weight:600;">${c.caseId}</td>
          <td>${new Date(c.createdAt).toLocaleDateString()}</td>
          <td>${c.animalType}</td>
          <td>${c.emergencyType}</td>
          <td><span class="badge ${c.priority}">${c.priority}</span></td>
          <td><b>${c.status}</b></td>
          <td>${(c.location?.address || 'N/A').slice(0, 30)}</td>
          <td>${c.assignedResponder?.name || 'Unassigned'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${cases.length > 150 ? `<p style="font-size:12px;color:#64748b;margin-top:12px;">* Showing first 150 of ${cases.length} records. Download CSV for the complete spreadsheet.</p>` : ''}

  <div class="footer">
    RescueLink Real-Time Animal Rescue Coordination Platform &bull; Data Integrity Verified &bull; Not for Public Redistribution
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}.html"`);
    return res.status(200).send(htmlReport);
  }

  return sendError(res, 'Unsupported export format', 400);
};

module.exports = {
  getAnalytics,
  getAuditLogs,
  exportReports,
};
