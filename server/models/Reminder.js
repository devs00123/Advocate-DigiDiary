const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Reminder',
      trim: true,
    },
    type: {
      type: String,
      enum: ['Hearing', 'Task', 'Payment', 'Limitation', 'General'],
      default: 'Hearing',
      index: true,
    },
    relatedCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      index: true,
    },
    relatedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    reminderDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reminderTime: {
      type: String,
      default: '09:00 AM',
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
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

reminderSchema.index({ lawFirmId: 1, reminderDate: 1, completed: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
