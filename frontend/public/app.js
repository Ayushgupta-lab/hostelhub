// ══════════════════════════════════════════════════════════
// ██  HOSTELHUB — FRONTEND (API-Connected)
// ██  Connects to Express backend at /api/*
// ══════════════════════════════════════════════════════════

const API = '/api';
let TOKEN = localStorage.getItem('hh_token') || null;

// ── API WRAPPER ──────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (TOKEN) opts.headers['x-token'] = TOKEN;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    throw e;
  }
}

// ── RUNTIME STATE ───────────────────────────────────────
let currentUser = null;
let currentHostelId = null;
let selectedRegHostelId = null;
let activeSlot = 'lunch';
let selectedFood = null;
let userRatings = {};
let forgotEmail = null;
let forgotOTP = null;
let currentLang = 'en';
let DB_NAV = [];
let DB_MEALTIMES = { breakfast: 450, lunch: 780, snacks: 1020, dinner: 1200 };
let DB_VOTED = {};   // { slot: true/false }
let DB_MENUS = {};
let DB_FACILITIES = [];
let DB_SUGGESTIONS = [];
let DB_STUDENTS = [];

// ── CONSTANTS ────────────────────────────────────────────
const VOTE_OPEN_BEFORE = 840;  // 14 hours in mins
const VOTE_CLOSE_BEFORE = 120; // 2 hours in mins
const DAILY_COST = 6;
const SWEET_FREE_PER_MONTH = 2;
const sweetDays = [{ day: 10, label: 'Sweet Day 1', emoji: '🍬' }, { day: 25, label: 'Sweet Day 2', emoji: '🍮' }];
const RATING_CATS = [
  { id: 'food', icon: '🍲', name: 'Food Quality', desc: 'Taste, nutrition, variety' },
  { id: 'clean', icon: '🧹', name: 'Room Cleanliness', desc: 'Room, bathroom, common areas' },
  { id: 'water', icon: '💧', name: 'Hot Water', desc: 'Geyser availability & timing' },
  { id: 'drink', icon: '🚰', name: 'Drinking Water', desc: 'RO quality & supply' },
  { id: 'medical', icon: '🏥', name: 'Medical Facility', desc: 'Doctor, first aid, emergency' },
  { id: 'maint', icon: '🔧', name: 'Maintenance Speed', desc: 'Problem resolution time' },
];

// Indian festival calendar (client-side for display)
const FESTIVAL_DATES = [
  '2026-01-14','2026-03-25','2026-04-06','2026-04-10',
  '2026-08-15','2026-08-19','2026-09-07','2026-10-02',
  '2026-10-20','2026-11-08','2026-11-09','2026-11-10','2026-12-25',
];
const FESTIVAL_NAMES = {
  '2026-01-14':'Makar Sankranti','2026-03-25':'Holi','2026-04-06':'Ram Navami',
  '2026-04-10':'Good Friday','2026-08-15':'Independence Day','2026-08-19':'Raksha Bandhan',
  '2026-09-07':'Janmashtami','2026-10-02':'Gandhi Jayanti','2026-10-20':'Dussehra',
  '2026-11-08':'Diwali 🪔','2026-11-09':'Diwali 🪔','2026-11-10':'Diwali 🪔','2026-12-25':'Christmas 🎄',
};

function getTodayBonusInfo() {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10);
  const isFestival = FESTIVAL_DATES.includes(ymd);
  const isSunday = today.getDay() === 0;
  if (isFestival) return { type: 'festival', bonus: 6, label: '🎉 ' + (FESTIVAL_NAMES[ymd] || 'Festival') + ' Bonus', loginBonus: 10 };
  if (isSunday) return { type: 'sunday', bonus: 4, label: '🌟 Sunday Bonus', loginBonus: 10 };
  return { type: 'none', bonus: 0, label: '', loginBonus: 10 };
}

