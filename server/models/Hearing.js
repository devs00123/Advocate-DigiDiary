const mongoose = require('mongoose');

const hearingSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
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
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    time: {
      type: String,
      default: '10:00 AM',
      trim: true,
    },
    itemNumber: {
      type: String,
      default: '',
      trim: true,
    },
    court: {
      type: String,
      default: 'District Court',
      trim: true,
    },
    courtroom: {
      type: String,
      default: '',
      trim: true,
    },
    judge: {
      type: String,
      default: '',
      trim: true,
    },
    purpose: {
      type: String,
      trim: true,
      default: 'Regular Hearing',
    },
    benchNotes: {
      type: String,
      trim: true,
      default: '',
    },
    outcome: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Scheduled', 'InProgress', 'Completed', 'Adjourned', 'Cancelled'],
      default: 'Scheduled',
      index: true,
    },
    nextDate: {
      type: Date,
    },
    nextStage: {
      type: String,
      trim: true,
      default: '',
    },
    passover: {
      type: Boolean,
      default: false,
    },
    assignedAdvocate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

hearingSchema.index({ lawFirmId: 1, date: 1 });
hearingSchema.index({ lawFirmId: 1, status: 1 });
hearingSchema.index({ lawFirmId: 1, court: 1 });
hearingSchema.index({ lawFirmId: 1, caseId: 1, date: -1 });

module.exports = mongoose.model('Hearing', hearingSchema);
