const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // One rating set per user per month
  month: { type: String, required: true }, // Format: "2024-03"

  ratings: {
    food:    { type: Number, min: 1, max: 5 },
    clean:   { type: Number, min: 1, max: 5 },
    water:   { type: Number, min: 1, max: 5 },
    drink:   { type: Number, min: 1, max: 5 },
    medical: { type: Number, min: 1, max: 5 },
    maint:   { type: Number, min: 1, max: 5 },
  },

  overall: { type: Number },
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

// One rating per user per month
ratingSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
