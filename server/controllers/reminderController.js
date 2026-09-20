const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const { logAudit } = require('../utils/auditLogger');

exports.listReminders = async (req, res, next) => {
  try {
    const { completed } = req.query;
    const query = { lawFirmId: req.user.lawFirmId };

    if (completed !== undefined && completed !== 'all' && completed !== '') {
      query.completed = completed === 'true' || completed === true;
    }

    const reminders = await Reminder.find(query)
      .populate('relatedCase', 'title caseNumber court')
      .populate('relatedClient', 'name phone')
      .sort({ reminderDate: 1, reminderTime: 1 });

    res.status(200).json({ success: true, count: reminders.length, data: reminders });
  } catch (err) {
    next(err);
  }
};

exports.createReminder = async (req, res, next) => {
  try {
    const {
      title,
      type,
      relatedCase,
      caseId,
      relatedClient,
      clientId,
      reminderDate,
      remindAt,
      reminderTime,
      priority,
    } = req.body;

    const finalTitle = (title && String(title).trim()) ? String(title).trim() : 'Reminder';
    const dateInput = reminderDate || remindAt || new Date();
    const finalDate = new Date(dateInput);

    const caseRef = relatedCase || caseId;
    const clientRef = relatedClient || clientId;

    const reminder = await Reminder.create({
      lawFirmId: req.user.lawFirmId,
      title: finalTitle,
      type: type || 'General',
      relatedCase: (caseRef && mongoose.Types.ObjectId.isValid(caseRef)) ? caseRef : null,
      relatedClient: (clientRef && mongoose.Types.ObjectId.isValid(clientRef)) ? clientRef : null,
      reminderDate: isNaN(finalDate.getTime()) ? new Date() : finalDate,
      reminderTime: reminderTime || '09:00 AM',
      priority: priority || 'Medium',
      completed: false,
      createdBy: req.user._id,
    });

    await reminder.populate('relatedCase', 'title caseNumber court');
    await reminder.populate('relatedClient', 'name phone');

    res.status(201).json({ success: true, message: 'Reminder set successfully.', data: reminder });
  } catch (err) {
    next(err);
  }
};

exports.updateReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    const {
      title,
      reminderDate,
      remindAt,
      reminderTime,
      priority,
      completed,
      isDismissed,
      type,
      relatedCase,
      caseId,
    } = req.body;

    if (title !== undefined) reminder.title = title;
    if (reminderDate !== undefined) reminder.reminderDate = new Date(reminderDate);
    else if (remindAt !== undefined) reminder.reminderDate = new Date(remindAt);
    if (reminderTime !== undefined) reminder.reminderTime = reminderTime;
    if (priority !== undefined) reminder.priority = priority;
    if (type !== undefined) reminder.type = type;
    if (completed !== undefined) reminder.completed = Boolean(completed);
    else if (isDismissed !== undefined) reminder.completed = Boolean(isDismissed);

    const caseRef = relatedCase || caseId;
    if (caseRef !== undefined) {
      reminder.relatedCase = (caseRef && mongoose.Types.ObjectId.isValid(caseRef)) ? caseRef : null;
    }

    await reminder.save();
    await reminder.populate('relatedCase', 'title caseNumber court');
    await reminder.populate('relatedClient', 'name phone');

    res.status(200).json({ success: true, message: 'Reminder updated successfully.', data: reminder });
  } catch (err) {
    next(err);
  }
};

exports.toggleComplete = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    if (req.body && req.body.completed !== undefined) {
      reminder.completed = Boolean(req.body.completed);
    } else if (req.body && req.body.isDismissed !== undefined) {
      reminder.completed = Boolean(req.body.isDismissed);
    } else {
      reminder.completed = !reminder.completed;
    }

    await reminder.save();
    await reminder.populate('relatedCase', 'title caseNumber court');
    await reminder.populate('relatedClient', 'name phone');

    res.status(200).json({ success: true, message: 'Reminder status updated.', data: reminder });
  } catch (err) {
    next(err);
  }
};

exports.deleteReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found.' });
    }

    res.status(200).json({ success: true, message: 'Reminder removed.' });
  } catch (err) {
    next(err);
  }
};
