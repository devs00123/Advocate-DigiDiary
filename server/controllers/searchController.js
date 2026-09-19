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
    const regex = new RegExp(query, 'i');
    const firmId = req.user.lawFirmId;

    const [cases, clients, hearings, tasks, notes, payments] = await Promise.all([
      Case.find({
        lawFirmId: firmId,
        $or: [
          { title: regex },
          { caseNumber: regex },
          { cnrNumber: regex },
          { court: regex },
          { judge: regex },
          { oppositeParty: regex },
          { oppositeCounsel: regex },
        ],
      })
        .select('title caseNumber cnrNumber court courtroom judge status priority')
        .limit(6),

      Client.find({
        lawFirmId: firmId,
        $or: [{ name: regex }, { phone: regex }, { email: regex }, { companyName: regex }],
      })
        .select('name phone email clientType companyName status')
        .limit(6),

      Hearing.find({
        lawFirmId: firmId,
        $or: [{ court: regex }, { courtroom: regex }, { judge: regex }, { purpose: regex }, { itemNumber: regex }],
      })
        .populate('caseId', 'title caseNumber')
        .select('date time court courtroom judge purpose status itemNumber')
        .limit(6),

      Task.find({
        lawFirmId: firmId,
        $or: [{ title: regex }, { description: regex }, { category: regex }],
      })
        .select('title dueDate priority status category')
        .limit(6),

      Note.find({
        lawFirmId: firmId,
        $or: [{ title: regex }, { content: regex }, { citation: regex }, { court: regex }],
      })
        .select('title category citation court pinned updatedAt')
        .limit(6),

      Payment.find({
        lawFirmId: firmId,
        $or: [{ receiptNumber: regex }, { description: regex }, { transactionReference: regex }],
      })
        .populate('clientId', 'name')
        .select('receiptNumber amount paymentDate status paymentMethod')
        .limit(6),
    ]);

    res.status(200).json({
      success: true,
      query,
      data: {
        cases,
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
