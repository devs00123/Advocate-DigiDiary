const express = require('express');
const router = express.Router();
const {
  getAnalytics,
  getCaseDistribution,
  getHearingOutcomes,
  getMonthlyRevenue,
} = require('../controllers/analyticsController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.get('/', requireRole('admin', 'advocate'), getAnalytics);
router.get('/summary', requireRole('admin', 'advocate'), getAnalytics);
router.get('/case-distribution', requireRole('admin', 'advocate'), getCaseDistribution);
router.get('/hearing-outcomes', requireRole('admin', 'advocate'), getHearingOutcomes);
router.get('/monthly-revenue', requireRole('admin', 'advocate'), getMonthlyRevenue);

module.exports = router;
