const express = require('express');
const router = express.Router();
const {
  listTasks,
  createTask,
  updateTask,
  toggleComplete,
  deleteTask,
} = require('../controllers/taskController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.route('/')
  .get(listTasks)
  .post(requireRole('admin', 'advocate', 'junior', 'clerk'), createTask);

router.route('/:id')
  .put(requireRole('admin', 'advocate', 'junior', 'clerk'), updateTask)
  .delete(requireRole('admin', 'advocate', 'junior'), deleteTask);

router.patch('/:id/toggle', toggleComplete);

module.exports = router;
