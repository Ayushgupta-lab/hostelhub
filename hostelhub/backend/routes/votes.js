const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const mongoose = require('mongoose');
const CreditTransaction = mongoose.model('CreditTransaction');
const User = require('../models/User');
const { protect, requireVerified } = require('../middleware/auth');

// ── MEAL MENUS ───────────────────────────────────────────────────────
const MEAL_MENUS = {
  breakfast: [
    { id:'b1', emoji:'🥣', name:'Poha',              credits:1 },
    { id:'b2', emoji:'🫓', name:'Upma',               credits:1 },
    { id:'b3', emoji:'🥞', name:'Idli-Sambar',        credits:1 },
    { id:'b4', emoji:'🍳', name:'Bread+Butter+Tea',   credits:0, free:true },
    { id:'b5', emoji:'🥚', name:'Egg Omelette',       credits:2 },
    { id:'b6', emoji:'🧇', name:'Aloo Paratha',       credits:2 },
  ],
  lunch: [
    { id:'l1', emoji:'🍛', name:'Dal+Roti+Rice',      credits:0, free:true },
    { id:'l2', emoji:'🥔', name:'Aloo Gobi',           credits:2 },
    { id:'l3', emoji:'🫘', name:'Kadhi Dal',           credits:2 },
    { id:'l4', emoji:'🫛', name:'Chana Masala',        credits:3 },
    { id:'l5', emoji:'🫘', name:'Rajma',               credits:3 },
    { id:'l6', emoji:'🥬', name:'Palak Paneer',        credits:5 },
    { id:'l7', emoji:'🧀', name:'Shahi Paneer',        credits:5 },
    { id:'l8', emoji:'🍗', name:'Chicken Curry',       credits:8 },
  ],
  snacks: [
    { id:'s1', emoji:'🫖', name:'Chai+Biscuit',        credits:0, free:true },
    { id:'s2', emoji:'🧆', name:'Samosa (2 pcs)',      credits:1 },
    { id:'s3', emoji:'🍟', name:'Pakoda',              credits:1 },
    { id:'s4', emoji:'🥪', name:'Sandwich',            credits:2 },
    { id:'s5', emoji:'🍜', name:'Maggi',               credits:2 },
    { id:'s6', emoji:'🌮', name:'Bread Pakoda',        credits:1 },
  ],
  dinner: [
    { id:'d1', emoji:'🍛', name:'Dal+Roti+Rice',      credits:0, free:true },
    { id:'d2', emoji:'🥔', name:'Aloo Matar',          credits:2 },
    { id:'d3', emoji:'🍲', name:'Mix Veg',             credits:2 },
    { id:'d4', emoji:'🫘', name:'Rajma',               credits:3 },
    { id:'d5', emoji:'🫛', name:'Chana Dal',           credits:3 },
    { id:'d6', emoji:'🥬', name:'Palak Paneer',        credits:5 },
    { id:'d7', emoji:'🧀', name:'Kadai Paneer',        credits:5 },
    { id:'d8', emoji:'🍗', name:'Chicken Curry',       credits:8 },
  ]
};

// Voting windows: opens 15hr before meal, closes 2.5hr before
const MEAL_TIMES = {
  breakfast: 7 * 60,   // 7:00 AM in minutes
  lunch:     12 * 60,  // 12:00 PM
  snacks:    16 * 60,  // 4:00 PM
  dinner:    19 * 60,  // 7:00 PM
};

function getVotingStatus(slot) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const mealMins = MEAL_TIMES[slot];
  const openMins = mealMins - 15 * 60;  // 15 hrs before
  const closeMins = mealMins - 150;      // 2.5 hrs before

  if (openMins < 0 && nowMins < closeMins) return { open: true }; // previous day open
  if (nowMins >= closeMins) return { open: false, reason: 'Voting band ho gayi!' };
  if (openMins >= 0 && nowMins < openMins) return { open: false, reason: 'Voting abhi nahi khuli!' };
  return { open: true };
}

// ── GET MENUS ─────────────────────────────────────────────────────────
router.get('/menus', protect, (req, res) => {
  res.json({ success: true, menus: MEAL_MENUS });
});

