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
      default: () => 'MATTER-' + Date.now().toString().slice(-6),
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
      default: 'General Legal Matter',
      trim: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    clientRepresentation: {
      type: String,
      enum: ['Plaintiff', 'Defendant', 'Petitioner', 'Respondent', 'Appellant', 'Complainant', 'Accused', 'Opposite Party', 'Other'],
      default: 'Plaintiff',
      set: (val) => {
        if (!val) return 'Plaintiff';
        const trimmed = String(val).trim();
        if (/opposite/i.test(trimmed)) return 'Opposite Party';
        if (/petitioner/i.test(trimmed)) return 'Petitioner';
        if (/respondent/i.test(trimmed)) return 'Respondent';
        if (/plaintiff/i.test(trimmed)) return 'Plaintiff';
        if (/defendant/i.test(trimmed)) return 'Defendant';
        if (/appellant/i.test(trimmed)) return 'Appellant';
        if (/complainant/i.test(trimmed)) return 'Complainant';
        if (/accused/i.test(trimmed)) return 'Accused';
        return trimmed;
      },
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
      trim: true,
      default: 'Civil Suit',
    },
    court: {
      type: String,
      default: 'District Court',
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
    lastHearingDate: {
      type: Date,
    },
    currentHearingDate: {
      type: Date,
    },
    hearingTime: {
      type: String,
      trim: true,
      default: '10:00 AM',
    },
    currentStage: {
      type: String,
      trim: true,
      default: 'Notice / Summons',
    },
    status: {
      type: String,
      enum: ['New', 'Active', 'Pending', 'Hearing', 'Reserved', 'Disposed', 'Closed', 'Stayed'],
      default: 'Active',
      set: (val) => {
        if (!val) return 'Active';
        const str = String(val).trim().toLowerCase();
        if (str === 'active') return 'Active';
        if (str === 'pending') return 'Pending';
        if (str === 'stayed') return 'Stayed';
        if (str === 'hearing') return 'Hearing';
        if (str === 'reserved') return 'Reserved';
        if (str === 'disposed') return 'Disposed';
        if (str === 'closed') return 'Closed';
        if (str === 'new') return 'New';
        return val.charAt(0).toUpperCase() + val.slice(1);
      },
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
caseSchema.index({ lawFirmId: 1, currentHearingDate: 1 });
caseSchema.index({ lawFirmId: 1, priority: 1 });
caseSchema.index({ lawFirmId: 1, createdAt: -1 });

module.exports = mongoose.model('Case', caseSchema);
