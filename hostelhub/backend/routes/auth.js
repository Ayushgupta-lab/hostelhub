const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ── REGISTER ────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, institutionType, institutionName, studentId, roomNumber } = req.body;

    if (!name || !email || !password || !phone || !institutionType || !institutionName || !studentId || !roomNumber) {
      return res.status(400).json({ success: false, message: 'Saari details bharo!' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered hai!' });

    // Calculate monthly credits on register
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyCredits = daysInMonth * 6;

    const user = await User.create({
      name, email, password, phone,
      institutionType, institutionName, studentId, roomNumber,
      credits: monthlyCredits,
      monthlyCredits,
      excessCredits: 4,
      lastCreditReset: now
    });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      message: 'Registration successful! Admin se verification ka wait karo.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        credits: user.credits,
        excessCredits: user.excessCredits,
        roomNumber: user.roomNumber,
        institutionName: user.institutionName,
        institutionType: user.institutionType
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ── LOGIN ────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email aur password dono chahiye!' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Email ya password galat hai!' });
    }

    // Reset today's votes if new day
    const today = new Date().toISOString().slice(0, 10);
    if (user.todayVotes.lastVoteDate !== today) {
      user.todayVotes = { breakfast: false, lunch: false, snacks: false, dinner: false, lastVoteDate: today };
      await user.save();
    }

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        credits: user.credits,
        excessCredits: user.excessCredits,
        sweetUsedThisMonth: user.sweetUsedThisMonth,
        roomNumber: user.roomNumber,
        institutionName: user.institutionName,
        institutionType: user.institutionType,
        todayVotes: user.todayVotes,
        monthlyCredits: user.monthlyCredits
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ── GET ME ───────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const today = new Date().toISOString().slice(0, 10);
    if (user.todayVotes.lastVoteDate !== today) {
      user.todayVotes = { breakfast: false, lunch: false, snacks: false, dinner: false, lastVoteDate: today };
      await user.save();
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
