const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
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
    category: {
      type: String,
      enum: ['Court Fees', 'Court Fee', 'Filing', 'Travel', 'Printing', 'Clerical', 'Clerkage', 'Stationery', 'Office', 'Research', 'Other'],
      default: 'Court Fees',
      index: true,
    },
    description: {
      type: String,
      default: 'Chamber Expense',
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Amount cannot be negative'],
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'NetBanking', 'Card', 'Cheque'],
      default: 'Cash',
    },
    billNumber: {
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

expenseSchema.index({ lawFirmId: 1, expenseDate: -1 });
expenseSchema.index({ lawFirmId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
