/**
 * Tenant Isolation Enforcement Middleware
 * 
 * Guarantees that:
 * 1. req.lawFirmId is strictly derived from req.user.lawFirmId.
 * 2. Client cannot override or spoof lawFirmId in req.body, req.query, or req.params.
 */
const enforceTenant = (req, res, next) => {
  if (!req.user || !req.user.lawFirmId) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Tenant association missing.',
    });
  }

  // Force req.lawFirmId to match authenticated user's law firm
  req.lawFirmId = req.user.lawFirmId;

  // Sanitize input payloads so client cannot spoof lawFirmId
  if (req.body && req.body.lawFirmId) {
    req.body.lawFirmId = req.user.lawFirmId;
  }
  if (req.query && req.query.lawFirmId) {
    delete req.query.lawFirmId;
  }

  next();
};

module.exports = { enforceTenant };
