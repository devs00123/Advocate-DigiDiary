const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userName: {
      type: String,
      default: 'System',
      trim: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['Case', 'Client', 'Hearing', 'Task', 'Note', 'Payment', 'Expense', 'Reminder', 'User', 'Auth', 'Settings', 'System'],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ lawFirmId: 1, createdAt: -1 });
auditLogSchema.index({ lawFirmId: 1, action: 1 });
auditLogSchema.index({ lawFirmId: 1, entityType: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
