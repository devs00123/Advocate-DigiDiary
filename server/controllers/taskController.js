const mongoose = require('mongoose');
const Task = require('../models/Task');
const { logAudit } = require('../utils/auditLogger');

exports.listTasks = async (req, res, next) => {
  try {
    const { status, priority, category, search, page = 1, limit = 20 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (status && status !== 'All' && status !== '') {
      const s = String(status).toLowerCase();
      if (s === 'pending' || s === 'to do' || s === 'todo' || s === 'in progress') {
        query.status = { $ne: 'Completed' };
      } else if (s === 'completed' || s === 'done') {
        query.status = 'Completed';
      } else {
        query.status = new RegExp(`^${status}$`, 'i');
      }
    }
    if (priority && priority !== 'All' && priority !== '') {
      query.priority = new RegExp(`^${priority}$`, 'i');
    }
    if (category && category !== 'All' && category !== '') {
      query.category = new RegExp(`^${category}$`, 'i');
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [{ title: new RegExp(s, 'i') }, { description: new RegExp(s, 'i') }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('caseId', 'title caseNumber court')
        .populate('clientId', 'name phone')
        .populate('assignedTo', 'name email designation')
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(limitNum),
      Task.countDocuments(query),
    ]);

    const counts = {
      all: total,
      urgent: await Task.countDocuments({ lawFirmId: req.user.lawFirmId, priority: 'Urgent', status: { $ne: 'Completed' } }),
      drafting: await Task.countDocuments({ lawFirmId: req.user.lawFirmId, category: 'Drafting', status: { $ne: 'Completed' } }),
      filings: await Task.countDocuments({ lawFirmId: req.user.lawFirmId, category: 'Filings', status: { $ne: 'Completed' } }),
      completed: await Task.countDocuments({ lawFirmId: req.user.lawFirmId, status: 'Completed' }),
    };

    res.status(200).json({
      success: true,
      data: tasks,
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

exports.createTask = async (req, res, next) => {
  try {
    const { title, description, caseId, clientId, category, assignedTo, dueDate, priority } = req.body;

    const finalTitle = (title && String(title).trim()) ? String(title).trim() : 'Chamber Task';
    const finalDueDate = dueDate ? new Date(dueDate) : new Date();

    const normalizePriority = (p) => {
      if (!p) return 'Medium';
      const lower = String(p).toLowerCase();
      if (lower === 'urgent') return 'Urgent';
      if (lower === 'high') return 'High';
      if (lower === 'low') return 'Low';
      return 'Medium';
    };

    const normalizeStatus = (s) => {
      if (!s) return 'To Do';
      const lower = String(s).toLowerCase();
      if (lower === 'completed' || lower === 'done') return 'Completed';
      if (lower === 'in progress') return 'In Progress';
      if (lower === 'overdue') return 'Overdue';
      return 'To Do';
    };

    const task = await Task.create({
      lawFirmId: req.user.lawFirmId,
      title: finalTitle,
      description: description || '',
      caseId: (caseId && mongoose.Types.ObjectId.isValid(caseId)) ? caseId : null,
      clientId: (clientId && mongoose.Types.ObjectId.isValid(clientId)) ? clientId : null,
      category: category || 'Drafting',
      assignedTo: (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) ? assignedTo : req.user._id,
      dueDate: finalDueDate,
      priority: normalizePriority(priority),
      status: normalizeStatus(req.body.status),
      createdBy: req.user._id,
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'TASK_CREATED',
      entityType: 'Task',
      entityId: task._id,
      description: `Created task: ${task.title} (Due: ${new Date(dueDate).toLocaleDateString()})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Task created.', data: task });
  } catch (err) {
    next(err);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found or unauthorized.' });
    }

    if (req.body.priority) req.body.priority = ['Urgent', 'High', 'Medium', 'Low'].find(x => x.toLowerCase() === String(req.body.priority).toLowerCase()) || req.body.priority;
    if (req.body.status) {
      const s = String(req.body.status).toLowerCase();
      if (s === 'completed' || s === 'done') req.body.status = 'Completed';
      else if (s === 'to do' || s === 'pending') req.body.status = 'To Do';
      else if (s === 'in progress') req.body.status = 'In Progress';
    }

    const fields = ['title', 'description', 'caseId', 'clientId', 'category', 'assignedTo', 'dueDate', 'priority', 'status'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) task[f] = req.body[f];
    });

    if (task.status === 'Completed' && !task.completedAt) {
      task.completedAt = new Date();
    } else if (task.status !== 'Completed') {
      task.completedAt = null;
    }

    await task.save();

    res.status(200).json({ success: true, message: 'Task updated.', data: task });
  } catch (err) {
    next(err);
  }
};

exports.toggleComplete = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    task.status = task.status === 'Completed' ? 'To Do' : 'Completed';
    task.completedAt = task.status === 'Completed' ? new Date() : null;
    await task.save();

    res.status(200).json({ success: true, message: `Task marked as ${task.status}.`, data: task });
  } catch (err) {
    next(err);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    res.status(200).json({ success: true, message: 'Task deleted.' });
  } catch (err) {
    next(err);
  }
};
