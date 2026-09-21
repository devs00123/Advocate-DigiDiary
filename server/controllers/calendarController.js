const Hearing = require('../models/Hearing');
const Case = require('../models/Case');
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');
const Client = require('../models/Client');

function toDateKey(d) {
  if (!d) return '';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const iso = dt.toISOString();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${month}-${day}`;
}

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
      startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
      endDate = new Date(y, m + 2, 0, 23, 59, 59, 999);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Auto-advance past scheduled hearings strictly before today
    const pastScheduled = await Hearing.find({
      lawFirmId: req.user.lawFirmId,
      status: 'Scheduled',
      date: { $lt: startOfToday },
    });

    for (const h of pastScheduled) {
      h.status = 'Completed';
      h.outcome = h.outcome || 'Completed (auto-advanced)';
      await h.save();

      // Only advance case if the case's current hearing date was strictly in the past
      if (h.caseId) {
        const foundCase = await Case.findOne({ _id: h.caseId, lawFirmId: req.user.lawFirmId });
        if (foundCase && foundCase.currentHearingDate) {
          const caseCurrent = new Date(foundCase.currentHearingDate);
          if (caseCurrent.getTime() < startOfToday.getTime()) {
            foundCase.lastHearingDate = foundCase.currentHearingDate;
            if (h.nextDate && new Date(h.nextDate).getTime() >= startOfToday.getTime()) {
              foundCase.currentHearingDate = h.nextDate;
            }
            if (h.nextStage) foundCase.currentStage = h.nextStage;
            await foundCase.save();
          }
        }
      }
    }

    // Query hearings, tasks, reminders, and cases with currentHearingDate in range
    const [hearings, tasks, reminders, casesWithHearing] = await Promise.all([
      Hearing.find({
        lawFirmId: req.user.lawFirmId,
        date: { $gte: startDate, $lte: endDate },
      })
        .populate({
          path: 'caseId',
          select: 'title caseNumber cnrNumber court courtroom judge caseType clientId partyRole clientRepresentation oppositeParty oppositeCounsel currentStage status totalFee agreedFee lastHearingDate currentHearingDate hearingTime description',
          populate: { path: 'clientId', select: 'name phone email' },
        })
        .populate('clientId', 'name phone email'),
      Task.find({
        lawFirmId: req.user.lawFirmId,
        dueDate: { $gte: startDate, $lte: endDate },
      }).populate('caseId', 'title caseNumber court'),
      Reminder.find({
        lawFirmId: req.user.lawFirmId,
        reminderDate: { $gte: startDate, $lte: endDate },
      }).populate('relatedCase', 'title caseNumber court'),
      Case.find({
        lawFirmId: req.user.lawFirmId,
        currentHearingDate: { $gte: startDate, $lte: endDate },
      }).populate('clientId', 'name phone email'),
    ]);

    const events = [];
    const scheduledCaseDateKeys = new Set();

    for (const h of hearings) {
      let lastHearingDate = null;
      const c = h.caseId;
      const hDateKey = toDateKey(h.date);

      if (c && c._id) {
        scheduledCaseDateKeys.add(`${c._id}_${hDateKey}`);
        const prev = await Hearing.findOne({
          lawFirmId: req.user.lawFirmId,
          caseId: c._id,
          date: { $lt: h.date },
        })
          .sort({ date: -1 })
          .select('date');
        if (prev) {
          lastHearingDate = prev.date;
        } else if (c.lastHearingDate) {
          lastHearingDate = c.lastHearingDate;
        }
      }

      const caseTitle = c ? c.title : (h.purpose || 'Court Hearing');
      const court = h.court || (c ? c.court : 'District Court');
      const courtroom = h.courtroom || (c ? c.courtroom : '') || '';
      const judge = h.judge || (c ? c.judge : '') || '';
      const appearingFor = c ? (c.clientRepresentation || c.partyRole || 'Counsel') : 'Counsel';
      const clientName = (c && c.clientId && c.clientId.name) ? c.clientId.name : (h.clientId && h.clientId.name ? h.clientId.name : '');
      const cnrNumber = c ? (c.cnrNumber || '') : '';
      const caseType = c ? (c.caseType || 'Civil Suit') : 'Civil Suit';
      const oppositeParty = c ? (c.oppositeParty || '') : '';
      const oppositeCounsel = c ? (c.oppositeCounsel || '') : '';
      const currentStage = c ? (c.currentStage || h.purpose || 'Regular Hearing') : (h.purpose || 'Regular Hearing');
      const caseStatus = c ? (c.status || 'Active') : 'Active';
      const agreedFee = c ? (c.agreedFee || c.totalFee || 0) : 0;
      const caseSynopsis = c ? (c.description || '') : '';

      const remarks = h.outcome
        ? `${h.outcome}${h.benchNotes ? ' | ' + h.benchNotes : ''}`
        : (h.benchNotes || h.purpose || 'Regular Hearing Proceedings');

      const resolvedTime = (c && c.hearingTime) || h.time || '10:00 AM';

      events.push({
        id: h._id,
        type: 'hearing',
        title: c ? `${c.title} (${resolvedTime})` : (h.purpose || 'Court Hearing'),
        caseTitle,
        caseNumber: c ? (c.caseNumber || '') : '',
        cnrNumber,
        caseType,
        clientName,
        clientId: (c && c.clientId) || h.clientId || null,
        clientRepresentation: appearingFor,
        appearingFor,
        oppositeParty,
        oppositeCounsel,
        currentStage,
        caseStatus,
        agreedFee,
        caseSynopsis,
        start: h.date,
        date: h.date,
        currentDate: h.date,
        dateKey: hDateKey,
        lastDate: lastHearingDate,
        nextDate: h.nextDate || null,
        remarks,
        benchNotes: h.benchNotes || '',
        outcome: h.outcome || '',
        time: resolvedTime,
        court,
        courtroom,
        judge,
        purpose: h.purpose || currentStage,
        description: `${h.purpose || currentStage}${h.benchNotes ? ' — ' + h.benchNotes : ''}`,
        status: h.status || 'Scheduled',
        caseId: c || null,
        color: '#C59B27',
      });
    }

    // Ensure all cases with currentHearingDate in the window are represented
    for (const c of casesWithHearing) {
      const caseIdStr = String(c._id);
      const caseDateKey = toDateKey(c.currentHearingDate);
      const compositeKey = `${caseIdStr}_${caseDateKey}`;

      if (!scheduledCaseDateKeys.has(compositeKey)) {
        scheduledCaseDateKeys.add(compositeKey);
        const resolvedTime = c.hearingTime || '10:00 AM';
        const clientName = (c.clientId && c.clientId.name) ? c.clientId.name : '';
        const appearingFor = c.clientRepresentation || c.partyRole || 'Counsel';

        events.push({
          id: c._id,
          type: 'hearing',
          title: `${c.title} (${resolvedTime})`,
          caseTitle: c.title,
          caseNumber: c.caseNumber || '',
          cnrNumber: c.cnrNumber || '',
          caseType: c.caseType || 'Civil Suit',
          clientName,
          clientId: c.clientId || null,
          clientRepresentation: appearingFor,
          appearingFor,
          oppositeParty: c.oppositeParty || '',
          oppositeCounsel: c.oppositeCounsel || '',
          currentStage: c.currentStage || 'Regular Hearing',
          caseStatus: c.status || 'Active',
          agreedFee: c.agreedFee || c.totalFee || 0,
          caseSynopsis: c.description || '',
          start: c.currentHearingDate,
          date: c.currentHearingDate,
          currentDate: c.currentHearingDate,
          dateKey: toDateKey(c.currentHearingDate),
          lastDate: c.lastHearingDate || null,
          nextDate: null,
          remarks: c.currentStage || 'Regular Hearing Proceedings',
          benchNotes: c.description || '',
          outcome: '',
          time: resolvedTime,
          court: c.court || 'District Court',
          courtroom: c.courtroom || '',
          judge: c.judge || '',
          purpose: c.currentStage || 'Hearing',
          description: `${c.currentStage || 'Hearing'}${c.description ? ' — ' + c.description : ''}`,
          status: 'Scheduled',
          caseId: c,
          color: '#C59B27',
        });

        // Background auto-sync of hearing document
        Hearing.create({
          lawFirmId: req.user.lawFirmId,
          caseId: c._id,
          clientId: c.clientId ? (c.clientId._id || c.clientId) : undefined,
          date: c.currentHearingDate,
          time: resolvedTime,
          court: c.court,
          courtroom: c.courtroom,
          judge: c.judge,
          purpose: c.currentStage || 'Regular Hearing',
          status: 'Scheduled',
          createdBy: req.user._id,
        }).catch(() => {});
      }
    }

    tasks.forEach((t) => {
      events.push({
        id: t._id,
        type: 'task',
        title: t.title || 'Chamber Task',
        caseNumber: t.caseId ? t.caseId.caseNumber : '',
        start: t.dueDate,
        date: t.dueDate,
        dateKey: toDateKey(t.dueDate),
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
        dateKey: toDateKey(r.reminderDate),
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
