const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Chamber Task',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    category: {
      type: String,
      enum: ['Drafting', 'Filings', 'Research', 'Briefing', 'Admin', 'Other'],
      default: 'Drafting',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    dueDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Completed', 'Overdue'],
      default: 'To Do',
      index: true,
    },
    completedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ lawFirmId: 1, dueDate: 1 });
taskSchema.index({ lawFirmId: 1, status: 1 });
taskSchema.index({ lawFirmId: 1, assignedTo: 1 });

module.exports = mongoose.model('Task', taskSchema);
