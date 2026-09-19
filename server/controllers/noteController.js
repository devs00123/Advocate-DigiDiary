const Note = require('../models/Note');
const { logAudit } = require('../utils/auditLogger');

exports.listNotes = async (req, res, next) => {
  try {
    const { category, pinned, search, caseId, page = 1, limit = 25 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (category && category !== 'All' && category !== 'all') {
      // Map frontend tab slugs to Category enum
      const map = {
        'case-note': 'Case',
        'hearing-note': 'Hearing',
        conference: 'Meeting',
        research: 'Research',
        general: 'General',
      };
      query.category = map[category] || category;
    }

    if (pinned === 'true' || pinned === true) {
      query.pinned = true;
    }

    if (caseId) {
      query.caseId = caseId;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: new RegExp(s, 'i') },
        { content: new RegExp(s, 'i') },
        { citation: new RegExp(s, 'i') },
        { court: new RegExp(s, 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [notes, total, pinnedNotes] = await Promise.all([
      Note.find(query)
        .populate('caseId', 'title caseNumber court courtroom judge')
        .populate('clientId', 'name phone')
        .populate('createdBy', 'name email designation')
        .sort({ pinned: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Note.countDocuments(query),
      Note.find({ lawFirmId: req.user.lawFirmId, pinned: true })
        .populate('caseId', 'title caseNumber court')
        .sort({ updatedAt: -1 })
        .limit(5),
    ]);

    const counts = {
      all: await Note.countDocuments({ lawFirmId: req.user.lawFirmId }),
      caseNote: await Note.countDocuments({ lawFirmId: req.user.lawFirmId, category: 'Case' }),
      hearingNote: await Note.countDocuments({ lawFirmId: req.user.lawFirmId, category: 'Hearing' }),
      conference: await Note.countDocuments({ lawFirmId: req.user.lawFirmId, category: 'Meeting' }),
      research: await Note.countDocuments({ lawFirmId: req.user.lawFirmId, category: 'Research' }),
      pinned: await Note.countDocuments({ lawFirmId: req.user.lawFirmId, pinned: true }),
    };

    res.status(200).json({
      success: true,
      data: notes,
      pinnedNotes,
      counts,
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

exports.getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    })
      .populate('caseId')
      .populate('clientId')
      .populate('createdBy', 'name email designation');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found or unauthorized.' });
    }

    res.status(200).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
};

exports.createNote = async (req, res, next) => {
  try {
    const { title, content, category, caseId, clientId, pinned, citation, court, judge } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Note title and content are required.' });
    }

    const note = await Note.create({
      lawFirmId: req.user.lawFirmId,
      title,
      content,
      category: category || 'General',
      caseId: caseId || null,
      clientId: clientId || null,
      pinned: Boolean(pinned),
      citation: citation || '',
      court: court || '',
      judge: judge || '',
      createdBy: req.user._id,
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'NOTE_CREATED',
      entityType: 'Note',
      entityId: note._id,
      description: `Created legal note: ${note.title} (${note.category})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Legal note saved.', data: note });
  } catch (err) {
    next(err);
  }
};

exports.updateNote = async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const fields = ['title', 'content', 'category', 'caseId', 'clientId', 'pinned', 'citation', 'court', 'judge'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) note[f] = req.body[f];
    });

    await note.save();

    res.status(200).json({ success: true, message: 'Note updated.', data: note });
  } catch (err) {
    next(err);
  }
};

exports.togglePin = async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    note.pinned = !note.pinned;
    await note.save();

    res.status(200).json({
      success: true,
      message: note.pinned ? 'Note pinned to Priority Briefs.' : 'Note unpinned.',
      data: note,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    res.status(200).json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    next(err);
  }
};
