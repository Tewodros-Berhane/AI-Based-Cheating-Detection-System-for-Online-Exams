const multer  = require('multer');
const express = require('express');
const router  = express.Router();

// ── Multer storage config ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ── File‐upload endpoint ─────────────────────────────────────────────────────
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }
  res.json({
    success: true,
    message: 'File uploaded successfully',
    // this is the relative path your client can use to fetch it
    link: `uploads/${req.file.filename}`
  });
});

module.exports = { upload, router };
