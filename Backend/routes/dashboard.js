// routes/dashboard.js
const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getTrainerDashboard
} = require('../services/Dashboard');  

router.get('/',  async (req, res) => {
  try {
    const { _id, type } = req.user;

    if (type === 'ADMIN') {
      const data = await getAdminDashboard();
      return res.json({ userType: 'ADMIN', ...data });
    }

    if (type === 'TRAINER') {
      const data = await getTrainerDashboard(_id);
      return res.json({ userType: 'TRAINER', ...data });
    }

    return res.status(403).json({ message: 'Unauthorized' });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
