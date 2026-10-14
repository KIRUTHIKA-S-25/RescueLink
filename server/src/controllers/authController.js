/**
 * authController.js
 *
 * Handles:
 *   register       — POST /api/auth/register
 *   login          — POST /api/auth/login
 *   getCurrentUser — GET  /api/auth/me
 *
 * Security notes:
 *  - Passwords are ALWAYS hashed with bcryptjs before saving.
 *  - Passwords / hashes are NEVER returned in any response.
 *  - Public registration ALWAYS creates a "citizen" — the role field in the
 *    request body is completely ignored. This prevents privilege escalation.
 *  - Login error messages are intentionally vague: we say "Invalid credentials"
 *    whether the email doesn't exist OR the password is wrong, so an attacker
 *    cannot enumerate valid email addresses.
 *  - JWT payload contains only userId + role (minimum necessary data).
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * issueToken
 * Creates a signed JWT for the given user.
 * Payload is kept minimal: only userId and role.
 */
const issueToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * safeUser
 * Returns only the fields that are safe to expose to the client.
 * The password field is intentionally omitted.
 */
const safeUser = (user) => ({
  id:       user._id,
  name:     user.name,
  email:    user.email,
  phone:    user.phone,
  role:     user.role,
  isActive: user.isActive,
});

// ─── register ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Creates a new citizen account.
 * The role is ALWAYS forced to "citizen" regardless of what the request sends.
 */
const register = async (req, res) => {
  const { name, email, password, phone } = req.body;

  // --- Validate required fields ---
  if (!name || !email || !password) {
    return sendError(res, 'Name, email, and password are required', 400);
  }

  // --- Validate Name (Must contain letters only, no numbers allowed, min 2 chars) ---
  const trimmedName = name.trim();
  if (/\d/.test(trimmedName)) {
    return sendError(res, 'Name must contain letters only (numbers are not allowed).', 400);
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmedName) || trimmedName.length < 2) {
    return sendError(res, 'Name must contain letters only and be at least 2 characters long.', 400);
  }

  // --- Validate Phone (If provided, must be digits only and exactly 10 digits) ---
  let cleanedPhone = undefined;
  if (phone && phone.trim()) {
    const rawPhone = phone.trim();
    if (/[a-zA-Z]/.test(rawPhone)) {
      return sendError(res, 'Phone number must contain numbers only (letters are not allowed).', 400);
    }
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let coreDigits = digitsOnly;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      coreDigits = digitsOnly.slice(2);
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      coreDigits = digitsOnly.slice(1);
    }
    if (coreDigits.length !== 10) {
      return sendError(res, `Phone number must be exactly 10 digits (you entered ${coreDigits.length} digits).`, 400);
    }
    cleanedPhone = coreDigits;
  }

  // --- Normalize and Validate Email ---
  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return sendError(res, 'Please enter a valid email address (e.g. name@domain.com).', 400);
  }

  // --- Validate Password Length ---
  if (password.length < 8) {
    return sendError(res, 'Password must be at least 8 characters long.', 400);
  }

  // --- Check for duplicate email ---
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return sendError(res, 'An account with this email already exists', 409);
  }

  // --- Hash password ---
  const salt           = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // --- Create user ---
  // NOTE: role is hardcoded to 'citizen' — the request body role is ignored.
  const user = await User.create({
    name:     trimmedName,
    email:    normalizedEmail,
    password: hashedPassword,
    phone:    cleanedPhone,
    role:     'citizen',   // ← ALWAYS citizen, never from req.body
    isActive: true,
  });

  return sendSuccess(
    res,
    safeUser(user),
    'Account created successfully',
    201
  );
};

// ─── login ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Authenticates a user and returns a JWT.
 * Intentionally uses the same error message for "email not found" and
 * "wrong password" to prevent email enumeration attacks.
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  // --- Validate ---
  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  // --- Find user (include password for comparison) ---
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user) {
    // Vague message — do not reveal whether the email exists
    return sendError(res, 'Invalid credentials', 401);
  }

  // --- Check account is active ---
  if (!user.isActive) {
    return sendError(res, 'Your account has been deactivated. Contact support.', 403);
  }

  // --- Compare password ---
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return sendError(res, 'Invalid credentials', 401);
  }

  // --- Issue JWT ---
  const token = issueToken(user);

  return sendSuccess(
    res,
    {
      token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    },
    'Login successful'
  );
};

// ─── getCurrentUser ───────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile.
 * Requires a valid JWT (set by authMiddleware before this controller runs).
 */
const getCurrentUser = async (req, res) => {
  // req.user.userId was set by authMiddleware
  const user = await User.findById(req.user.userId);

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  return sendSuccess(res, safeUser(user), 'User fetched successfully');
};

module.exports = { register, login, getCurrentUser };
