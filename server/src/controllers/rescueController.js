/**
 * rescueController.js
 *
 * Core Rescue Workflow Controller:
 * - createRescue: Evaluates TUS priority, detects duplicate incidents, attaches corroborating reports
 * - getAllRescues: Filtered queue with privacy-conscious location projection
 * - getRescueById: Detailed case view with role-based coordinate redaction
 * - updateRescueStatus: Atomic state machine with race condition prevention, mandatory proof on RESCUED, and release with mandatory reason
 * - unmergeCorroboratingReport: Admin tool to separate misidentified duplicate reports
 * - getUserRescues: Submitted cases for authenticated citizens
 * - submitFeedback: Reporter rating (1-5 stars) on completed rescues
 */

const fs                = require('fs');
const path              = require('path');
const RescueCase        = require('../models/RescueCase');
const RescueActivity    = require('../models/RescueActivity');
const ResponderProfile  = require('../models/ResponderProfile');
const AuditLog          = require('../models/AuditLog');
const { createNotification }     = require('../services/notificationService');
const { evaluateTriage }         = require('../utils/triageUtils');
const { detectDuplicateCase }     = require('../services/duplicateDetectionService');
const { findEligibleResponders }  = require('../utils/geoUtils');
const { sendSuccess, sendError }  = require('../utils/apiResponse');
const { uploadToCloudinary }      = require('../services/cloudinaryService');

// ─── Valid statuses and allowed transitions ──────────────────────────────────

const VALID_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESCUED', 'CANCELLED', 'ESCALATED'];

const ALLOWED_TRANSITIONS = {
  PENDING:     ['ACCEPTED', 'CANCELLED'],
  ESCALATED:   ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:    ['IN_PROGRESS', 'PENDING', 'CANCELLED'], // PENDING = release case
  IN_PROGRESS: ['RESCUED', 'PENDING', 'CANCELLED'],    // PENDING = emergency release
  RESCUED:     [],
  CANCELLED:   [],
};

// ─── Activity types per status ───────────────────────────────────────────────

const STATUS_ACTIVITY_TYPE = {
  PENDING:     'CASE_RELEASED',
  ACCEPTED:    'CASE_ACCEPTED',
  IN_PROGRESS: 'RESCUE_STARTED',
  RESCUED:     'CASE_RESCUED',
  CANCELLED:   'CASE_CANCELLED',
  ESCALATED:   'CASE_ESCALATED',
};

