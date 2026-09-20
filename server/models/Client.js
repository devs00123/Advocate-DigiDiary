const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    lawFirmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LawFirm',
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: () => 'Client ' + Date.now().toString().slice(-4),
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    clientType: {
      type: String,
      enum: ['Individual', 'Corporate', 'Government', 'Firm'],
      default: 'Individual',
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Archived'],
      default: 'Active',
      index: true,
    },
    notes: {
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

clientSchema.index({ lawFirmId: 1, name: 1 });
clientSchema.index({ lawFirmId: 1, email: 1 });
clientSchema.index({ lawFirmId: 1, phone: 1 });
clientSchema.index({ lawFirmId: 1, createdAt: -1 });

module.exports = mongoose.model('Client', clientSchema);
