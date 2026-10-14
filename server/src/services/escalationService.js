/**
 * escalationService.js
 *
 * Automated escalation background worker for unaccepted rescue cases:
 * - Tiered SLA response timeouts based on Triage Urgency Priority:
 *     CRITICAL : 3 minutes (180,000 ms)
 *     HIGH     : 5 minutes (300,000 ms)
 *     MEDIUM   : 10 minutes (600,000 ms)
 *     LOW      : 15 minutes (900,000 ms)
 * - State transition from PENDING -> ESCALATED with audit log
 * - Idempotent, crash-safe atomic updates
 * - Priority administrator notifications with deduplication
 * - Rescuer search radius expansion (15 km -> 30 km) to alert secondary rescuers
 * - Mutex lock (isSweeping) preventing overlapping worker executions
 * - Graceful shutdown hooks
 */

const RescueCase = require('../models/RescueCase');
const RescueActivity = require('../models/RescueActivity');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createNotification } = require('./notificationService');
const { findEligibleResponders } = require('../utils/geoUtils');

// Standard tiered SLA thresholds
const TIERED_TIMEOUTS_MS = {
  CRITICAL: 3 * 60 * 1000,  // 3 minutes
  HIGH:     5 * 60 * 1000,  // 5 minutes
  MEDIUM:  10 * 60 * 1000,  // 10 minutes
  LOW:     15 * 60 * 1000,  // 15 minutes
};

const EXPANDED_SEARCH_RADIUS_KM = 30;
const STANDARD_SEARCH_RADIUS_KM = 15;

let workerInterval = null;
let isSweeping = false;

/**
 * Gets the applicable timeout threshold for a given case priority.
 * Allows override via process.env.ESCALATION_TIMEOUT_MS or ESCALATION_TEST_TIMEOUT_MS for tests.
 */
const getThresholdForPriority = (priority = 'MEDIUM') => {
  if (process.env.ESCALATION_TEST_TIMEOUT_MS) {
    return parseInt(process.env.ESCALATION_TEST_TIMEOUT_MS, 10);
  }
  if (process.env.ESCALATION_TIMEOUT_MS) {
    return parseInt(process.env.ESCALATION_TIMEOUT_MS, 10);
  }
  return TIERED_TIMEOUTS_MS[priority] || TIERED_TIMEOUTS_MS.HIGH;
};

/**
 * Sweeps the database for unassigned PENDING cases exceeding their priority SLA.
 * Uses atomic findOneAndUpdate to prevent duplicate or concurrent execution.
 *
 * @returns {Promise<number>} Number of newly escalated cases
 */
