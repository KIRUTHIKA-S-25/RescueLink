/**
 * rescueController.js — Phase 5
 *
 * Handles the core rescue request workflow:
 *   createRescue        — POST   /api/rescues
 *   getAllRescues        — GET    /api/rescues
 *   getRescueById       — GET    /api/rescues/:id
 *   updateRescueStatus  — PATCH  /api/rescues/:id/status
 *   getUserRescues      — GET    /api/rescues/my
 *
 * Phase 5 additions:
 *   - Automatically creates RescueActivity entries on key events
 *   - Assigns authenticated responder when PENDING → ACCEPTED
 *   - Populates assignedResponder field on fetches
 *
 * Status transition rules (enforced server-side):
 *   PENDING     → ACCEPTED | CANCELLED
 *   ACCEPTED    → IN_PROGRESS | CANCELLED
 *   IN_PROGRESS → RESCUED
 *   RESCUED     → (terminal)
 *   CANCELLED   → (terminal)
 */

const RescueCase        = require('../models/RescueCase');
const RescueActivity    = require('../models/RescueActivity');
const ResponderProfile  = require('../models/ResponderProfile');
const AuditLog          = require('../models/AuditLog');
const { createNotification }     = require('../services/notificationService');
const { calculatePriority }       = require('../utils/triageUtils');
const { detectDuplicateCase }     = require('../services/duplicateDetectionService');
const { findEligibleResponders }  = require('../utils/geoUtils');
const { sendSuccess, sendError }  = require('../utils/apiResponse');

// ─── Valid statuses ───────────────────────────────────────────────────────────

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED', 'CANCELLED'];

const ALLOWED_TRANSITIONS = {
  PENDING:     ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:    ['IN_PROGRESS', 'CANCELLED', 'PENDING'], // PENDING allows releasing case
  IN_PROGRESS: ['RESCUED', 'CANCELLED'],
  RESCUED:     [],
  CANCELLED:   [],
};

// ─── Activity messages per status ─────────────────────────────────────────────

const STATUS_ACTIVITY_TYPE = {
  PENDING:     'CASE_RELEASED',
  ACCEPTED:    'CASE_ACCEPTED',
  IN_PROGRESS: 'RESCUE_STARTED',
  RESCUED:     'CASE_RESCUED',
  CANCELLED:   'CASE_CANCELLED',
};

