// ══════════════════════════════════════════════════════
// ██  HOSTELHUB — EXPRESS BACKEND SERVER
// ██  Node.js + Express + JSON file as DB
// ══════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── DB ENGINE (JSON file) ──────────────────────────────
function dbRead() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return null; }
}
function dbWrite(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── HELPER: Hash password (simple sha256 for demo) ─────
function hashPw(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

// ── HELPER: Session tokens (in-memory, simple map) ─────
const sessions = new Map(); // token → { userId, email, role, hostelId }
function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function auth(req, res, next) {
  const t = req.headers['x-token'];
  if (!t || !sessions.has(t)) return res.status(401).json({ error: 'Unauthorized' });
  req.session = sessions.get(t);
  next();
}
function adminOnly(req, res, next) {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ── HELPER: Utility ─────────────────────────────────────
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function calcMonthlyCredits() {
  const n = new Date();
  return getDaysInMonth(n.getFullYear(), n.getMonth()) * 6;
}

// ── HELPER: Sunday Bonus ─────────────────────────────────
function isSunday(date) { return date.getDay() === 0; }

// Indian festival dates (yyyy-mm-dd) — update annually
const FESTIVAL_DATES = [
  '2026-01-14', // Makar Sankranti
  '2026-03-25', // Holi
  '2026-04-06', // Ram Navami
  '2026-04-10', // Good Friday
  '2026-08-15', // Independence Day
  '2026-08-19', // Raksha Bandhan
  '2026-09-07', // Janmashtami
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-08', // Diwali
  '2026-11-09', // Diwali (2nd day)
  '2026-11-10', // Diwali (3rd day)
  '2026-12-25', // Christmas
  '2025-10-02', '2025-10-12', '2025-10-20', '2025-11-01', '2025-12-25',
];

function isFestivalDay(date) {
  const ymd = date.toISOString().slice(0, 10);
  return FESTIVAL_DATES.includes(ymd);
}

function getBonusInfo(date) {
  const festival = isFestivalDay(date);
  const sunday = isSunday(date);
  if (festival) return { type: 'festival', bonus: 6, label: '🎉 Festival Bonus' };
  if (sunday) return { type: 'sunday', bonus: 4, label: '🌟 Sunday Bonus' };
  return { type: 'none', bonus: 0, label: '' };
}

// ── DB INIT ──────────────────────────────────────────────
function initDb() {
  let db = dbRead();
  if (db) return db;

  const mc = calcMonthlyCredits();
  db = {
    hostels: [
      { id: 'h1', name: 'IIT Delhi — Zanskar Hostel', type: 'iit', city: 'Delhi', icon: '🏛️', totalStudents: 312 },
      { id: 'h2', name: 'IIT Bombay — Hostel 14', type: 'iit', city: 'Mumbai', icon: '🌊', totalStudents: 280 },
      { id: 'h3', name: 'IIT Kanpur — Hall 4', type: 'iit', city: 'Kanpur', icon: '🏗', totalStudents: 256 },
      { id: 'h4', name: 'IIT Madras — Krishna Hostel', type: 'iit', city: 'Chennai', icon: '🌴', totalStudents: 290 },
      { id: 'h5', name: 'Medicaps University Hostel', type: 'private', city: 'Indore', icon: '🏥', totalStudents: 420 },
      { id: 'h6', name: 'IET Indore — Boys Hostel', type: 'private', city: 'Indore', icon: '⚡', totalStudents: 380 },
      { id: 'h7', name: 'NIT Trichy — Cauvery Hostel', type: 'govt', city: 'Trichy', icon: '🌊', totalStudents: 340 },
      { id: 'h8', name: 'BITS Pilani — Ram Bhawan', type: 'govt', city: 'Pilani', icon: '⭐', totalStudents: 268 },
      { id: 'h9', name: 'Delhi University — Mansarovar', type: 'govt', city: 'Delhi', icon: '🦚', totalStudents: 220 },
      { id: 'h10', name: 'Stanza Living — Belvedere', type: 'private', city: 'Bangalore', icon: '🏢', totalStudents: 180 },
    ],
    // users keyed by email
    users: {
      'admin@hostel.com': {
        id: 'u1', name: 'Admin Kumar', email: 'admin@hostel.com', phone: '9000011111',
        role: 'admin', isVerified: true, credits: 0, monthlyCredits: 0,
        sweetUsedThisMonth: 0, roomNumber: 'Office', studentId: 'ADMIN001',
        hostelId: 'h6', institutionName: 'IET Indore — Boys Hostel',
        passwordHash: hashPw('admin123'), todayVoteCount: 0,
        lastLoginDate: '', lastBonusDate: '',
      },
      'student@hostel.com': {
        id: 'u2', name: 'Ayush Singh', email: 'student@hostel.com', phone: '9876543210',
        role: 'student', isVerified: true, credits: 74, monthlyCredits: mc,
        sweetUsedThisMonth: 1, roomNumber: 'A-204', studentId: 'CS2024042',
        hostelId: 'h6', institutionName: 'IET Indore — Boys Hostel',
        passwordHash: hashPw('pass123'), todayVoteCount: 1,
        lastLoginDate: '', lastBonusDate: '',
      },
    },
    students: [
      { id: 's1', name: 'Ravi Patel', email: 'ravi@college.edu', phone: '9300011111', roll: 'EC2022031', room: 'C-301', credits: 295, isVerified: false, hostelId: 'h6' },
      { id: 's2', name: 'Sneha Joshi', email: 'sneha@college.edu', phone: '9400022222', roll: 'CS2021099', room: 'A-110', credits: 180, isVerified: true, hostelId: 'h6' },
      { id: 's3', name: 'Arjun Mehta', email: 'arjun@college.edu', phone: '9500033333', roll: 'ME2023015', room: 'B-205', credits: 160, isVerified: true, hostelId: 'h6' },
      { id: 's4', name: 'Priya Yadav', email: 'priya@college.edu', phone: '9700055555', roll: 'IT2023090', room: 'B-108', credits: 200, isVerified: true, hostelId: 'h6' },
    ],
    menus: {
      breakfast: [
        { id: 'b1', emoji: '🥣', name: 'Poha', desc: 'Light flattened rice with spices', credits: 1, nutri: '7.8', votes: 54 },
        { id: 'b2', emoji: '🫓', name: 'Upma', desc: 'Semolina with peanuts & curry leaves', credits: 1, nutri: '7.5', votes: 38 },
        { id: 'b3', emoji: '🥞', name: 'Idli-Sambar', desc: 'Soft idli with hot sambar', credits: 1, nutri: '8.2', votes: 62 },
        { id: 'b4', emoji: '🍞', name: 'Bread + Butter + Tea', desc: '2 slices bread, butter, cutting chai', credits: 0, nutri: '6.0', votes: 91, free: true },
        { id: 'b5', emoji: '🥚', name: 'Egg Omelette', desc: '2 egg omelette with onion & chili', credits: 2, nutri: '9.0', votes: 47 },
        { id: 'b6', emoji: '🧇', name: 'Aloo Paratha', desc: 'Stuffed aloo paratha with curd', credits: 2, nutri: '7.2', votes: 33 },
      ],
      lunch: [
        { id: 'l1', emoji: '🍛', name: 'Dal + Roti + Rice', desc: 'Basic dal with roti and rice', credits: 0, nutri: '7.5', votes: 82, free: true },
        { id: 'l2', emoji: '🥔', name: 'Aloo Gobi', desc: 'Dry potato and cauliflower sabzi', credits: 2, nutri: '7.8', votes: 54 },
        { id: 'l3', emoji: '🫘', name: 'Rajma', desc: 'Rajma in tomato masala', credits: 3, nutri: '8.7', votes: 29 },
        { id: 'l4', emoji: '🥬', name: 'Palak Paneer', desc: 'Spinach with soft paneer cubes', credits: 5, nutri: '9.1', votes: 68 },
        { id: 'l5', emoji: '🍗', name: 'Chicken Curry', desc: 'Desi chicken curry with masala', credits: 8, nutri: '9.4', votes: 31 },
      ],
      snacks: [
        { id: 'sn1', emoji: '🫖', name: 'Chai + Biscuit', desc: 'Cutting chai with cream biscuit', credits: 0, nutri: '4.5', votes: 78, free: true },
        { id: 'sn2', emoji: '🧆', name: 'Samosa (2 pcs)', desc: 'Crispy aloo samosa with chutney', credits: 1, nutri: '5.5', votes: 65 },
        { id: 'sn3', emoji: '🍜', name: 'Maggi', desc: 'Classic instant noodles with veggies', credits: 2, nutri: '5.8', votes: 55 },
        { id: 'sn4', emoji: '🥪', name: 'Sandwich', desc: 'Veg grilled sandwich with chutney', credits: 2, nutri: '7.0', votes: 39 },
      ],
      dinner: [
        { id: 'd1', emoji: '🍛', name: 'Dal + Roti + Rice', desc: 'Basic dal with roti and rice', credits: 0, nutri: '7.5', votes: 74, free: true },
        { id: 'd2', emoji: '🥔', name: 'Aloo Matar', desc: 'Potato and peas dry sabzi', credits: 2, nutri: '7.6', votes: 50 },
        { id: 'd3', emoji: '🥬', name: 'Palak Paneer', desc: 'Spinach with soft paneer cubes', credits: 5, nutri: '9.1', votes: 61 },
        { id: 'd4', emoji: '🍗', name: 'Chicken Curry', desc: 'Desi chicken curry with masala', credits: 8, nutri: '9.4', votes: 25 },
      ],
    },
    facilities: [
      { id: 'f1', icon: '🍲', title: 'Mess / Food Quality', status: 'warn', label: 'Needs Improvement', desc: 'AI detected oily food complaints up 18% this week.' },
      { id: 'f2', icon: '🧹', title: 'Room Cleanliness', status: 'bad', label: 'Alert Sent', desc: 'Management notified. Inspection scheduled Thursday.' },
      { id: 'f3', icon: '♨️', title: 'Hot Water (Geyser)', status: 'ok', label: 'Working Fine', desc: 'Available 6–10 AM and 6–10 PM in all blocks.' },
      { id: 'f4', icon: '🚰', title: 'Drinking Water (RO)', status: 'ok', label: 'Purified & Safe', desc: 'RO plant serviced 3 days ago. TDS: 48 ppm.' },
      { id: 'f5', icon: '🌙', title: 'Induction Kitchen', status: 'ok', label: 'Open 24×7', desc: 'Induction available round the clock.' },
      { id: 'f6', icon: '🏥', title: 'Medical Facility', status: 'warn', label: 'Doctor on Call', desc: 'Regular visits: Mon/Wed/Fri.' },
      { id: 'f7', icon: '🔒', title: 'Security', status: 'ok', label: '24/7 Guard', desc: 'CCTV + security at all entry points.' },
      { id: 'f8', icon: '📶', title: 'WiFi / Internet', status: 'ok', label: 'Fast Connection', desc: '1 Gbps fiber. All floors covered.' },
    ],
    suggestions: [
      { id: 'sg1', slot: 'lunch', emoji: '🥘', name: 'Pav Bhaji', reason: 'Classic Mumbai street food!', votes: 23, votedBy: [] },
      { id: 'sg2', slot: 'dinner', emoji: '🍕', name: 'Veg Pizza', reason: 'Occasional treat.', votes: 18, votedBy: [] },
      { id: 'sg3', slot: 'breakfast', emoji: '🧀', name: 'Paneer Paratha', reason: 'High protein breakfast!', votes: 31, votedBy: [] },
    ],
    navConfig: [
      { id: 'home', label: '🏠 Home', visible: true, protected: true },
      { id: 'food', label: '🍽 Vote', visible: true, protected: false },
      { id: 'ratings', label: '⭐ Rate', visible: true, protected: false },
      { id: 'credits', label: '💎 Credits', visible: true, protected: false },
      { id: 'facilities', label: '🏗 Facility', visible: true, protected: false },
      { id: 'sweet', label: '🍬 Sweet', visible: true, protected: false },
      { id: 'feedback', label: '💬 Feedback', visible: true, protected: false },
    ],
    mealTimes: { breakfast: 450, lunch: 780, snacks: 1020, dinner: 1200 },
    creditHistory: [],
    todayVotes: {},  // userId+slot → true
    maintenanceRequests: [],
  };
  dbWrite(db);
  return db;
}

let db = initDb();

// ═══════════════════════════════════════════
// ██  ROUTES
// ═══════════════════════════════════════════

// ── HOSTELS ─────────────────────────────────
app.get('/api/hostels', (req, res) => {
  res.json(db.hostels);
});

app.post('/api/hostels', (req, res) => {
  const { name, city, type, totalStudents, icon, adminName, adminPhone, adminEmail, adminPass } = req.body;
  if (!name || !city || !adminName || !adminEmail || !adminPass)
    return res.status(400).json({ error: 'Missing required fields' });
  if (adminPass.length < 6)
    return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
  if (db.users[adminEmail])
    return res.status(400).json({ error: 'Email already registered' });

  const newId = 'h_' + Date.now();
  const hostel = { id: newId, name, city, type: type || 'private', totalStudents: parseInt(totalStudents) || 100, icon: icon || '🏫' };
  db.hostels.push(hostel);

  const adminUser = {
    id: 'admin_' + Date.now(), name: adminName, email: adminEmail, phone: adminPhone || '',
    role: 'admin', isVerified: true, credits: 0, monthlyCredits: 0,
    sweetUsedThisMonth: 0, roomNumber: 'Admin Office', studentId: 'ADMIN',
    hostelId: newId, institutionName: name,
    passwordHash: hashPw(adminPass), todayVoteCount: 0, lastLoginDate: '', lastBonusDate: '',
  };
  db.users[adminEmail] = adminUser;
  dbWrite(db);
  res.json({ success: true, hostel });
});

// ── AUTH ─────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users[email?.toLowerCase()];
  if (!user || user.passwordHash !== hashPw(password))
    return res.status(401).json({ error: 'Invalid email or password' });

  // Daily bonus check
  const today = new Date();
  const todayStr = today.toDateString();
  const bonus = getBonusInfo(today);

  if (user.lastBonusDate !== todayStr && user.role === 'student') {
    const loginBonus = 10;
    const totalBonus = loginBonus + bonus.bonus;
    user.credits = (user.credits || 0) + totalBonus;
    user.lastBonusDate = todayStr;

    const histEntry = { type: 'earn', title: '🌅 Daily login bonus', date: 'Today', amount: loginBonus };
    db.creditHistory.unshift(histEntry);

    if (bonus.bonus > 0) {
      db.creditHistory.unshift({ type: 'earn', title: bonus.label + ' Credits', date: 'Today', amount: bonus.bonus });
    }

    // Sync student record
    const st = db.students.find(s => s.email === email);
    if (st) st.credits = user.credits;
  }

  const token = makeToken();
  sessions.set(token, { userId: user.id, email: user.email, role: user.role, hostelId: user.hostelId });
  dbWrite(db);

  const { passwordHash, ...safeUser } = user;
  res.json({ token, user: safeUser, bonusToday: bonus });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, roomNumber, studentId, hostelId } = req.body;
  const em = email?.toLowerCase();
  if (!name || !em || !password || !roomNumber || !studentId || !hostelId)
    return res.status(400).json({ error: 'Please fill all required fields' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.users[em])
    return res.status(400).json({ error: 'Email already registered. Please login.' });

  const hostel = db.hostels.find(h => h.id === hostelId);
  if (!hostel) return res.status(400).json({ error: 'Invalid hostel selected' });

  const mc = calcMonthlyCredits();
  const newId = 'u_' + Date.now();
  const newUser = {
    id: newId, name, email: em, phone: phone || '', role: 'student', isVerified: false,
    credits: mc, monthlyCredits: mc, sweetUsedThisMonth: 0,
    roomNumber, studentId, hostelId, institutionName: hostel.name,
    passwordHash: hashPw(password), todayVoteCount: 0, lastLoginDate: '', lastBonusDate: '',
  };
  db.users[em] = newUser;
  db.students.push({ id: newId, name, email: em, phone: phone || '', roll: studentId, room: roomNumber, credits: mc, isVerified: false, hostelId });
  dbWrite(db);

  const token = makeToken();
  sessions.set(token, { userId: newId, email: em, role: 'student', hostelId });
  const { passwordHash, ...safeUser } = newUser;
  res.json({ token, user: safeUser });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const t = req.headers['x-token'];
  sessions.delete(t);
  res.json({ success: true });
});

app.post('/api/auth/forgot', (req, res) => {
  const { email } = req.body;
  const user = db.users[email?.toLowerCase()];
  if (!user) return res.status(404).json({ error: 'No account found with this email' });
  // Demo: return OTP (in production send via SMS/email)
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  // Store OTP temporarily in session-like map
  sessions.set('otp_' + email, { otp, expires: Date.now() + 10 * 60 * 1000 });
  res.json({ success: true, otp }); // in prod: don't return OTP!
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, otp, newPassword } = req.body;
  const stored = sessions.get('otp_' + email);
  if (!stored || stored.otp !== otp || Date.now() > stored.expires)
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  db.users[email].passwordHash = hashPw(newPassword);
  dbWrite(db);
  sessions.delete('otp_' + email);
  res.json({ success: true });
});

