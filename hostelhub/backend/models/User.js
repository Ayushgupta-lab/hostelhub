const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true },

  // Institution info — for verification
  institutionType: {
    type: String,
    enum: ['college', 'coaching', 'school', 'other'],
    required: true
  },
  institutionName: { type: String, required: true },
  studentId: { type: String, required: true }, // Roll no / Enrollment no
  roomNumber: { type: String, required: true },

  role: { type: String, enum: ['student', 'admin', 'warden'], default: 'student' },

  // Verification
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  verificationNote: { type: String },

  // Credits
  credits: { type: Number, default: 0 },
  monthlyCredits: { type: Number, default: 0 },
  lastCreditReset: { type: Date, default: Date.now },

  // Sweet tracking
  sweetUsedThisMonth: { type: Number, default: 0 }, // max 2 free per month
  sweetFreeLimit: { type: Number, default: 2 },

  // Excess credits (4 extra per month, usable any day)
  excessCredits: { type: Number, default: 4 },
  excessUsedThisMonth: { type: Number, default: 0 },

  // Today's votes tracking
  todayVotes: {
    breakfast: { type: Boolean, default: false },
    lunch:     { type: Boolean, default: false },
    snacks:    { type: Boolean, default: false },
    dinner:    { type: Boolean, default: false },
    lastVoteDate: { type: String, default: '' } // YYYY-MM-DD
  },

  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
