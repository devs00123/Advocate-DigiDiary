const express = require('express');
const router = express.Router();
const {
  listReminders,
  createReminder,
  updateReminder,
  toggleComplete,
  deleteReminder,
} = require('../controllers/reminderController');
const { protect } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.route('/')
  .get(listReminders)
  .post(createReminder);

router.put('/:id', updateReminder);
router.patch('/:id/toggle', toggleComplete);
router.patch('/:id/dismiss', toggleComplete);
router.delete('/:id', deleteReminder);

module.exports = router;
