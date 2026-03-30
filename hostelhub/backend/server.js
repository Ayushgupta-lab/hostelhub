require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import models first (so CreditTransaction model is registered)
require('./models/User');
require('./models/Rating');
require('./models/Vote');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── ROUTES ────────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/votes',   require('./routes/votes'));

// ── HEALTH CHECK ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HostelHub API running!', time: new Date() });
});

// ── SERVE FRONTEND (catch-all) ────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── CONNECT DB + START SERVER ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected!');

    // Setup cron jobs
    require('./cron/jobs')();

    // Create default admin if none exists
    createDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`🚀 HostelHub server running on http://localhost:${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔌 API: http://localhost:${PORT}/api`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Create default admin account
async function createDefaultAdmin() {
  try {
    const User = require('./models/User');
    const existing = await User.findOne({ role: 'admin' });
    if (!existing) {
      await User.create({
        name: 'Admin',
        email: 'admin@hostelhub.com',
        password: 'admin123',
        phone: '9999999999',
        institutionType: 'college',
        institutionName: 'HostelHub Admin',
        studentId: 'ADMIN001',
        roomNumber: 'OFFICE',
        role: 'admin',
        isVerified: true,
        credits: 9999,
        monthlyCredits: 9999
      });
      console.log('✅ Default admin created: admin@hostelhub.com / admin123');
    }
  } catch (err) {
    // Admin already exists
  }
}
