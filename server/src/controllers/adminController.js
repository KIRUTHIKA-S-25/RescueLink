const RescueCase = require('../models/RescueCase');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendSuccess } = require('../utils/apiResponse');

// ─── getAnalytics ────────────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  // Case statistics
  const totalCases = await RescueCase.countDocuments();
  
  const casesByStatus = await RescueCase.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const casesByAnimalType = await RescueCase.aggregate([
    { $group: { _id: '$animalType', count: { $sum: 1 } } }
  ]);

  const casesByPriority = await RescueCase.aggregate([
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);

  // Responder statistics
  const totalResponders = await User.countDocuments({ role: 'responder' });
  const activeResponders = await User.countDocuments({ role: 'responder', isActive: true });
  
  const completedRescues = await RescueCase.countDocuments({ status: 'RESCUED' });

  // Performance statistics (Response Time Analytics)
  const rescuedCases = await RescueCase.find({ status: 'RESCUED' });
  let totalResponseTimeMs = 0;
  let totalCompletionTimeMs = 0;
  let validResponseTimeCount = 0;
  let validCompletionTimeCount = 0;

  rescuedCases.forEach(rc => {
    const created = rc.createdAt;
    const acceptedActivity = rc.statusHistory.find(s => s.status === 'ACCEPTED');
    const rescuedActivity = rc.statusHistory.find(s => s.status === 'RESCUED');

    if (created && acceptedActivity && acceptedActivity.timestamp) {
      totalResponseTimeMs += (new Date(acceptedActivity.timestamp) - new Date(created));
      validResponseTimeCount++;
      
      if (rescuedActivity && rescuedActivity.timestamp) {
        totalCompletionTimeMs += (new Date(rescuedActivity.timestamp) - new Date(acceptedActivity.timestamp));
        validCompletionTimeCount++;
      }
    }
  });

  const avgResponseTimeMs = validResponseTimeCount > 0 ? totalResponseTimeMs / validResponseTimeCount : 0;
  const avgCompletionTimeMs = validCompletionTimeCount > 0 ? totalCompletionTimeMs / validCompletionTimeCount : 0;

  const data = {
    caseStats: {
      totalCases,
      byStatus: casesByStatus.reduce((acc, val) => ({ ...acc, [val._id]: val.count }), {}),
      byAnimalType: casesByAnimalType.reduce((acc, val) => ({ ...acc, [val._id]: val.count }), {}),
      byPriority: casesByPriority.reduce((acc, val) => ({ ...acc, [val._id]: val.count }), {}),
    },
    responderStats: {
      totalResponders,
      activeResponders,
      completedRescues,
    },
    performanceStats: {
      avgResponseTimeMinutes: Math.round(avgResponseTimeMs / 60000),
      avgRescueCompletionTimeMinutes: Math.round(avgCompletionTimeMs / 60000),
    }
  };

  return sendSuccess(res, data, 'Analytics fetched successfully');
};

// ─── getAuditLogs ────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  const logs = await AuditLog.find()
    .populate('actor', 'name email role')
    .populate('rescueCase', 'caseId animalType')
    .sort({ createdAt: -1 })
    .limit(100);
    
  return sendSuccess(res, logs, 'Audit logs fetched successfully');
};

module.exports = {
  getAnalytics,
  getAuditLogs,
};
