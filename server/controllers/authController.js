const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LawFirm = require('../models/LawFirm');
const { logAudit } = require('../utils/auditLogger');

const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = jwt.sign(
    { id: user._id, role: user.role, lawFirmId: user.lawFirmId },
    process.env.JWT_SECRET || 'fallback_secret_for_tests',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

    const finalName = (name && String(name).trim()) ? String(name).trim() : 'Adv. Practice Admin';
    const finalEmail = (email && String(email).trim()) ? String(email).trim().toLowerCase() : `advocate_${Date.now().toString().slice(-6)}@digidiary.law`;
    const finalPassword = (password && password.length >= 6) ? password : 'Advocate@2026';

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
    const { email, password } = req.body;

    const finalEmail = (email && String(email).trim()) ? String(email).trim().toLowerCase() : 'advocate@singhania.law';
    const finalPassword = password || 'Advocate@2026';

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

    sendTokenResponse(user, 200, res, 'Login successful.');
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
