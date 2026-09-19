const AuditLog = require('../models/AuditLog');

/**
 * Log a user action in the audit trail.
 * Strictly avoids recording passwords, tokens, or sensitive secret payloads.
 */
const logAudit = async ({
  lawFirmId,
  userId,
  userName = 'System',
  userEmail = '',
  action,
  entityType,
  entityId = null,
  description,
  metadata = {},
  ipAddress = '',
}) => {
  try {
    // Sanitize metadata to never store passwords/tokens
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.passwordHash;
    delete safeMetadata.token;
    delete safeMetadata.refreshToken;
    delete safeMetadata.resetPasswordToken;

    await AuditLog.create({
      lawFirmId,
      userId,
      userName,
      userEmail,
      action,
      entityType,
      entityId,
      description,
      metadata: safeMetadata,
      ipAddress,
    });
  } catch (err) {
    console.error('[AUDIT LOG ERROR] Failed to record audit entry:', err.message);
  }
};

module.exports = { logAudit };
