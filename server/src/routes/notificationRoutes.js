/**
 * notificationRoutes.js
 */

const express = require('express');
const router = express.Router();
const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// All notification routes are protected (require authentication)
router.use(protect);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllAsRead); // Place before /:id to avoid param conflict
router.patch('/:id/read', markAsRead);

module.exports = router;