const checkAndEscalatePendingCases = async () => {
  if (isSweeping) {
    return 0; // Prevent overlapping execution
  }

  isSweeping = true;

  try {
    // Find all active un-escalated pending cases
    const pendingCases = await RescueCase.find({
      status: 'PENDING',
      'escalation.isEscalated': { $ne: true },
    });

    if (!pendingCases || pendingCases.length === 0) {
      return 0;
    }

    const now = Date.now();
    const casesToEscalate = [];

    for (const rc of pendingCases) {
      const threshold = getThresholdForPriority(rc.priority);
      const ageMs = now - new Date(rc.createdAt).getTime();

      if (ageMs >= threshold) {
        casesToEscalate.push({ caseDoc: rc, threshold });
      }
    }

    if (casesToEscalate.length === 0) {
      return 0;
    }

    // Fetch active system administrators
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');

    let escalatedCount = 0;

    for (const { caseDoc: rc, threshold } of casesToEscalate) {
      const thresholdMinutes = Math.max(1, Math.round(threshold / 60000));
      const reason = `Unassigned ${rc.priority} case exceeded SLA response threshold (${thresholdMinutes}m)`;

      // Atomic mutation guarantees idempotency across concurrent instances
      const updated = await RescueCase.findOneAndUpdate(
        {
          _id: rc._id,
          status: 'PENDING',
          'escalation.isEscalated': { $ne: true },
        },
        {
          $set: {
            status: 'ESCALATED',
            'escalation.isEscalated': true,
            'escalation.escalatedAt': new Date(),
            'escalation.escalationReason': reason,
            'escalation.searchRadiusKm': EXPANDED_SEARCH_RADIUS_KM,
          },
          $push: {
            statusHistory: {
              status: 'ESCALATED',
              timestamp: new Date(),
              note: `Case automatically escalated. Rescuer search radius expanded to ${EXPANDED_SEARCH_RADIUS_KM} km.`,
            },
          },
        },
        { returnDocument: 'after' }
      );

      if (!updated) {
        continue; // Already processed by another worker
      }

      escalatedCount++;

      // 1. Log in audit activity timeline
      try {
        await RescueActivity.create({
          rescueCase: updated._id,
          type: 'CASE_ESCALATED',
          message: `🚨 Case escalated to coordinators: Unassigned after ${thresholdMinutes}m. Radius expanded to ${EXPANDED_SEARCH_RADIUS_KM}km.`,
        });
      } catch (actErr) {
        console.error('[Escalation] Activity log error:', actErr.message);
      }

      // 2. Alert System Administrators (with idempotency check)
      for (const admin of admins) {
        try {
          const existingNotif = await Notification.findOne({
            recipient: admin._id,
            rescueCase: updated._id,
            type: 'CASE_ESCALATED',
          });

          if (!existingNotif) {
            await createNotification({
              recipient: admin._id,
              rescueCase: updated._id,
              type: 'CASE_ESCALATED',
              title: `🚨 Urgent: Case Escalated (${updated.priority})`,
              message: `Case ${updated.caseId} (${updated.animalType}) is unassigned after ${thresholdMinutes}m. Search radius expanded to ${EXPANDED_SEARCH_RADIUS_KM}km.`,
            });
          }
        } catch (notifErr) {
          console.error('[Escalation] Admin notification error:', notifErr.message);
        }
      }

      // 3. Search Radius Expansion: alert secondary responders in expanded 15km - 30km range
      if (
        updated.location &&
        typeof updated.location.latitude === 'number' &&
        typeof updated.location.longitude === 'number'
      ) {
        try {
          const expandedResponders = await findEligibleResponders(
            updated.location.latitude,
            updated.location.longitude,
            EXPANDED_SEARCH_RADIUS_KM,
            3
          );

          // Alert newly reached responders beyond the initial standard 15km
          const newlyReached = expandedResponders.filter(
            (r) => r.distanceKm > STANDARD_SEARCH_RADIUS_KM
          );

          for (const responder of newlyReached) {
            await createNotification({
              recipient: responder.responderId,
              rescueCase: updated._id,
              type: 'CASE_NEARBY',
              title: `🚨 Expanded Zone Emergency Alert (${responder.distanceKm} km)`,
              message: `Escalated ${updated.priority} emergency for a ${updated.animalType} at ${updated.location.address}.`,
            });
          }
        } catch (expandErr) {
          console.error('[Escalation] Expanded dispatch error:', expandErr.message);
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
  } finally {
    isSweeping = false;
  }
};

/**
 * Starts the recurring background escalation sweep worker.
 *
 * @param {number} sweepIntervalMs Sweep frequency (default: 30,000 ms / 30s)
 */
const startEscalationWorker = (sweepIntervalMs = 30000) => {
  if (workerInterval) return;

  console.log(`[Escalation Worker] Initialized (sweep every ${sweepIntervalMs / 1000}s)`);

  // Run initial check
  checkAndEscalatePendingCases().catch((err) =>
    console.error('[Escalation] Initial sweep error:', err.message)
  );

  workerInterval = setInterval(() => {
    checkAndEscalatePendingCases().catch((err) =>
      console.error('[Escalation] Periodic sweep error:', err.message)
    );
  }, sweepIntervalMs);

  // Hook process termination for graceful shutdown
  const gracefulExit = () => {
    stopEscalationWorker();
  };

  process.once('SIGINT', gracefulExit);
  process.once('SIGTERM', gracefulExit);
};

const stopEscalationWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Escalation Worker] Stopped gracefully');
  }
};

module.exports = {
  checkAndEscalatePendingCases,
  startEscalationWorker,
  stopEscalationWorker,
  getThresholdForPriority,
  TIERED_TIMEOUTS_MS,
  EXPANDED_SEARCH_RADIUS_KM,
  STANDARD_SEARCH_RADIUS_KM,
};