// ── SUBMIT VOTE + DEDUCT CREDITS ─────────────────────────────────────
router.post('/vote', protect, requireVerified, async (req, res) => {
  try {
    const { mealSlot, foodItemId, useExcessCredits } = req.body;

    if (!MEAL_MENUS[mealSlot]) return res.status(400).json({ success: false, message: 'Invalid meal slot!' });

    // Check voting window
    const status = getVotingStatus(mealSlot);
    if (!status.open) return res.status(400).json({ success: false, message: status.reason });

    const foodItem = MEAL_MENUS[mealSlot].find(f => f.id === foodItemId);
    if (!foodItem) return res.status(400).json({ success: false, message: 'Food item nahi mila!' });

    // Check already voted today
    const today = new Date().toISOString().slice(0, 10);
    const user = await User.findById(req.user._id);

    if (user.todayVotes.lastVoteDate === today && user.todayVotes[mealSlot]) {
      return res.status(400).json({ success: false, message: 'Is meal ke liye aaj vote ho chuka hai!' });
    }

    let creditsToCharge = foodItem.credits;
    let excessUsed = 0;

    // EXCESS CREDITS LOGIC:
    // If user wants to use excess credits (for premium item), and has them:
    // Normal credits cover the "basic" cost (2 for regular sabzi), 
    // excess covers the difference. Excess returns if premium not chosen.
    if (useExcessCredits && user.excessCredits > 0 && creditsToCharge > 2) {
      const baseCredit = 2; // normal sabzi cost
      const extraNeeded = creditsToCharge - baseCredit;
      excessUsed = Math.min(extraNeeded, user.excessCredits);
      creditsToCharge = creditsToCharge - excessUsed;
    }

    if (creditsToCharge > user.credits) {
      return res.status(400).json({
        success: false,
        message: `Credits kam hain! ${creditsToCharge} chahiye, aapke paas ${user.credits} hain.`
      });
    }

    // Deduct credits
    if (creditsToCharge > 0) user.credits -= creditsToCharge;
    if (excessUsed > 0) {
      user.excessCredits -= excessUsed;
      user.excessUsedThisMonth += excessUsed;
    }

    // Mark voted
    if (user.todayVotes.lastVoteDate !== today) {
      user.todayVotes = { breakfast: false, lunch: false, snacks: false, dinner: false, lastVoteDate: today };
    }
    user.todayVotes[mealSlot] = true;
    await user.save();

    // Save vote record
    await Vote.create({
      user: user._id, date: today, mealSlot,
      foodItemId, foodItemName: foodItem.name,
      creditsCharged: creditsToCharge, usedExcessCredits: excessUsed
    });

    // Save credit transaction
    if (creditsToCharge > 0 || excessUsed > 0) {
      await CreditTransaction.create({
        user: user._id,
        type: 'spend',
        amount: -(creditsToCharge + excessUsed),
        description: `${mealSlot}: ${foodItem.name}${excessUsed ? ` (${excessUsed} excess used)` : ''}`
      });
    }

    res.json({
      success: true,
      message: `Vote submit! ${foodItem.name}${creditsToCharge > 0 ? ` (-${creditsToCharge} credits)` : ' (Free!)'}`,
      credits: user.credits,
      excessCredits: user.excessCredits,
      todayVotes: user.todayVotes
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Is meal ke liye aaj vote ho chuka hai!' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SWEET CLAIM (2 free per month) ───────────────────────────────────
router.post('/sweet-claim', protect, requireVerified, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const SWEET_MIN = 10;

    if (user.credits < SWEET_MIN) {
      return res.status(400).json({ success: false, message: `Sweet ke liye ${SWEET_MIN} credits chahiye!` });
    }

    if (user.sweetUsedThisMonth >= 2) {
      return res.status(400).json({ success: false, message: 'Is mahine ki dono free sweets use ho gayi hain!' });
    }

    user.sweetUsedThisMonth += 1;
    await user.save();

    await CreditTransaction.create({
      user: user._id, type: 'earn', amount: 0,
      description: `🍬 Free Sweet Claimed (${user.sweetUsedThisMonth}/2 this month) — 0 credits deducted`
    });

    res.json({
      success: true,
      message: `🍬 Sweet mila! Bilkul FREE (${user.sweetUsedThisMonth}/2 is mahine). Canteen se lo!`,
      sweetUsedThisMonth: user.sweetUsedThisMonth,
      sweetFreeLeft: 2 - user.sweetUsedThisMonth
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET MY CREDIT HISTORY ─────────────────────────────────────────────
router.get('/credit-history', protect, async (req, res) => {
  try {
    const history = await CreditTransaction.find({ user: req.user._id })
      .sort({ date: -1 }).limit(30);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET VOTE COUNTS (for live vote display) ───────────────────────────
router.get('/counts/:date/:slot', protect, async (req, res) => {
  try {
    const { date, slot } = req.params;
    const votes = await Vote.find({ date, mealSlot: slot });
    const counts = {};
    votes.forEach(v => { counts[v.foodItemId] = (counts[v.foodItemId] || 0) + 1; });
    res.json({ success: true, counts, total: votes.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SWEET LEADERBOARD ─────────────────────────────────────────────────
router.get('/sweet-leaderboard', protect, async (req, res) => {
  try {
    const students = await User.find({ role: 'student', isVerified: true })
      .select('name credits roomNumber').sort({ credits: -1 }).limit(10);
    res.json({ success: true, leaderboard: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
