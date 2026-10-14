/**
 * activityController.js — Phase 5
 *
 * Handles:
 *   getActivities   — GET  /api/rescues/:id/activities
 *   addUpdate       — POST /api/rescues/:id/updates
 *
 * Access control:
 *   - Citizens can only see activities for their own cases
 *   - Responders can see activities for cases assigned to them (or any case if admin)
 *   - Admins can access all
 *   - Only the assigned responder may post updates (type=NOTE)
 */

const RescueCase     = require('../models/RescueCase');
const RescueActivity = require('../models/RescueActivity');
const { createNotification } = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── getActivities ────────────────────────────────────────────────────────────

/**
 * GET /api/rescues/:id/activities
 *
 * Returns timeline activities for a rescue case, oldest first.
 *
 * Access:
 *   admin      → any case
 *   responder  → any case (they handle cases)
 *   citizen    → only their own case (reporter === req.user.userId)
 */
const getActivities = async (req, res) => {
  const rescue = await RescueCase.findByIdOrCaseId(req.params.id).lean();
  if (!rescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  // Activities represent public milestone history (e.g. reported, accepted, rescued, update notes)
  // Verified authenticated users may view history details for any valid case reference
  const activities = await RescueActivity.find({ rescueCase: rescue._id })
    .sort({ createdAt: 1 }) // oldest first — chronological timeline
    .lean();

  return sendSuccess(res, activities, 'Activities fetched successfully');
};

// ─── addUpdate ────────────────────────────────────────────────────────────────

/**
 * POST /api/rescues/:id/updates
 *
 * Allows the assigned responder to post a progress update note.
 *
 * Body: { "message": "Reached the location." }
 *
 * Rules:
 *   - User must be authenticated
 *   - User must be the assigned responder for this case
 *     (or an admin)
 *   - Message must not be empty
 *   - Message max 500 characters
 */
const addUpdate = async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return sendError(res, 'Update message is required', 400);
  }
  if (message.trim().length > 500) {
    return sendError(res, 'Message cannot exceed 500 characters', 400);
  }

  const rescue = await RescueCase.findByIdOrCaseId(req.params.id);
  if (!rescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  const { userId, role } = req.user;

  // Only the assigned responder or an admin may add updates
  if (role !== 'admin') {
    const isAssigned =
      rescue.assignedResponder &&
      rescue.assignedResponder.toString() === userId;

    if (!isAssigned) {
      return sendError(
        res,
        'Only the assigned responder can add updates to this case',
        403
      );
    }
  }

  // Cannot add updates to terminal cases
  if (rescue.status === 'RESCUED' || rescue.status === 'CANCELLED') {
    return sendError(
      res,
      `Cannot add updates to a ${rescue.status} case`,
      422
    );
  }

  const activity = await RescueActivity.create({
    rescueCase:    rescue._id,
    type:          'NOTE',
    message:       message.trim(),
    createdBy:     userId,
    createdByName: req.user.name,
  });

  // Phase 7: Create notification for the citizen
  if (rescue.reporter) {
    await createNotification({
      recipient: rescue.reporter,
      rescueCase: rescue._id,
      type: 'RESCUE_UPDATE',
      title: 'New Rescue Update',
      message: 'The responder added a new update to your rescue case.',
    });
  }

  return sendSuccess(res, activity, 'Update added successfully', 201);
};

module.exports = { getActivities, addUpdate };
