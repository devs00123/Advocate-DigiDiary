const express = require('express');
const router = express.Router();
const {
  getFinancialOverview,
  listPayments,
  recordPayment,
  deletePayment,
  listExpenses,
  createExpense,
  deleteExpense,
} = require('../controllers/financialController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.get('/overview', getFinancialOverview);

router.route('/payments')
  .get(listPayments)
  .post(requireRole('admin', 'advocate'), recordPayment);

router.delete('/payments/:id', requireRole('admin'), deletePayment);

router.route('/expenses')
  .get(listExpenses)
  .post(requireRole('admin', 'advocate', 'clerk'), createExpense);

router.delete('/expenses/:id', requireRole('admin'), deleteExpense);

module.exports = router;