// ── UTILS ────────────────────────────────────────────────
function fmtMins(m) {
  const n = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60), mn = n % 60;
  return `${h > 12 ? h - 12 : h || 12}:${String(mn).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function calcMonthlyCredits() {
  const n = new Date();
  return getDaysInMonth(n.getFullYear(), n.getMonth()) * DAILY_COST;
}
function toast(icon, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── VOTING WINDOW LOGIC ─────────────────────────────────
function isInWindow(nowM, openM, closeM) {
  if (openM <= closeM) return nowM >= openM && nowM < closeM;
  return nowM >= openM || nowM < closeM;
}
function minsUntil(nowM, targetM) {
  if (targetM > nowM) return targetM - nowM;
  return 1440 - nowM + targetM;
}
function windowProgress(nowM, openM, closeM) {
  let total, elapsed;
  if (openM <= closeM) { total = closeM - openM; elapsed = nowM - openM; }
  else { total = 1440 - openM + closeM; elapsed = nowM >= openM ? nowM - openM : 1440 - openM + nowM; }
  return Math.min(100, Math.max(0, Math.round(elapsed / total * 100)));
}
function getSlotStatus(slot) {
  const meal = DB_MEALTIMES[slot];
  const open = ((meal - VOTE_OPEN_BEFORE) % 1440 + 1440) % 1440;
  const close = ((meal - VOTE_CLOSE_BEFORE) % 1440 + 1440) % 1440;
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  if (DB_VOTED[slot]) return { state: 'voted', msg: `✅ Voted! (${fmtMins(meal)})` };
  if (nowM >= meal) return { state: 'past', msg: `✅ Meal done` };
  if (isInWindow(nowM, open, close)) {
    const left = minsUntil(nowM, close);
    return { state: 'open', msg: `✅ Open — ${Math.floor(left / 60)}h ${left % 60}m left`, canVote: true };
  }
  if (isInWindow(nowM, close, meal)) return { state: 'closed', msg: `🔒 Voting closed` };
  return { state: 'notyet', msg: `⏳ Opens ${fmtMins(open)}` };
}

// ── AUTH PAGE ────────────────────────────────────────────
function showAuthPage() {
  document.getElementById('authPage').classList.add('show');
  loadHostelsForAuth('');
}
function hideAuthPage() { document.getElementById('authPage').classList.remove('show'); }

async function loadHostelsForAuth(filter) {
  try {
    const hostels = await api('GET', '/hostels');
    renderAuthHostels(hostels, filter);
  } catch (e) {
    console.error('Could not load hostels:', e);
  }
}

function renderAuthHostels(hostels, filter) {
  const dd = document.getElementById('authHostelDropdown');
  const typeLabels = { iit: 'IIT / Govt Premium', private: 'Private College', govt: 'Government / University' };
  const filtered = filter
    ? hostels.filter(h => h.name.toLowerCase().includes(filter.toLowerCase()) || h.city.toLowerCase().includes(filter.toLowerCase()))
    : hostels;
  dd.innerHTML = filtered.map(h => `
    <div class="auth-hostel-option${currentHostelId === h.id ? ' selected-opt' : ''}" onclick="selectAuthHostel('${h.id}','${h.icon || '🏫'}','${h.name.replace(/'/g, "\\'")}','${h.city}',${h.totalStudents})">
      <div class="auth-hostel-icon">${h.icon || '🏫'}</div>
      <div>
        <div class="auth-hostel-info-name">${h.name}</div>
        <div class="auth-hostel-info-sub">📍 ${h.city} • ${typeLabels[h.type] || h.type} • 👥 ${h.totalStudents} students</div>
      </div>
    </div>`).join('') || '<div style="padding:16px;text-align:center;color:var(--text2)">No hostels found.</div>';
}

let _allHostels = [];
async function filterAuthHostels(val) {
  if (!_allHostels.length) _allHostels = await api('GET', '/hostels').catch(() => []);
  renderAuthHostels(_allHostels, val);
  document.getElementById('authHostelDropdown').classList.add('show');
}
async function showAuthDropdown() {
  if (!_allHostels.length) _allHostels = await api('GET', '/hostels').catch(() => []);
  renderAuthHostels(_allHostels, document.getElementById('hostelSearchInput').value);
  document.getElementById('authHostelDropdown').classList.add('show');
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.auth-search-bar') && !e.target.closest('.auth-hostel-dropdown')) {
    document.getElementById('authHostelDropdown')?.classList.remove('show');
  }
});

function selectAuthHostel(id, icon, name, city, students) {
  currentHostelId = id;
  selectedRegHostelId = id;
  document.getElementById('authHostelDropdown').classList.remove('show');
  document.getElementById('hostelSearchInput').value = name;
  document.getElementById('authSelectedIcon').textContent = icon;
  document.getElementById('authSelectedName').textContent = name;
  document.getElementById('authSelectedSub').textContent = `📍 ${city} • 👥 ${students} students`;
  document.getElementById('authSelectedHostel').classList.add('show');
  document.getElementById('regHostelDisplay').textContent = '✅ ' + name;
}

function switchAuthTab(tab) {
  document.getElementById('authLoginForm').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('authRegisterForm').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('authForgotForm').style.display = tab === 'forgot' ? '' : 'none';
  ['Login', 'Register', 'Forgot'].forEach(t => document.getElementById('authTab' + t).classList.remove('active'));
  document.getElementById('authTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  clearAuthMsg();
}
function showAuthErr(msg) { const e = document.getElementById('authErr'); e.textContent = msg; e.style.display = 'block'; document.getElementById('authOk').style.display = 'none'; }
function showAuthOk(msg) { const e = document.getElementById('authOk'); e.textContent = msg; e.style.display = 'block'; document.getElementById('authErr').style.display = 'none'; }
function clearAuthMsg() { document.getElementById('authErr').style.display = 'none'; document.getElementById('authOk').style.display = 'none'; }

// ── LOGIN ────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const pass = document.getElementById('authPass').value;
  if (!email || !pass) { showAuthErr('Please enter email and password.'); return; }
  try {
    const data = await api('POST', '/auth/login', { email, password: pass });
    TOKEN = data.token;
    localStorage.setItem('hh_token', TOKEN);
    currentUser = data.user;
    currentHostelId = currentHostelId || currentUser.hostelId;
    hideAuthPage();
    await onLoggedIn(data.bonusToday);
  } catch (e) {
    showAuthErr(e.message || 'Login failed.');
  }
}

// ── REGISTER ─────────────────────────────────────────────
async function doRegister() {
  if (!selectedRegHostelId) { showAuthErr('Please select your hostel first.'); return; }
  const name = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPass').value;
  const room = document.getElementById('regRoom').value.trim();
  const roll = document.getElementById('regRoll').value.trim();
  if (!name || !email || !pass || !room || !roll) { showAuthErr('Please fill all required fields.'); return; }
  if (pass.length < 6) { showAuthErr('Password must be at least 6 characters.'); return; }
  try {
    const data = await api('POST', '/auth/register', { name, email, password: pass, phone, roomNumber: room, studentId: roll, hostelId: selectedRegHostelId });
    TOKEN = data.token;
    localStorage.setItem('hh_token', TOKEN);
    currentUser = data.user;
    currentHostelId = selectedRegHostelId;
    hideAuthPage();
    await onLoggedIn(null);
    toast('✅', 'Registration successful! Awaiting admin verification.');
  } catch (e) {
    showAuthErr(e.message || 'Registration failed.');
  }
}

// ── ADD HOSTEL ────────────────────────────────────────────
function openAddHostelModal() { document.getElementById('addHostelModal').classList.add('open'); }
function closeAddHostelModal() { document.getElementById('addHostelModal').classList.remove('open'); }
async function addNewHostel() {
  const name = document.getElementById('nhName').value.trim();
  const city = document.getElementById('nhCity').value.trim();
  const type = document.getElementById('nhType').value;
  const students = document.getElementById('nhStudents').value;
  const icon = document.getElementById('nhIcon').value.trim() || '🏫';
  const adminName = document.getElementById('nhAdminName').value.trim();
  const adminPhone = document.getElementById('nhAdminPhone').value.trim();
  const adminEmail = document.getElementById('nhAdminEmail').value.trim().toLowerCase();
  const adminPass = document.getElementById('nhAdminPass').value;
  const errEl = document.getElementById('nhErr'); errEl.style.display = 'none';
  if (!name || !city || !adminName || !adminEmail || !adminPass) { errEl.textContent = 'Please fill all required fields.'; errEl.style.display = 'block'; return; }
  try {
    const data = await api('POST', '/hostels', { name, city, type, totalStudents: students, icon, adminName, adminPhone, adminEmail, adminPass });
    _allHostels = [];
    closeAddHostelModal();
    toast('🎉', `"${name}" added! Admin: ${adminEmail}`);
    selectAuthHostel(data.hostel.id, icon, name, city, students || 100);
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

// ── FORGOT PASSWORD ──────────────────────────────────────
async function sendOTP() {
  const email = document.getElementById('fpEmail').value.trim().toLowerCase();
  if (!email) { showAuthErr('Please enter your email.'); return; }
  try {
    const data = await api('POST', '/auth/forgot', { email });
    forgotEmail = email;
    forgotOTP = data.otp; // demo only
    document.getElementById('fpEmailDisplay').textContent = email;
    document.getElementById('fpStep1').style.display = 'none';
    document.getElementById('fpStep2').style.display = '';
    ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach(id => document.getElementById(id).value = '');
    showAuthOk(`✅ OTP sent! (Demo OTP: ${data.otp})`);
    toast('📧', 'OTP sent to ' + email + ' (Demo: ' + data.otp + ')');
  } catch (e) { showAuthErr(e.message); }
}
function otpNext(el, nextId) { if (el.value && nextId) document.getElementById(nextId)?.focus(); }
function otpBack(e, prevId) { if (e.key === 'Backspace' && !e.target.value && prevId) document.getElementById(prevId)?.focus(); }
function verifyOTP() {
  const entered = ['otp1','otp2','otp3','otp4','otp5','otp6'].map(id => document.getElementById(id).value).join('');
  if (entered.length !== 6) { showAuthErr('Please enter the complete 6-digit OTP.'); return; }
  if (entered !== forgotOTP) { showAuthErr('Incorrect OTP. Please try again.'); return; }
  document.getElementById('fpStep2').style.display = 'none';
  document.getElementById('fpStep3').style.display = '';
  clearAuthMsg(); showAuthOk('✅ OTP verified! Set your new password.');
}
async function resetPassword() {
  const np = document.getElementById('fpNewPass').value;
  const cp = document.getElementById('fpConfPass').value;
  if (!np || !cp) { showAuthErr('Please fill both fields.'); return; }
  if (np.length < 6) { showAuthErr('Password must be at least 6 characters.'); return; }
  if (np !== cp) { showAuthErr('Passwords do not match.'); return; }
  try {
    await api('POST', '/auth/reset-password', { email: forgotEmail, otp: forgotOTP, newPassword: np });
    showAuthOk('🎉 Password reset successful! Please login.');
    setTimeout(() => switchAuthTab('login'), 2000);
    toast('✅', 'Password reset successful!');
    forgotOTP = null; forgotEmail = null;
    document.getElementById('fpStep3').style.display = 'none';
    document.getElementById('fpStep1').style.display = '';
  } catch (e) { showAuthErr(e.message); }
}

// ── LOGOUT ───────────────────────────────────────────────
async function doLogout() {
  try { await api('POST', '/auth/logout'); } catch (e) {}
  TOKEN = null;
  localStorage.removeItem('hh_token');
  currentUser = null;
  toast('👋', 'Logged out!');
  setTimeout(() => location.reload(), 800);
}

// ── ON LOGGED IN ─────────────────────────────────────────
async function onLoggedIn(bonusInfo) {
  // Load all needed data
  try {
    const [mealtimes, menus, facilities, suggestions, navconfig, voteStatus] = await Promise.all([
      api('GET', '/mealtimes'),
      api('GET', '/menus'),
      api('GET', '/facilities'),
      api('GET', '/suggestions'),
      api('GET', '/navconfig'),
      api('GET', '/vote/status'),
    ]);
    DB_MEALTIMES = mealtimes;
    DB_MENUS = menus;
    DB_FACILITIES = facilities;
    DB_SUGGESTIONS = suggestions;
    DB_NAV = navconfig;
    DB_VOTED = voteStatus.voted;
  } catch (e) { console.error('Data load error:', e); }

  if (currentUser.role === 'admin') {
    try { DB_STUDENTS = await api('GET', '/students'); } catch (e) {}
  }

  renderNavTabs();
  updateNavUser();
  updateHostelDisplay();

  document.getElementById('verifyWarning').style.display = (currentUser.role !== 'admin' && !currentUser.isVerified) ? 'block' : 'none';
  document.getElementById('hostelWarning').style.display = (!currentHostelId) ? 'block' : 'none';
  document.getElementById('adminResetSection').style.display = currentUser.role === 'admin' ? '' : 'none';

  if (currentUser.role !== 'admin' && !currentUser.isVerified) {
    document.getElementById('unverifiedFoodMsg').style.display = 'block';
    document.getElementById('unverifiedRatingMsg').style.display = 'block';
    document.getElementById('unverifiedFeedbackMsg').style.display = 'block';
  }

  refreshCreditUI();
  renderFoodCards();
  renderFacilities();
  updateAllSlotStatuses();
  renderSweetDays();
  renderSweetLeaderboard();
  renderSweetEligibility();
  renderRatingCards();
  updateCountdown();
  renderVotingWindowPanels();
  setTodayDate();

  setInterval(updateCountdown, 1000);
  setInterval(() => { updateAllSlotStatuses(); renderVotingWindowPanels(); }, 30000);

  if (currentUser.role === 'admin') {
    renderAdminPanel();
    renderAdminMenu();
    renderAdminFacilities();
    renderNavMenuEditor();
  }

  document.getElementById('statCredits').textContent = currentUser.credits;
  document.getElementById('statSweet').textContent = (currentUser.sweetUsedThisMonth || 0) + '/' + SWEET_FREE_PER_MONTH;
  document.getElementById('statVotes').textContent = currentUser.todayVoteCount || 0;

  // Show bonus popup on login
  if (bonusInfo && bonusInfo.type !== 'none') {
    showBonusGift(bonusInfo);
  } else {
    // Show regular daily bonus toast
    toast('🌅', `+10 daily login bonus! Credits: ${currentUser.credits}`);
  }

  // Show today's bonus banner on home
  renderBonusBanner();
}

// ── BONUS BANNER (Home page) ─────────────────────────────
function renderBonusBanner() {
  const info = getTodayBonusInfo();
  const el = document.getElementById('bonusBannerSection');
  if (!el) return;
  const today = new Date();
  const isSunday = today.getDay() === 0;
  const ymd = today.toISOString().slice(0, 10);
  const isFestival = FESTIVAL_DATES.includes(ymd);
  const festName = FESTIVAL_NAMES[ymd] || '';

  if (isFestival) {
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(255,184,106,.15),rgba(255,106,155,.12));border:1.5px solid rgba(255,184,106,.4);border-radius:20px;padding:18px 22px;margin-bottom:20px;animation:float 4s ease-in-out infinite">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="font-size:2.5rem">🎉</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1rem">${festName} — Special Festival Day!</div>
            <div style="color:var(--text2);font-size:.82rem;margin-top:3px">You received <strong style="color:var(--accent4)">+${info.bonus} Festival Bonus Credits</strong> for logging in today! Enjoy something special this festive day 🍛🎊</div>
          </div>
          <div style="margin-left:auto;text-align:center">
            <div style="font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--accent4),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent">+${info.bonus}</div>
            <div style="font-size:.7rem;color:var(--text2)">bonus credits</div>
          </div>
        </div>
      </div>`;
  } else if (isSunday) {
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(124,106,255,.12),rgba(106,255,184,.08));border:1.5px solid rgba(124,106,255,.35);border-radius:20px;padding:18px 22px;margin-bottom:20px;animation:float 4s ease-in-out infinite">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="font-size:2.5rem">🌟</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1rem">Sunday Bonus Day! 🎉</div>
            <div style="color:var(--text2);font-size:.82rem;margin-top:3px">Every Sunday you earn <strong style="color:var(--accent3)">+4 Bonus Credits</strong> — treat yourself to something special today! 🍕🎂</div>
          </div>
          <div style="margin-left:auto;text-align:center">
            <div style="font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent3));-webkit-background-clip:text;-webkit-text-fill-color:transparent">+4</div>
            <div style="font-size:.7rem;color:var(--text2)">sunday bonus</div>
          </div>
        </div>
      </div>`;
  } else {
    // Show upcoming bonus info
    const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
    el.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:1.6rem">📅</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.88rem">Upcoming Bonus Days</div>
          <div style="font-size:.76rem;color:var(--text2);margin-top:3px">
            🌟 Sunday bonus (+4 cr) — <strong style="color:var(--accent)">${daysUntilSunday} day${daysUntilSunday > 1 ? 's' : ''}</strong> away &nbsp;|&nbsp; 🎉 Festival bonuses (+6 cr) also available on special days!
          </div>
        </div>
      </div>`;
  }
}

