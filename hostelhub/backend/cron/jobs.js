const cron = require('node-cron');
const User = require('../models/User');
const mongoose = require('mongoose');
const CreditTransaction = mongoose.model('CreditTransaction');

// DAILY_MEAL_COST = 6 credits per day (1+2+1+2)
// Deducted equally EVERY day whether student ate or not (hostel profit model)
const DAILY_DEDUCT = 6;

function setupCronJobs() {

  // ── DAILY CREDIT DEDUCTION — runs every day at midnight 00:01 ──────
  // Sabke credits se 6 credit daily katenge chahe khaya ho ya nahi
  cron.schedule('1 0 * * *', async () => {
    console.log('⏰ Daily credit deduction running...');
    try {
      const students = await User.find({ role: 'student', isVerified: true, credits: { $gt: 0 } });
      const today = new Date().toISOString().slice(0, 10);

      for (const student of students) {
        const deduct = Math.min(DAILY_DEDUCT, student.credits); // don't go below 0
        student.credits -= deduct;
        await student.save();

        if (deduct > 0) {
          await CreditTransaction.create({
            user: student._id,
            type: 'daily_deduct',
            amount: -deduct,
            description: `📅 Daily deduction (${today}) — ${deduct} credits`
          });
        }
      }
      console.log(`✅ Daily deduction done for ${students.length} students.`);
    } catch (err) {
      console.error('❌ Daily deduction error:', err);
    }
  });

  // ── MONTHLY RESET — runs on 1st of every month at 00:05 ───────────
  cron.schedule('5 0 1 * *', async () => {
    console.log('🔄 Monthly credit reset running...');
    try {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthlyCredits = daysInMonth * 6;

      const students = await User.find({ role: 'student' });
      for (const student of students) {
        student.credits = monthlyCredits;
        student.monthlyCredits = monthlyCredits;
        student.excessCredits = 4;
        student.excessUsedThisMonth = 0;
        student.sweetUsedThisMonth = 0;
        student.lastCreditReset = now;
        await student.save();

        await CreditTransaction.create({
          user: student._id,
          type: 'reset',
          amount: monthlyCredits,
          description: `🔄 Monthly Reset — ${daysInMonth} din × 6 = ${monthlyCredits} credits`
        });
      }
      console.log(`✅ Monthly reset done! ${monthlyCredits} credits for ${students.length} students.`);
    } catch (err) {
      console.error('❌ Monthly reset error:', err);
    }
  });

  // ── LAST SUNDAY SWEET — runs every Sunday at 10:00 AM ─────────────
  // Check if it's last Sunday of the month, give sweet notification
  cron.schedule('0 10 * * 0', async () => {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + 7);
    const isLastSunday = nextSunday.getMonth() !== now.getMonth();

    if (isLastSunday) {
      console.log('🍬 Last Sunday of month — Sweet day! Sabko sweet milega.');
      // In production: send push notifications to all verified students
    }
  });

  console.log('✅ Cron jobs setup complete!');
}

module.exports = setupCronJobs;
