const Reminder = require('../models/Reminder');
const { logAudit } = require('../utils/auditLogger');

exports.listReminders = async (req, res, next) => {
  try {
    const { completed } = req.query;
    const query = { lawFirmId: req.user.lawFirmId };

    if (completed !== undefined && completed !== 'all') {
      query.completed = completed === 'true';
    }

    const reminders = await Reminder.find(query)
      .populate('relatedCase', 'title caseNumber court')
      .populate('relatedClient', 'name phone')
      .sort({ reminderDate: 1 });

    res.status(200).json({ success: true, data: reminders });
  } catch (err) {
    next(err);
  }
};

exports.createReminder = async (req, res, next) => {
  try {
    const { title, type, relatedCase, relatedClient, reminderDate, reminderTime, priority } = req.body;

    if (!title || !reminderDate) {
      return res.status(400).json({ success: false, message: 'Title and Reminder Date are required.' });
    }

    const reminder = await Reminder.create({
      lawFirmId: req.user.lawFirmId,
      title,
      type: type || 'Hearing',
      relatedCase: relatedCase || null,
      relatedClient: relatedClient || null,
      reminderDate: new Date(reminderDate),
      reminderTime: reminderTime || '09:00 AM',
      priority: priority || 'Medium',
      completed: false,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Reminder set.', data: reminder });
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

    reminder.completed = !reminder.completed;
    await reminder.save();

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
