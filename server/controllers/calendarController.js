const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');

exports.getCalendarEvents = async (req, res, next) => {
  try {
    const { year, month, start, end } = req.query;

    let startDate, endDate;

    if (start && end) {
      startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      const y = parseInt(year, 10) || now.getFullYear();
      const m = parseInt(month, 10) !== undefined ? parseInt(month, 10) : now.getMonth();
      startDate = new Date(y, m - 1, 1, 0, 0, 0, 0); // Previous month buffer
      endDate = new Date(y, m + 2, 0, 23, 59, 59, 999); // Next month buffer
    }

    const [hearings, tasks, reminders] = await Promise.all([
      Hearing.find({
        lawFirmId: req.user.lawFirmId,
        date: { $gte: startDate, $lte: endDate },
      }).populate('caseId', 'title caseNumber court courtroom judge priority status clientRepresentation partyRole nextHearingDate'),
      Task.find({
        lawFirmId: req.user.lawFirmId,
        dueDate: { $gte: startDate, $lte: endDate },
      }).populate('caseId', 'title caseNumber court'),
      Reminder.find({
        lawFirmId: req.user.lawFirmId,
        reminderDate: { $gte: startDate, $lte: endDate },
      }).populate('relatedCase', 'title caseNumber court'),
    ]);

    const events = [];

    // Enrich hearings with previous hearing date, next hearing date, appearingFor, and remarks
    for (const h of hearings) {
      let lastHearingDate = null;
      if (h.caseId && h.caseId._id) {
        const prev = await Hearing.findOne({
          lawFirmId: req.user.lawFirmId,
          caseId: h.caseId._id,
          date: { $lt: h.date },
        })
          .sort({ date: -1 })
          .select('date');
        if (prev) {
          lastHearingDate = prev.date;
        }
      }

      const caseTitle = h.caseId ? h.caseId.title : (h.purpose || 'Court Hearing');
      const court = h.court || (h.caseId ? h.caseId.court : 'District Court');
      const appearingFor = h.caseId ? (h.caseId.clientRepresentation || h.caseId.partyRole || 'Counsel') : 'Counsel';
      const remarks = h.outcome
        ? `${h.outcome}${h.benchNotes ? ' | ' + h.benchNotes : ''}`
        : (h.benchNotes || h.purpose || 'Regular Hearing Proceedings');

      events.push({
        id: h._id,
        type: 'hearing',
        title: h.caseId ? `${h.caseId.title} (${h.time || '10:00 AM'})` : (h.purpose || 'Court Hearing'),
        caseTitle,
        caseNumber: h.caseId ? h.caseId.caseNumber : '',
        start: h.date,
        date: h.date,
        currentDate: h.date,
        lastDate: lastHearingDate,
        nextDate: h.nextDate || (h.caseId ? h.caseId.nextHearingDate : null),
        appearingFor,
        remarks,
        benchNotes: h.benchNotes || '',
        outcome: h.outcome || '',
        time: h.time || '10:00 AM',
        court,
        courtroom: h.courtroom || '',
        judge: h.judge || '',
        purpose: h.purpose || 'Hearing',
        description: `${h.purpose || 'Hearing'}${h.benchNotes ? ' — ' + h.benchNotes : ''}`,
        status: h.status || 'Scheduled',
        caseId: h.caseId,
        color: '#C59B27', // Antique Gold
      });
    }

    tasks.forEach((t) => {
      events.push({
        id: t._id,
        type: 'task',
        title: t.title || 'Chamber Task',
        caseNumber: t.caseId ? t.caseId.caseNumber : '',
        start: t.dueDate,
        date: t.dueDate,
        priority: t.priority || 'Medium',
        status: t.status || 'To Do',
        description: t.description || `Priority: ${t.priority || 'Medium'}`,
        caseId: t.caseId,
        color: (t.priority === 'Urgent' || t.priority === 'urgent') ? '#BA1A1A' : '#059669',
      });
    });

    reminders.forEach((r) => {
      events.push({
        id: r._id,
        type: 'reminder',
        title: r.title || 'Chamber Reminder',
        caseNumber: r.relatedCase ? r.relatedCase.caseNumber : '',
        start: r.reminderDate,
        date: r.reminderDate,
        time: r.reminderTime || '09:00 AM',
        priority: r.priority || 'Medium',
        status: r.completed ? 'Completed' : 'Active',
        completed: r.completed,
        description: (r.type ? r.type + ' reminder' : 'Chamber reminder') + (r.reminderTime ? ` at ${r.reminderTime}` : ''),
        caseId: r.relatedCase,
        color: '#D97706',
      });
    });

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (err) {
    next(err);
  }
};
