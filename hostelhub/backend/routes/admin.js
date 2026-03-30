const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Rating = require('../models/Rating');
const { protect, requireAdmin } = require('../middleware/auth');

// All admin routes need auth + admin role
router.use(protect, requireAdmin);

// ── GET ALL STUDENTS (pending + verified) ────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── VERIFY A STUDENT ─────────────────────────────────────────────────
router.patch('/verify/:userId', async (req, res) => {
  try {
    const { note } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        isVerified: true,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        verificationNote: note || 'Admin ne verify kiya'
      },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'Student nahi mila!' });
    res.json({ success: true, message: `${user.name} verify ho gaya!`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── REJECT / UNVERIFY ─────────────────────────────────────────────────
router.patch('/unverify/:userId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isVerified: false, verifiedBy: null, verifiedAt: null },
      { new: true }
    ).select('-password');
    res.json({ success: true, message: `${user.name} unverified ho gaya.`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── MONTHLY CREDIT RESET (manual, auto is via cron) ──────────────────
router.post('/reset-credits', async (req, res) => {
  try {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyCredits = daysInMonth * 6;

    await User.updateMany(
      { role: 'student' },
      {
        credits: monthlyCredits,
        monthlyCredits,
        excessCredits: 4,
        excessUsedThisMonth: 0,
        sweetUsedThisMonth: 0,
        lastCreditReset: now
      }
    );

    res.json({ success: true, message: `Sabke credits reset! ${monthlyCredits} credits (${daysInMonth} din × 6).` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET OVERALL RATINGS STATS ─────────────────────────────────────────
router.get('/ratings-stats', async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const ratings = await Rating.find({ month }).populate('user', 'name roomNumber institutionName');
    if (!ratings.length) return res.json({ success: true, stats: null, count: 0 });

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const fields = ['food', 'clean', 'water', 'drink', 'medical', 'maint'];
    const stats = {};
    fields.forEach(f => {
      const vals = ratings.map(r => r.ratings[f]).filter(Boolean);
      stats[f] = vals.length ? parseFloat(avg(vals).toFixed(2)) : null;
    });
    stats.overall = parseFloat(avg(Object.values(stats).filter(Boolean)).toFixed(2));

    res.json({ success: true, stats, count: ratings.length, ratings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GIVE ROLE ─────────────────────────────────────────────────────────
router.patch('/role/:userId', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'admin', 'warden'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role!' });
    }
    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true }).select('-password');
    res.json({ success: true, message: `${user.name} ka role ${role} ho gaya.`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