// ── BONUS GIFT POPUP ─────────────────────────────────────
function showBonusGift(bonusInfo) {
  const overlay = document.getElementById('giftOverlay');
  const emoji = document.getElementById('giftEmoji');
  const title = document.getElementById('giftTitle');
  const desc = document.getElementById('giftDesc');

  if (bonusInfo.type === 'festival') {
    const festName = bonusInfo.label.replace('🎉 ', '').replace(' Bonus', '');
    emoji.textContent = '🎉';
    title.textContent = 'Festival Bonus Credits!';
    desc.innerHTML = `Today is <strong>${festName}</strong>!<br>You got <strong style="color:var(--accent4);font-size:1.2rem">+${bonusInfo.bonus} extra credits</strong> as a festival bonus.<br><br>Enjoy something special today! 🍛🎊`;
  } else if (bonusInfo.type === 'sunday') {
    emoji.textContent = '🌟';
    title.textContent = 'Sunday Bonus!';
    desc.innerHTML = `You got <strong style="color:var(--accent3);font-size:1.2rem">+4 extra credits</strong> today!<br><br>Every Sunday earns you a bonus — treat yourself to something special! 🍕🎂`;
  }
  overlay.classList.add('show');
}

// ── NAV ──────────────────────────────────────────────────
function renderNavTabs() {
  const container = document.getElementById('mainNavTabs');
  const visibleTabs = (DB_NAV || []).filter(t => t.visible);
  let html = visibleTabs.map(t => `<button class="nav-tab" onclick="showPage('${t.id}')">${t.label}</button>`).join('');
  if (currentUser?.role === 'admin') html += `<button class="nav-tab" id="adminNavTab" onclick="showPage('admin')">🛡 Admin</button>`;
  container.innerHTML = html;
  const active = document.querySelector('.page.active');
  if (active) {
    const id = active.id.replace('page-', '');
    document.querySelectorAll('.nav-tab').forEach(t => { if ((t.getAttribute('onclick') || '').includes("'" + id + "'")) t.classList.add('active'); });
  }
}

function updateNavUser() { document.getElementById('navCredits').textContent = currentUser?.credits || 0; }

function updateHostelDisplay() {
  const h = _allHostels.find(x => x.id === currentHostelId);
  const chip = document.getElementById('hostelChip');
  if (h) {
    const short = h.name.length > 20 ? h.name.substring(0, 20) + '…' : h.name;
    chip.innerHTML = (h.icon || '🏠') + ' ' + short;
    chip.style.color = 'var(--accent3)';
    chip.style.borderColor = 'rgba(106,255,184,.3)';
  } else { chip.innerHTML = '🏠 Select Hostel'; chip.style.color = ''; }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => { if ((t.getAttribute('onclick') || '').includes("'" + id + "'")) t.classList.add('active'); });
  if (id === 'admin') { renderAdminPanel(); renderAdminMenu(); renderAdminFacilities(); renderNavMenuEditor(); }
  if (id === 'credits') { refreshCreditUI(); }
  if (id === 'home') renderBonusBanner();
}

