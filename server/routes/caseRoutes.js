const express = require('express');
const router = express.Router();
const {
  listCases,
  getCaseById,
  getCaseTimeline,
  createCase,
  updateCase,
  deleteCase,
} = require('../controllers/caseController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.route('/')
  .get(listCases)
  .post(requireRole('admin', 'advocate', 'junior'), createCase);

router.route('/:id')
  .get(getCaseById)
  .put(requireRole('admin', 'advocate', 'junior'), updateCase)
  .delete(requireRole('admin'), deleteCase);

router.get('/:id/timeline', getCaseTimeline);

module.exports = router;
