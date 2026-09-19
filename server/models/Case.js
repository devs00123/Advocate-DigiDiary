const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    caseNumber: {
      type: String,
      required: [true, 'Case registration number is required'],
      trim: true,
    },
    cnrNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    title: {
      type: String,
      required: [true, 'Case title is required'],
      trim: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    clientRepresentation: {
      type: String,
      enum: ['Plaintiff', 'Defendant', 'Petitioner', 'Respondent', 'Appellant', 'Complainant', 'Accused', 'Other'],
      default: 'Plaintiff',
    },
    oppositeParty: {
      type: String,
      trim: true,
      default: '',
    },
    oppositeCounsel: {
      type: String,
      trim: true,
      default: '',
    },
    caseType: {
      type: String,
      required: true,
      trim: true,
      default: 'Civil Suit',
    },
    court: {
      type: String,
      required: [true, 'Court complex is required'],
      trim: true,
    },
    judge: {
      type: String,
      trim: true,
      default: '',
    },
    courtroom: {
      type: String,
      trim: true,
      default: '',
    },
    filingDate: {
      type: Date,
    },
    firstHearingDate: {
      type: Date,
    },
    nextHearingDate: {
      type: Date,
      index: true,
    },
    currentStage: {
      type: String,
      trim: true,
      default: 'Notice / Summons',
    },
    status: {
      type: String,
      enum: ['New', 'Active', 'Pending', 'Hearing', 'Reserved', 'Disposed', 'Closed'],
      default: 'Active',
      index: true,
    },
    priority: {
      type: String,
      enum: ['standard', 'high', 'urgent'],
      default: 'standard',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    agreedFee: {
      type: Number,
      default: 0,
      min: [0, 'Agreed fee cannot be negative'],
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

caseSchema.virtual('totalAgreedFee').get(function () {
  return this.agreedFee;
});
caseSchema.set('toJSON', { virtuals: true });
caseSchema.set('toObject', { virtuals: true });

caseSchema.index({ lawFirmId: 1, caseNumber: 1 });
caseSchema.index({ lawFirmId: 1, cnrNumber: 1 });
caseSchema.index({ lawFirmId: 1, status: 1 });
caseSchema.index({ lawFirmId: 1, court: 1 });
caseSchema.index({ lawFirmId: 1, nextHearingDate: 1 });
caseSchema.index({ lawFirmId: 1, priority: 1 });
caseSchema.index({ lawFirmId: 1, createdAt: -1 });

module.exports = mongoose.model('Case', caseSchema);