const STATUS_MESSAGES = {
  PENDING:     (name) => `Case released back to pending queue${name ? ` by ${name}` : ''}.`,
  ACCEPTED:    (name) => `Rescue request accepted${name ? ` by ${name}` : ''}.`,
  IN_PROGRESS: (name) => `Responder${name ? ` ${name}` : ''} started the rescue.`,
  RESCUED:     ()     => 'Animal rescue completed successfully. Evidence documented.',
  CANCELLED:   ()     => 'Rescue request was cancelled.',
  ESCALATED:   ()     => 'Rescue request was escalated to coordinators.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateCaseId = () => {
  const ts  = Date.now();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RC-${ts}-${rnd}`;
};

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
    console.error('[Activity] Failed to create activity:', err.message);
  }
};

const populateRescue = (query) =>
  query.populate('assignedResponder', 'name phone email role');

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
  } = req.body;

  let imageUrl = req.body.imageUrl;
  if (req.file) {
    const cloudRes = await uploadToCloudinary(req.file.path, 'rescuelink/incidents');
    imageUrl = cloudRes.url || `/uploads/${req.file.filename}`;
  }

  // Required field validation
  const missing = [];
  if (!reporterName?.trim())      missing.push('reporterName');
  if (!reporterContact?.trim())   missing.push('reporterContact');
  if (!animalType?.trim())        missing.push('animalType');
  if (!emergencyType?.trim())     missing.push('emergencyType');
  if (!description?.trim())       missing.push('description');
  if (!locationAddress?.trim())   missing.push('locationAddress');

  if (missing.length > 0) {
    return sendError(res, `Missing required fields: ${missing.join(', ')}`, 400);
  }

  // --- Validate reporterName (Must contain letters only, no numbers allowed, min 2 chars) ---
  const trimmedReporterName = reporterName.trim();
  if (/\d/.test(trimmedReporterName)) {
    return sendError(res, 'Reporter name must contain letters only (numbers are not allowed).', 400);
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmedReporterName) || trimmedReporterName.length < 2) {
    return sendError(res, 'Reporter name must contain letters only and be at least 2 characters long.', 400);
  }

  // --- Validate reporterContact (Must be numbers only and exactly 10 digits) ---
  const rawContact = reporterContact.trim();
  if (/[a-zA-Z]/.test(rawContact)) {
    return sendError(res, 'Phone number must contain numbers only (letters are not allowed).', 400);
  }
  const contactDigits = rawContact.replace(/\D/g, '');
  let coreContactDigits = contactDigits;
  if (contactDigits.length === 12 && contactDigits.startsWith('91')) {
    coreContactDigits = contactDigits.slice(2);
  } else if (contactDigits.length === 11 && contactDigits.startsWith('0')) {
    coreContactDigits = contactDigits.slice(1);
  }
  if (coreContactDigits.length !== 10) {
    return sendError(res, `Phone number must be exactly 10 digits (you entered ${coreContactDigits.length} digits).`, 400);
  }

  // --- Validate description length ---
  if (description.trim().length < 10) {
    return sendError(res, 'Please provide a more descriptive emergency explanation (minimum 10 characters).', 400);
  }

  // --- Validate locationAddress length ---
  if (locationAddress.trim().length < 5) {
    return sendError(res, 'Location address must be at least 5 characters long.', 400);
  }

  // Coordinate completeness and range validation
  let lat = latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : undefined;
  let lng = longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : undefined;

  const hasLat = lat !== undefined && !isNaN(lat);
  const hasLng = lng !== undefined && !isNaN(lng);

  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    return sendError(res, 'Both latitude and longitude are required if coordinates are provided', 400);
  }

  if (hasLat && hasLng) {
    if (lat < -90 || lat > 90) {
      return sendError(res, 'Latitude must be between -90 and 90 degrees', 400);
    }
    if (lng < -180 || lng > 180) {
      return sendError(res, 'Longitude must be between -180 and 180 degrees', 400);
    }
  }

  // 1. Calculate Priority (TUS) via Backend Engine (Client cannot override)
  const triageResult = evaluateTriage({
    animalType,
    emergencyType,
    description,
    locationAddress,
  });

  const computedPriority = triageResult.priority;

  // 2. Duplicate Detection (<100m, <45m, matching animal category)
  if (hasLat && hasLng) {
    const dupCheck = await detectDuplicateCase({
      animalType,
      latitude: lat,
      longitude: lng,
    });

    if (dupCheck.isDuplicate && dupCheck.primaryCase) {
      const primary = await RescueCase.findById(dupCheck.primaryCase._id);
      if (primary && ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ESCALATED'].includes(primary.status)) {
        // Attach as Corroborating Report to the primary case without duplicating dispatch
        const corroboratingEntry = {
          reporterName: reporterName.trim(),
          reporterContact: reporterContact.trim(),
          reporter: req.user?.userId || undefined,
          description: description.trim(),
          imageUrl: imageUrl || undefined,
          location: {
            address: locationAddress.trim(),
            latitude: lat,
            longitude: lng,
          },
          distanceMeters: dupCheck.distanceMeters,
          reportedAt: new Date(),
        };

        primary.corroboratingReports.push(corroboratingEntry);
        await primary.save();

        // Audit log
        await AuditLog.create({
          actor: req.user?.userId,
          actorRole: req.user?.role || 'guest',
          action: 'CORROBORATING_REPORT_ATTACHED',
          rescueCase: primary._id,
          description: `Corroborating report attached by ${reporterName.trim()} (${dupCheck.distanceMeters}m from original scene)`,
        });

        // Timeline activity
        await createActivity({
          rescueCaseId: primary._id,
          type: 'NOTE',
          message: `Corroborating report received from ${reporterName.trim()} (${dupCheck.distanceMeters}m away). Additional details recorded.`,
          userId: req.user?.userId,
          userName: reporterName.trim(),
        });

        // If the corroborating reporter is authenticated, notify them
        if (req.user?.userId) {
          await createNotification({
            recipient: req.user.userId,
            rescueCase: primary._id,
            type: 'CASE_CREATED',
            title: 'Corroborating Report Attached',
            message: `A matching rescue incident (${primary.caseId}) is already being processed nearby. Your evidence has been attached.`,
          });
        }

        // Return the existing case reference to the reporter without exposing other citizens' sensitive data
        return sendSuccess(
          res,
          {
            isDuplicate: true,
            caseId: primary.caseId,
            _id: primary._id,
            status: primary.status,
            animalType: primary.animalType,
            emergencyType: primary.emergencyType,
            message: 'A matching rescue incident is already active nearby. Your report and photo have been attached as corroborating evidence.',
          },
          'Corroborating report linked to existing case',
          200
        );
      }
    }
  }

  // 3. Create New Independent Rescue Case
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
    triage: triageResult,
    status: 'PENDING',
    statusHistory: [{
      status:    'PENDING',
      timestamp: new Date(),
      note:      `Case created (Priority: ${computedPriority}, Score: ${triageResult.score})`,
    }],
  });

  // Audit log
  await AuditLog.create({
    actor: req.user?.userId,
    actorRole: req.user?.role || 'guest',
    action: 'CASE_CREATED',
    rescueCase: rescue._id,
    description: `Case reported by ${rescue.reporterName} (Priority: ${computedPriority}, TUS Score: ${triageResult.score})`,
  });

  // Timeline Activity
  await createActivity({
    rescueCaseId: rescue._id,
    type:         'CASE_CREATED',
    message:      `Rescue request created by ${rescue.reporterName} (Priority: ${computedPriority}, TUS: ${triageResult.score}).`,
    userId:       req.user?.userId,
    userName:     rescue.reporterName,
  });

  // Citizen Notification
  if (rescue.reporter) {
    await createNotification({
      recipient: rescue.reporter,
      rescueCase: rescue._id,
      type: 'CASE_CREATED',
      title: 'Rescue Request Submitted',
      message: `Your emergency request has been registered (${computedPriority} Priority). Finding nearby responders.`,
    });
  }

  // 4. Proximity-based Dispatch: Alert nearby eligible responders (within 15km)
  if (hasLat && hasLng) {
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
    RescueCase.findByIdOrCaseId(req.params.id)
  ).lean();

  if (!rescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  // Security: Strip exact coordinates unless user is admin, responder, or the owner citizen
  const user = req.user;
  let canViewCoordinates = false;

  if (user) {
    if (user.role === 'admin' || user.role === 'responder') {
      canViewCoordinates = true;
    } else if (user.role === 'citizen' && rescue.reporter && rescue.reporter.toString() === user.userId) {
      canViewCoordinates = true;
    }
  }

  if (!canViewCoordinates && rescue.location) {
    delete rescue.location.latitude;
    delete rescue.location.longitude;
  }

  return sendSuccess(res, rescue, 'Rescue case fetched successfully');
};

// ─── updateRescueStatus ──────────────────────────────────────────────────────

const updateRescueStatus = async (req, res) => {
  const { status, releaseReason, note } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return sendError(
      res,
      `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      400
    );
  }

  const existingRescue = await RescueCase.findByIdOrCaseId(req.params.id);
  if (!existingRescue) {
    return sendError(res, 'Rescue case not found', 404);
  }

  // Enforce state transition rules
  const allowed = ALLOWED_TRANSITIONS[existingRescue.status] || [];
  if (!allowed.includes(status)) {
    return sendError(
      res,
      `Cannot transition from ${existingRescue.status} to ${status}. ` +
        (allowed.length > 0
          ? `Allowed next statuses: ${allowed.join(', ')}`
          : `${existingRescue.status} is a terminal status.`),
      422
    );
  }

  const responderId   = req.user?.userId;
  const responderName = req.user?.name;
  const responderRole = req.user?.role;

  // ─── Status Transition Logic ───────────────────────────────────────────────

  // 1. ACCEPTANCE: (PENDING | ESCALATED) -> ACCEPTED
  if (status === 'ACCEPTED') {
    if (responderRole !== 'responder' && responderRole !== 'admin') {
      return sendError(res, 'Only a registered responder or admin can accept cases', 403);
    }

    // Workload limit: maximum 3 active cases per responder
    const profile = await ResponderProfile.findOne({ user: responderId });
    if (profile && profile.activeCaseCount >= 3) {
      return sendError(
        res,
        'Workload capacity reached: You already have 3 active rescue cases. Please complete an active case first.',
        400
      );
    }

    // Atomic acceptance with concurrency lock: prevents two responders accepting the same case simultaneously
    const atomicAccepted = await RescueCase.findOneAndUpdate(
      {
        _id: existingRescue._id,
        status: { $in: ['PENDING', 'ESCALATED'] },
        assignedResponder: { $in: [null, undefined] },
      },
      {
        $set: {
          status: 'ACCEPTED',
          assignedResponder: responderId,
          assignedAt: new Date(),
        },
        $push: {
          statusHistory: {
            status: 'ACCEPTED',
            changedBy: responderId,
            timestamp: new Date(),
            note: note || `Rescue case accepted by ${responderName || 'responder'}`,
          },
        },
      },
      { returnDocument: 'after' }
    );

    if (!atomicAccepted) {
      return sendError(
        res,
        'Conflict: This rescue case is no longer available or has already been accepted by another responder.',
        409
      );
    }

    // Increment active workload count
    if (profile) {
      profile.activeCaseCount += 1;
      await profile.save();
    }

    // Activity log
    await createActivity({
      rescueCaseId: atomicAccepted._id,
      type: 'CASE_ACCEPTED',
      message: `Rescue request accepted by ${responderName || 'responder'}.`,
      userId: responderId,
      userName: responderName,
    });

    // Notify citizen
    if (atomicAccepted.reporter) {
      await createNotification({
        recipient: atomicAccepted.reporter,
        rescueCase: atomicAccepted._id,
        type: 'CASE_ACCEPTED',
        title: 'Rescue Request Accepted',
        message: `${responderName || 'A responder'} has accepted your rescue case and is preparing dispatch.`,
      });
    }

    const populated = await populateRescue(RescueCase.findById(atomicAccepted._id)).lean();
    return sendSuccess(res, populated, 'Rescue case accepted successfully');
  }

  // 2. CASE RELEASE: (ACCEPTED | IN_PROGRESS) -> PENDING
  if (status === 'PENDING') {
    // Only assigned responder or admin can release
    const isAssigned = existingRescue.assignedResponder?.toString() === responderId;
    if (responderRole !== 'admin' && !isAssigned) {
      return sendError(res, 'Only the currently assigned responder or an admin can release this case', 403);
    }

    const reason = releaseReason || note;
    if (!reason || !reason.trim()) {
      return sendError(res, 'A mandatory release reason is required to return this case to the pending pool.', 400);
    }

    // Decrement previous responder's workload
    if (existingRescue.assignedResponder) {
      await ResponderProfile.findOneAndUpdate(
        { user: existingRescue.assignedResponder, activeCaseCount: { $gt: 0 } },
        { $inc: { activeCaseCount: -1 } }
      );
    }

    // Atomically reset assignment
    const releasedCase = await RescueCase.findOneAndUpdate(
      {
        _id: existingRescue._id,
        status: { $in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
      {
        $set: {
          status: 'PENDING',
          assignedResponder: null,
          assignedAt: null,
        },
        $push: {
          statusHistory: {
            status: 'PENDING',
            changedBy: responderId,
            timestamp: new Date(),
            note: `Case released back to pending: ${reason.trim()}`,
          },
        },
      },
      { returnDocument: 'after' }
    );

    if (!releasedCase) {
      return sendError(res, 'Case could not be released due to state conflict', 409);
    }

    // Log Activity
    await createActivity({
      rescueCaseId: releasedCase._id,
      type: 'CASE_RELEASED',
      message: `Case released back to pending queue by ${responderName || 'responder'}: ${reason.trim()}`,
      userId: responderId,
      userName: responderName,
    });

    // Notify citizen
    if (releasedCase.reporter) {
      await createNotification({
        recipient: releasedCase.reporter,
        rescueCase: releasedCase._id,
        type: 'CASE_RELEASED',
        title: 'Case Returned to Dispatch Queue',
        message: 'Your case was released back to the queue and is being reassigned to another available team.',
      });
    }

    // Re-run dispatch matching: notify other available nearby responders (excluding the releasing responder)
    if (releasedCase.location?.latitude && releasedCase.location?.longitude) {
      try {
        const eligible = await findEligibleResponders(
          releasedCase.location.latitude,
          releasedCase.location.longitude,
          15,
          3
        );

        for (const resp of eligible) {
          if (resp.responderId.toString() !== responderId) {
            await createNotification({
              recipient: resp.responderId,
              rescueCase: releasedCase._id,
              type: 'CASE_NEARBY',
              title: `🚨 Reopened Rescue Alert (${resp.distanceKm} km)`,
              message: `Case ${releasedCase.caseId} (${releasedCase.animalType}) is available for reassignment.`,
            });
          }
        }
      } catch (reErr) {
        console.error('[Dispatch] Reassignment notification error:', reErr.message);
      }
    }

    const populated = await populateRescue(RescueCase.findById(releasedCase._id)).lean();
    return sendSuccess(res, populated, 'Rescue case released back to pending pool');
  }

  // 3. COMPLETION: IN_PROGRESS -> RESCUED (Mandatory Proof-of-Rescue Enforcement)
  if (status === 'RESCUED') {
    // Only assigned responder or admin can complete
    const isAssigned = existingRescue.assignedResponder?.toString() === responderId;
    if (responderRole !== 'admin' && !isAssigned) {
      return sendError(res, 'Only the assigned responder or an administrator can mark a case as RESCUED', 403);
    }

    let proofUrl = req.body.proofImageUrl;
    if (req.file) {
      const cloudRes = await uploadToCloudinary(req.file.path, 'rescuelink/proofs');
      proofUrl = cloudRes.url || `/uploads/${req.file.filename}`;
    }

    const completionNote = req.body.completionNote || note;

    // Strict Backend Validation: BOTH photo proof AND completion notes are mandatory
    if (!proofUrl || !proofUrl.trim()) {
      return sendError(
        res,
        'Mandatory photographic proof is required before a case can be marked as RESCUED.',
        400
      );
    }

    if (!completionNote || !completionNote.trim()) {
      return sendError(
        res,
        'Mandatory completion and treatment notes are required before a case can be marked as RESCUED.',
        400
      );
    }

    // Check that uploaded file actually exists on server filesystem if local upload
    if (proofUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../../uploads', path.basename(proofUrl));
      if (!fs.existsSync(filePath)) {
        return sendError(res, 'Uploaded proof file could not be verified on the server.', 400);
      }
    }

    existingRescue.status = 'RESCUED';
    existingRescue.verification = {
      verificationStatus:  'completed',
      proofImageUrl:       proofUrl.trim(),
      completionNote:      completionNote.trim(),
      handoverDestination: req.body.handoverDestination?.trim() || 'Veterinary Facility',
      completedAt:         new Date(),
      verifiedAt:          new Date(),
      verifiedBy:          responderId,
    };

    existingRescue.statusHistory.push({
      status: 'RESCUED',
      changedBy: responderId,
      timestamp: new Date(),
      note: `Rescue evidence submitted: ${completionNote.trim()}`,
    });

    await existingRescue.save();

    // Decrement active cases and increment completed cases
    if (existingRescue.assignedResponder) {
      await ResponderProfile.findOneAndUpdate(
        { user: existingRescue.assignedResponder, activeCaseCount: { $gt: 0 } },
        { $inc: { activeCaseCount: -1, completedCaseCount: 1 } }
      );
    }

    // Audit log
    await AuditLog.create({
      actor: responderId,
      actorRole: responderRole,
      action: 'STATUS_UPDATED_RESCUED',
      rescueCase: existingRescue._id,
      description: `Rescue completed by ${responderName || 'responder'} with verified proof`,
    });

    // Timeline Activity
    await createActivity({
      rescueCaseId: existingRescue._id,
      type: 'CASE_RESCUED',
      message: `Animal rescue completed by ${responderName || 'responder'}. Evidence documented: "${completionNote.trim()}"`,
      userId: responderId,
      userName: responderName,
    });

    // Notify Citizen
    if (existingRescue.reporter) {
      await createNotification({
        recipient: existingRescue.reporter,
        rescueCase: existingRescue._id,
        type: 'CASE_RESCUED',
        title: 'Rescue Operation Completed 🎉',
        message: `Your reported animal has been safely rescued by ${responderName || 'the rescue team'}. You can now view the rescue evidence and leave feedback.`,
      });
    }

    const populated = await populateRescue(RescueCase.findById(existingRescue._id)).lean();
    return sendSuccess(res, populated, 'Rescue completed successfully with verified evidence');
  }

  // 4. GENERAL STATUS UPDATES (e.g. ACCEPTED -> IN_PROGRESS, CANCELLED)
  if (status === 'IN_PROGRESS') {
    const isAssigned = existingRescue.assignedResponder?.toString() === responderId;
    if (responderRole !== 'admin' && !isAssigned) {
      return sendError(res, 'Only the assigned responder or an admin can depart for the rescue', 403);
    }
  }

  if (status === 'CANCELLED') {
    if (existingRescue.assignedResponder) {
      await ResponderProfile.findOneAndUpdate(
        { user: existingRescue.assignedResponder, activeCaseCount: { $gt: 0 } },
        { $inc: { activeCaseCount: -1 } }
      );
    }
  }

  existingRescue.status = status;
  existingRescue.statusHistory.push({
    status,
    changedBy: responderId || undefined,
    timestamp: new Date(),
    note:      note || `Status updated to ${status}`,
  });

  await existingRescue.save();

  // Audit log
  await AuditLog.create({
    actor: responderId,
    actorRole: responderRole,
    action: `STATUS_UPDATED_${status}`,
    rescueCase: existingRescue._id,
    description: `Status changed to ${status}`,
  });

  // Timeline Activity
  const activityType = STATUS_ACTIVITY_TYPE[status];
  const messageFn    = STATUS_MESSAGES[status];
  if (activityType && messageFn) {
    await createActivity({
      rescueCaseId: existingRescue._id,
      type:         activityType,
      message:      messageFn(responderName),
      userId:       responderId,
      userName:     responderName,
    });
  }

  // Notify Citizen
  const STATUS_NOTIFICATIONS = {
    IN_PROGRESS: {
      type: 'RESCUE_STARTED',
      title: 'Responder En Route',
      message: `${responderName || 'A responder'} is now en route to the rescue scene.`,
    },
    CANCELLED: {
      type: 'CASE_CANCELLED',
      title: 'Rescue Request Cancelled',
      message: 'Your rescue request has been cancelled.',
    },
  };

  const notificationConfig = STATUS_NOTIFICATIONS[status];
  if (notificationConfig && existingRescue.reporter) {
    await createNotification({
      recipient: existingRescue.reporter,
      rescueCase: existingRescue._id,
      type: notificationConfig.type,
      title: notificationConfig.title,
      message: notificationConfig.message,
    });
  }

  const populated = await populateRescue(RescueCase.findById(existingRescue._id)).lean();
  return sendSuccess(res, populated, `Status updated to ${status}`);
};

// ─── unmergeCorroboratingReport (Admin Only) ──────────────────────────────────

const unmergeCorroboratingReport = async (req, res) => {
  const { id: caseId, reportId } = req.params;

  const primaryCase = await RescueCase.findByIdOrCaseId(caseId);
  if (!primaryCase) {
    return sendError(res, 'Primary rescue case not found', 404);
  }

  const reportIndex = primaryCase.corroboratingReports.findIndex(
    (r) => r._id.toString() === reportId
  );

  if (reportIndex === -1) {
    return sendError(res, 'Corroborating report not found on this case', 404);
  }

  const [extracted] = primaryCase.corroboratingReports.splice(reportIndex, 1);
  await primaryCase.save();

  // Calculate independent triage score for the separated case
  const triageResult = evaluateTriage({
    animalType: primaryCase.animalType,
    emergencyType: primaryCase.emergencyType,
    description: extracted.description || primaryCase.description,
    locationAddress: extracted.location?.address || primaryCase.location?.address,
  });

  // Create separated independent rescue case
  const newCase = await RescueCase.create({
    caseId:          generateCaseId(),
    reporterName:    extracted.reporterName,
    reporterContact: extracted.reporterContact,
    reporter:        extracted.reporter || undefined,
    animalType:      primaryCase.animalType,
    emergencyType:   primaryCase.emergencyType,
    description:     extracted.description || 'Separated from corroborating incident.',
    imageUrl:        extracted.imageUrl || undefined,
    location: {
      address:   extracted.location?.address || primaryCase.location.address,
      latitude:  extracted.location?.latitude,
      longitude: extracted.location?.longitude,
    },
    priority: triageResult.priority,
    triage: triageResult,
    status: 'PENDING',
    statusHistory: [{
      status:    'PENDING',
      timestamp: new Date(),
      note:      `Separated from Case ${primaryCase.caseId} by Administrator`,
    }],
  });

  // Log audit
  await AuditLog.create({
    actor: req.user.userId,
    actorRole: 'admin',
    action: 'CASE_UNMERGED',
    rescueCase: newCase._id,
    description: `Corroborating report unmerged from ${primaryCase.caseId} into independent case ${newCase.caseId}`,
  });

  // Create timeline activities
  await createActivity({
    rescueCaseId: primaryCase._id,
    type: 'NOTE',
    message: `Corroborating report from ${extracted.reporterName} unmerged by admin into independent case ${newCase.caseId}.`,
    userId: req.user.userId,
    userName: req.user.name,
  });

  await createActivity({
    rescueCaseId: newCase._id,
    type: 'CASE_CREATED',
    message: `Separated into independent rescue case from ${primaryCase.caseId}.`,
    userId: req.user.userId,
    userName: req.user.name,
  });

  return sendSuccess(
    res,
    { newCase, primaryCaseId: primaryCase.caseId },
    'Corroborating report successfully separated into independent rescue case',
    201
  );
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

  const rescue = await RescueCase.findByIdOrCaseId(req.params.id);
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
    comment: comment?.trim() || undefined,
    submittedAt: new Date(),
  };

  await rescue.save();

  await AuditLog.create({
    actor: req.user.userId,
    actorRole: 'citizen',
    action: 'FEEDBACK_SUBMITTED',
    rescueCase: rescue._id,
    description: `Feedback submitted: ${rating} stars`,
  });

  return sendSuccess(res, rescue, 'Feedback submitted successfully');
};

