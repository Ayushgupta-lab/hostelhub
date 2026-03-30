const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },      // YYYY-MM-DD
  mealSlot: {
    type: String,
    enum: ['breakfast', 'lunch', 'snacks', 'dinner'],
    required: true
  },
  foodItemId: { type: String, required: true },
  foodItemName: { type: String, required: true },
  creditsCharged: { type: Number, default: 0 },
  usedExcessCredits: { type: Number, default: 0 }, // how many excess credits used
  createdAt: { type: Date, default: Date.now }
});

// One vote per user per meal per day
voteSchema.index({ user: 1, date: 1, mealSlot: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);

// ── CreditTransaction model (same file for simplicity) ──────────────
const creditTxSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['earn', 'spend', 'reset', 'daily_deduct'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

mongoose.model('CreditTransaction', creditTxSchema);
