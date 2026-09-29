/**
 * ResponderProfile.js
 *
 * Mongoose model for a responder's operational profile.
 *
 * WHY a separate model from User?
 * - Not every user is a responder.
 * - Responder-specific data (location, capabilities, case counts) would bloat
 *   the User document for citizens and admins.
 * - Keeping it separate follows the principle of separation of concerns and
 *   makes responder queries cleaner.
 *
 * Relationship: one-to-one with User (a responder has exactly one profile).
 */

const mongoose = require('mongoose');

const responderProfileSchema = new mongoose.Schema(
  {
    /**
     * Reference to the User document for this responder.
     * Stored as a MongoDB ObjectId; Mongoose will populate the full User
     * when we call .populate('user') in a query.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A responder profile must be linked to a user'],
    },

    availability: {
      type: String,
      enum: {
        values: ['available', 'unavailable'],
        message: 'Availability must be either: available or unavailable',
      },
      default: 'available',
    },

    // GPS coordinates — set when the responder shares their location
    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    // Free-text description of the area the responder covers (e.g. "North Chennai")
    serviceArea: {
      type: String,
    },

    // List of animal types or rescue skills the responder is trained for
    // e.g. ["dog", "cat", "snake", "bird"]
    rescueCapabilities: {
      type: [String],
      default: [],
    },

    // Tracks workload — useful for Phase 6 responder matching
    activeCaseCount: {
      type: Number,
      default: 0,
    },

    completedCaseCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

const ResponderProfile = mongoose.model('ResponderProfile', responderProfileSchema);

module.exports = ResponderProfile;
