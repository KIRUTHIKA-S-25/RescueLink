/**
 * notificationController.js
 */

const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── GET /api/notifications ──────────────────────────────────────────────────
// Returns current user's notifications (newest first) and unread count
const getMyNotifications = async (req, res) => {
  const userId = req.user.userId;

  // Fetch last 50 notifications for this user
  const notifications = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('rescueCase', 'caseId animalType emergencyType status') // Optional populate
    .lean();

  const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

  return res.status(200).json({
    success: true,
    message: 'Notifications fetched successfully',
    data: notifications,
    unreadCount,
  });
};

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
// Marks a single notification as read
const markAsRead = async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.userId;

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    return sendError(res, 'Notification not found', 404);
  }

  // Ensure notification belongs to current user
  if (notification.recipient.toString() !== userId) {
    return sendError(res, 'Forbidden: Not your notification', 403);
  }

  notification.read = true;
  await notification.save();

  return sendSuccess(res, notification, 'Notification marked as read');
};

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
// Marks all unread notifications as read for current user
const markAllAsRead = async (req, res) => {
  const userId = req.user.userId;

  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true } }
  );

  return sendSuccess(res, { updatedCount: result.modifiedCount }, 'All notifications marked as read');
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
