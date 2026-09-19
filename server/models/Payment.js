const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'NetBanking', 'Demand Draft', 'Bank Transfer', 'Other'],
      default: 'NEFT',
    },
    transactionReference: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['Appearance Fees', 'Retainer Agreements', 'Lump-Sum Quotes', 'Drafting Charges', 'Miscellaneous'],
      default: 'Appearance Fees',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Realized', 'Pending', 'Bounced'],
      default: 'Realized',
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

paymentSchema.index({ lawFirmId: 1, paymentDate: -1 });
paymentSchema.index({ lawFirmId: 1, receiptNumber: 1 });
paymentSchema.index({ lawFirmId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
