const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middleware/auth');
const { getPricing, setPricing } = require('../../services/pricing');

router.get('/', adminAuth, async (req, res) => {
  try {
    res.json(await getPricing());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', adminAuth, async (req, res) => {
  try {
    const { oneTimeAmount, subscriptionAmount } = req.body;
    const oneTime = Number(oneTimeAmount);
    const subscription = Number(subscriptionAmount);
    if (!Number.isInteger(oneTime) || oneTime <= 0) {
      return res.status(400).json({ error: 'One-time price must be a whole number of cents greater than 0.' });
    }
    if (!Number.isInteger(subscription) || subscription <= 0) {
      return res.status(400).json({ error: 'Subscription price must be a whole number of cents greater than 0.' });
    }
    res.json(await setPricing({ oneTimeAmount: oneTime, subscriptionAmount: subscription }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