function openSettings() {
  if (!currentUser) return;
  const u = currentUser;
  document.getElementById('profileAvatar').textContent = u.name.charAt(0).toUpperCase();
  document.getElementById('profileName').textContent = u.name;
  const rt = document.getElementById('profileRoleTag');
  rt.textContent = u.role === 'admin' ? '🛡 Admin' : '👤 Student';
  rt.className = 'role-tag ' + u.role;
  document.getElementById('profileVerifyBadge').innerHTML = u.isVerified ? '<span class="verified-badge">✅ Verified</span>' : '<span class="pending-badge">⏳ Pending Verification</span>';
  document.getElementById('profileHostelDisplay').textContent = '🏠 ' + (u.institutionName || '—');
  const statsRow = document.getElementById('profileStatsRow');
  if (u.role !== 'admin') {
    statsRow.style.display = 'grid';
    document.getElementById('psCredits').textContent = u.credits;
    document.getElementById('psSweet').textContent = u.sweetUsedThisMonth || 0;
    document.getElementById('psVotes').textContent = u.todayVoteCount || 0;
  } else { statsRow.style.display = 'none'; }
  // Fill profile info fields
  const fields = { piName: u.name, piEmail: u.email, piPhone: u.phone || '—', piRoom: u.roomNumber || '—', piRoll: u.studentId || '—', piHostel: u.institutionName || '—' };
  Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }

function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('hhTheme', root.dataset.theme);
}

// ── VOTING WINDOW PANELS ─────────────────────────────────
function renderVotingWindowPanels() {
  const container = document.getElementById('votingWindowPanels'); if (!container) return;
  const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes();
  const slots = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const emojis = { breakfast: '☕', lunch: '🍛', snacks: '🫖', dinner: '🌙' };
  container.innerHTML = slots.map(slot => {
    const meal = DB_MEALTIMES[slot];
    const open = ((meal - VOTE_OPEN_BEFORE) % 1440 + 1440) % 1440;
    const close = ((meal - VOTE_CLOSE_BEFORE) % 1440 + 1440) % 1440;
    const inOpen = isInWindow(nowM, open, close);
    const isPast = nowM >= meal;
    const voted = DB_VOTED[slot];
    let state = 'closed', badge = 'closed', dotClass = 'closed-dot';
    if (voted || isPast) { state = 'past'; badge = 'past'; dotClass = 'past-dot'; }
    else if (inOpen) { state = 'open'; badge = 'open'; dotClass = ''; }
    const prog = isPast || voted ? 100 : inOpen ? windowProgress(nowM, open, close) : 0;
    const fillClass = state === 'open' ? 'open-fill' : state === 'past' ? 'past-fill' : '';
    const dur = minsUntil(open, close); const dH = Math.floor(dur / 60), dM = dur % 60;
    return `<div class="voting-window-card ${state}">
      <div class="vw-header">
        <div class="vw-title"><div class="vw-live-dot ${dotClass}"></div>${emojis[slot]} ${slot.charAt(0).toUpperCase() + slot.slice(1)}</div>
        <span class="vw-badge ${badge}">${voted ? '✅ Voted' : state === 'past' ? '✅ Done' : state === 'open' ? '🟢 Voting Open' : '🔒 Closed'}</span>
      </div>
      <div class="vw-time-range">${fmtMins(open)} → ${fmtMins(close)}</div>
      <div class="vw-bar-outer"><div class="vw-bar-fill ${fillClass}" style="width:${prog}%"></div></div>
      <div class="vw-timestamps"><span>${fmtMins(open)}</span><span>${prog}%</span><span>${fmtMins(close)}</span></div>
      <div class="vw-meal-duration">🍽 Meal at <strong>${fmtMins(meal)}</strong> &nbsp;|&nbsp; Window: <strong>${dH}h ${dM}m</strong></div>
    </div>`;
  }).join('');
}

