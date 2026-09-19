const express = require('express');
const router = express.Router();
const {
  listTeamMembers,
  addTeamMember,
  updateMemberRole,
  toggleMemberStatus,
} = require('../controllers/teamController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.route('/')
  .get(listTeamMembers)
  .post(requireRole('admin'), addTeamMember);

router.put('/:id/role', requireRole('admin'), updateMemberRole);
router.patch('/:id/toggle-status', requireRole('admin'), toggleMemberStatus);

module.exports = router;
