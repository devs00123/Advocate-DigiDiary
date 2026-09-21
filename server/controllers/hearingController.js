const mongoose = require('mongoose');
const Hearing = require('../models/Hearing');
const Case = require('../models/Case');
const Client = require('../models/Client');
const { logAudit } = require('../utils/auditLogger');

exports.listHearings = async (req, res, next) => {
  try {
    const { view = 'today', date, startDate, endDate, court, status, search, page = 1, limit = 50 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    const now = date ? new Date(date) : new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Auto-advance: mark past scheduled hearings as Completed if their date has passed
    const pastScheduled = await Hearing.find({
      lawFirmId: req.user.lawFirmId,
      status: 'Scheduled',
      date: { $lt: startOfToday },
    });

    for (const h of pastScheduled) {
      h.status = 'Completed';
      h.outcome = h.outcome || 'Completed (auto-advanced)';
      await h.save();

      // Sync case: only advance if strictly in the past and nextDate is provided
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

    if (view === 'today') {
      query.date = { $gte: startOfToday, $lte: endOfToday };
    } else if (view === 'tomorrow') {
      const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: startOfTomorrow, $lte: endOfTomorrow };
    } else if (view === 'this-week') {
      const dayOfWeek = startOfToday.getDay(); // 0 is Sunday
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + mondayOffset);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
      query.date = { $gte: monday, $lte: sunday };
    } else if (view === 'this-month') {
      const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
      const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0, 23, 59, 59, 999);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (view === 'upcoming') {
      query.date = { $gte: startOfToday };
    } else if (view === 'past') {
      query.date = { $lt: startOfToday };
    }

    if (court && court !== 'All Courts' && court !== 'All') {
      query.court = new RegExp(court, 'i');
    }
    if (status && status !== 'All Statuses' && status !== 'All') {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [hearings, total] = await Promise.all([
      Hearing.find(query)
        .populate('caseId', 'title caseNumber cnrNumber caseType court courtroom judge clientRepresentation oppositeParty oppositeCounsel status priority')
        .populate('clientId', 'name phone email clientType')
        .populate('assignedAdvocate', 'name email designation')
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(limitNum),
      Hearing.countDocuments(query),
    ]);

    // Format query statistics for the hearing diary header
    const stats = {
      total,
      todayCount: await Hearing.countDocuments({ lawFirmId: req.user.lawFirmId, date: { $gte: startOfToday, $lte: endOfToday } }),
      scheduled: hearings.filter((h) => h.status === 'Scheduled').length,
      inSession: hearings.filter((h) => h.status === 'InProgress').length,
      completed: hearings.filter((h) => h.status === 'Completed').length,
      adjourned: hearings.filter((h) => h.status === 'Adjourned').length,
    };

    res.status(200).json({
      success: true,
      data: hearings,
      stats,
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

exports.getHearingById = async (req, res, next) => {
  try {
    const hearing = await Hearing.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    })
      .populate('caseId')
      .populate('clientId')
      .populate('assignedAdvocate', 'name email designation phone');

    if (!hearing) {
      return res.status(404).json({ success: false, message: 'Hearing entry not found or unauthorized.' });
    }

    res.status(200).json({ success: true, data: hearing });
  } catch (err) {
    next(err);
  }
};

exports.createHearing = async (req, res, next) => {
  try {
    const {
      caseId,
      date,
      time,
      itemNumber,
      court,
      courtroom,
      judge,
      purpose,
      benchNotes,
      status,
      assignedAdvocate,
    } = req.body;

    const hearingDate = date || req.body.hearingDate || new Date();
    const finalCourtroom = courtroom || req.body.courtRoom || '';

    let foundCase = null;
    if (caseId && mongoose.Types.ObjectId.isValid(caseId)) {
      foundCase = await Case.findOne({ _id: caseId, lawFirmId: req.user.lawFirmId });
    }
    if (!foundCase) {
      foundCase = await Case.findOne({ lawFirmId: req.user.lawFirmId });
    }
    if (!foundCase) {
      let client = await Client.findOne({ lawFirmId: req.user.lawFirmId });
      if (!client) {
        client = await Client.create({
          lawFirmId: req.user.lawFirmId,
          name: 'General Practice Client',
          createdBy: req.user._id,
        });
      }
      foundCase = await Case.create({
        lawFirmId: req.user.lawFirmId,
        caseNumber: 'MATTER-' + Date.now().toString().slice(-6),
        title: 'General Chamber Matter',
        clientId: client._id,
        court: court || 'District Court',
        createdBy: req.user._id,
      });
    }

    const hearing = await Hearing.create({
      lawFirmId: req.user.lawFirmId,
      caseId: foundCase._id,
      clientId: foundCase.clientId,
      date: new Date(hearingDate),
      time: time || '10:00 AM',
      itemNumber: itemNumber || '',
      court: court || foundCase.court || 'District Court',
      courtroom: finalCourtroom || foundCase.courtroom || foundCase.courtRoom || '',
      judge: judge || foundCase.judge || '',
      purpose: purpose || 'Regular Hearing',
      benchNotes: benchNotes || '',
      status: status || 'Scheduled',
      assignedAdvocate: (assignedAdvocate && mongoose.Types.ObjectId.isValid(assignedAdvocate)) ? assignedAdvocate : req.user._id,
      createdBy: req.user._id,
    });

    // Update case currentHearingDate if hearing is in the future
    const hearingDateObj = new Date(hearingDate);
    if (!isNaN(hearingDateObj.getTime()) && hearingDateObj >= new Date()) {
      foundCase.lastHearingDate = foundCase.currentHearingDate;
      foundCase.currentHearingDate = hearingDateObj;
      foundCase.currentStage = hearing.purpose;
      await foundCase.save();
    }

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'HEARING_SCHEDULED',
      entityType: 'Hearing',
      entityId: hearing._id,
      description: `Hearing scheduled for ${foundCase.title} on ${new Date(hearingDate).toLocaleDateString()} at ${hearing.court}`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Hearing scheduled successfully.',
      data: hearing,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateHearing = async (req, res, next) => {
  try {
    const hearing = await Hearing.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!hearing) {
      return res.status(404).json({ success: false, message: 'Hearing entry not found or unauthorized.' });
    }

    const fields = [
      'date',
      'time',
      'itemNumber',
      'court',
      'courtroom',
      'judge',
      'purpose',
      'benchNotes',
      'outcome',
      'status',
      'nextDate',
      'nextStage',
      'passover',
      'assignedAdvocate',
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) hearing[f] = req.body[f];
    });

    if (req.body.date) {
      hearing.date = new Date(req.body.date);
    }

    if (req.body.remarks !== undefined && !req.body.benchNotes) {
      hearing.benchNotes = req.body.remarks;
    }

    if (req.body.courtRoom && !req.body.courtroom) {
      hearing.courtroom = req.body.courtRoom;
    }

    if (req.body.status) {
      const s = String(req.body.status).toLowerCase();
      if (s === 'completed') hearing.status = 'Completed';
      else if (s === 'scheduled') hearing.status = 'Scheduled';
      else if (s === 'adjourned') hearing.status = 'Adjourned';
      else if (s === 'cancelled') hearing.status = 'Cancelled';
      else if (s === 'inprogress' || s === 'in progress') hearing.status = 'InProgress';
    }

    const nextDateVal = req.body.nextDate || req.body.nextHearingDate;
    const nextStageVal = req.body.nextStage || req.body.nextHearingPurpose;

    if (nextDateVal) {
      hearing.nextDate = new Date(nextDateVal);
      if (nextStageVal) hearing.nextStage = nextStageVal;
    }

    await hearing.save();

    // If nextDate was provided, shift currentHearingDate -> lastHearingDate and set new currentHearingDate
    if (nextDateVal) {
      const foundCase = await Case.findOne({ _id: hearing.caseId, lawFirmId: req.user.lawFirmId });
      if (foundCase) {
        foundCase.lastHearingDate = hearing.date || foundCase.currentHearingDate;
        foundCase.currentHearingDate = new Date(nextDateVal);
        if (nextStageVal) foundCase.currentStage = nextStageVal;
        await foundCase.save();

        // Check if next hearing record already created, if not create
        const nextDateObj = new Date(nextDateVal);
        const existingNext = await Hearing.findOne({
          caseId: foundCase._id,
          lawFirmId: req.user.lawFirmId,
          date: nextDateObj,
        });

        if (!existingNext) {
          await Hearing.create({
            lawFirmId: req.user.lawFirmId,
            caseId: foundCase._id,
            clientId: foundCase.clientId,
            date: nextDateObj,
            time: '10:00 AM',
            court: hearing.court,
            courtroom: hearing.courtroom,
            judge: hearing.judge,
            purpose: nextStageVal || 'Next Hearing',
            status: 'Scheduled',
            createdBy: req.user._id,
          });
        }
      }
    } else if (req.body.date && hearing.caseId) {
      const foundCase = await Case.findOne({ _id: hearing.caseId, lawFirmId: req.user.lawFirmId });
      if (foundCase) {
        foundCase.currentHearingDate = new Date(req.body.date);
        if (req.body.time) foundCase.hearingTime = req.body.time;
        const stageVal = nextStageVal || req.body.purpose;
        if (stageVal) foundCase.currentStage = stageVal;
        await foundCase.save();
      }
    }

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'HEARING_UPDATED',
      entityType: 'Hearing',
      entityId: hearing._id,
      description: `Updated hearing: status=${hearing.status}${hearing.outcome ? `, outcome=${hearing.outcome}` : ''}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Hearing record updated successfully.',
      data: hearing,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteHearing = async (req, res, next) => {
  try {
    const hearing = await Hearing.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!hearing) {
      return res.status(404).json({ success: false, message: 'Hearing entry not found or unauthorized.' });
    }

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'HEARING_DELETED',
      entityType: 'Hearing',
      entityId: hearing._id,
      description: `Deleted hearing record for ${hearing.court}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Hearing entry removed.' });
  } catch (err) {
    next(err);
  }
};

exports.getCauseList = async (req, res, next) => {
  try {
    const range = req.query.range || req.query.view || 'today';
    const { status, court } = req.query;
    const now = req.query.date ? new Date(req.query.date) : new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Auto-advance: mark past scheduled hearings as Completed
    const pastScheduled = await Hearing.find({
      lawFirmId: req.user.lawFirmId,
      status: 'Scheduled',
      date: { $lt: startOfToday },
    });

    for (const h of pastScheduled) {
      h.status = 'Completed';
      h.outcome = h.outcome || 'Completed (auto-advanced)';
      await h.save();

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

    const query = { lawFirmId: req.user.lawFirmId };
    if (range === 'today') {
      query.date = { $gte: startOfToday, $lte: endOfToday };
    } else if (range === 'tomorrow') {
      const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: startOfTomorrow, $lte: endOfTomorrow };
    } else if (range === 'week' || range === 'this-week') {
      const dayOfWeek = startOfToday.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + mondayOffset);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
      query.date = { $gte: monday, $lte: sunday };
    } else if (range === 'month' || range === 'this-month') {
      const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
      const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0, 23, 59, 59, 999);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (range === 'all' || range === 'upcoming') {
      query.date = { $gte: startOfToday };
    } else if (range === 'past') {
      query.date = { $lt: startOfToday };
    }

    if (court && court !== 'All') query.court = new RegExp(court, 'i');
    if (status && status !== 'All') query.status = status;

    const hearings = await Hearing.find(query)
      .populate('caseId', 'title caseNumber cnrNumber caseType court courtroom judge clientRepresentation oppositeParty oppositeCounsel status priority')
      .populate('clientId', 'name phone email clientType')
      .populate('assignedAdvocate', 'name email designation')
      .sort({ date: 1, time: 1 });

    return res.status(200).json({
      success: true,
      count: hearings.length,
      data: hearings,
    });
  } catch (err) {
    next(err);
  }
};

