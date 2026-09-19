const express = require('express');
const router = express.Router();
const { listAuditLogs } = require('../controllers/auditController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.get('/', requireRole('admin', 'advocate'), listAuditLogs);

module.exports = router;
