/**
 * RescueCase.js
 *
 * Mongoose model for an animal rescue case.
 *
 * This is the central document in RescueLink.
 * Every reported animal emergency creates one RescueCase.
 *
 * Key design decisions:
 * - `statusHistory` is an embedded array so we get a full audit trail of every
 *   status change without a separate collection.
 * - `priority`, `escalation`, and `verification` are embedded sub-documents
 *   because they belong exclusively to one case and are always accessed together.
 * - References to User (reporter, assignedResponder, verifiedBy) use ObjectId
 *   refs so we can .populate() them when needed.
 *
 * NOTE (Phase 2):
 * Only the schema is defined here. Business logic such as priority calculation,
 * responder matching, Haversine distance, and escalation timers belong to
 * later phases.
 */

const mongoose = require('mongoose');

// ─── Sub-schema: Status History Entry ─────────────────────────────────────────

/**
 * Every time a case's status changes, one of these objects is pushed onto
 * the `statusHistory` array. This gives us a full audit trail.
 */
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
    },
  },
  { _id: false } // No separate _id needed for sub-documents in the history array
);

// ─── Main Schema ───────────────────────────────────────────────────────────────

const rescueCaseSchema = new mongoose.Schema(
  {
    /**
     * Human-readable case identifier (e.g. "RC-1234567890").
     * Auto-generated on creation — unique index.
     */
    caseId: {
      type: String,
      unique: true,
    },

    // ─── Reporter info (Phase 4: plain strings for public/auth'd reporting) ──

    /**
     * Reporter's display name — stored as a plain string so the form works
     * whether the user is logged in or not.
     */
    reporterName: {
      type: String,
      required: [true, 'Reporter name is required'],
      trim: true,
    },

    reporterContact: {
      type: String,
      required: [true, 'Reporter contact is required'],
      trim: true,
    },

    /**
     * Optional reference to an authenticated User account.
     * Set when the reporter is logged in; null for anonymous reports.
     */
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ─── Rescue details ───────────────────────────────────────────────────────

    animalType: {
      type: String,
      required: [true, 'Animal type is required'],
      trim: true,
    },

    /**
     * emergencyType replaces rescueCategory for Phase 4.
     * Examples: Injured, Trapped, Abandoned, Accident, Sick, Other
     */
    emergencyType: {
      type: String,
      required: [true, 'Emergency type is required'],
      trim: true,
    },

    // Keep rescueCategory for backwards compatibility with future phases
    rescueCategory: {
      type: String,
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },

    // Optional image URL — Cloudinary upload added in a later phase
    imageUrl: {
      type: String,
    },

    // ─── Location ────────────────────────────────────────────────────────────

    location: {
      latitude:  { type: Number, min: [-90, 'Latitude must be at least -90'], max: [90, 'Latitude cannot exceed 90'] },
      longitude: { type: Number, min: [-180, 'Longitude must be at least -180'], max: [180, 'Longitude cannot exceed 180'] },
      address:   { type: String, required: [true, 'Location address is required'] },
    },

    // ─── Priority & Triage ───────────────────────────────────────────────────

    /**
     * Overall operational priority level.
     */
    priority: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM'
    },

    /**
     * Triage Urgency Scoring (TUS) audit details:
     * TUS = W_animal + W_condition + W_location_risk
     */
    triage: {
      score: { type: Number },
      priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      breakdown: {
        animalRisk: { type: Number },
        conditionSeverity: { type: Number },
        locationRisk: { type: Number },
      },
      scoringInputs: {
        animalType: { type: String },
        emergencyType: { type: String },
        description: { type: String },
        locationAddress: { type: String },
      },
      calculatedAt: { type: Date, default: Date.now },
      disclaimer: { type: String },
    },

    // ─── Assignment ──────────────────────────────────────────────────────────

    // The responder currently assigned to this case (optional until assigned)
    assignedResponder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Timestamp of when the responder was assigned
    assignedAt: {
      type: Date,
    },

    // ─── Status ──────────────────────────────────────────────────────────────

    status: {
      type: String,
      enum: {
        values: [
          // ── Primary workflow statuses ──
          'PENDING',            // Citizen submitted, awaiting acceptance
          'ACCEPTED',           // Responder accepted the case
          'IN_PROGRESS',        // Responder is actively rescuing
          'RESCUED',            // Animal has been rescued
          'CANCELLED',          // Case cancelled
          'ESCALATED',          // Escalated to administrators due to response SLA timeout
          // ── Future phase statuses (reserved) ──
          'reported',
          'prioritized',
          'assigned',
          'accepted',
          'on_the_way',
          'rescued',
          'handed_over',
          'pending_verification',
          'verified',
          'resolved',
          'escalated',
          'cancelled',
        ],
        message: 'Invalid status value',
      },
      default: 'PENDING',
    },

    /**
     * Full audit trail of every status change.
     * Each entry records who changed it, when, and an optional note.
     */
    statusHistory: [statusHistorySchema],

    // ─── Escalation ──────────────────────────────────────────────────────────

    escalation: {
      isEscalated: { type: Boolean, default: false },
      escalatedAt: { type: Date },
      escalationReason: { type: String },
      searchRadiusKm: { type: Number, default: 15 },
    },

    // ─── Verification ────────────────────────────────────────────────────────

    /**
     * Filled in during the verification phase (Phase 8).
     * Admin reviews the responder's completion proof before closing the case.
     */
    verification: {
      verificationStatus: { type: String },  // e.g. "pending", "approved", "rejected"
      proofImageUrl: { type: String },       // Uploaded by responder as evidence
      completionNote: { type: String },
      handoverDestination: { type: String }, // Shelter/vet name where animal was taken
      completedAt: { type: Date },           // When the responder marked it complete
      verifiedAt: { type: Date },            // When the admin verified it
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },

    // ─── Duplicate Detection & Corroborating Reports ─────────────────────────

    duplicateInfo: {
      isDuplicate: { type: Boolean, default: false },
      primaryCase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RescueCase',
      },
      duplicateDetectedAt: { type: Date },
    },

    /**
     * Corroborating reports attached by other citizens reporting the same incident
     * (<100m, <45m window, same animal category).
     */
    corroboratingReports: [
      {
        reporterName: { type: String, required: true },
        reporterContact: { type: String, required: true },
        reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        description: { type: String },
        imageUrl: { type: String },
        location: {
          address: { type: String },
          latitude: { type: Number },
          longitude: { type: Number },
        },
        distanceMeters: { type: Number },
        reportedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes for query performance and geospatial lookup
rescueCaseSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
rescueCaseSchema.index({ status: 1, createdAt: -1 });
rescueCaseSchema.index({ animalType: 1, createdAt: -1 });
rescueCaseSchema.index({ 'escalation.isEscalated': 1, status: 1 });

/**
 * Static helper to find a case by either MongoDB _id or human-readable caseId without CastErrors.
 */
rescueCaseSchema.statics.findByIdOrCaseId = function (identifier) {
  if (!identifier) return null;
  const str = String(identifier).trim();
  if (mongoose.Types.ObjectId.isValid(str) && /^[0-9a-fA-F]{24}$/.test(str)) {
    return this.findOne({ $or: [{ _id: new mongoose.Types.ObjectId(str) }, { caseId: str }] });
  }
  return this.findOne({ caseId: str });
};

const RescueCase = mongoose.model('RescueCase', rescueCaseSchema);

module.exports = RescueCase;
