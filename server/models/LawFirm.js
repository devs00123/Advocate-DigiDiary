const mongoose = require('mongoose');

const lawFirmSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Law firm name is required'],
      trim: true,
      maxlength: 120,
    },
    tagline: {
      type: String,
      default: 'Chamber Practice & Legal Services',
      trim: true,
    },
    chamberNumber: {
      type: String,
      default: 'Chamber 402',
      trim: true,
    },
    address: {
      type: String,
      default: 'Saket District Courts Complex, New Delhi 110017',
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '+91 11 2656 4400',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    barCouncilRegistration: {
      type: String,
      default: 'D/1429/2011',
      trim: true,
    },
    primaryCourts: [
      {
        type: String,
        trim: true,
      },
    ],
    settings: {
      currency: {
        type: String,
        default: 'INR',
      },
      currencySymbol: {
        type: String,
        default: '₹',
      },
      dateFormat: {
        type: String,
        default: 'DD/MM/YYYY',
      },
      timeZone: {
        type: String,
        default: 'Asia/Kolkata',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LawFirm', lawFirmSchema);
