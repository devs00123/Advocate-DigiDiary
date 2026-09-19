const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = null;

  // 1. Check HTTP-only cookie first (Primary auth strategy)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Check Authorization Bearer header as secondary fallback
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_tests');
    const user = await User.findById(decoded.id).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact your law firm administrator.',
      });
    }

    req.user = user;
    // Derive tenant identity strictly from authenticated user record
    req.lawFirmId = user.lawFirmId;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid token. Please log in again.',
    });
  }
};

/**
 * Role-Based Access Control Middleware
 * @param  {...string} roles - Allowed roles e.g. 'admin', 'advocate'
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Your role (${req.user.role}) is not authorized to perform this operation.`,
      });
    }

    next();
  };
};

module.exports = { protect, requireRole };
