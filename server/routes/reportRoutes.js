const express = require('express');
const router = express.Router();
const {
  exportCauseList,
  exportCauseListPDF,
  exportCauseListCSV,
  exportCaseSummary,
  exportCasesCSV,
  exportFinancial,
  exportFeeLedgerExcel,
  exportExpenses,
  exportExpensesCSV,
} = require('../controllers/reportController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

// Unified endpoints with ?format=
router.get('/cause-list', exportCauseList);
router.get('/case-summary', exportCaseSummary);
router.get('/financial', requireRole('admin', 'advocate'), exportFinancial);
router.get('/expense-summary', requireRole('admin', 'advocate'), exportExpenses);

// Direct format endpoints for backward compatibility
router.get('/cause-list/pdf', exportCauseListPDF);
router.get('/cause-list/csv', exportCauseListCSV);
router.get('/cases/csv', exportCasesCSV);
router.get('/fee-ledger/excel', requireRole('admin', 'advocate'), exportFeeLedgerExcel);
router.get('/expenses/csv', requireRole('admin', 'advocate'), exportExpensesCSV);

module.exports = router;
