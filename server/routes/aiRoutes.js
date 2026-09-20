const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');
const { chatWithAI, summarizeDocument } = require('../controllers/aiController');

// Multer memory storage for direct processing
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload a PDF document or image (JPG, PNG, WEBP).'));
    }
  },
});

// Protect all AI endpoints with authentication
router.use(protect, enforceTenant);

// POST /api/ai/chat
router.post('/chat', chatWithAI);

// POST /api/ai/summarize
router.post('/summarize', upload.single('document'), summarizeDocument);

module.exports = router;
