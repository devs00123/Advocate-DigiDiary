const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Client = require('../models/Client');

exports.getAnalytics = async (req, res, next) => {
  try {
    const firmId = req.user.lawFirmId;

    // 1. Cases by status
    const casesByStatus = await Case.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 2. Cases by jurisdiction / court
    const casesByCourt = await Case.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: '$court', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 3. Cases by case type
    const casesByType = await Case.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: '$caseType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 4. Client distribution (Corporate vs Individual)
    const clientDistribution = await Client.aggregate([
      { $match: { lawFirmId: firmId } },
      { $group: { _id: '$clientType', count: { $sum: 1 } } },
    ]);

    // 5. Monthly revenue for the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenue = await Payment.aggregate([
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

    // 6. Monthly expenses for the past 6 months
    const monthlyExpenses = await Expense.aggregate([
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

    // 7. Total overall statistics
    const [totalCases, activeCases, totalClients, totalHearings] = await Promise.all([
      Case.countDocuments({ lawFirmId: firmId }),
      Case.countDocuments({ lawFirmId: firmId, status: { $nin: ['Disposed', 'Closed'] } }),
      Client.countDocuments({ lawFirmId: firmId }),
      Hearing.countDocuments({ lawFirmId: firmId }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCases,
          activeCases,
          totalClients,
          totalHearings,
        },
        casesByStatus,
        casesByCourt,
        casesByType,
        clientDistribution,
        monthlyRevenue,
        monthlyExpenses,
      },
    });
  } catch (err) {
    next(err);
  }
};
