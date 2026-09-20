const User = require('../models/User');
const LawFirm = require('../models/LawFirm');
const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Note = require('../models/Note');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const { logAudit } = require('../utils/auditLogger');
const { generateCSV } = require('../services/reportService');

/**
 * Super Admin & Platform Telemetry Controller
 */

// GET /api/admin/telemetry
exports.getTelemetry = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      newThisMonth,
      verifiedUsers,
      lawFirmCount,
      caseCount,
      hearingCount,
      paymentStats,
      auditCount,
      activeUsersToday,
      activeMonthlyUsers,
      noteCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ $or: [{ emailVerified: true }, { enrollmentNumber: { $ne: '' } }] }),
      LawFirm.countDocuments(),
      Case.countDocuments(),
      Hearing.countDocuments(),
      Payment.aggregate([
        { $match: { status: { $in: ['Realized', 'Received'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      AuditLog.countDocuments(),
      User.countDocuments({
        $or: [
          { lastLogin: { $gte: oneDayAgo } },
          { updatedAt: { $gte: oneDayAgo } },
        ],
      }),
      User.countDocuments({
        lastLogin: { $gte: thirtyDaysAgo },
      }),
      Note.countDocuments(),
    ]);

    const totalRevenue = paymentStats.length > 0 ? paymentStats[0].total : 0;

    // Calculate real module traffic from AuditLog or collection ratios
    const totalModuleDocs = hearingCount + caseCount + paymentStats.length + noteCount;
    let moduleTraffic = { hearings: 25, cases: 25, finance: 25, notes: 25 };
    if (totalModuleDocs > 0) {
      moduleTraffic = {
        hearings: Math.round((hearingCount / totalModuleDocs) * 100),
        cases: Math.round((caseCount / totalModuleDocs) * 100),
        finance: Math.round(((paymentStats.length || 1) / totalModuleDocs) * 100),
        notes: Math.round((noteCount / totalModuleDocs) * 100),
      };
    }

    // Real data footprint based on total collection documents
    const totalDocs = userCount + caseCount + hearingCount + auditCount + noteCount;
    const footprintKB = totalDocs * 2.2;
    const footprintStr = footprintKB >= 1024 * 1024
      ? (footprintKB / (1024 * 1024)).toFixed(2) + ' GB'
      : (footprintKB / 1024).toFixed(1) + ' MB';

    const verifiedPercent = userCount > 0 ? ((verifiedUsers / userCount) * 100).toFixed(1) : '100.0';
    const retentionRate = userCount > 0 ? Math.min(100, Math.max(0, ((activeMonthlyUsers / userCount) * 100))).toFixed(1) : '100.0';

    res.status(200).json({
      success: true,
      data: {
        advocateRoster: {
          total: userCount,
          newThisMonth,
          verifiedPercentage: verifiedPercent,
        },
        totalPlatformViews: auditCount,
        activeConcurrent: activeUsersToday,
        stickyRetention: retentionRate,
        dataFootprintGB: footprintStr,
        totalCases: caseCount,
        totalHearings: hearingCount,
        totalRevenue,
        totalFirms: lawFirmCount,
        moduleTraffic,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/advocates
exports.listAdvocates = async (req, res, next) => {
  try {
    const { search, status, jurisdiction, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (status && status !== 'all' && status !== 'Status: All Accounts') {
      if (status === 'Active Now' || status === 'Active Today') {
        query.status = 'active';
      } else if (status.includes('Inactive')) {
        query.status = 'inactive';
      } else if (status.includes('Pending')) {
        query.status = 'pending';
      } else {
        query.status = status.toLowerCase();
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { enrollmentNumber: searchRegex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .populate('lawFirmId', 'name address barCouncilRegistration primaryCourts')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    // Enhance each user with their actual real case count and audit activity
    const advocates = await Promise.all(
      users.map(async (u) => {
        const [caseCount, todayHearings, auditCount] = await Promise.all([
          Case.countDocuments({ lawFirmId: u.lawFirmId?._id }),
          Hearing.countDocuments({
            lawFirmId: u.lawFirmId?._id,
            date: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          }),
          AuditLog.countDocuments({ userId: u._id }),
        ]);

        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          designation: u.designation,
          enrollmentNumber: u.enrollmentNumber || 'Pending Verification',
          status: u.status || 'active',
          lastLogin: u.lastLogin,
          firm: u.lawFirmId
            ? {
                _id: u.lawFirmId._id,
                name: u.lawFirmId.name,
                address: u.lawFirmId.address,
                barCouncilRegistration: u.lawFirmId.barCouncilRegistration,
              }
            : {
                name: 'Independent Chamber',
                address: 'High Court of Delhi',
                barCouncilRegistration: 'D/ROOT/2026',
              },
          caseCount: caseCount || 0,
          todayHearings: todayHearings || 0,
          views: auditCount || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: advocates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/live-feed
exports.getLiveFeed = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate('userId', 'name email')
      .populate('lawFirmId', 'name')
      .sort({ createdAt: -1 })
      .limit(15);

    const formattedFeed = logs.map((log) => {
      let icon = 'history';
      let tagColor = 'bg-primary-container text-surface-container-lowest';

      if (log.action.includes('PAYMENT')) {
        icon = 'receipt_long';
        tagColor = 'bg-secondary-container text-on-secondary-container';
      } else if (log.action.includes('HEARING')) {
        icon = 'event_note';
        tagColor = 'bg-primary-container text-surface-container-lowest';
      } else if (log.action.includes('USER') || log.action.includes('REGISTER')) {
        icon = 'person_check';
        tagColor = 'bg-surface-container-high text-on-surface';
      } else if (log.action.includes('FAILED') || log.action.includes('ERROR')) {
        icon = 'gpp_bad';
        tagColor = 'bg-error text-on-error';
      }

      return {
        _id: log._id,
        action: log.action,
        description: log.description,
        userName: log.userName || (log.userId ? log.userId.name : 'System Monitor'),
        firmName: log.lawFirmId ? log.lawFirmId.name : 'Advocate DigiDiary Network',
        timestamp: log.createdAt,
        icon,
        tagColor,
        ipAddress: log.ipAddress || '127.0.0.1',
      };
    });

    res.status(200).json({
      success: true,
      data: formattedFeed,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/health-report
exports.getHealthReport = async (req, res, next) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'Disconnected',
      1: 'Connected & Optimal',
      2: 'Connecting',
      3: 'Disconnecting',
    };

    const [cases, clients, hearings, notes, payments, tasks, users, logs] = await Promise.all([
      Case.countDocuments(),
      require('../models/Client').countDocuments(),
      Hearing.countDocuments(),
      Note.countDocuments(),
      Payment.countDocuments(),
      Task.countDocuments(),
      User.countDocuments(),
      AuditLog.countDocuments(),
    ]);

    const memoryUsage = process.memoryUsage();

    res.status(200).json({
      success: true,
      data: {
        status: dbState === 1 ? 'Healthy' : 'Degraded',
        database: {
          engine: 'MongoDB Atlas',
          status: states[dbState] || 'Unknown',
          readyState: dbState,
          host: mongoose.connection.host || 'cluster.mongodb.net',
        },
        cluster: {
          region: 'ap-south-1 (Mumbai)',
          encryption: 'TLS 1.3 Strict-Transport',
          protocol: 'Node.js Express Secure Gateway',
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
        },
        memory: {
          rssMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
          heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
          heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        },
        documentCounts: {
          cases,
          clients,
          hearings,
          notes,
          payments,
          tasks,
          users,
          auditLogs: logs,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/purge-stale
exports.purgeStale = async (req, res, next) => {
  try {
    // Purge audit logs older than 90 days if any, or temporary reminders
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await AuditLog.deleteMany({
      createdAt: { $lt: cutoff },
      action: { $in: ['TEMP_LOG', 'SESSION_PING'] },
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'ADMIN_PURGE_STALE',
      entityType: 'System',
      entityId: req.user._id,
      description: `Root Admin purged ${result.deletedCount || 0} stale system records.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `System cache optimized. ${result.deletedCount || 0} stale records purged.`,
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/invite
exports.inviteAdvocate = async (req, res, next) => {
  try {
    const { name, email, role = 'advocate', firmName, enrollmentNumber } = req.body;

    const finalName = (name && String(name).trim()) ? String(name).trim() : 'Advocate';
    const finalEmail = (email && String(email).trim()) ? String(email).trim().toLowerCase() : `advocate_${Date.now().toString().slice(-6)}@chamber.law`;

    const existing = await User.findOne({ email: finalEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email address is already registered.' });
    }

    // Find or create law firm
    let targetFirm = await LawFirm.findOne({ name: firmName || 'Independent Chamber' });
    if (!targetFirm) {
      targetFirm = await LawFirm.create({
        name: firmName || `${name} Chambers`,
        email: email.toLowerCase().trim(),
        barCouncilRegistration: enrollmentNumber || 'D/2026/001',
      });
    }

    const bcrypt = require('bcryptjs');
    const defaultPassword = 'ChamberHead@2026';
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    const newUser = await User.create({
      lawFirmId: targetFirm._id,
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role.toLowerCase(),
      enrollmentNumber: enrollmentNumber || '',
      emailVerified: true,
      status: 'active',
    });

    await logAudit({
      lawFirmId: targetFirm._id,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'ADMIN_USER_INVITED',
      entityType: 'User',
      entityId: newUser._id,
      description: `Super Admin onboarded Chamber Head: ${name} (${email}) for ${targetFirm.name}.`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Chamber Head ${name} invited and provisioned successfully.`,
      data: {
        userId: newUser._id,
        email: newUser.email,
        temporaryPassword: defaultPassword,
        firm: targetFirm.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/export-audit
exports.exportAuditCSV = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate('userId', 'name email')
      .populate('lawFirmId', 'name')
      .sort({ createdAt: -1 })
      .limit(1000);

    const fields = [
      { label: 'Timestamp', value: (l) => new Date(l.createdAt).toISOString() },
      { label: 'User Name', value: (l) => l.userName || (l.userId ? l.userId.name : 'System') },
      { label: 'User Email', value: (l) => l.userEmail || (l.userId ? l.userId.email : 'system@advocate.law') },
      { label: 'Law Firm / Chamber', value: (l) => (l.lawFirmId ? l.lawFirmId.name : 'DigiDiary') },
      { label: 'Action', value: 'action' },
      { label: 'Entity Type', value: 'entityType' },
      { label: 'Description', value: 'description' },
      { label: 'IP Address', value: 'ipAddress' },
    ];

    const csv = generateCSV(logs, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="SuperAdmin_Audit_Trail.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
