const Hearing = require('../models/Hearing');
const Case = require('../models/Case');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const LawFirm = require('../models/LawFirm');
const {
  generateCauseListPDF,
  generateFeeLedgerExcel,
  generateCasesExcel,
  generateExpensesExcel,
  generateCSV,
} = require('../services/reportService');

exports.exportCauseList = async (req, res, next) => {
  try {
    const { format = 'pdf', range = 'today', date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    let start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    let end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    if (range === 'tomorrow') {
      start = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    } else if (range === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(start.setDate(diff));
      end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'month') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const [hearings, firm] = await Promise.all([
      Hearing.find({
        lawFirmId: req.user.lawFirmId,
        date: { $gte: start, $lte: end },
      }).populate('caseId').populate('clientId'),
      LawFirm.findById(req.user.lawFirmId),
    ]);

    const dateStr = start.toISOString().split('T')[0];

    if (format.toLowerCase() === 'pdf') {
      return generateCauseListPDF(hearings, firm || {}, dateStr, res);
    }

    // Otherwise CSV
    const fields = [
      { label: 'Hearing Date', value: (h) => new Date(h.date).toLocaleDateString() },
      { label: 'Time', value: 'time' },
      { label: 'Item No.', value: 'itemNumber' },
      { label: 'Case Number', value: (h) => (h.caseId ? h.caseId.caseNumber : '') },
      { label: 'Case Title', value: (h) => (h.caseId ? h.caseId.title : '') },
      { label: 'Client', value: (h) => (h.clientId ? h.clientId.name : '') },
      { label: 'Court Complex', value: 'court' },
      { label: 'Courtroom', value: 'courtroom' },
      { label: 'Presiding Judge', value: 'judge' },
      { label: 'Stage / Purpose', value: 'purpose' },
      { label: 'Status', value: 'status' },
      { label: 'Bench Notes', value: 'benchNotes' },
    ];

    const csv = generateCSV(hearings, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Cause_List_${dateStr}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

exports.exportCauseListPDF = (req, res, next) => {
  req.query.format = 'pdf';
  return exports.exportCauseList(req, res, next);
};

exports.exportCauseListCSV = (req, res, next) => {
  req.query.format = 'csv';
  return exports.exportCauseList(req, res, next);
};

exports.exportCaseSummary = async (req, res, next) => {
  try {
    const { format = 'excel' } = req.query;

    const [cases, firm] = await Promise.all([
      Case.find({ lawFirmId: req.user.lawFirmId })
        .populate('clientId', 'name phone')
        .sort({ nextHearingDate: 1 }),
      LawFirm.findById(req.user.lawFirmId),
    ]);

    if (format.toLowerCase() === 'excel') {
      return await generateCasesExcel(cases, firm || {}, res);
    }

    const fields = [
      { label: 'Case Number', value: 'caseNumber' },
      { label: 'CNR Number', value: 'cnrNumber' },
      { label: 'Title', value: 'title' },
      { label: 'Client', value: (c) => (c.clientId ? c.clientId.name : '') },
      { label: 'Court', value: 'court' },
      { label: 'Courtroom', value: (c) => c.courtRoom || c.courtroom || '' },
      { label: 'Stage', value: (c) => c.stage || c.currentStage || '' },
      { label: 'Status', value: 'status' },
      { label: 'Next Hearing Date', value: (c) => (c.nextHearingDate ? new Date(c.nextHearingDate).toLocaleDateString() : 'N/A') },
      { label: 'Agreed Fee (INR)', value: (c) => c.totalAgreedFee || c.agreedFee || 0 },
    ];

    const csv = generateCSV(cases, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Case_Portfolio_Export.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

exports.exportCasesCSV = (req, res, next) => {
  req.query.format = 'csv';
  return exports.exportCaseSummary(req, res, next);
};

exports.exportFinancial = async (req, res, next) => {
  try {
    const [payments, firm] = await Promise.all([
      Payment.find({ lawFirmId: req.user.lawFirmId })
        .populate('clientId', 'name phone')
        .populate('caseId', 'title caseNumber')
        .sort({ paymentDate: -1 }),
      LawFirm.findById(req.user.lawFirmId),
    ]);

    await generateFeeLedgerExcel(payments, firm || {}, res);
  } catch (err) {
    next(err);
  }
};

exports.exportFeeLedgerExcel = exports.exportFinancial;

exports.exportExpenses = async (req, res, next) => {
  try {
    const { format = 'excel' } = req.query;

    const [expenses, firm] = await Promise.all([
      Expense.find({ lawFirmId: req.user.lawFirmId })
        .populate('caseId', 'caseNumber title')
        .sort({ expenseDate: -1 }),
      LawFirm.findById(req.user.lawFirmId),
    ]);

    if (format.toLowerCase() === 'excel') {
      return await generateExpensesExcel(expenses, firm || {}, res);
    }

    const fields = [
      { label: 'Date', value: (e) => new Date(e.expenseDate).toLocaleDateString() },
      { label: 'Category', value: 'category' },
      { label: 'Description', value: 'description' },
      { label: 'Amount (INR)', value: 'amount' },
      { label: 'Payment Mode', value: 'paymentMode' },
      { label: 'Bill / Voucher No', value: (e) => e.receiptNumber || e.billNumber || '' },
      { label: 'Case', value: (e) => (e.caseId ? `${e.caseId.caseNumber} - ${e.caseId.title}` : 'General Office') },
    ];

    const csv = generateCSV(expenses, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Chamber_Expenses_Export.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

exports.exportExpensesCSV = (req, res, next) => {
  req.query.format = 'csv';
  return exports.exportExpenses(req, res, next);
};
