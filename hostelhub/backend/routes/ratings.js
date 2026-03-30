const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const { protect, requireVerified } = require('../middleware/auth');

// ── SUBMIT / UPDATE RATING (only verified students) ──────────────────
router.post('/', protect, requireVerified, async (req, res) => {
  try {
    const { food, clean, water, drink, medical, maint } = req.body;
    const month = new Date().toISOString().slice(0, 7); // "2024-03"

    const fields = { food, clean, water, drink, medical, maint };
    const provided = Object.values(fields).filter(v => v !== undefined && v !== null);
    if (provided.length < 3) {
      return res.status(400).json({ success: false, message: 'Kam se kam 3 categories rate karo!' });
    }
    // Validate range
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== null && (val < 1 || val > 5)) {
        return res.status(400).json({ success: false, message: `${key} rating 1-5 ke beech honi chahiye!` });
      }
    }

    const overall = parseFloat((provided.reduce((a, b) => a + b, 0) / provided.length).toFixed(1));

    const existing = await Rating.findOne({ user: req.user._id, month });
    let rating;
    if (existing) {
      existing.ratings = fields;
      existing.overall = overall;
      existing.updatedAt = new Date();
      rating = await existing.save();
    } else {
      rating = await Rating.create({ user: req.user._id, month, ratings: fields, overall });
    }

    res.json({ success: true, message: 'Rating submit ho gayi!', rating });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET THIS MONTH'S PUBLIC AVERAGE ──────────────────────────────────
router.get('/average', protect, async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const ratings = await Rating.find({ month });
    if (!ratings.length) return res.json({ success: true, average: null, count: 0 });

    const fields = ['food', 'clean', 'water', 'drink', 'medical', 'maint'];
    const result = {};
    fields.forEach(f => {
      const vals = ratings.map(r => r.ratings[f]).filter(Boolean);
      result[f] = vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    });
    const allVals = Object.values(result).filter(Boolean);
    result.overall = allVals.length ? parseFloat((allVals.reduce((a,b)=>a+b,0)/allVals.length).toFixed(1)) : null;

    res.json({ success: true, average: result, count: ratings.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET MY RATING THIS MONTH ─────────────────────────────────────────
router.get('/mine', protect, async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const rating = await Rating.findOne({ user: req.user._id, month });
    res.json({ success: true, rating });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