const STATUS_MESSAGES = {
  PENDING:     (name) => `Case released back to pending queue${name ? ` by ${name}` : ''}.`,
  ACCEPTED:    (name) => `Rescue request accepted${name ? ` by ${name}` : ''}.`,
  IN_PROGRESS: (name) => `Responder${name ? ` ${name}` : ''} started the rescue.`,
  RESCUED:     ()     => 'Animal rescue completed successfully.',
  CANCELLED:   ()     => 'Rescue request was cancelled.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateCaseId = () => {
  const ts  = Date.now();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RC-${ts}-${rnd}`;
};

/**
 * createActivity — internal helper, not a route handler.
 * Creates a RescueActivity document without blocking the main response.
 */
const createActivity = async ({ rescueCaseId, type, message, userId, userName }) => {
  try {
    await RescueActivity.create({
      rescueCase:    rescueCaseId,
      type,
      message,
      createdBy:     userId   || undefined,
      createdByName: userName || undefined,
    });
  } catch (err) {
    // Log but don't throw — activity failure must not break the main workflow
    console.error('[Activity] Failed to create activity:', err.message);
  }
};

/**
 * populateRescue — returns a query that .populate()s the assignedResponder with
 * only the fields needed for display (name, phone, email).
 */
const populateRescue = (query) =>
  query.populate('assignedResponder', 'name phone email');

// ─── createRescue ─────────────────────────────────────────────────────────────

const createRescue = async (req, res) => {
  const {
    reporterName,
    reporterContact,
    animalType,
    emergencyType,
    description,
    locationAddress,
    latitude,
    longitude,
    priority,
  } = req.body;

  let imageUrl = req.body.imageUrl;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const missing = [];
  if (!reporterName?.trim())      missing.push('reporterName');
  if (!reporterContact?.trim())   missing.push('reporterContact');
  if (!animalType?.trim())        missing.push('animalType');
  if (!emergencyType?.trim())     missing.push('emergencyType');
  if (!description?.trim())       missing.push('description');
  if (!locationAddress?.trim()) missing.push('locationAddress');

  if (missing.length > 0) {
    return sendError(res, `Missing required fields: ${missing.join(', ')}`, 400);
  }

  // Validate coordinates completeness
  let lat = latitude ? parseFloat(latitude) : undefined;
  let lng = longitude ? parseFloat(longitude) : undefined;
  
  const hasLat = lat !== undefined && !isNaN(lat);
  const hasLng = lng !== undefined && !isNaN(lng);

  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    return sendError(res, 'Both latitude and longitude are required if providing coordinates', 400);
  }

  if (hasLat && hasLng) {
    if (lat < -90 || lat > 90) {
      return sendError(res, 'Invalid latitude', 400);
    }
    if (lng < -180 || lng > 180) {
      return sendError(res, 'Invalid longitude', 400);
    }
  }

  // 1. Calculate Priority (TUS) if not manually specified
  const computedPriority = priority && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(priority)
    ? priority
    : calculatePriority(animalType, emergencyType, description);

  // 2. Duplicate Detection (<100m, <45m, matching animal category)
  let duplicateInfo = { isDuplicate: false };
  if (hasLat && hasLng) {
    const dupCheck = await detectDuplicateCase({
      animalType,
      latitude: lat,
      longitude: lng,
    });
    if (dupCheck.isDuplicate && dupCheck.primaryCase) {
      duplicateInfo = {
        isDuplicate: true,
        primaryCase: dupCheck.primaryCase._id,
        duplicateDetectedAt: new Date(),
      };
    }
  }

  const rescue = await RescueCase.create({
    caseId:          generateCaseId(),
    reporterName:    reporterName.trim(),
    reporterContact: reporterContact.trim(),
    reporter:        req.user?.userId || undefined,
    animalType:      animalType.trim(),
    emergencyType:   emergencyType.trim(),
    description:     description.trim(),
    imageUrl:        imageUrl?.trim() || undefined,
    location: {
      address:   locationAddress.trim(),
      latitude:  lat,
      longitude: lng,
    },
    priority: computedPriority,
    status: 'PENDING',
    duplicateInfo,
    statusHistory: [{
      status:    'PENDING',
      timestamp: new Date(),
      note:      duplicateInfo.isDuplicate
        ? `Case created (Flagged as duplicate of ${duplicateInfo.primaryCase})`
        : 'Case created',
    }],
  });

  // Audit log
  await AuditLog.create({
    actor: req.user?.userId,
    actorRole: req.user?.role || 'guest',
    action: 'CASE_CREATED',
    rescueCase: rescue._id,
    description: `Case reported by ${rescue.reporterName} (Priority: ${computedPriority}${duplicateInfo.isDuplicate ? ', Duplicate' : ''})`
  });

  // Auto-create the CASE_CREATED activity
  await createActivity({
    rescueCaseId: rescue._id,
    type:         'CASE_CREATED',
    message:      `Rescue request created by ${rescue.reporterName} (Priority: ${computedPriority}).`,
    userId:       req.user?.userId,
    userName:     rescue.reporterName,
  });

  // Create notification for the citizen
  if (rescue.reporter) {
    await createNotification({
      recipient: rescue.reporter,
      rescueCase: rescue._id,
      type: 'CASE_CREATED',
      title: 'Rescue Request Submitted',
      message: duplicateInfo.isDuplicate
        ? 'Your report was received! A matching case is already being processed nearby.'
        : 'Your rescue request has been successfully submitted and is waiting for a responder.',
    });
  }

  // 3. Proximity-based Dispatch: Alert nearby eligible responders (within 15km)
  if (hasLat && hasLng && !duplicateInfo.isDuplicate) {
    try {
      const eligibleResponders = await findEligibleResponders(lat, lng, 15, 3);
      for (const responder of eligibleResponders) {
        await createNotification({
          recipient: responder.responderId,
          rescueCase: rescue._id,
          type: 'CASE_NEARBY',
          title: `🚨 Nearby Rescue Alert (${responder.distanceKm} km)`,
          message: `${computedPriority} emergency for a ${rescue.animalType} at ${rescue.location.address}.`,
        });
      }
    } catch (dispatchErr) {
      console.error('[Dispatch] Proximity notification error:', dispatchErr.message);
    }
  }

  return sendSuccess(res, rescue, 'Rescue request submitted successfully', 201);
};

// ─── getAllRescues ────────────────────────────────────────────────────────────

const getAllRescues = async (req, res) => {
  const filter = {};
  if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const rescues = await populateRescue(
    RescueCase.find(filter).sort({ createdAt: -1 })
  ).lean();

  return sendSuccess(res, rescues, 'Rescue cases fetched successfully');
};

// ─── getRescueById ───────────────────────────────────────────────────────────

const getRescueById = async (req, res) => {
  const rescue = await populateRescue(
    RescueCase.findById(req.params.id)
  ).lean();

  if (!rescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  // Phase 6 Security: Strip exact coordinates unless user is admin, responder, or the owner citizen
  const user = req.user; // Set by optional auth middleware
  let canViewCoordinates = false;

  if (user) {
    if (user.role === 'admin' || user.role === 'responder') {
      canViewCoordinates = true;
    } else if (user.role === 'citizen' && rescue.reporter && rescue.reporter.toString() === user.userId) {
      canViewCoordinates = true;
    }
  }

  if (!canViewCoordinates && rescue.location) {
    // Remove exact coordinates to protect privacy of public reports
    delete rescue.location.latitude;
    delete rescue.location.longitude;
  }

  return sendSuccess(res, rescue, 'Rescue case fetched successfully');
};

// ─── updateRescueStatus ──────────────────────────────────────────────────────

const updateRescueStatus = async (req, res) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return sendError(
      res,
      `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      400
    );
  }

  const rescue = await RescueCase.findById(req.params.id);
  if (!rescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  // Enforce transition rules
  const allowed = ALLOWED_TRANSITIONS[rescue.status] || [];
  if (!allowed.includes(status)) {
    return sendError(
      res,
      `Cannot transition from ${rescue.status} to ${status}. ` +
        (allowed.length > 0
          ? `Allowed next statuses: ${allowed.join(', ')}`
          : `${rescue.status} is a terminal status.`),
      422
    );
  }

  const responderId   = req.user?.userId;
  const responderName = req.user?.name; // populated from JWT if set

  // ─── Status-specific business logic ────────────────────────────────────────

  // Case Release: ACCEPTED -> PENDING
  if (status === 'PENDING') {
    if (req.user?.role !== 'admin' && rescue.assignedResponder?.toString() !== responderId) {
      return sendError(res, 'Only the assigned responder or an admin can release this case', 403);
    }
    if (rescue.assignedResponder) {
      await ResponderProfile.findOneAndUpdate(
        { user: rescue.assignedResponder, activeCaseCount: { $gt: 0 } },
        { $inc: { activeCaseCount: -1 } }
      );
    }
    rescue.assignedResponder = undefined;
    rescue.assignedAt        = undefined;
  }

  // Acceptance: PENDING -> ACCEPTED
  else if (status === 'ACCEPTED') {
    // Concurrency conflict protection: prevent two responders accepting the same case
    if (rescue.assignedResponder && rescue.assignedResponder.toString() !== responderId) {
      return sendError(res, 'This rescue case has already been accepted by another responder', 409);
    }

    // Workload ceiling protection: maximum 3 active cases per responder
    const profile = await ResponderProfile.findOne({ user: responderId });
    if (profile && profile.activeCaseCount >= 3) {
      return sendError(
        res,
        'Workload capacity reached: You already have 3 active rescue cases. Please complete an active case first.',
        400
      );
    }

    if (!rescue.assignedResponder) {
      rescue.assignedResponder = responderId;
      rescue.assignedAt        = new Date();
      if (profile) {
        profile.activeCaseCount += 1;
        await profile.save();
      }
    }
  }

  // Completion: IN_PROGRESS -> RESCUED (Enforce Rescue Proof Evidence)
  else if (status === 'RESCUED') {
    let proofUrl = req.body.proofImageUrl;
    if (req.file) {
      proofUrl = `/uploads/${req.file.filename}`;
    }

    const completionNote = req.body.completionNote;

    // Backend verification enforcement: must provide image or completion documentation
    if (!proofUrl && (!completionNote || !completionNote.trim())) {
      return sendError(
        res,
        'Mandatory evidence required: Both proofImageUrl (or uploaded photo) and completionNote are required to mark case as RESCUED',
        400
      );
    }

    rescue.verification = {
      verificationStatus:  'completed',
      proofImageUrl:       proofUrl || undefined,
      completionNote:      completionNote?.trim() || 'Rescue completed successfully.',
      handoverDestination: req.body.handoverDestination?.trim() || 'Veterinary Facility',
      completedAt:         new Date(),
      verifiedAt:          new Date(),
      verifiedBy:          responderId,
    };

    // Decrement active workload and increment completed count
    if (rescue.assignedResponder) {
      await ResponderProfile.findOneAndUpdate(
        { user: rescue.assignedResponder, activeCaseCount: { $gt: 0 } },
        { $inc: { activeCaseCount: -1, completedCaseCount: 1 } }
      );
    }
  }

  // Cancellation: Release responder's active workload if previously assigned
  else if (status === 'CANCELLED') {
    if (rescue.assignedResponder) {
      await ResponderProfile.findOneAndUpdate(
        { user: rescue.assignedResponder, activeCaseCount: { $gt: 0 } },
        { $inc: { activeCaseCount: -1 } }
      );
    }
  }

  rescue.status = status;
  rescue.statusHistory.push({
    status,
    changedBy: responderId || undefined,
    timestamp: new Date(),
    note:      req.body.note || `Status updated to ${status}`,
  });

  await rescue.save();

  await AuditLog.create({
    actor: responderId,
    actorRole: req.user?.role,
    action: `STATUS_UPDATED_${status}`,
    rescueCase: rescue._id,
    description: `Status changed to ${status}`
  });

  // Auto-create activity
  const activityType = STATUS_ACTIVITY_TYPE[status];
  const messageFn    = STATUS_MESSAGES[status];
  if (activityType && messageFn) {
    await createActivity({
      rescueCaseId: rescue._id,
      type:         activityType,
      message:      messageFn(responderName),
      userId:       responderId,
      userName:     responderName,
    });
  }

  // Phase 7: Notification mapping
  const STATUS_NOTIFICATIONS = {
    ACCEPTED: {
      type: 'CASE_ACCEPTED',
      title: 'Rescue Request Accepted',
      message: 'A responder has accepted your rescue request.',
    },
    IN_PROGRESS: {
      type: 'RESCUE_STARTED',
      title: 'Rescue Started',
      message: 'The rescue operation for your case is now in progress.',
    },
    RESCUED: {
      type: 'CASE_RESCUED',
      title: 'Rescue Completed',
      message: 'The rescue operation has been completed.',
    },
    CANCELLED: {
      type: 'CASE_CANCELLED',
      title: 'Rescue Request Cancelled',
      message: 'Your rescue request has been cancelled.',
    },
  };

  const notificationConfig = STATUS_NOTIFICATIONS[status];
  if (notificationConfig && rescue.reporter) {
    await createNotification({
      recipient: rescue.reporter,
      rescueCase: rescue._id,
      type: notificationConfig.type,
      title: notificationConfig.title,
      message: notificationConfig.message,
    });
  }

  // Return populated version
  const populated = await populateRescue(
    RescueCase.findById(rescue._id)
  ).lean();

  return sendSuccess(res, populated, `Status updated to ${status}`);
};

