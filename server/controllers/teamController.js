const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

exports.listTeamMembers = async (req, res, next) => {
  try {
    const users = await User.find({ lawFirmId: req.user.lawFirmId }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

exports.addTeamMember = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, designation, enrollmentNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and initial password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newMember = await User.create({
      lawFirmId: req.user.lawFirmId,
      name,
      email: email.toLowerCase(),
      passwordHash,
      phone: phone || '',
      role: role || 'advocate',
      designation: designation || 'Associate Advocate',
      enrollmentNumber: enrollmentNumber || '',
      emailVerified: true,
      isActive: true,
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'TEAM_MEMBER_ADDED',
      entityType: 'User',
      entityId: newMember._id,
      description: `Added team member ${newMember.name} as ${newMember.role} (${newMember.designation})`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Team member added successfully.',
      data: newMember,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { role, designation } = req.body;

    // Prevent changing your own role away from admin if you're the sole admin
    if (req.user._id.toString() === req.params.id && role !== 'admin') {
      const adminCount = await User.countDocuments({ lawFirmId: req.user.lawFirmId, role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the last active admin of the firm.' });
      }
    }

    const member = await User.findOne({ _id: req.params.id, lawFirmId: req.user.lawFirmId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    if (role) member.role = role;
    if (designation) member.designation = designation;
    await member.save();

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'TEAM_MEMBER_UPDATED',
      entityType: 'User',
      entityId: member._id,
      description: `Updated permissions for ${member.name}: role=${member.role}`,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Member role updated.', data: member });
  } catch (err) {
    next(err);
  }
};

exports.toggleMemberStatus = async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const member = await User.findOne({ _id: req.params.id, lawFirmId: req.user.lawFirmId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    member.isActive = !member.isActive;
    await member.save();

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: member.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: member._id,
      description: `${member.isActive ? 'Activated' : 'Deactivated'} account for ${member.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Account ${member.isActive ? 'activated' : 'deactivated'}.`,
      data: member,
    });
  } catch (err) {
    next(err);
  }
};
