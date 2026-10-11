/**
 * RescueActivity.js
 *
 * Activity/timeline entries for rescue cases.
 *
 * Each document represents one event in a rescue case's history.
 * Activities are created automatically by the backend — never by the frontend.
 *
 * Activity types:
 *   CASE_CREATED    — Case was submitted by citizen
 *   CASE_ACCEPTED   — Responder accepted the case
 *   RESCUE_STARTED  — Responder started (IN_PROGRESS)
 *   CASE_RESCUED    — Animal rescued
 *   CASE_CANCELLED  — Case cancelled
 *   NOTE            — Responder progress update
 *   STATUS_CHANGED  — Generic status change (fallback)
 */

const mongoose = require('mongoose');

const rescueActivitySchema = new mongoose.Schema(
  {
    /**
     * Reference to the rescue case this activity belongs to.
     * Indexed for fast retrieval: GET /api/rescues/:id/activities
     */
    rescueCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RescueCase',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        'CASE_CREATED',
        'CASE_ACCEPTED',
        'RESCUE_STARTED',
        'CASE_RESCUED',
        'CASE_CANCELLED',
        'CASE_ESCALATED',
        'CASE_RELEASED',
        'CASE_NEARBY',
        'STATUS_CHANGED',
        'NOTE',
      ],
      required: true,
    },

    /**
     * Human-readable message shown in the timeline.
     * Example: "Rescue request accepted by Test Responder"
     */
    message: {
      type: String,
      required: [true, 'Activity message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },

    /**
     * User who triggered this activity.
     * Null for system-generated events where no user is available.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    /**
     * Display name snapshot — stored so the timeline remains readable
     * even if the user account is later modified or deleted.
     */
    createdByName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt is used as the activity timestamp
  }
);

const RescueActivity = mongoose.model('RescueActivity', rescueActivitySchema);

module.exports = RescueActivity;
