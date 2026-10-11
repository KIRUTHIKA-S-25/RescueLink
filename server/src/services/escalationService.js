/**
 * escalationService.js
 *
 * Automated escalation worker for unaccepted rescue cases.
 *
 * Rules:
 * - If a case stays in PENDING longer than ESCALATION_TIMEOUT_MS (default: 5 min),
 *   it is marked as escalated.
 * - Administrators receive high-priority alerts.
 * - Uses atomic DB queries so it is safe across server restarts and concurrent workers.
 */

const RescueCase = require('../models/RescueCase');
const RescueActivity = require('../models/RescueActivity');
const User = require('../models/User');
const { createNotification } = require('./notificationService');

const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes (300,000 ms)

/**
 * Sweeps the database for unaccepted PENDING cases that have exceeded the timeout.
 * Atomically updates each case to prevent duplicate escalation triggers.
 */
const checkAndEscalatePendingCases = async () => {
  const timeoutMs = parseInt(process.env.ESCALATION_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;
  const cutoffTime = new Date(Date.now() - timeoutMs);

  try {
    // Find un-escalated pending cases created before the cutoff
    const overdueCases = await RescueCase.find({
      status: 'PENDING',
      'escalation.isEscalated': { $ne: true },
      createdAt: { $lte: cutoffTime },
    });

    if (!overdueCases || overdueCases.length === 0) {
      return 0;
    }

    // Fetch active admins once for notification dispatch
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');

    let escalatedCount = 0;

    for (const rc of overdueCases) {
      // Atomic update ensures idempotency
      const updated = await RescueCase.findOneAndUpdate(
        {
          _id: rc._id,
          status: 'PENDING',
          'escalation.isEscalated': { $ne: true },
        },
        {
          $set: {
            'escalation.isEscalated': true,
            'escalation.escalatedAt': new Date(),
            'escalation.escalationReason': `No responder accepted case within ${Math.round(timeoutMs / 60000)} minutes`,
          },
          $push: {
            statusHistory: {
              status: 'PENDING',
              timestamp: new Date(),
              note: 'Case automatically escalated to administrators due to response timeout',
            },
          },
        },
        { returnDocument: 'after' }
      );

      if (updated) {
        escalatedCount++;

        // 1. Create audit activity
        try {
          await RescueActivity.create({
            rescueCase: updated._id,
            type: 'CASE_ESCALATED',
            message: `Emergency escalated to coordinators: Unassigned after ${Math.round(timeoutMs / 60000)}m.`,
          });
        } catch (actErr) {
          console.error('[Escalation] Activity log error:', actErr.message);
        }

        // 2. Alert each system administrator
        for (const admin of admins) {
          try {
            await createNotification({
              recipient: admin._id,
              rescueCase: updated._id,
              type: 'CASE_ESCALATED',
              title: '🚨 Case Escalated to Admin',
              message: `Case ${updated.caseId} (${updated.animalType}) has been pending without responder acceptance. Immediate coordinator action required.`,
            });
          } catch (notifErr) {
            console.error('[Escalation] Notification error:', notifErr.message);
          }
        }
      }
    }

    if (escalatedCount > 0) {
      console.log(`[Escalation] Successfully escalated ${escalatedCount} overdue rescue case(s).`);
    }

    return escalatedCount;
  } catch (err) {
    console.error('[Escalation] Error in sweep worker:', err.message);
    return 0;
  }
};

let workerInterval = null;

/**
 * Starts the background escalation interval sweep.
 *
 * @param {number} sweepIntervalMs Frequency of database checks (default 30 seconds)
 */
const startEscalationWorker = (sweepIntervalMs = 30000) => {
  if (workerInterval) return;

  console.log(`[Escalation Worker] Initialized (sweep every ${sweepIntervalMs / 1000}s)`);

  // Run initial check immediately
  checkAndEscalatePendingCases();

  // Then schedule recurring checks
  workerInterval = setInterval(checkAndEscalatePendingCases, sweepIntervalMs);
};

const stopEscalationWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Escalation Worker] Stopped');
  }
};

module.exports = {
  checkAndEscalatePendingCases,
  startEscalationWorker,
  stopEscalationWorker,
  DEFAULT_TIMEOUT_MS,
};
