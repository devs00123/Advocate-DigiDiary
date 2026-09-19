const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['General', 'Case', 'Client', 'Hearing', 'Meeting', 'Research'],
      default: 'General',
      index: true,
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
    pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    citation: {
      type: String,
      trim: true,
      default: '',
    },
    court: {
      type: String,
      trim: true,
      default: '',
    },
    judge: {
      type: String,
      trim: true,
      default: '',
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

noteSchema.index({ lawFirmId: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ lawFirmId: 1, category: 1 });
noteSchema.index({ lawFirmId: 1, title: 'text', content: 'text' });

module.exports = mongoose.model('Note', noteSchema);
