const express = require('express');
const router = express.Router();
const {
  listHearings,
  getCauseList,
  getHearingById,
  createHearing,
  updateHearing,
  deleteHearing,
} = require('../controllers/hearingController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.get('/cause-list', getCauseList);
router.get('/causelist', getCauseList);

router.route('/')
  .get(listHearings)
  .post(requireRole('admin', 'advocate', 'junior', 'clerk'), createHearing);

router.route('/:id')
  .get(getHearingById)
  .put(requireRole('admin', 'advocate', 'junior', 'clerk'), updateHearing)
  .delete(requireRole('admin', 'advocate'), deleteHearing);

router.post('/:id/outcome', requireRole('admin', 'advocate', 'junior', 'clerk'), updateHearing);

module.exports = router;
