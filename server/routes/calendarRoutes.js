const express = require('express');
const router = express.Router();
const { getCalendarEvents } = require('../controllers/calendarController');
const { protect } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.get('/', getCalendarEvents);

module.exports = router;
