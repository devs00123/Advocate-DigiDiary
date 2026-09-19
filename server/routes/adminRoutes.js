const express = require('express');
const router = express.Router();
const {
  getTelemetry,
  listAdvocates,
  getLiveFeed,
  getHealthReport,
  purgeStale,
  inviteAdvocate,
  exportAuditCSV,
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');

// Super Admin routes - Protected and strictly restricted to admin role
router.use(protect, requireRole('admin'));

router.get('/telemetry', getTelemetry);
router.get('/advocates', listAdvocates);
router.get('/live-feed', getLiveFeed);
router.get('/health-report', getHealthReport);
router.post('/purge-stale', purgeStale);
router.post('/invite', inviteAdvocate);
router.get('/export-audit', exportAuditCSV);

module.exports = router;
