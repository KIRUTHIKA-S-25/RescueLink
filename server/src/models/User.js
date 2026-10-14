/**
 * User.js
 *
 * Mongoose model for a RescueLink user account.
 *
 * WHO uses this?
 * - Citizens who report rescue cases
 * - Responders who handle rescue cases
 * - Admins who oversee the platform
 *
 * NOTE (Phase 2):
 * The `password` field is defined in the schema but is intentionally stored
 * as plain text for now — it is a placeholder for Phase 3, where bcrypt
 * hashing will be added before the registration/login routes are built.
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
      validate: {
        validator: function (v) {
          return !/\d/.test(v) && /^[a-zA-Z\s.'-]+$/.test(v);
        },
        message: 'Name must contain letters only (numbers are not allowed).',
      },
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,        // Enforced at the database level (creates an index)
      lowercase: true,     // Always store emails in lowercase for consistency
      trim: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please provide a valid email address.',
      },
    },

    /**
     * Plain string for now.
     * Phase 3 will add bcrypt hashing before this value is ever saved.
     */
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          const digits = v.replace(/\D/g, '');
          let core = digits;
          if (digits.length === 12 && digits.startsWith('91')) core = digits.slice(2);
          else if (digits.length === 11 && digits.startsWith('0')) core = digits.slice(1);
          return core.length === 10;
        },
        message: 'Phone number must be exactly 10 digits.',
      },
    },

    role: {
      type: String,
      enum: {
        values: ['citizen', 'responder', 'admin'],
        message: 'Role must be one of: citizen, responder, admin',
      },
      default: 'citizen',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    /**
     * timestamps: true
     * Automatically adds `createdAt` and `updatedAt` fields to every document.
     * Mongoose manages these — we never set them manually.
     */
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
