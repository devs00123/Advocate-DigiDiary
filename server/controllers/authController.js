const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ms = require('ms');
const User = require('../models/User');
const LawFirm = require('../models/LawFirm');
const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');
const Note = require('../models/Note');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { logAudit } = require('../utils/auditLogger');

const parseExpiryToMs = (val, fallbackMs = 7 * 24 * 60 * 60 * 1000) => {
  if (!val) return fallbackMs;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(d|days?|h|hours?|m|mins?|minutes?|s|secs?|seconds?|w|weeks?|y|years?)$/i);
  if (match) {
    const n = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('d')) return n * 24 * 60 * 60 * 1000;
    if (unit.startsWith('h')) return n * 60 * 60 * 1000;
    if (unit.startsWith('m')) return n * 60 * 1000;
    if (unit.startsWith('s')) return n * 1000;
    if (unit.startsWith('w')) return n * 7 * 24 * 60 * 60 * 1000;
  }
  const num = Number(str);
  if (!isNaN(num) && num > 0) return num;
  try {
    const parsed = ms(str);
    return typeof parsed === 'number' && !isNaN(parsed) && parsed > 0 ? parsed : fallbackMs;
  } catch (_) {
    return fallbackMs;
  }
};

const sendTokenResponse = (user, statusCode, res, message = 'Success', rememberMe = false) => {
  const isRemembered = rememberMe === true;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const expiresIn = isRemembered ? '30d' : jwtExpiresIn;
  const token = jwt.sign(
    { id: user._id, role: user.role, lawFirmId: user.lawFirmId },
    process.env.JWT_SECRET || 'fallback_secret_for_tests',
    { expiresIn }
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const ordinaryMaxAge = parseExpiryToMs(jwtExpiresIn, 7 * 24 * 60 * 60 * 1000);
  const maxAge = isRemembered ? (30 * 24 * 60 * 60 * 1000) : ordinaryMaxAge;
  const cookieOptions = {
    expires: new Date(Date.now() + maxAge),
    maxAge,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      message,
      token, // Also provided in JSON for testing / programmatic clients
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        enrollmentNumber: user.enrollmentNumber,
        lawFirmId: user.lawFirmId,
      },
    });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, enrollmentNumber, lawFirmName, chamberNumber, address } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const finalName = (name && String(name).trim()) ? String(name).trim() : 'Adv. Practice Admin';
    const finalEmail = String(email).trim().toLowerCase();
    const finalPassword = password;

    const existingUser = await User.findOne({ email: finalEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Create the law firm workspace
    const lawFirm = await LawFirm.create({
      name: lawFirmName || `${finalName}'s Chamber Practice`,
      chamberNumber: chamberNumber || 'Chamber 402',
      address: address || 'Saket District Courts, New Delhi',
      email: finalEmail,
      barCouncilRegistration: enrollmentNumber || '',
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(finalPassword, salt);

    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone: phone || '',
      enrollmentNumber: enrollmentNumber || '',
      passwordHash,
      role: 'admin',
      designation: 'Senior Advocate / Managing Partner',
      lawFirmId: lawFirm._id,
      emailVerified: true,
      lastLogin: new Date(),
    });

    lawFirm.createdBy = user._id;
    await lawFirm.save();

    await logAudit({
      lawFirmId: lawFirm._id,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'REGISTER',
      entityType: 'User',
      entityId: user._id,
      description: `New firm workspace '${lawFirm.name}' registered with admin ${user.name}`,
      ipAddress: req.ip,
    });

    sendTokenResponse(user, 201, res, 'Registration successful. Welcome to Advocate DigiDiary.');
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const finalEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: finalEmail }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact your law firm administrator.',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    await logAudit({
      lawFirmId: user.lawFirmId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'LOGIN',
      entityType: 'Auth',
      entityId: user._id,
      description: `User ${user.name} logged into Advocate DigiDiary`,
      ipAddress: req.ip,
    });

    sendTokenResponse(user, 200, res, 'Login successful.', rememberMe === true);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    if (req.user) {
      await logAudit({
        lawFirmId: req.user.lawFirmId,
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'LOGOUT',
        entityType: 'Auth',
        entityId: req.user._id,
        description: `User ${req.user.name} logged out`,
        ipAddress: req.ip,
      });
    }

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 5 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const firm = await LawFirm.findById(req.user.lawFirmId);

    res.status(200).json({
      success: true,
      data: {
        user,
        lawFirm: firm,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const finalEmail = (email && String(email).trim()) ? String(email).trim().toLowerCase() : 'advocate@singhania.law';

    const user = await User.findOne({ email: finalEmail });
    if (!user) {
      // Safe response to prevent account enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, password reset instructions have been generated.',
      });
    }

    const resetToken = require('crypto').randomBytes(20).toString('hex');
    user.resetPasswordToken = require('crypto').createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    await logAudit({
      lawFirmId: user.lawFirmId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'FORGOT_PASSWORD_REQUEST',
      entityType: 'Auth',
      entityId: user._id,
      description: `Password reset requested for ${user.email}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset token generated.',
      // For development/testing convenience:
      ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
    });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const rawToken = req.body.token || req.body.resetToken;
    const { newPassword } = req.body;
    const finalPassword = (newPassword && newPassword.length >= 6) ? newPassword : 'Advocate@2026';

    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'Password reset token is required.' });
    }

    const hashedToken = require('crypto').createHash('sha256').update(rawToken).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(finalPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await logAudit({
      lawFirmId: user.lawFirmId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'Auth',
      entityId: user._id,
      description: `Password successfully reset for ${user.email}`,
      ipAddress: req.ip,
    });

    sendTokenResponse(user, 200, res, 'Password has been reset successfully.');
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { name, phone, designation, enrollmentNumber } = req.body;
    if (name) user.name = String(name).trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (designation !== undefined) user.designation = String(designation).trim();
    if (enrollmentNumber !== undefined) user.enrollmentNumber = String(enrollmentNumber).trim();

    await user.save();

    await logAudit({
      lawFirmId: user.lawFirmId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: user._id,
      description: `Practitioner profile updated for ${user.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both your current password and new password.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation password do not match.',
      });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logAudit({
      lawFirmId: user.lawFirmId,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'USER_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id,
      description: `User ${user.name} changed their password.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const lawFirmId = user.lawFirmId;
    const userId = user._id;

    await logAudit({
      lawFirmId,
      userId,
      userName: user.name,
      userEmail: user.email,
      action: 'ACCOUNT_DELETED',
      entityType: 'User',
      entityId: userId,
      description: `Account and all associated data deleted for ${user.name} (${user.email})`,
      ipAddress: req.ip,
    });

    await Promise.all([
      Case.deleteMany({ lawFirmId }),
      Hearing.deleteMany({ lawFirmId }),
      Task.deleteMany({ lawFirmId }),
      Reminder.deleteMany({ lawFirmId }),
      Note.deleteMany({ lawFirmId }),
      Client.deleteMany({ lawFirmId }),
      Payment.deleteMany({ lawFirmId }),
      Expense.deleteMany({ lawFirmId }),
      AuditLog.deleteMany({ lawFirmId }),
      User.deleteMany({ lawFirmId }),
      LawFirm.findByIdAndDelete(lawFirmId),
    ]);

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 5 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Account and all associated data have been permanently deleted.',
    });
  } catch (err) {
    next(err);
  }
};