// ─── getRescuerStats (Phase 15) ───────────────────────────────────────────────
const getRescuerStats = async (req, res) => {
  const rescuerId = req.user.userId;

  // Active cases assigned to this rescuer
  const activeCases = await RescueCase.find({
    assignedResponder: rescuerId,
    status: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
  }).lean();

  const awaitingAction = activeCases.filter(c => c.status === 'ACCEPTED').length;
  const inProgress = activeCases.filter(c => c.status === 'IN_PROGRESS').length;

  // Rescued cases by this rescuer
  const completedRescues = await RescueCase.countDocuments({
    assignedResponder: rescuerId,
    status: 'RESCUED'
  });

  // Cases requiring evidence/notes: cases currently in IN_PROGRESS
  const requiringEvidence = inProgress;

  // Released cases by this rescuer
  const releasedCases = await RescueCase.countDocuments({
    statusHistory: {
      $elemMatch: { status: 'PENDING', changedBy: rescuerId }
    }
  });

  // Response time and completion time for this rescuer
  const rescuerCases = await RescueCase.find({
    assignedResponder: rescuerId,
    status: 'RESCUED'
  }).select('createdAt statusHistory').lean();

  const responseDurationsMs = [];
  const completionDurationsMs = [];

  rescuerCases.forEach(rc => {
    const createdTime = new Date(rc.createdAt).getTime();
    const accepted = rc.statusHistory?.find(s => s.status === 'ACCEPTED');
    const rescued = rc.statusHistory?.find(s => s.status === 'RESCUED');

    if (accepted?.timestamp) {
      const acceptedTime = new Date(accepted.timestamp).getTime();
      const diff = acceptedTime - createdTime;
      if (diff >= 0) responseDurationsMs.push(diff);

      if (rescued?.timestamp) {
        const compDiff = new Date(rescued.timestamp).getTime() - acceptedTime;
        if (compDiff >= 0) completionDurationsMs.push(compDiff);
      }
    }
  });

  const avgResponseTimeMinutes = responseDurationsMs.length
    ? Math.round(responseDurationsMs.reduce((a, b) => a + b, 0) / responseDurationsMs.length / 60000)
    : 0;

  const avgCompletionTimeMinutes = completionDurationsMs.length
    ? Math.round(completionDurationsMs.reduce((a, b) => a + b, 0) / completionDurationsMs.length / 60000)
    : 0;

  // Personal status distribution
  const allPersonalCases = await RescueCase.find({
    assignedResponder: rescuerId
  }).select('status priority createdAt').lean();

  const statusMap = allPersonalCases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const severityMap = allPersonalCases.reduce((acc, c) => {
    acc[c.priority] = (acc[c.priority] || 0) + 1;
    return acc;
  }, {});

  // Monthly activity trends for past 6 months
  const monthlyActivity = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString('default', { month: 'short' });
    monthlyActivity[key] = 0;
  }
  allPersonalCases.forEach(c => {
    const mKey = new Date(c.createdAt).toLocaleString('default', { month: 'short' });
    if (monthlyActivity[mKey] !== undefined) {
      monthlyActivity[mKey]++;
    }
  });

  const data = {
    summary: {
      currentlyAssigned: activeCases.length,
      awaitingAction,
      inProgress,
      completedRescues,
      releasedCases,
      requiringEvidence,
      activeWorkload: activeCases.length,
      maxWorkload: 3,
      workloadPercentage: Math.round((activeCases.length / 3) * 100),
      avgResponseTimeMinutes,
      avgCompletionTimeMinutes,
    },
    statusDistribution: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    severityDistribution: Object.entries(severityMap).map(([priority, count]) => ({ priority, count })),
    monthlyActivity: Object.entries(monthlyActivity).map(([month, count]) => ({ month, count })),
  };

  return sendSuccess(res, data, 'Rescuer personal statistics retrieved successfully');
};

module.exports = {
  createRescue,
  getAllRescues,
  getRescueById,
  updateRescueStatus,
  unmergeCorroboratingReport,
  getUserRescues,
  submitFeedback,
  getRescuerStats,
};
