const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analyticsController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.get('/', requireRole('admin', 'advocate'), getAnalytics);
router.get('/summary', requireRole('admin', 'advocate'), getAnalytics);

module.exports = router;