// ── DATE PICKER ───────────────────────────────────────────
function setTodayDate() {
  const t = new Date();
  const el = document.getElementById('foodDatePicker');
  if (el) el.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// ── FOOD VOTE ─────────────────────────────────────────────
function updateAllSlotStatuses() {
  ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(slot => {
    const s = getSlotStatus(slot);
    const el = document.getElementById('slotStatus-' + slot);
    if (el) { el.textContent = s.msg; el.style.color = s.state === 'open' || s.state === 'voted' ? 'var(--accent3)' : 'var(--text2)'; }
    // Update vote counts
    const vc = document.getElementById('votes-' + slot);
    if (vc && DB_MENUS[slot]) {
      const total = DB_MENUS[slot].reduce((s, f) => s + (f.votes || 0), 0);
      vc.textContent = total + ' votes';
    }
  });
}

function selectSlot(el, slot) {
  document.querySelectorAll('.meal-slot-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeSlot = slot;
  selectedFood = null;
  renderFoodCards();
  updateDeadlineBanner();
}

function updateDeadlineBanner() {
  const banner = document.getElementById('deadlineBanner');
  const btn = document.getElementById('submitVoteBtn');
  const s = getSlotStatus(activeSlot);
  banner.style.display = 'block';
  if (s.state === 'voted') {
    banner.style.cssText = 'display:block;background:rgba(106,255,184,.1);border-color:rgba(106,255,184,.4);color:var(--accent3);padding:10px 14px;border-radius:12px;font-size:.8rem;font-weight:500;border:1.5px solid;margin-bottom:14px';
    banner.innerHTML = '<strong>✅ You already voted for this meal today!</strong>'; btn.disabled = true;
  } else if (s.state === 'closed' || s.state === 'past') {
    banner.style.cssText = 'display:block;background:rgba(255,106,155,.1);border-color:rgba(255,106,155,.4);color:var(--accent2);padding:10px 14px;border-radius:12px;font-size:.8rem;font-weight:500;border:1.5px solid;margin-bottom:14px';
    banner.innerHTML = '<strong>🔒 Voting closed for this meal.</strong>'; btn.disabled = true;
  } else if (s.state === 'notyet') {
    banner.style.cssText = 'display:block;background:rgba(124,106,255,.1);border-color:rgba(124,106,255,.4);color:var(--accent);padding:10px 14px;border-radius:12px;font-size:.8rem;font-weight:500;border:1.5px solid;margin-bottom:14px';
    banner.innerHTML = '<strong>⏳ ' + s.msg + '</strong>'; btn.disabled = true;
  } else if (s.canVote) {
    banner.style.cssText = 'display:block;background:rgba(255,184,106,.1);border-color:rgba(255,184,106,.4);color:var(--accent4);padding:10px 14px;border-radius:12px;font-size:.8rem;font-weight:500;border:1.5px solid;margin-bottom:14px';
    banner.innerHTML = '<strong>' + s.msg + '</strong>';
    btn.disabled = (!currentUser?.isVerified && currentUser?.role !== 'admin') || !currentHostelId;
  } else { banner.style.display = 'none'; btn.disabled = false; }
}

function renderFoodCards() {
  const grid = document.getElementById('voteGrid');
  const items = DB_MENUS[activeSlot] || [];
  const total = items.reduce((s, f) => s + (f.votes || 0), 0);
  grid.innerHTML = items.map(f => `
    <div class="food-card${selectedFood === f.id ? ' selected' : ''}" id="fc-${f.id}" onclick="selectFood('${f.id}')">
      ${f.free ? '<div class="free-badge">FREE</div>' : ''}
      <span style="font-size:2.2rem;margin-bottom:8px;display:block">${f.emoji}</span>
      <div style="font-family:'Syne',sans-serif;font-size:.95rem;font-weight:700;margin-bottom:4px">${f.name}</div>
      <div style="color:var(--text2);font-size:.76rem;margin-bottom:10px;line-height:1.4">${f.desc}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <span style="background:var(--bg3);border-radius:50px;padding:2px 9px;font-size:.68rem;color:var(--accent4)">${f.credits === 0 ? '🎁 Free' : '💰 +' + f.credits + ' cr extra'}</span>
        <span style="background:var(--bg3);border-radius:50px;padding:2px 9px;font-size:.68rem;color:var(--accent3)">🥗 ${f.nutri}/10</span>
      </div>
      <div class="vote-bar-wrap">
        <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text2);margin-bottom:4px">
          <span>${f.votes} votes</span><span>${total ? Math.round(f.votes / total * 100) : 0}%</span>
        </div>
        <div class="vote-bar"><div class="vote-bar-fill" style="width:${total ? f.votes / total * 100 : 0}%"></div></div>
      </div>
    </div>`).join('');
  updateDeadlineBanner();
}

function selectFood(id) {
  selectedFood = id;
  document.querySelectorAll('.food-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('fc-' + id)?.classList.add('selected');
}

async function submitVote() {
  if (!currentUser) { toast('⚠️', 'Please login first!'); return; }
  if (!currentHostelId) { toast('❌', 'Please select your hostel first!'); return; }
  if (!currentUser.isVerified && currentUser.role !== 'admin') { toast('❌', 'Admin verification required to vote.'); return; }
  if (!selectedFood) { toast('⚠️', 'Please select a food item first!'); return; }
  if (DB_VOTED[activeSlot]) { toast('ℹ️', 'Already voted for this meal today!'); return; }
  const s = getSlotStatus(activeSlot);
  if (!s.canVote) { toast('❌', 'Voting is not open for this slot right now.'); return; }
  try {
    const data = await api('POST', '/vote', { slot: activeSlot, foodId: selectedFood });
    currentUser = data.user;
    DB_VOTED[activeSlot] = true;
    const food = (DB_MENUS[activeSlot] || []).find(f => f.id === selectedFood);
    if (food) food.votes = (food.votes || 0) + 1;
    document.getElementById('statVotes').textContent = currentUser.todayVoteCount || 0;
    updateNavUser();
    renderFoodCards();
    updateDeadlineBanner();
    updateAllSlotStatuses();
    refreshCreditUI();
    toast('✅', `Vote submitted for ${food?.name || 'item'}!`);
    selectedFood = null;
  } catch (e) { toast('❌', e.message || 'Vote failed.'); }
}

// ── SUGGEST FOOD ─────────────────────────────────────────
function openSuggestFood() {
  if (!currentUser) { toast('⚠️', 'Please login first!'); showAuthPage(); return; }
  if (!currentUser.isVerified && currentUser.role !== 'admin') { toast('❌', 'Verification required to suggest food.'); return; }
  renderSuggestions();
  document.getElementById('suggestFoodModal').classList.add('open');
}
function closeSuggestFood() { document.getElementById('suggestFoodModal').classList.remove('open'); }

function renderSuggestions() {
  const list = document.getElementById('suggestionsList');
  if (!DB_SUGGESTIONS.length) { list.innerHTML = '<div style="color:var(--text2);font-size:.82rem;padding:8px">No suggestions yet. Be the first!</div>'; return; }
  list.innerHTML = DB_SUGGESTIONS.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:12px;margin-bottom:8px">
      <span style="font-size:1.4rem">${s.emoji}</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:.85rem">${s.name} <span style="background:var(--card);border-radius:50px;padding:2px 8px;font-size:.68rem;color:var(--text2);text-transform:capitalize">${s.slot}</span></div>
        <div style="font-size:.74rem;color:var(--text2);margin-top:2px">${s.reason}</div>
      </div>
      <div style="text-align:center">
        <div style="font-family:'Syne',sans-serif;font-size:1rem;font-weight:700;color:var(--accent4)">${s.votes}</div>
        <button class="btn-sm btn-outline" style="font-size:.68rem;padding:3px 9px;margin-top:3px" onclick="upvoteSuggestion('${s.id}')">👍 Upvote</button>
      </div>
    </div>`).join('');
}

async function upvoteSuggestion(id) {
  if (!currentUser) { toast('⚠️', 'Please login first!'); return; }
  try {
    const data = await api('POST', `/suggestions/${id}/upvote`);
    const s = DB_SUGGESTIONS.find(x => x.id === id);
    if (s) s.votes = data.votes;
    renderSuggestions();
    toast('👍', 'Upvoted! ' + data.votes + ' votes now.');
  } catch (e) { toast('ℹ️', e.message); }
}

async function submitSuggestion() {
  if (!currentUser) { toast('⚠️', 'Please login first!'); return; }
  const slot = document.getElementById('suggestSlot').value;
  const emoji = document.getElementById('suggestEmoji').value.trim() || '🍽';
  const name = document.getElementById('suggestName').value.trim();
  const reason = document.getElementById('suggestReason').value.trim();
  if (!name) { toast('⚠️', 'Please enter a food name!'); return; }
  try {
    const data = await api('POST', '/suggestions', { slot, emoji, name, reason });
    DB_SUGGESTIONS.unshift(data.suggestion);
    document.getElementById('suggestName').value = '';
    document.getElementById('suggestReason').value = '';
    document.getElementById('suggestEmoji').value = '';
    renderSuggestions();
    renderAdminSuggestions();
    toast('✅', `"${name}" suggestion submitted!`);
  } catch (e) { toast('❌', e.message); }
}

// ── RATINGS ──────────────────────────────────────────────
function renderRatingCards() {
  const grid = document.getElementById('ratingGrid');
  const disabled = !currentUser?.isVerified && currentUser?.role !== 'admin';
  grid.innerHTML = RATING_CATS.map(r => `
    <div class="rating-card fade-up">
      <div style="font-size:1.8rem;margin-bottom:8px">${r.icon}</div>
      <div style="font-family:'Syne',sans-serif;font-size:.95rem;font-weight:700;margin-bottom:3px">${r.name}</div>
      <div style="color:var(--text2);font-size:.78rem;margin-bottom:12px">${r.desc}</div>
      <div class="stars" id="stars-${r.id}">
        ${[1, 2, 3, 4, 5].map(n => `<span class="star${(userRatings[r.id] || 0) >= n ? ' active' : ''}" onclick="${disabled ? "toast('❌','Verification required.')" : "setRating('" + r.id + "'," + n + ')'}">⭐</span>`).join('')}
      </div>
      <div style="font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,var(--accent4),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${userRatings[r.id] ? userRatings[r.id] + '.0' : '—'}</div>
    </div>`).join('');
}

function setRating(cat, val) {
  if (!currentUser?.isVerified && currentUser?.role !== 'admin') { toast('❌', 'Verification required.'); return; }
  userRatings[cat] = val; renderRatingCards();
}

async function submitRatings() {
  if (!currentUser?.isVerified && currentUser?.role !== 'admin') { toast('❌', 'Admin verification required.'); return; }
  if (Object.keys(userRatings).length < 3) { toast('⚠️', 'Please rate at least 3 categories!'); return; }
  const avg = (Object.values(userRatings).reduce((s, v) => s + v, 0) / Object.keys(userRatings).length).toFixed(1);
  document.getElementById('overallScore').textContent = avg;
  try { await api('POST', '/ratings', { ratings: userRatings }); } catch (e) {}
  if (parseFloat(avg) < 3.5) toast('🚨', 'Score below 3.5! Management alert sent.');
  else toast('✅', 'Ratings submitted!');
}

// ── CREDITS ──────────────────────────────────────────────
async function refreshCreditUI() {
  if (!currentUser) return;
  const cr = currentUser.credits || 0;
  const mc = currentUser.monthlyCredits || calcMonthlyCredits();
  const pct = mc > 0 ? Math.round(cr / mc * 100) : 0;
  document.getElementById('walletAmount').textContent = cr;
  document.getElementById('walletSub').textContent = 'of ' + mc + ' monthly credits';
  document.getElementById('creditFill').style.width = pct + '%';
  document.getElementById('walletSpent').textContent = (mc - cr) + ' spent';
  document.getElementById('walletTotal').textContent = mc + ' total';
  document.getElementById('navCredits').textContent = cr;
  document.getElementById('statCredits').textContent = cr;
  const n = new Date(); const dayOfMonth = n.getDate(); const daysIn = getDaysInMonth(n.getFullYear(), n.getMonth());
  const expected = Math.round((daysIn - dayOfMonth) / daysIn * mc);
  const paceEl = document.getElementById('spendingPace');
  if (paceEl) {
    if (cr >= expected) { paceEl.innerHTML = '✅ <strong style="color:var(--accent3)">On track!</strong> Saving ' + (cr - expected) + ' more credits than expected.'; paceEl.style.cssText = 'border-radius:14px;padding:12px 16px;margin-bottom:18px;border:1.5px solid rgba(106,255,184,.3);background:rgba(106,255,184,.06);font-size:.83rem;line-height:1.6'; }
    else { paceEl.innerHTML = '⚠️ <strong style="color:var(--accent4)">Slightly over budget.</strong> Consider extra items carefully.'; paceEl.style.cssText = 'border-radius:14px;padding:12px 16px;margin-bottom:18px;border:1.5px solid rgba(255,184,106,.3);background:rgba(255,184,106,.06);font-size:.83rem;line-height:1.6'; }
  }
  await renderCreditHistory();
}

async function renderCreditHistory() {
  const el = document.getElementById('creditHistory'); if (!el) return;
  try {
    const history = await api('GET', '/credits/history');
    if (!history.length) { el.innerHTML = '<div style="color:var(--text2);text-align:center;padding:20px">No credit history yet.</div>'; return; }
    el.innerHTML = history.map(h => `
      <div class="ch-item">
        <div class="ch-dot ${h.type}"></div>
        <div style="flex:1"><div style="font-size:.85rem;font-weight:500">${h.title}</div><div style="font-size:.7rem;color:var(--text2);margin-top:2px">${h.date}</div></div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;color:${h.type === 'earn' ? 'var(--accent3)' : h.type === 'deduct' ? 'var(--accent4)' : h.type === 'spend' ? 'var(--accent2)' : 'var(--accent)'}">${h.amount > 0 ? '+' + h.amount : h.amount === 0 ? 'FREE' : h.amount}</div>
      </div>`).join('');
  } catch (e) {}
}

function updateCountdown() {
  const n = new Date(); const next = new Date(n.getFullYear(), n.getMonth() + 1, 1); const diff = next - n; if (diff <= 0) return;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24)), h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)), m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)), s = Math.floor((diff % (1000 * 60)) / 1000);
  const p = (v) => String(v).padStart(2, '0');
  ['cd-days', 'cd-hours', 'cd-mins', 'cd-secs'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = p([d, h, m, s][i]); });
}

function confirmManualReset() {
  if (!currentUser || currentUser.role !== 'admin') { toast('❌', 'Admin only!'); return; }
  document.getElementById('resetConfirmOverlay').style.display = 'flex';
}

async function executeReset() {
  document.getElementById('resetConfirmOverlay').style.display = 'none';
  try {
    const data = await api('POST', '/credits/reset');
    toast('🔄', `Credits reset! ${data.monthlyCredits} credits given to all students.`);
    renderAdminPanel();
    refreshCreditUI();
  } catch (e) { toast('❌', e.message); }
}

// ── FACILITIES ────────────────────────────────────────────
function renderFacilities() {
  document.getElementById('facilityGrid').innerHTML = DB_FACILITIES.map(f => `
    <div class="facility-card fade-up">
      <div style="font-size:2rem;margin-bottom:8px">${f.icon}</div>
      <div style="font-family:'Syne',sans-serif;font-size:.92rem;font-weight:700;margin-bottom:7px">${f.title}</div>
      <div class="fac-status ${f.status}" style="margin-bottom:8px"><div class="fac-dot"></div>${f.label}</div>
      <div style="color:var(--text2);font-size:.78rem;line-height:1.5">${f.desc}</div>
    </div>`).join('');
}

async function submitMaintenance() {
  const room = document.getElementById('mainRoom').value;
  const desc = document.getElementById('mainDesc').value;
  const type = document.getElementById('mainType').value;
  if (!room || !desc) { toast('⚠️', 'Room number and description are required!'); return; }
  try {
    await api('POST', '/maintenance', { room, desc, type });
    toast('🔧', 'Maintenance request submitted!');
    document.getElementById('mainRoom').value = '';
    document.getElementById('mainDesc').value = '';
  } catch (e) { toast('❌', e.message); }
}

// ── SWEET ─────────────────────────────────────────────────
function renderSweetDays() {
  const grid = document.getElementById('sweetDaysGrid'); if (!grid) return;
  const today = new Date().getDate();
  grid.innerHTML = sweetDays.map(sd => {
    const isToday = sd.day === today; const isPast = sd.day < today;
    let cls = 'sweet-day-card'; if (isToday) cls += ' today'; else if (isPast) cls += ' used';
    return `<div class="${cls}"><div style="font-size:1.6rem;margin-bottom:4px">${sd.emoji}</div><div class="sweet-day-num">${sd.day}</div><div style="font-size:.72rem;font-weight:700;color:var(--accent4);margin-top:2px">${new Date().toLocaleString('en-US', { month: 'long' })}</div><div style="font-size:.65rem;margin-top:4px;font-weight:600;color:${isToday ? 'var(--accent3)' : 'var(--text2)'}">${isToday ? '🟢 Today!' : isPast ? '✅ Past' : '⏳ Upcoming'}</div></div>`;
  }).join('');
}

function renderSweetLeaderboard() {
  const el = document.getElementById('sweetLeaderboard'); if (!el) return;
  // Use students data if available
  const data = DB_STUDENTS.length ? [...DB_STUDENTS].sort((a, b) => b.credits - a.credits).slice(0, 5) : [];
  if (!data.length) { el.innerHTML = '<div style="color:var(--text2);font-size:.82rem;padding:8px">No data yet.</div>'; return; }
  const rankClass = (i) => i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : 'rn';
  el.innerHTML = data.map((s, i) => `
    <div class="lb-row">
      <div class="lb-rank ${rankClass(i)}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:.82rem;flex-shrink:0">${s.name.charAt(0)}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:.85rem">${s.name}</div><div style="font-size:.7rem;color:var(--text2)">Room ${s.room || '—'}</div></div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--accent4);font-size:.9rem">${s.credits} cr</div>
    </div>`).join('');
}

function renderSweetEligibility() {
  const el = document.getElementById('sweetEligibility'); if (!el || !currentUser) return;
  const today = new Date().getDate();
  const sweetDay = sweetDays.find(sd => sd.day === today);
  const used = currentUser.sweetUsedThisMonth || 0;
  const eligible = sweetDay && used < SWEET_FREE_PER_MONTH;
  const claimBtn = document.getElementById('sweetClaimBtn');
  if (claimBtn) claimBtn.disabled = !eligible || currentUser.role === 'admin';
  el.innerHTML = `<div style="font-size:.85rem;line-height:1.7">
    ${sweetDay ? `<strong style="color:var(--accent3)">🎉 Today is Sweet Day (${sweetDay.day}th)!</strong>` : `<strong style="color:var(--text2)">Today is not a Sweet Day.</strong>`}
    <br>Used this month: <strong>${used}/${SWEET_FREE_PER_MONTH}</strong>
    ${eligible ? '<br><span style="color:var(--accent3)">✅ Claim karo aaj ka Sweet Bonus (+20 credits)!</span>' : used >= 2 ? '<br><span style="color:var(--text2)">✅ Mahine ke dono sweet days use ho gaye.</span>' : ''}
  </div>`;
}

async function claimSweetCredit() {
  if (!currentUser) { toast('⚠️', 'Please login first!'); return; }
  if (!currentUser.isVerified && currentUser.role !== 'admin') { toast('❌', 'Verification required.'); return; }
  try {
    const data = await api('POST', '/sweet/claim');
    currentUser = data.user;
    renderSweetEligibility();
    updateNavUser();
    refreshCreditUI();
    document.getElementById('giftEmoji').textContent = '🍬';
    document.getElementById('giftTitle').textContent = 'Sweet Day Bonus!';
    document.getElementById('giftDesc').innerHTML = 'You got <strong style="color:var(--accent4);font-size:1.2rem">+20 credits</strong> today!<br>Enjoy any sweet item on the menu — Sweet Day special! 🍰🎂';
    document.getElementById('giftOverlay').classList.add('show');
    toast('🍬', '+20 Sweet Day credits claimed!');
  } catch (e) { toast('❌', e.message); }
}

// ── ADMIN ─────────────────────────────────────────────────
async function renderAdminPanel() {
  if (!currentUser || currentUser.role !== 'admin') return;
  try { DB_STUDENTS = await api('GET', '/students'); } catch (e) {}
  const pending = DB_STUDENTS.filter(s => !s.isVerified);
  const verified = DB_STUDENTS.filter(s => s.isVerified);
  const adminStats = document.getElementById('adminStats');
  if (adminStats) adminStats.innerHTML = [
    { num: pending.length, label: 'Pending Verification', color: 'var(--accent2)' },
    { num: verified.length, label: 'Verified Students', color: 'var(--accent3)' },
    { num: DB_STUDENTS.length, label: 'Total Students', color: 'var(--accent4)' },
    { num: DB_STUDENTS.reduce((s, st) => s + (st.credits || 0), 0), label: 'Total Credits Pool', color: 'var(--accent)' },
  ].map(s => `<div class="stat-card"><div class="stat-num" style="-webkit-text-fill-color:${s.color}">${s.num}</div><div class="stat-label">${s.label}</div></div>`).join('');
  const pList = document.getElementById('pendingList');
  const vList = document.getElementById('verifiedList');
  if (pList) pList.innerHTML = pending.length ? pending.map(s => studentRow(s, false)).join('') : '<div style="color:var(--text2);padding:12px">No pending verifications.</div>';
  if (vList) vList.innerHTML = verified.length ? verified.map(s => studentRow(s, true)).join('') : '<div style="color:var(--text2);padding:12px">No verified students yet.</div>';

  // Admin hostel display
  const h = _allHostels.find(x => x.id === currentHostelId);
  const el = document.getElementById('adminHostelDisplay');
  if (el && h) el.textContent = h.name + ' (' + h.city + ') — ' + h.totalStudents + ' students registered';

  renderAdminCredits();
}

function studentRow(s, isVerified) {
  return `<div class="student-row">
    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:.88rem;flex-shrink:0">${s.name.charAt(0).toUpperCase()}</div>
    <div class="student-info">
      <div style="font-weight:700;font-size:.88rem">${s.name} ${isVerified ? '<span class="verified-badge">✓ Verified</span>' : '<span class="pending-badge">⏳ Pending</span>'}</div>
      <div style="font-size:.72rem;color:var(--text2);margin-top:3px;line-height:1.6">📧 ${s.email} | 📱 ${s.phone || '—'}<br>🚪 Room: ${s.room} | 🪪 ${s.roll} | 💰 ${s.credits} cr</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${!isVerified ? `<button class="verify-btn approve" onclick="verifyStudent('${s.id}',true)">✅ Verify</button>` : `<button class="verify-btn reject" onclick="verifyStudent('${s.id}',false)">🚫 Revoke</button>`}
    </div>
  </div>`;
}

async function verifyStudent(id, approve) {
  try {
    await api('PUT', `/students/${id}/verify`, { approve });
    toast(approve ? '✅' : '🚫', (approve ? 'Verified: ' : 'Unverified: ') + (DB_STUDENTS.find(s => s.id === id)?.name || ''));
    await renderAdminPanel();
  } catch (e) { toast('❌', e.message); }
}

function renderAdminCredits() {
  const adminCreditStats = document.getElementById('adminCreditStats');
  if (adminCreditStats) adminCreditStats.innerHTML = [
    { num: DAILY_COST, label: 'Daily Deduction', color: 'var(--accent4)' },
    { num: calcMonthlyCredits(), label: 'Monthly Allocation', color: 'var(--accent3)' },
    { num: DB_STUDENTS.length, label: 'Students Tracked', color: 'var(--accent)' },
    { num: DB_STUDENTS.reduce((s, st) => s + (st.credits || 0), 0), label: 'Total Credits Pool', color: 'var(--accent2)' },
  ].map(s => `<div class="stat-card"><div class="stat-num" style="-webkit-text-fill-color:${s.color}">${s.num}</div><div class="stat-label">${s.label}</div></div>`).join('');
  const list = document.getElementById('adminCreditList'); if (!list) return;
  list.innerHTML = DB_STUDENTS.map(s => `
    <div class="student-row">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:.88rem;flex-shrink:0">${s.name.charAt(0)}</div>
      <div style="flex:1"><div style="font-weight:700;font-size:.85rem">${s.name}</div><div style="font-size:.72rem;color:var(--text2)">Room: ${s.room} | ${s.credits} credits remaining</div></div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;color:${s.credits > 100 ? 'var(--accent3)' : s.credits > 50 ? 'var(--accent4)' : 'var(--accent2)'}">${s.credits} cr</div>
    </div>`).join('');
}

async function addMenuItem() {
  const slot = document.getElementById('adminMenuSlot').value;
  const emoji = document.getElementById('adminMenuEmoji').value.trim() || '🍽';
  const name = document.getElementById('adminMenuName').value.trim();
  const credits = document.getElementById('adminMenuCredits').value;
  const free = document.getElementById('adminMenuFree').checked;
  if (!name) { toast('⚠️', 'Item name is required!'); return; }
  try {
    const data = await api('POST', '/menus/item', { slot, emoji, name, credits, free });
    if (!DB_MENUS[slot]) DB_MENUS[slot] = [];
    DB_MENUS[slot].push(data.item);
    document.getElementById('adminMenuName').value = '';
    document.getElementById('adminMenuEmoji').value = '';
    document.getElementById('adminMenuCredits').value = '';
    document.getElementById('adminMenuFree').checked = false;
    renderAdminMenu();
    if (activeSlot === slot) renderFoodCards();
    toast('✅', `"${name}" added to ${slot} menu!`);
  } catch (e) { toast('❌', e.message); }
}

async function removeMenuItem(slot, id) {
  try {
    await api('DELETE', `/menus/item/${slot}/${id}`);
    DB_MENUS[slot] = (DB_MENUS[slot] || []).filter(f => f.id !== id);
    renderAdminMenu();
    if (activeSlot === slot) renderFoodCards();
    toast('🗑', 'Menu item removed.');
  } catch (e) { toast('❌', e.message); }
}

function renderAdminMenu() {
  const el = document.getElementById('adminMenuList'); if (!el) return;
  const slots = ['breakfast', 'lunch', 'snacks', 'dinner'];
  el.innerHTML = slots.map(slot => `
    <div class="card" style="margin-bottom:14px">
      <div style="font-family:'Syne',sans-serif;font-weight:700;margin-bottom:12px;text-transform:capitalize">${slot}</div>
      ${(DB_MENUS[slot] || []).map(item => `
        <div class="admin-menu-item">
          <span style="font-size:1.2rem">${item.emoji}</span>
          <div style="flex:1;font-size:.82rem"><strong>${item.name}</strong> — ${item.free ? '🎁 Free (base)' : '+' + item.credits + ' extra credits'}</div>
          <button class="btn-sm btn-danger" style="font-size:.72rem" onclick="removeMenuItem('${slot}','${item.id}')">🗑 Remove</button>
        </div>`).join('')}
      ${!(DB_MENUS[slot] || []).length ? '<div style="color:var(--text2);font-size:.78rem;padding:8px">No items.</div>' : ''}
    </div>`).join('');
}

function renderAdminSuggestions() {
  const el = document.getElementById('adminSuggestionsList'); if (!el) return;
  if (!DB_SUGGESTIONS.length) { el.innerHTML = '<div style="color:var(--text2);font-size:.82rem;padding:8px">No community suggestions yet.</div>'; return; }
  el.innerHTML = DB_SUGGESTIONS.map(s => `
    <div class="admin-menu-item">
      <span style="font-size:1.2rem">${s.emoji}</span>
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:600">${s.name} <span style="background:var(--card);border-radius:50px;padding:1px 7px;font-size:.65rem;color:var(--text2)">${s.slot}</span> <span style="color:var(--accent4);font-size:.72rem">${s.votes} votes</span></div>
        <div style="font-size:.73rem;color:var(--text2)">${s.reason}</div>
      </div>
      <button class="btn-sm btn-success" style="font-size:.72rem" onclick="approveSuggestion('${s.id}')">✅ Add to Menu</button>
      <button class="btn-sm btn-danger" style="font-size:.72rem" onclick="rejectSuggestion('${s.id}')">🗑 Reject</button>
    </div>`).join('');
}

async function approveSuggestion(id) {
  try {
    await api('POST', `/suggestions/${id}/approve`);
    const s = DB_SUGGESTIONS.find(x => x.id === id);
    if (s && DB_MENUS[s.slot]) DB_MENUS[s.slot].push({ id: 'sugg_' + Date.now(), emoji: s.emoji, name: s.name, desc: 'Community suggested', credits: 0, nutri: '7.0', votes: s.votes, free: true });
    DB_SUGGESTIONS = DB_SUGGESTIONS.filter(x => x.id !== id);
    renderAdminSuggestions(); renderAdminMenu();
    if (s && activeSlot === s.slot) renderFoodCards();
    toast('✅', `"${s?.name}" added to ${s?.slot} menu!`);
  } catch (e) { toast('❌', e.message); }
}

async function rejectSuggestion(id) {
  try {
    await api('DELETE', `/suggestions/${id}`);
    DB_SUGGESTIONS = DB_SUGGESTIONS.filter(x => x.id !== id);
    renderAdminSuggestions();
    toast('🗑', 'Suggestion rejected.');
  } catch (e) { toast('❌', e.message); }
}

async function addFacility() {
  const icon = document.getElementById('newFacIcon').value.trim() || '🏗';
  const title = document.getElementById('newFacTitle').value.trim();
  const status = document.getElementById('newFacStatus').value;
  const label = document.getElementById('newFacLabel').value.trim();
  const desc = document.getElementById('newFacDesc').value.trim();
  if (!title || !label) { toast('⚠️', 'Title and label are required!'); return; }
  try {
    const data = await api('POST', '/facilities', { icon, title, status, label, desc });
    DB_FACILITIES.push(data.facility);
    document.getElementById('newFacTitle').value = '';
    document.getElementById('newFacLabel').value = '';
    document.getElementById('newFacDesc').value = '';
    renderFacilities(); renderAdminFacilities();
    toast('✅', `Facility "${title}" added!`);
  } catch (e) { toast('❌', e.message); }
}

async function removeFacility(id) {
  try {
    await api('DELETE', `/facilities/${id}`);
    DB_FACILITIES = DB_FACILITIES.filter(f => f.id !== id);
    renderFacilities(); renderAdminFacilities();
    toast('🗑', 'Facility removed.');
  } catch (e) { toast('❌', e.message); }
}

async function updateFacilityStatus(id, status) {
  try {
    await api('PUT', `/facilities/${id}`, { status });
    const f = DB_FACILITIES.find(x => x.id === id);
    if (f) f.status = status;
    renderFacilities(); renderAdminFacilities();
    toast('✅', 'Status updated!');
  } catch (e) { toast('❌', e.message); }
}

function renderAdminFacilities() {
  const el = document.getElementById('adminFacilitiesList'); if (!el) return;
  el.innerHTML = DB_FACILITIES.map(f => `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <span style="font-size:1.5rem">${f.icon}</span>
        <div style="font-family:'Syne',sans-serif;font-weight:700;flex:1">${f.title}</div>
        <div class="fac-status ${f.status}" style="font-size:.72rem"><div class="fac-dot"></div>${f.label}</div>
      </div>
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:12px">${f.desc}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="form-select" style="flex:1;padding:7px 10px;font-size:.78rem" onchange="updateFacilityStatus('${f.id}',this.value)">
          <option value="ok" ${f.status === 'ok' ? 'selected' : ''}>✅ OK</option>
          <option value="warn" ${f.status === 'warn' ? 'selected' : ''}>⚠️ Warning</option>
          <option value="bad" ${f.status === 'bad' ? 'selected' : ''}>❌ Alert</option>
        </select>
        <button class="btn-sm btn-danger" onclick="removeFacility('${f.id}')">🗑 Remove</button>
      </div>
    </div>`).join('');
}

// ── VOTE TIMES ────────────────────────────────────────────
function renderVotingTimePreview() {
  const slots = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const vals = {
    breakfast: parseInt(document.getElementById('vtBreakfast')?.value) || 450,
    lunch: parseInt(document.getElementById('vtLunch')?.value) || 780,
    snacks: parseInt(document.getElementById('vtSnacks')?.value) || 1020,
    dinner: parseInt(document.getElementById('vtDinner')?.value) || 1200,
  };
  const el = document.getElementById('vtPreview'); if (!el) return;
  el.innerHTML = slots.map(s => {
    const m = vals[s]; const open = ((m - VOTE_OPEN_BEFORE) % 1440 + 1440) % 1440; const close = ((m - VOTE_CLOSE_BEFORE) % 1440 + 1440) % 1440;
    return `<div style="margin-bottom:5px"><strong style="text-transform:capitalize">${s}</strong>: Meal ${fmtMins(m)} | Vote opens <span style="color:var(--accent3)">${fmtMins(open)}</span> | Closes <span style="color:var(--accent2)">${fmtMins(close)}</span></div>`;
  }).join('');
}

async function saveVoteTimes() {
  const breakfast = parseInt(document.getElementById('vtBreakfast').value) || 450;
  const lunch = parseInt(document.getElementById('vtLunch').value) || 780;
  const snacks = parseInt(document.getElementById('vtSnacks').value) || 1020;
  const dinner = parseInt(document.getElementById('vtDinner').value) || 1200;
  try {
    const data = await api('PUT', '/mealtimes', { breakfast, lunch, snacks, dinner });
    DB_MEALTIMES = data.mealTimes;
    updateAllSlotStatuses(); renderVotingTimePreview(); renderVotingWindowPanels();
    toast('💾', 'Voting times saved!');
  } catch (e) { toast('❌', e.message); }
}

// ── NAV MENU EDITOR ───────────────────────────────────────
function renderNavMenuEditor() {
  const el = document.getElementById('navMenuEditor'); if (!el) return;
  el.innerHTML = DB_NAV.map(item => `
    <div class="nav-item-row">
      <label>
        <input type="checkbox" id="navcheck-${item.id}" ${item.visible ? 'checked' : ''} ${item.protected ? 'disabled' : ''} style="accent-color:var(--accent3)">
        <span style="font-size:.85rem;font-weight:500">${item.label}</span>
        ${item.protected ? '<span style="background:rgba(124,106,255,.15);color:var(--accent);font-size:.65rem;padding:2px 8px;border-radius:50px;margin-left:6px">Required</span>' : ''}
      </label>
    </div>`).join('');
}

async function saveNavMenu() {
  DB_NAV.forEach(item => {
    if (!item.protected) { const cb = document.getElementById('navcheck-' + item.id); if (cb) item.visible = cb.checked; }
  });
  try {
    await api('PUT', '/navconfig', { navConfig: DB_NAV });
    renderNavTabs();
    toast('✅', 'Navigation menu updated!');
  } catch (e) { toast('❌', e.message); }
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('adminPanel-' + tab)?.classList.add('active');
  if (btn) btn.classList.add('active');
  if (tab === 'menu') { renderAdminMenu(); renderAdminSuggestions(); }
  if (tab === 'facilities') renderAdminFacilities();
  if (tab === 'vtime') { renderVotingTimePreview(); fillVoteTimeFields(); }
  if (tab === 'credits') renderAdminCredits();
  if (tab === 'navmenu') renderNavMenuEditor();
}

function fillVoteTimeFields() {
  ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(s => {
    const el = document.getElementById('vt' + s.charAt(0).toUpperCase() + s.slice(1));
    if (el) el.value = DB_MEALTIMES[s] || '';
  });
  renderVotingTimePreview();
}

// ── STATS (Home hero) ─────────────────────────────────────
function renderHomeStats() {
  const total = _allHostels.reduce((s, h) => s + (h.totalStudents || 0), 0);
  const el = document.getElementById('statTotalStudents');
  if (el) el.textContent = total.toLocaleString();
}

// ── LANGUAGE (UI only) ───────────────────────────────────
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  toast('🌐', 'Language saved: ' + lang.toUpperCase());
}

// ── INIT ─────────────────────────────────────────────────
(async function init() {
  const savedTheme = localStorage.getItem('hhTheme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  // Load hostels for auth page
  _allHostels = await api('GET', '/hostels').catch(() => []);
  renderHomeStats();

  // If token exists, try auto-login
  if (TOKEN) {
    try {
      const user = await api('GET', '/me');
      currentUser = user;
      currentHostelId = user.hostelId;
      hideAuthPage();
      await onLoggedIn(null);
    } catch (e) {
      // Token expired — show auth
      TOKEN = null;
      localStorage.removeItem('hh_token');
      showAuthPage();
      renderAuthHostels(_allHostels, '');
    }
  } else {
    showAuthPage();
    renderAuthHostels(_allHostels, '');
  }

  // Apply saved vote times to form when admin tab opens
  document.addEventListener('click', function (e) {
    if (e.target.closest('[onclick*="vtime"]')) {
      setTimeout(fillVoteTimeFields, 100);
    }
  });
})();
