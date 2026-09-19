const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');

exports.getCalendarEvents = async (req, res, next) => {
  try {
    const { year, month, start, end } = req.query;

    let startDate, endDate;

    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
    } else {
      const now = new Date();
      const y = parseInt(year, 10) || now.getFullYear();
      const m = parseInt(month, 10) !== undefined ? parseInt(month, 10) : now.getMonth();
      startDate = new Date(y, m - 1, 1); // Previous month buffer
      endDate = new Date(y, m + 2, 0, 23, 59, 59, 999); // Next month buffer
    }

    const [hearings, tasks, reminders] = await Promise.all([
      Hearing.find({
        lawFirmId: req.user.lawFirmId,
        date: { $gte: startDate, $lte: endDate },
      }).populate('caseId', 'title caseNumber court courtroom judge priority status'),
      Task.find({
        lawFirmId: req.user.lawFirmId,
        dueDate: { $gte: startDate, $lte: endDate },
      }).populate('caseId', 'title caseNumber'),
      Reminder.find({
        lawFirmId: req.user.lawFirmId,
        reminderDate: { $gte: startDate, $lte: endDate },
      }).populate('relatedCase', 'title caseNumber'),
    ]);

    const events = [];

    hearings.forEach((h) => {
      events.push({
        id: h._id,
        type: 'HEARING',
        title: h.caseId ? `${h.caseId.title} (${h.time || '10:00 AM'})` : 'Court Hearing',
        caseNumber: h.caseId ? h.caseId.caseNumber : '',
        date: h.date,
        time: h.time,
        court: h.court,
        courtroom: h.courtroom,
        judge: h.judge,
        stage: h.purpose,
        status: h.status,
        color: '#C59B27', // Antique Gold
      });
    });

    tasks.forEach((t) => {
      events.push({
        id: t._id,
        type: 'TASK',
        title: `Task: ${t.title}`,
        caseNumber: t.caseId ? t.caseId.caseNumber : '',
        date: t.dueDate,
        priority: t.priority,
        status: t.status,
        color: t.priority === 'Urgent' ? '#BA1A1A' : '#141A32',
      });
    });

    reminders.forEach((r) => {
      events.push({
        id: r._id,
        type: 'REMINDER',
        title: `Reminder: ${r.title}`,
        date: r.reminderDate,
        time: r.reminderTime,
        priority: r.priority,
        completed: r.completed,
        color: '#575D78',
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
