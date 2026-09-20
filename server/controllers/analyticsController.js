const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Client = require('../models/Client');
const Task = require('../models/Task');

exports.getAnalytics = async (req, res, next) => {
  try {
    const firmId = req.user.lawFirmId;

    // 1. Date boundaries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 2. Cases aggregations
    const [casesByStatus, casesByCourt, casesByType] = await Promise.all([
      Case.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Case.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: '$court', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Case.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: '$caseType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // 3. Client distribution (Corporate vs Individual)
    const clientDistribution = await Client.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: '$clientType', count: { $sum: 1 } } },
    ]);

    // 4. Monthly revenue for the past 6 months
    const monthlyRevenueRaw = await Payment.aggregate([
      {
        $match: {
          lawFirmId: firmId,
          status: 'Realized',
          paymentDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // 5. Monthly expenses for the past 6 months
    const monthlyExpensesRaw = await Expense.aggregate([
      {
        $match: {
          lawFirmId: firmId,
          expenseDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$expenseDate' },
            month: { $month: '$expenseDate' },
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // 6. Financial summary calculations
    const [billedAgg, collectedAgg, expenseAgg] = await Promise.all([
      Case.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: null, totalAgreed: { $sum: '$agreedFee' } } },
      ]),
      Payment.aggregate([
        { $match: { lawFirmId: firmId, status: 'Realized' } },
        { $group: { _id: null, totalCollected: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: null, totalExpense: { $sum: '$amount' } } },
      ]),
    ]);

    const totalBilled = billedAgg.length > 0 ? billedAgg[0].totalAgreed : 0;
    const totalCollected = collectedAgg.length > 0 ? collectedAgg[0].totalCollected : 0;
    const totalExpenses = expenseAgg.length > 0 ? expenseAgg[0].totalExpense : 0;
    const totalOutstanding = Math.max(0, totalBilled - totalCollected);

    // 7. Case, Hearing & Task counts
    const [
      totalCases,
      activeCases,
      totalClients,
      totalHearings,
      todayHearingsCount,
      pendingTasksCount,
      urgentTasksCount,
    ] = await Promise.all([
      Case.countDocuments({ lawFirmId: firmId }),
      Case.countDocuments({ lawFirmId: firmId, status: { $nin: ['Disposed', 'Closed'] } }),
      Client.countDocuments({ lawFirmId: firmId }),
      Hearing.countDocuments({ lawFirmId: firmId }),
      Hearing.countDocuments({
        lawFirmId: firmId,
        date: { $gte: startOfToday, $lte: endOfToday },
      }),
      Task.countDocuments({
        lawFirmId: firmId,
        status: { $ne: 'Completed' },
      }),
      Task.countDocuments({
        lawFirmId: firmId,
        priority: { $in: ['Urgent', 'High', 'urgent', 'high'] },
        status: { $ne: 'Completed' },
      }),
    ]);

    const summaryData = {
      totalCases,
      activeCases,
      totalActiveCases: activeCases,
      totalClients,
      totalHearings,
      todayHearingsCount,
      pendingTasksCount,
      urgentTasksCount,
      totalBilled,
      totalAgreedFee: totalBilled,
      totalCollected,
      totalRevenue: totalCollected,
      totalOutstanding,
      pendingDues: totalOutstanding,
      totalExpenses,
    };

    res.status(200).json({
      success: true,
      data: {
        ...summaryData,
        summary: summaryData,
        casesByStatus,
        casesByCourt,
        casesByType,
        clientDistribution,
        monthlyRevenue: monthlyRevenueRaw,
        monthlyExpenses: monthlyExpensesRaw,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getCaseDistribution = async (req, res, next) => {
  try {
    const firmId = req.user.lawFirmId;
    const [byCourt, byCaseType] = await Promise.all([
      Case.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: '$court', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Case.aggregate([
        { $match: { lawFirmId: firmId } },
        { $group: { _id: '$caseType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: { byCourt, byCaseType },
    });
  } catch (err) {
    next(err);
  }
};

exports.getHearingOutcomes = async (req, res, next) => {
  try {
    const firmId = req.user.lawFirmId;
    const outcomes = await Hearing.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: outcomes,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMonthlyRevenue = async (req, res, next) => {
  try {
    const firmId = req.user.lawFirmId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [payments, expenses] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            lawFirmId: firmId,
            status: 'Realized',
            paymentDate: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$paymentDate' },
              month: { $month: '$paymentDate' },
            },
            revenue: { $sum: '$amount' },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            lawFirmId: firmId,
            expenseDate: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$expenseDate' },
              month: { $month: '$expenseDate' },
            },
            expenses: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    // Build unified 6-month array
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1; // 1-indexed

      const pMatch = payments.find((p) => p._id.year === y && p._id.month === m);
      const eMatch = expenses.find((e) => e._id.year === y && e._id.month === m);

      monthlyData.push({
        month: `${monthNames[m - 1]} ${y}`,
        revenue: pMatch ? pMatch.revenue : 0,
        expenses: eMatch ? eMatch.expenses : 0,
      });
    }

    res.status(200).json({
      success: true,
      data: monthlyData,
    });
  } catch (err) {
    next(err);
  }
};
