/**
 * Notification.js
 *
 * Mongoose model for in-app notifications.
 *
 * WHO receives notifications?
 * - Citizens: case status updates (e.g. "A responder has been assigned")
 * - Responders: new assignment alerts, escalation warnings
 * - Admins: escalation alerts, verification requests
 *
 * NOTE (Phase 2):
 * Only the schema is defined here. Notification generation (triggered by case
 * events) and real-time delivery via Socket.IO belong to later phases.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    /**
     * The user who will see this notification.
     * Required — every notification must have an intended recipient.
     */
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification must have a recipient'],
    },

    /**
     * Machine-readable notification category.
     * Examples: "case_assigned", "case_escalated", "verification_required"
     * Used in the frontend to pick the correct icon/colour.
     */
    type: {
      type: String,
      enum: [
        'CASE_CREATED',
        'CASE_ACCEPTED',
        'RESCUE_STARTED',
        'RESCUE_UPDATE',
        'CASE_RESCUED',
        'CASE_CANCELLED',
        'CASE_ESCALATED',
        'CASE_RELEASED',
        'CASE_NEARBY',
      ],
      required: [true, 'Notification type is required'],
    },

    // Short headline shown in the notification list
    title: {
      type: String,
      required: [true, 'Notification title is required'],
    },

    // Full notification message
    message: {
      type: String,
      required: [true, 'Notification message is required'],
    },

    // Tracks whether the user has dismissed/read the notification
    read: {
      type: Boolean,
      default: false,
    },

    /**
     * Optional link back to the case that triggered this notification.
     * Allows the frontend to navigate directly to the case detail page.
     */
    rescueCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RescueCase',
    },

    // Use Date.now default directly instead of timestamps:true so we have
    // a single `createdAt` field matching the spec (notifications don't need updatedAt)
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
  // No timestamps: true here — the spec defines only createdAt, not updatedAt
);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