// ─── getUserRescues ───────────────────────────────────────────────────────────

const getUserRescues = async (req, res) => {
  if (!req.user?.userId) {
    return sendError(res, 'Authentication required to view your rescues', 401);
  }

  const rescues = await populateRescue(
    RescueCase.find({ reporter: req.user.userId }).sort({ createdAt: -1 })
  ).lean();

  return sendSuccess(res, rescues, 'Your rescue cases fetched successfully');
};

// ─── submitFeedback ────────────────────────────────────────────────────────────

const submitFeedback = async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return sendError(res, 'Valid rating (1-5) is required', 400);
  }

  const rescue = await RescueCase.findById(req.params.id);
  if (!rescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  if (rescue.status !== 'RESCUED') {
    return sendError(res, 'Feedback can only be submitted for completed rescues', 400);
  }

  if (rescue.reporter?.toString() !== req.user.userId) {
    return sendError(res, 'Only the original reporter can submit feedback', 403);
  }

  if (rescue.feedback && rescue.feedback.rating) {
    return sendError(res, 'Feedback has already been submitted for this case', 400);
  }

  rescue.feedback = {
    rating,
    comment,
    submittedAt: new Date()
  };

  await rescue.save();

  await AuditLog.create({
    actor: req.user.userId,
    actorRole: 'citizen',
    action: 'FEEDBACK_SUBMITTED',
    rescueCase: rescue._id,
    description: `Feedback submitted: ${rating} stars`
  });

  return sendSuccess(res, rescue, 'Feedback submitted successfully');
};

module.exports = {
  createRescue,
  getAllRescues,
  getRescueById,
  updateRescueStatus,
  getUserRescues,
  submitFeedback,
};
