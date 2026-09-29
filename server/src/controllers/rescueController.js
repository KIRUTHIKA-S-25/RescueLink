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

const RescueCase     = require('../models/RescueCase');
const RescueActivity = require('../models/RescueActivity');
const { createNotification } = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── Valid statuses ───────────────────────────────────────────────────────────

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED', 'CANCELLED'];

const ALLOWED_TRANSITIONS = {
  PENDING:     ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:    ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['RESCUED'],
  RESCUED:     [],
  CANCELLED:   [],
};

// ─── Activity messages per status ─────────────────────────────────────────────

const STATUS_ACTIVITY_TYPE = {
  ACCEPTED:    'CASE_ACCEPTED',
  IN_PROGRESS: 'RESCUE_STARTED',
  RESCUED:     'CASE_RESCUED',
  CANCELLED:   'CASE_CANCELLED',
};

const STATUS_MESSAGES = {
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
    location,
    imageUrl,
  } = req.body;

  const missing = [];
  if (!reporterName?.trim())      missing.push('reporterName');
  if (!reporterContact?.trim())   missing.push('reporterContact');
  if (!animalType?.trim())        missing.push('animalType');
  if (!emergencyType?.trim())     missing.push('emergencyType');
  if (!description?.trim())       missing.push('description');
  if (!location?.address?.trim()) missing.push('location.address');

  if (missing.length > 0) {
    return sendError(res, `Missing required fields: ${missing.join(', ')}`, 400);
  }

  // Validate coordinates completeness
  const hasLat = location.latitude !== undefined && location.latitude !== null;
  const hasLng = location.longitude !== undefined && location.longitude !== null;

  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    return sendError(res, 'Both latitude and longitude are required if providing coordinates', 400);
  }

  if (hasLat && hasLng) {
    if (typeof location.latitude !== 'number' || location.latitude < -90 || location.latitude > 90) {
      return sendError(res, 'Invalid latitude', 400);
    }
    if (typeof location.longitude !== 'number' || location.longitude < -180 || location.longitude > 180) {
      return sendError(res, 'Invalid longitude', 400);
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
      address:   location.address.trim(),
      latitude:  location.latitude  || undefined,
      longitude: location.longitude || undefined,
    },
    status: 'PENDING',
    statusHistory: [{
      status:    'PENDING',
      timestamp: new Date(),
      note:      'Case created',
    }],
  });

  // Auto-create the CASE_CREATED activity
  await createActivity({
    rescueCaseId: rescue._id,
    type:         'CASE_CREATED',
    message:      `Rescue request created by ${rescue.reporterName}.`,
    userId:       req.user?.userId,
    userName:     rescue.reporterName,
  });

  // Phase 7: Create notification for the citizen
  if (rescue.reporter) {
    await createNotification({
      recipient: rescue.reporter,
      rescueCase: rescue._id,
      type: 'CASE_CREATED',
      title: 'Rescue Request Submitted',
      message: 'Your rescue request has been successfully submitted and is waiting for a responder.',
    });
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

  // ─── Phase 5: assign responder on ACCEPTED ─────────────────────────────────
  if (status === 'ACCEPTED') {
    // Only assign if not already assigned (prevent re-assignment in same status)
    if (!rescue.assignedResponder) {
      rescue.assignedResponder = responderId;
      rescue.assignedAt        = new Date();
    }
  }

  rescue.status = status;
  rescue.statusHistory.push({
    status,
    changedBy: responderId || undefined,
    timestamp: new Date(),
    note:      `Status updated to ${status}`,
  });

  await rescue.save();

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

module.exports = {
  createRescue,
  getAllRescues,
  getRescueById,
  updateRescueStatus,
  getUserRescues,
};
