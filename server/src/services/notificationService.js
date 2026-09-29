/**
 * notificationService.js
 *
 * Centralized service to handle creating notifications.
 */

const Notification = require('../models/Notification');

/**
 * Creates a notification.
 * Does not throw errors to prevent breaking the main transaction flow if a notification fails,
 * but safely logs them.
 * 
 * @param {Object} data - Notification details
 * @param {String} data.recipient - User ID of the recipient
 * @param {String} data.rescueCase - RescueCase ID (optional)
 * @param {String} data.type - Notification type enum
 * @param {String} data.title - Short title
 * @param {String} data.message - Detailed message
 */
const createNotification = async ({ recipient, rescueCase, type, title, message }) => {
  if (!recipient) {
    // If there is no authenticated recipient (e.g. anonymous report), skip gracefully.
    return null;
  }

  try {
    const notification = await Notification.create({
      recipient,
      rescueCase,
      type,
      title,
      message,
    });
    return notification;
  } catch (err) {
    // We log the error but don't fail the primary workflow (e.g. status change)
    console.error('[NotificationService] Error creating notification:', err.message);
    return null;
  }
};

module.exports = {
  createNotification,
};
