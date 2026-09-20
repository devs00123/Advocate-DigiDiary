const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');

const LawFirm = require('../models/LawFirm');
const User = require('../models/User');
const Client = require('../models/Client');
const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Note = require('../models/Note');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Reminder = require('../models/Reminder');
const AuditLog = require('../models/AuditLog');

const cleanupDemoData = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('[CLEANUP] Connecting to database...');
      await connectDB();
    }

    console.log('[CLEANUP] Removing demo/chamber seed data...');

    // Find the demo law firm
    const demoFirm = await LawFirm.findOne({ name: 'Singhania & Partners LLP' });
    if (!demoFirm) {
      console.log('[CLEANUP] No demo firm found. Nothing to clean.');
      return;
    }

    const firmId = demoFirm._id;
    console.log(`[CLEANUP] Found demo firm: ${demoFirm.name} (${firmId})`);

    // Find demo user emails
    const demoEmails = [
      'rajesh@singhania.law',
      'ananya@singhania.law',
      'vikram@singhania.law',
      'ram@singhania.law',
    ];

    const demoUsers = await User.find({ email: { $in: demoEmails } });
    const demoUserIds = demoUsers.map(u => u._id);

    // Delete all data belonging to the demo firm
    const results = await Promise.all([
      AuditLog.deleteMany({ lawFirmId: firmId }),
      Reminder.deleteMany({ lawFirmId: firmId }),
      Expense.deleteMany({ lawFirmId: firmId }),
      Payment.deleteMany({ lawFirmId: firmId }),
      Note.deleteMany({ lawFirmId: firmId }),
      Task.deleteMany({ lawFirmId: firmId }),
      Hearing.deleteMany({ lawFirmId: firmId }),
      Case.deleteMany({ lawFirmId: firmId }),
      Client.deleteMany({ lawFirmId: firmId }),
      User.deleteMany({ lawFirmId: firmId }),
      LawFirm.findByIdAndDelete(firmId),
    ]);

    const labels = ['AuditLogs', 'Reminders', 'Expenses', 'Payments', 'Notes', 'Tasks', 'Hearings', 'Cases', 'Clients', 'Users', 'LawFirm'];
    labels.forEach((label, i) => {
      console.log(`[CLEANUP] Deleted ${results[i].deletedCount || 1} ${label}`);
    });

    console.log('\n=============================================================');
    console.log('  [CLEANUP SUCCESS] Demo chamber data removed successfully!');
    console.log('  Deleted firm: Singhania & Partners LLP');
    console.log('  Deleted users: rajesh, ananya, vikram, ram (@singhania.law)');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('[CLEANUP ERROR] Failed to clean demo data:', err);
    throw err;
  }
};

if (require.main === module) {
  cleanupDemoData()
    .then(() => disconnectDB().then(() => process.exit(0)))
    .catch(() => process.exit(1));
}

module.exports = cleanupDemoData;
