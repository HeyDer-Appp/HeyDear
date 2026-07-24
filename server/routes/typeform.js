const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { importTypeformResponses } = require('../services/typeform');

router.post('/import', adminAuth, async (req, res) => {
  try {
    const count = await importTypeformResponses();
    res.json({ success: true, imported: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
});

module.exports = router;
