const AuditLog = require('../models/AuditLog');

exports.listAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, search, page = 1, limit = 25 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (action && action !== 'All') query.action = action;
    if (entityType && entityType !== 'All') query.entityType = entityType;

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { description: new RegExp(s, 'i') },
        { userName: new RegExp(s, 'i') },
        { userEmail: new RegExp(s, 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
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