// ── ME ───────────────────────────────────────
app.get('/api/me', auth, (req, res) => {
  const user = db.users[req.session.email];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

// ── BONUS CHECK ──────────────────────────────
app.get('/api/bonus/today', auth, (req, res) => {
  const today = new Date();
  const info = getBonusInfo(today);
  res.json(info);
});

// ── MENUS ────────────────────────────────────
app.get('/api/menus', auth, (req, res) => {
  const hostelId = req.session.hostelId;
  res.json(db.menus); // shared across hostel for now
});

app.post('/api/menus/item', auth, adminOnly, (req, res) => {
  const { slot, emoji, name, desc, credits, free, nutri } = req.body;
  if (!slot || !name) return res.status(400).json({ error: 'Slot and name required' });
  const item = { id: 'menu_' + Date.now(), emoji: emoji || '🍽', name, desc: desc || 'Admin added', credits: free ? 0 : (parseInt(credits) || 0), nutri: nutri || '7.0', votes: 0, free: !!free };
  if (!db.menus[slot]) db.menus[slot] = [];
  db.menus[slot].push(item);
  dbWrite(db);
  res.json({ success: true, item });
});

app.delete('/api/menus/item/:slot/:id', auth, adminOnly, (req, res) => {
  const { slot, id } = req.params;
  db.menus[slot] = (db.menus[slot] || []).filter(f => f.id !== id);
  dbWrite(db);
  res.json({ success: true });
});

// ── VOTING ───────────────────────────────────
app.post('/api/vote', auth, (req, res) => {
  const { slot, foodId } = req.body;
  const user = db.users[req.session.email];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.isVerified && user.role !== 'admin')
    return res.status(403).json({ error: 'Admin verification required to vote' });

  const voteKey = user.id + '_' + slot + '_' + new Date().toDateString();
  if (db.todayVotes[voteKey])
    return res.status(400).json({ error: 'Already voted for this meal today' });

  const items = db.menus[slot] || [];
  const food = items.find(f => f.id === foodId);
  if (!food) return res.status(404).json({ error: 'Food item not found' });

  if (food.credits > 0 && user.credits < food.credits)
    return res.status(400).json({ error: `Not enough credits! Need ${food.credits} extra.` });

  if (food.credits > 0) {
    user.credits -= food.credits;
    db.creditHistory.unshift({ type: 'spend', title: `${slot}: ${food.name} (extra)`, date: 'Today', amount: -food.credits });
    const st = db.students.find(s => s.email === user.email);
    if (st) st.credits = user.credits;
  }

  food.votes = (food.votes || 0) + 1;
  db.todayVotes[voteKey] = true;
  user.todayVoteCount = (user.todayVoteCount || 0) + 1;
  dbWrite(db);

  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.get('/api/vote/status', auth, (req, res) => {
  const user = db.users[req.session.email];
  const slots = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const todayStr = new Date().toDateString();
  const voted = {};
  slots.forEach(s => {
    voted[s] = !!db.todayVotes[user.id + '_' + s + '_' + todayStr];
  });
  res.json({ voted });
});

// ── MEAL TIMES ───────────────────────────────
app.get('/api/mealtimes', auth, (req, res) => {
  res.json(db.mealTimes);
});

app.put('/api/mealtimes', auth, adminOnly, (req, res) => {
  const { breakfast, lunch, snacks, dinner } = req.body;
  db.mealTimes = { breakfast: parseInt(breakfast) || 450, lunch: parseInt(lunch) || 780, snacks: parseInt(snacks) || 1020, dinner: parseInt(dinner) || 1200 };
  dbWrite(db);
  res.json({ success: true, mealTimes: db.mealTimes });
});

// ── CREDITS ──────────────────────────────────
app.get('/api/credits/history', auth, (req, res) => {
  res.json(db.creditHistory.slice(0, 50));
});

app.post('/api/credits/reset', auth, adminOnly, (req, res) => {
  const mc = calcMonthlyCredits();
  db.students.forEach(s => { s.credits = mc; });
  Object.values(db.users).forEach(u => { if (u.role === 'student') u.credits = mc; });
  const n = new Date();
  db.creditHistory.unshift({ type: 'reset', title: 'Admin credit reset', date: n.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), amount: mc });
  dbWrite(db);
  res.json({ success: true, monthlyCredits: mc });
});

// ── SUGGESTIONS ──────────────────────────────
app.get('/api/suggestions', auth, (req, res) => {
  res.json(db.suggestions);
});

app.post('/api/suggestions', auth, (req, res) => {
  const user = db.users[req.session.email];
  if (!user.isVerified && user.role !== 'admin')
    return res.status(403).json({ error: 'Verification required to suggest food' });
  const { slot, emoji, name, reason } = req.body;
  if (!name) return res.status(400).json({ error: 'Food name required' });
  const s = { id: 'sg_' + Date.now(), slot: slot || 'lunch', emoji: emoji || '🍽', name, reason: reason || 'Suggested by community.', votes: 1, votedBy: [user.id] };
  db.suggestions.unshift(s);
  dbWrite(db);
  res.json({ success: true, suggestion: s });
});

app.post('/api/suggestions/:id/upvote', auth, (req, res) => {
  const user = db.users[req.session.email];
  const s = db.suggestions.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.votedBy.includes(user.id)) return res.status(400).json({ error: 'Already upvoted' });
  s.votes++;
  s.votedBy.push(user.id);
  dbWrite(db);
  res.json({ success: true, votes: s.votes });
});

app.post('/api/suggestions/:id/approve', auth, adminOnly, (req, res) => {
  const s = db.suggestions.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  db.menus[s.slot].push({ id: 'sugg_' + Date.now(), emoji: s.emoji, name: s.name, desc: 'Community suggested', credits: 0, nutri: '7.0', votes: s.votes, free: true });
  db.suggestions = db.suggestions.filter(x => x.id !== req.params.id);
  dbWrite(db);
  res.json({ success: true });
});

app.delete('/api/suggestions/:id', auth, adminOnly, (req, res) => {
  db.suggestions = db.suggestions.filter(x => x.id !== req.params.id);
  dbWrite(db);
  res.json({ success: true });
});

// ── FACILITIES ───────────────────────────────
app.get('/api/facilities', auth, (req, res) => {
  res.json(db.facilities);
});

app.post('/api/facilities', auth, adminOnly, (req, res) => {
  const { icon, title, status, label, desc } = req.body;
  if (!title || !label) return res.status(400).json({ error: 'Title and label required' });
  const f = { id: 'fac_' + Date.now(), icon: icon || '🏗', title, status: status || 'ok', label, desc: desc || 'No description.' };
  db.facilities.push(f);
  dbWrite(db);
  res.json({ success: true, facility: f });
});

app.put('/api/facilities/:id', auth, adminOnly, (req, res) => {
  const f = db.facilities.find(x => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (req.body.status) f.status = req.body.status;
  if (req.body.label) f.label = req.body.label;
  dbWrite(db);
  res.json({ success: true });
});

app.delete('/api/facilities/:id', auth, adminOnly, (req, res) => {
  db.facilities = db.facilities.filter(x => x.id !== req.params.id);
  dbWrite(db);
  res.json({ success: true });
});

// ── MAINTENANCE ──────────────────────────────
app.post('/api/maintenance', auth, (req, res) => {
  const user = db.users[req.session.email];
  const { type, room, desc } = req.body;
  if (!room || !desc) return res.status(400).json({ error: 'Room and description required' });
  const req2 = { id: 'mr_' + Date.now(), userId: user.id, name: user.name, room, type: type || 'Other', desc, status: 'pending', hostelId: req.session.hostelId, date: new Date().toLocaleDateString('en-IN') };
  db.maintenanceRequests.push(req2);
  dbWrite(db);
  res.json({ success: true });
});

// ── STUDENTS (Admin) ─────────────────────────
app.get('/api/students', auth, adminOnly, (req, res) => {
  const hostelId = req.session.hostelId;
  res.json(db.students.filter(s => s.hostelId === hostelId));
});

app.put('/api/students/:id/verify', auth, adminOnly, (req, res) => {
  const { approve } = req.body;
  const s = db.students.find(st => st.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Student not found' });
  s.isVerified = !!approve;
  const userEmail = Object.keys(db.users).find(k => db.users[k].id === req.params.id);
  if (userEmail) db.users[userEmail].isVerified = !!approve;
  dbWrite(db);
  res.json({ success: true });
});

// ── NAV CONFIG ───────────────────────────────
app.get('/api/navconfig', auth, (req, res) => {
  res.json(db.navConfig);
});

app.put('/api/navconfig', auth, adminOnly, (req, res) => {
  const { navConfig } = req.body;
  if (!Array.isArray(navConfig)) return res.status(400).json({ error: 'navConfig must be array' });
  db.navConfig = navConfig;
  dbWrite(db);
  res.json({ success: true });
});

// ── SWEET ────────────────────────────────────
app.post('/api/sweet/claim', auth, (req, res) => {
  const user = db.users[req.session.email];
  if (!user.isVerified && user.role !== 'admin')
    return res.status(403).json({ error: 'Verification required' });
  const today = new Date().getDate();
  const sweetDays = [10, 25];
  if (!sweetDays.includes(today))
    return res.status(400).json({ error: 'Not a sweet day' });
  if ((user.sweetUsedThisMonth || 0) >= 2)
    return res.status(400).json({ error: 'Already used 2 sweet credits this month' });
  const key = 'sweet_' + user.id + '_' + new Date().toISOString().slice(0, 7) + '_' + today;
  if (db.todayVotes[key])
    return res.status(400).json({ error: 'Already claimed today' });
  user.sweetUsedThisMonth = (user.sweetUsedThisMonth || 0) + 1;
  db.todayVotes[key] = true;
  db.creditHistory.unshift({ type: 'earn', title: '🍬 Sweet Day bonus credit', date: 'Today', amount: 20 });
  user.credits = (user.credits || 0) + 20;
  const st = db.students.find(s => s.email === user.email);
  if (st) st.credits = user.credits;
  dbWrite(db);
  const { passwordHash, ...safe } = user;
  res.json({ success: true, user: safe });
});

// ── RATINGS ──────────────────────────────────
app.post('/api/ratings', auth, (req, res) => {
  const user = db.users[req.session.email];
  if (!user.isVerified && user.role !== 'admin')
    return res.status(403).json({ error: 'Verification required' });
  res.json({ success: true });
});

// ── FALLBACK ─────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 HostelHub Server running at http://localhost:${PORT}`);
  console.log(`📁 DB file: ${DB_FILE}`);
  console.log(`\n🔑 Demo credentials:`);
  console.log(`   Admin  → admin@hostel.com  / admin123`);
  console.log(`   Student→ student@hostel.com / pass123\n`);
});
