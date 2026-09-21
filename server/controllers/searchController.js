const Case = require('../models/Case');
const Client = require('../models/Client');
const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Note = require('../models/Note');
const Payment = require('../models/Payment');

exports.globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim() || q.trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          cases: [],
          clients: [],
          hearings: [],
          tasks: [],
          notes: [],
          payments: [],
        },
      });
    }

    const query = q.trim();
    const safePattern = String(query).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(safePattern, 'i');
    const firmId = req.user.lawFirmId;

    // Find matching cases first so hearings can reference them
    const matchingCases = await Case.find({
      lawFirmId: firmId,
      $or: [
        { title: regex },
        { caseNumber: regex },
        { cnrNumber: regex },
        { court: regex },
        { judge: regex },
        { courtroom: regex },
        { oppositeParty: regex },
        { oppositeCounsel: regex },
      ],
    })
      .select('title caseNumber cnrNumber court courtroom judge status priority')
      .limit(10);

    const matchedCaseIds = matchingCases.map((c) => c._id);

    const hearingOr = [
      { court: regex },
      { courtroom: regex },
      { judge: regex },
      { purpose: regex },
      { itemNumber: regex },
    ];
    if (matchedCaseIds.length > 0) {
      hearingOr.push({ caseId: { $in: matchedCaseIds } });
    }

    const [clients, hearings, tasks, notes, payments] = await Promise.all([
      Client.find({
        lawFirmId: firmId,
        $or: [{ name: regex }, { phone: regex }, { email: regex }, { companyName: regex }],
      })
        .select('name phone email clientType companyName status')
        .limit(8),

      Hearing.find({
        lawFirmId: firmId,
        $or: hearingOr,
      })
        .populate('caseId', 'title caseNumber cnrNumber court')
        .select('date time court courtroom judge purpose status itemNumber caseId')
        .limit(8),

      Task.find({
        lawFirmId: firmId,
        $or: [{ title: regex }, { description: regex }, { category: regex }],
      })
        .select('title dueDate priority status category')
        .limit(8),

      Note.find({
        lawFirmId: firmId,
        $or: [{ title: regex }, { content: regex }, { citation: regex }, { court: regex }],
      })
        .select('title category citation court pinned updatedAt')
        .limit(8),

      Payment.find({
        lawFirmId: firmId,
        $or: [{ receiptNumber: regex }, { description: regex }, { transactionReference: regex }],
      })
        .populate('clientId', 'name')
        .select('receiptNumber amount paymentDate status paymentMethod')
        .limit(8),
    ]);

    res.status(200).json({
      success: true,
      query,
      data: {
        cases: matchingCases,
        clients,
        hearings,
        tasks,
        notes,
        payments,
      },
    });
  } catch (err) {
    next(err);
  }
};
