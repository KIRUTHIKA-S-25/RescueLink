const express = require('express');
const {
  getAnalytics,
  getAuditLogs,
} = require('../controllers/adminController');

const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// All admin routes are protected and require the 'admin' role
router.use(protect);
router.use(authorizeRoles('admin'));

// GET /api/admin/analytics
router.get('/analytics', getAnalytics);

// GET /api/admin/audit
router.get('/audit', getAuditLogs);

module.exports = router;
