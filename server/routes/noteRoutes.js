const express = require('express');
const router = express.Router();
const {
  listNotes,
  getNoteById,
  createNote,
  updateNote,
  togglePin,
  deleteNote,
} = require('../controllers/noteController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.route('/')
  .get(listNotes)
  .post(requireRole('admin', 'advocate', 'junior'), createNote);

router.route('/:id')
  .get(getNoteById)
  .put(requireRole('admin', 'advocate', 'junior'), updateNote)
  .delete(requireRole('admin', 'advocate'), deleteNote);

router.patch('/:id/pin', togglePin);

module.exports = router;
