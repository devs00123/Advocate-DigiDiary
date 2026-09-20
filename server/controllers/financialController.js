const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Case = require('../models/Case');
const Client = require('../models/Client');
const { logAudit } = require('../utils/auditLogger');

exports.getFinancialOverview = async (req, res, next) => {
  try {
    const firmId = req.user.lawFirmId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Total realized revenue from all payments
    const revenueAgg = await Payment.aggregate([
      { $match: { lawFirmId: firmId, status: 'Realized' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // 2. Month-to-date collections
    const monthlyAgg = await Payment.aggregate([
      { $match: { lawFirmId: firmId, status: 'Realized', paymentDate: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, monthTotal: { $sum: '$amount' } } },
    ]);
    const monthCollections = monthlyAgg.length > 0 ? monthlyAgg[0].monthTotal : 0;

    // 3. Total agreed fees across all cases
    const caseFeeAgg = await Case.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: null, totalAgreedFee: { $sum: '$agreedFee' } } },
    ]);
    const totalAgreedFee = caseFeeAgg.length > 0 ? caseFeeAgg[0].totalAgreedFee : 0;

    // 4. Pending balance across firm
    const pendingDues = Math.max(0, totalAgreedFee - totalRevenue);

    // 5. Total expenses
    const expenseAgg = await Expense.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: null, totalExpense: { $sum: '$amount' } } },
    ]);
    const totalExpenses = expenseAgg.length > 0 ? expenseAgg[0].totalExpense : 0;

    // 6. Overdue payments / cases with pending fees older than 30 days
    const overdueAgg = await Payment.aggregate([
      { $match: { lawFirmId: firmId, status: 'Pending', paymentDate: { $lte: thirtyDaysAgo } } },
      { $group: { _id: null, overdueTotal: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const overdueAmount = overdueAgg.length > 0 ? overdueAgg[0].overdueTotal : 0;
    const overdueCount = overdueAgg.length > 0 ? overdueAgg[0].count : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalCollected: totalRevenue,
        monthCollections,
        pendingDues,
        totalOutstanding: pendingDues,
        totalExpenses,
        overdueAmount,
        overdueCount,
        totalAgreedFee,
        totalBilled: totalAgreedFee,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const { category, status, search, clientId, caseId, page = 1, limit = 20 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (category && category !== 'All') query.category = category;
    if (status && status !== 'All') query.status = status;
    if (clientId) query.clientId = clientId;
    if (caseId) query.caseId = caseId;

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { receiptNumber: new RegExp(s, 'i') },
        { description: new RegExp(s, 'i') },
        { transactionReference: new RegExp(s, 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('clientId', 'name phone email')
        .populate('caseId', 'title caseNumber court')
        .populate('createdBy', 'name email')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { clientId, caseId, amount, paymentDate, paymentMethod, transactionReference, category, description, status } = req.body;

    let client = null;
    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      client = await Client.findOne({ _id: clientId, lawFirmId: req.user.lawFirmId });
    }
    if (!client) {
      client = await Client.findOne({ lawFirmId: req.user.lawFirmId });
    }
    if (!client) {
      client = await Client.create({
        lawFirmId: req.user.lawFirmId,
        name: 'General Practice Client',
        createdBy: req.user._id,
      });
    }

    const finalAmount = !isNaN(Number(amount)) && Number(amount) >= 0 ? Number(amount) : 0;

    // Auto-generate receipt number: REC-YYYY-XXXX
    const count = await Payment.countDocuments({ lawFirmId: req.user.lawFirmId });
    const year = new Date().getFullYear();
    const receiptNumber = `REC-${year}-${String(count + 1).padStart(4, '0')}`;

    const payment = await Payment.create({
      lawFirmId: req.user.lawFirmId,
      clientId: client._id,
      caseId: (caseId && mongoose.Types.ObjectId.isValid(caseId)) ? caseId : null,
      receiptNumber,
      amount: finalAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || 'NEFT',
      transactionReference: transactionReference || '',
      category: category || 'Appearance Fees',
      description: description || '',
      status: status || 'Realized',
      createdBy: req.user._id,
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment._id,
      description: `Recorded payment of ₹${payment.amount} from ${client.name} (Receipt: ${receiptNumber})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Payment recorded successfully.', data: payment });
  } catch (err) {
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    res.status(200).json({ success: true, message: 'Payment record removed.' });
  } catch (err) {
    next(err);
  }
};

// EXPENSES
exports.listExpenses = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (category && category !== 'All') query.category = category;

    if (search && search.trim()) {
      query.description = new RegExp(search.trim(), 'i');
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('caseId', 'title caseNumber court')
        .populate('createdBy', 'name email')
        .sort({ expenseDate: -1 })
        .skip(skip)
        .limit(limitNum),
      Expense.countDocuments(query),
    ]);

    const totalSpent = await Expense.aggregate([
      { $match: { lawFirmId: req.user.lawFirmId } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);

    res.status(200).json({
      success: true,
      data: expenses,
      totalSpent: totalSpent.length > 0 ? totalSpent[0].sum : 0,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createExpense = async (req, res, next) => {
  try {
    const { caseId, category, description, amount, expenseDate, paymentMode, billNumber } = req.body;

    const finalDesc = (description && String(description).trim()) ? String(description).trim() : 'Chamber Expense';
    const finalAmount = !isNaN(Number(amount)) && Number(amount) >= 0 ? Number(amount) : 0;

    const expense = await Expense.create({
      lawFirmId: req.user.lawFirmId,
      caseId: (caseId && mongoose.Types.ObjectId.isValid(caseId)) ? caseId : null,
      category: category || 'Court Fees',
      description: finalDesc,
      amount: finalAmount,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      paymentMode: paymentMode || 'Cash',
      billNumber: billNumber || '',
      createdBy: req.user._id,
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'EXPENSE_LOGGED',
      entityType: 'Expense',
      entityId: expense._id,
      description: `Logged chamber expense: ₹${expense.amount} for ${expense.description} (${expense.category})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Expense logged.', data: expense });
  } catch (err) {
    next(err);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    res.status(200).json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    next(err);
  }
};
