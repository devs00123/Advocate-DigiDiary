const mongoose = require('mongoose');
const Case = require('../models/Case');
const Client = require('../models/Client');
const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Note = require('../models/Note');
const Payment = require('../models/Payment');
const { logAudit } = require('../utils/auditLogger');

exports.listCases = async (req, res, next) => {
  try {
    const { search, status, court, priority, caseType, sort = 'currentHearingDate', order = 'asc', page = 1, limit = 15 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (status && status !== 'All Statuses' && status !== 'All') {
      // Match status case-insensitively (e.g. 'active', 'Active')
      query.status = new RegExp('^' + status + '$', 'i');
    }
    if (court && court !== 'All Courts' && court !== 'All') {
      query.court = new RegExp(court, 'i');
    }
    if (priority && priority !== 'All') {
      query.priority = priority.toLowerCase();
    }
    if (caseType && caseType !== 'All Types' && caseType !== 'All') {
      query.caseType = new RegExp(caseType, 'i');
    }

    if (search && search.trim()) {
      const s = search.trim();
      const safePattern = String(s).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const safeRegex = new RegExp(safePattern, 'i');

      // Also search matching clients so searching client name matches their cases
      const matchingClients = await Client.find({
        lawFirmId: req.user.lawFirmId,
        $or: [{ name: safeRegex }, { phone: safeRegex }, { email: safeRegex }],
      }).select('_id');
      const matchedClientIds = matchingClients.map((c) => c._id);

      const orConditions = [
        { title: safeRegex },
        { caseNumber: safeRegex },
        { cnrNumber: safeRegex },
        { court: safeRegex },
        { judge: safeRegex },
        { courtroom: safeRegex },
        { oppositeParty: safeRegex },
        { oppositeCounsel: safeRegex },
        { currentStage: safeRegex },
        { description: safeRegex },
      ];

      if (matchedClientIds.length > 0) {
        orConditions.push({ clientId: { $in: matchedClientIds } });
      }

      query.$or = orConditions;
    }

    const sortOptions = {};
    const sortField = sort === 'title' ? 'title' : sort === 'createdAt' ? 'createdAt' : 'currentHearingDate';
    sortOptions[sortField] = order === 'desc' ? -1 : 1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      Case.find(query)
        .populate('clientId', 'name phone email clientType')
        .populate('assignedAdvocate', 'name email designation')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Case.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: cases,
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

exports.getCaseById = async (req, res, next) => {
  try {
    const foundCase = await Case.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId, // Strict tenant isolation
    })
      .populate('clientId')
      .populate('assignedAdvocate', 'name email designation phone')
      .populate('createdBy', 'name email');

    if (!foundCase) {
      return res.status(404).json({
        success: false,
        message: 'Case record not found or unauthorized.',
      });
    }

    // Fetch related hearings, tasks, notes, payments
    const [hearings, tasks, notes, payments] = await Promise.all([
      Hearing.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }).sort({ date: -1 }),
      Task.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }).sort({ dueDate: 1 }),
      Note.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }).sort({ pinned: -1, updatedAt: -1 }),
      Payment.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }).sort({ paymentDate: -1 }),
    ]);

    const totalPaid = payments
      .filter((p) => p.status === 'Realized')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const agreedFee = foundCase.agreedFee || 0;
    const pendingBalance = Math.max(0, agreedFee - totalPaid);

    const caseObj = foundCase.toObject();
    res.status(200).json({
      success: true,
      data: {
        ...caseObj,
        case: foundCase,
        hearings,
        tasks,
        notes,
        payments,
        financials: {
          agreedFee,
          totalPaid,
          pendingBalance,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getCaseTimeline = async (req, res, next) => {
  try {
    const foundCase = await Case.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!foundCase) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const [hearings, tasks, notes, payments] = await Promise.all([
      Hearing.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
      Task.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
      Note.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
      Payment.find({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
    ]);

    const events = [];

    // Case filing / creation
    events.push({
      date: foundCase.filingDate || foundCase.createdAt,
      type: 'FILING',
      title: 'Case Instituted & Registered',
      description: `Suit registered under registration number ${foundCase.caseNumber} at ${foundCase.court}.`,
      badge: 'Chamber Intake',
    });

    hearings.forEach((h) => {
      events.push({
        date: h.date,
        type: 'HEARING',
        title: `Hearing: ${h.purpose} (${h.status})`,
        description: `${h.court}, ${h.courtroom || ''}. Bench: ${h.judge || 'Hon. Judge'}.${h.outcome ? ` Outcome: ${h.outcome}` : ''}${h.benchNotes ? ` Notes: ${h.benchNotes}` : ''}`,
        badge: h.status,
      });
    });

    tasks.forEach((t) => {
      events.push({
        date: t.completedAt || t.dueDate,
        type: 'TASK',
        title: `Task: ${t.title} [${t.status}]`,
        description: t.description || `Category: ${t.category}. Priority: ${t.priority}`,
        badge: t.status,
      });
    });

    notes.forEach((n) => {
      events.push({
        date: n.createdAt,
        type: 'NOTE',
        title: `Legal Note: ${n.title}`,
        description: n.citation ? `Citation: ${n.citation}` : `Category: ${n.category}`,
        badge: n.category,
      });
    });

    payments.forEach((p) => {
      events.push({
        date: p.paymentDate,
        type: 'PAYMENT',
        title: `Fee Payment Realized: ₹${p.amount.toLocaleString('en-IN')}`,
        description: `Receipt: ${p.receiptNumber} (${p.paymentMethod}) - ${p.category}`,
        badge: p.status,
      });
    });

    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (err) {
    next(err);
  }
};

exports.createCase = async (req, res, next) => {
  try {
    const {
      caseNumber,
      cnrNumber,
      title,
      clientId,
      caseType,
      court,
      judge,
      filingDate,
      firstHearingDate,
      lastHearingDate,
      currentHearingDate,
      priority,
      status,
      description,
      assignedAdvocate,
    } = req.body;

    const oppositeParty = req.body.oppositeParty || req.body.opponentParty || '';
    const oppositeCounsel = req.body.oppositeCounsel || req.body.opponentAdvocate || '';
    const clientRepresentation = req.body.clientRepresentation || req.body.partyRole || 'Plaintiff';
    const agreedFee = req.body.agreedFee !== undefined ? req.body.agreedFee : (req.body.totalAgreedFee || 0);
    const courtroom = req.body.courtroom || req.body.courtRoom || '';
    const currentStage = req.body.currentStage || req.body.stage || 'Preliminary Hearing';
    const hearingTime = req.body.hearingTime || req.body.time || '10:00 AM';

    const finalCaseNumber = (caseNumber && String(caseNumber).trim()) ? String(caseNumber).trim() : ('MATTER-' + Date.now().toString().slice(-6));
    const finalTitle = (title && String(title).trim()) ? String(title).trim() : 'General Legal Matter';
    const finalCourt = (court && String(court).trim()) ? String(court).trim() : 'District Court';

    // Verify client belongs to this tenant, or link to first available / auto-create
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
        clientType: 'Individual',
        createdBy: req.user._id,
      });
    }

    const newCase = await Case.create({
      lawFirmId: req.user.lawFirmId,
      caseNumber: finalCaseNumber,
      cnrNumber: cnrNumber ? String(cnrNumber).toUpperCase() : '',
      title: finalTitle,
      clientId: client._id,
      clientRepresentation,
      oppositeParty,
      oppositeCounsel,
      caseType: caseType || 'Civil Suit',
      court: finalCourt,
      judge: judge || '',
      courtroom,
      filingDate: filingDate || new Date(),
      firstHearingDate: firstHearingDate || null,
      lastHearingDate: lastHearingDate || null,
      currentHearingDate: currentHearingDate || null,
      hearingTime,
      currentStage: currentStage || 'Notice / Summons',
      priority: priority ? priority.toLowerCase() : 'standard',
      status: status || 'Active',
      description: description || '',
      agreedFee: Number(agreedFee) || 0,
      assignedAdvocate: assignedAdvocate || req.user._id,
      createdBy: req.user._id,
    });

    // If currentHearingDate was provided, automatically create scheduled hearing record
    if (currentHearingDate) {
      await Hearing.create({
        lawFirmId: req.user.lawFirmId,
        caseId: newCase._id,
        clientId: client._id,
        date: new Date(currentHearingDate),
        time: hearingTime,
        court: newCase.court,
        courtroom: newCase.courtroom,
        judge: newCase.judge,
        purpose: currentStage || 'Admission / Regular Hearing',
        status: 'Scheduled',
        createdBy: req.user._id,
      });
    }

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CASE_CREATED',
      entityType: 'Case',
      entityId: newCase._id,
      description: `New case docket created: ${newCase.title} (${newCase.caseNumber})`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Case docket created successfully.',
      data: newCase,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCase = async (req, res, next) => {
  try {
    const foundCase = await Case.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!foundCase) {
      return res.status(404).json({
        success: false,
        message: 'Case not found or unauthorized.',
      });
    }

    // Updatable fields with alias resolution
    if (req.body.caseNumber !== undefined) foundCase.caseNumber = req.body.caseNumber;
    if (req.body.cnrNumber !== undefined) foundCase.cnrNumber = req.body.cnrNumber ? String(req.body.cnrNumber).toUpperCase() : '';
    if (req.body.title !== undefined) foundCase.title = req.body.title;
    if (req.body.clientRepresentation !== undefined || req.body.partyRole !== undefined) {
      foundCase.clientRepresentation = req.body.clientRepresentation || req.body.partyRole;
    }
    if (req.body.oppositeParty !== undefined || req.body.opponentParty !== undefined) {
      foundCase.oppositeParty = req.body.oppositeParty !== undefined ? req.body.oppositeParty : req.body.opponentParty;
    }
    if (req.body.oppositeCounsel !== undefined || req.body.opponentAdvocate !== undefined) {
      foundCase.oppositeCounsel = req.body.oppositeCounsel !== undefined ? req.body.oppositeCounsel : req.body.opponentAdvocate;
    }
    if (req.body.caseType !== undefined) foundCase.caseType = req.body.caseType;
    if (req.body.court !== undefined) foundCase.court = req.body.court;
    if (req.body.judge !== undefined) foundCase.judge = req.body.judge;
    if (req.body.courtroom !== undefined || req.body.courtRoom !== undefined) {
      foundCase.courtroom = req.body.courtroom !== undefined ? req.body.courtroom : req.body.courtRoom;
    }
    if (req.body.filingDate !== undefined) foundCase.filingDate = req.body.filingDate;
    if (req.body.firstHearingDate !== undefined) foundCase.firstHearingDate = req.body.firstHearingDate;
    if (req.body.lastHearingDate !== undefined) foundCase.lastHearingDate = req.body.lastHearingDate;
    if (req.body.currentHearingDate !== undefined) foundCase.currentHearingDate = req.body.currentHearingDate;
    if (req.body.hearingTime !== undefined || req.body.time !== undefined) {
      foundCase.hearingTime = req.body.hearingTime || req.body.time || '10:00 AM';
    }
    if (req.body.currentStage !== undefined || req.body.stage !== undefined) {
      foundCase.currentStage = req.body.currentStage !== undefined ? req.body.currentStage : req.body.stage;
    }
    if (req.body.priority !== undefined) foundCase.priority = req.body.priority ? req.body.priority.toLowerCase() : 'standard';
    if (req.body.status !== undefined) foundCase.status = req.body.status;
    if (req.body.description !== undefined) foundCase.description = req.body.description;
    if (req.body.agreedFee !== undefined || req.body.totalAgreedFee !== undefined) {
      foundCase.agreedFee = Number(req.body.agreedFee !== undefined ? req.body.agreedFee : req.body.totalAgreedFee) || 0;
    }
    if (req.body.clientId && mongoose.Types.ObjectId.isValid(req.body.clientId)) {
      foundCase.clientId = req.body.clientId;
    }
    if (req.body.assignedAdvocate && mongoose.Types.ObjectId.isValid(req.body.assignedAdvocate)) {
      foundCase.assignedAdvocate = req.body.assignedAdvocate;
    }

    await foundCase.save();

    // Sync hearing record when currentHearingDate or hearingTime changes
    if (req.body.currentHearingDate !== undefined || req.body.hearingTime !== undefined || req.body.time !== undefined) {
      const newDate = foundCase.currentHearingDate ? new Date(foundCase.currentHearingDate) : null;
      if (newDate) {
        const existingHearing = await Hearing.findOne({
          caseId: foundCase._id,
          lawFirmId: req.user.lawFirmId,
          status: { $in: ['Scheduled', 'InProgress'] },
        }).sort({ date: -1 });

        if (existingHearing) {
          existingHearing.date = newDate;
          existingHearing.time = foundCase.hearingTime || existingHearing.time || '10:00 AM';
          existingHearing.court = foundCase.court || existingHearing.court;
          existingHearing.courtroom = foundCase.courtroom || existingHearing.courtroom;
          existingHearing.judge = foundCase.judge || existingHearing.judge;
          existingHearing.purpose = foundCase.currentStage || existingHearing.purpose;
          await existingHearing.save();
        } else {
          await Hearing.create({
            lawFirmId: req.user.lawFirmId,
            caseId: foundCase._id,
            clientId: foundCase.clientId,
            date: newDate,
            time: foundCase.hearingTime || '10:00 AM',
            court: foundCase.court,
            courtroom: foundCase.courtroom,
            judge: foundCase.judge,
            purpose: foundCase.currentStage || 'Admission / Regular Hearing',
            status: 'Scheduled',
            createdBy: req.user._id,
          });
        }
      }
    }

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CASE_UPDATED',
      entityType: 'Case',
      entityId: foundCase._id,
      description: `Updated case docket ${foundCase.caseNumber} (${foundCase.title})`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Case docket updated successfully.',
      data: foundCase,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCase = async (req, res, next) => {
  try {
    const foundCase = await Case.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!foundCase) {
      return res.status(404).json({
        success: false,
        message: 'Case not found or unauthorized.',
      });
    }

    // Clean up associated hearings, tasks, notes
    await Promise.all([
      Hearing.deleteMany({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
      Task.deleteMany({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
      Note.deleteMany({ caseId: foundCase._id, lawFirmId: req.user.lawFirmId }),
    ]);

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CASE_DELETED',
      entityType: 'Case',
      entityId: foundCase._id,
      description: `Deleted case docket ${foundCase.caseNumber} (${foundCase.title})`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Case docket removed successfully.',
    });
  } catch (err) {
    next(err);
  }
};
