// ══════════════════════════════════════════════════════
// ██  HOSTELHUB — EXPRESS BACKEND (MongoDB Edition)
// ══════════════════════════════════════════════════════
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const crypto    = require('crypto');
const mongoose  = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── HELPERS ─────────────────────────────────────────────
function hashPw(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }
const sessions = new Map();
function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function auth(req,res,next){
  const t=req.headers['x-token'];
  if(!t||!sessions.has(t)) return res.status(401).json({error:'Unauthorized'});
  req.session=sessions.get(t); next();
}
function adminOnly(req,res,next){
  if(req.session.role!=='admin') return res.status(403).json({error:'Admin only'});
  next();
}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function calcMonthlyCredits(){const n=new Date();return getDaysInMonth(n.getFullYear(),n.getMonth())*6;}
const FESTIVAL_DATES=['2026-01-14','2026-03-25','2026-04-06','2026-04-10','2026-08-15','2026-08-19','2026-09-07','2026-10-02','2026-10-20','2026-11-08','2026-11-09','2026-11-10','2026-12-25'];
function getBonusInfo(date){
  const ymd=date.toISOString().slice(0,10);
  if(FESTIVAL_DATES.includes(ymd)) return {type:'festival',bonus:6,label:'🎉 Festival Bonus'};
  if(date.getDay()===0) return {type:'sunday',bonus:4,label:'🌟 Sunday Bonus'};
  return {type:'none',bonus:0,label:''};
}
function safe(user){const u=user.toObject?user.toObject():{...user};delete u.passwordHash;delete u._id;delete u.__v;return u;}

// ── SCHEMAS ─────────────────────────────────────────────
const Hostel     = mongoose.model('Hostel',     new mongoose.Schema({id:String,name:String,city:String,type:String,icon:String,totalStudents:Number}));
const User       = mongoose.model('User',       new mongoose.Schema({id:String,name:String,email:String,phone:String,role:String,isVerified:Boolean,credits:Number,monthlyCredits:Number,sweetUsedThisMonth:Number,roomNumber:String,studentId:String,hostelId:String,institutionName:String,passwordHash:String,todayVoteCount:Number,lastLoginDate:String,lastBonusDate:String}));
const Student    = mongoose.model('Student',    new mongoose.Schema({id:String,name:String,email:String,phone:String,roll:String,room:String,credits:Number,isVerified:Boolean,hostelId:String}));
const MenuItem   = mongoose.model('MenuItem',   new mongoose.Schema({id:String,slot:String,emoji:String,name:String,desc:String,credits:Number,nutri:String,votes:Number,free:Boolean}));
const Facility   = mongoose.model('Facility',   new mongoose.Schema({id:String,icon:String,title:String,status:String,label:String,desc:String}));
const Suggestion = mongoose.model('Suggestion', new mongoose.Schema({id:String,slot:String,emoji:String,name:String,reason:String,votes:Number,votedBy:[String]}));
const CreditHist = mongoose.model('CreditHistory', new mongoose.Schema({type:String,title:String,date:String,amount:Number}));
const Vote       = mongoose.model('Vote',       new mongoose.Schema({key:String}));
const Config     = mongoose.model('Config',     new mongoose.Schema({key:String,value:mongoose.Schema.Types.Mixed}));

// ── SEED ────────────────────────────────────────────────
async function seedIfEmpty(){
  if(await Hostel.countDocuments()>0) return;
  console.log('🌱 Seeding default data...');
  const mc=calcMonthlyCredits();
  await Hostel.insertMany([
    {id:'h1',name:'IIT Delhi — Zanskar Hostel',type:'iit',city:'Delhi',icon:'🏛️',totalStudents:312},
    {id:'h2',name:'IIT Bombay — Hostel 14',type:'iit',city:'Mumbai',icon:'🌊',totalStudents:280},
    {id:'h3',name:'IIT Kanpur — Hall 4',type:'iit',city:'Kanpur',icon:'🏗',totalStudents:256},
    {id:'h4',name:'IIT Madras — Krishna Hostel',type:'iit',city:'Chennai',icon:'🌴',totalStudents:290},
    {id:'h5',name:'Medicaps University Hostel',type:'private',city:'Indore',icon:'🏥',totalStudents:420},
    {id:'h6',name:'IET Indore — Boys Hostel',type:'private',city:'Indore',icon:'⚡',totalStudents:380},
    {id:'h7',name:'NIT Trichy — Cauvery Hostel',type:'govt',city:'Trichy',icon:'🌊',totalStudents:340},
    {id:'h8',name:'BITS Pilani — Ram Bhawan',type:'govt',city:'Pilani',icon:'⭐',totalStudents:268},
    {id:'h9',name:'Delhi University — Mansarovar',type:'govt',city:'Delhi',icon:'🦚',totalStudents:220},
    {id:'h10',name:'Stanza Living — Belvedere',type:'private',city:'Bangalore',icon:'🏢',totalStudents:180},
  ]);
  await User.insertMany([
    {id:'u1',name:'Admin Kumar',email:'admin@hostel.com',phone:'9000011111',role:'admin',isVerified:true,credits:0,monthlyCredits:0,sweetUsedThisMonth:0,roomNumber:'Office',studentId:'ADMIN001',hostelId:'h6',institutionName:'IET Indore — Boys Hostel',passwordHash:hashPw('admin123'),todayVoteCount:0,lastLoginDate:'',lastBonusDate:''},
    {id:'u2',name:'Ayush Singh',email:'student@hostel.com',phone:'9876543210',role:'student',isVerified:true,credits:74,monthlyCredits:mc,sweetUsedThisMonth:1,roomNumber:'A-204',studentId:'CS2024042',hostelId:'h6',institutionName:'IET Indore — Boys Hostel',passwordHash:hashPw('pass123'),todayVoteCount:1,lastLoginDate:'',lastBonusDate:''},
  ]);
  await Student.insertMany([
    {id:'s1',name:'Ravi Patel',email:'ravi@college.edu',phone:'9300011111',roll:'EC2022031',room:'C-301',credits:295,isVerified:false,hostelId:'h6'},
    {id:'s2',name:'Sneha Joshi',email:'sneha@college.edu',phone:'9400022222',roll:'CS2021099',room:'A-110',credits:180,isVerified:true,hostelId:'h6'},
    {id:'s3',name:'Arjun Mehta',email:'arjun@college.edu',phone:'9500033333',roll:'ME2023015',room:'B-205',credits:160,isVerified:true,hostelId:'h6'},
    {id:'s4',name:'Priya Yadav',email:'priya@college.edu',phone:'9700055555',roll:'IT2023090',room:'B-108',credits:200,isVerified:true,hostelId:'h6'},
  ]);
  await MenuItem.insertMany([
    {id:'b1',slot:'breakfast',emoji:'🥣',name:'Poha',desc:'Light flattened rice with spices',credits:1,nutri:'7.8',votes:54,free:false},
    {id:'b2',slot:'breakfast',emoji:'🫓',name:'Upma',desc:'Semolina with peanuts & curry leaves',credits:1,nutri:'7.5',votes:38,free:false},
    {id:'b3',slot:'breakfast',emoji:'🥞',name:'Idli-Sambar',desc:'Soft idli with hot sambar',credits:1,nutri:'8.2',votes:62,free:false},
    {id:'b4',slot:'breakfast',emoji:'🍞',name:'Bread + Butter + Tea',desc:'2 slices bread, butter, cutting chai',credits:0,nutri:'6.0',votes:91,free:true},
    {id:'b5',slot:'breakfast',emoji:'🥚',name:'Egg Omelette',desc:'2 egg omelette with onion & chili',credits:2,nutri:'9.0',votes:47,free:false},
    {id:'b6',slot:'breakfast',emoji:'🧇',name:'Aloo Paratha',desc:'Stuffed aloo paratha with curd',credits:2,nutri:'7.2',votes:33,free:false},
    {id:'l1',slot:'lunch',emoji:'🍛',name:'Dal + Roti + Rice',desc:'Basic dal with roti and rice',credits:0,nutri:'7.5',votes:82,free:true},
    {id:'l2',slot:'lunch',emoji:'🥔',name:'Aloo Gobi',desc:'Dry potato and cauliflower sabzi',credits:2,nutri:'7.8',votes:54,free:false},
    {id:'l3',slot:'lunch',emoji:'🫘',name:'Rajma',desc:'Rajma in tomato masala',credits:3,nutri:'8.7',votes:29,free:false},
    {id:'l4',slot:'lunch',emoji:'🥬',name:'Palak Paneer',desc:'Spinach with soft paneer cubes',credits:5,nutri:'9.1',votes:68,free:false},
    {id:'l5',slot:'lunch',emoji:'🍗',name:'Chicken Curry',desc:'Desi chicken curry with masala',credits:8,nutri:'9.4',votes:31,free:false},
    {id:'sn1',slot:'snacks',emoji:'🫖',name:'Chai + Biscuit',desc:'Cutting chai with cream biscuit',credits:0,nutri:'4.5',votes:78,free:true},
    {id:'sn2',slot:'snacks',emoji:'🧆',name:'Samosa (2 pcs)',desc:'Crispy aloo samosa with chutney',credits:1,nutri:'5.5',votes:65,free:false},
    {id:'sn3',slot:'snacks',emoji:'🍜',name:'Maggi',desc:'Classic instant noodles with veggies',credits:2,nutri:'5.8',votes:55,free:false},
    {id:'sn4',slot:'snacks',emoji:'🥪',name:'Sandwich',desc:'Veg grilled sandwich with chutney',credits:2,nutri:'7.0',votes:39,free:false},
    {id:'d1',slot:'dinner',emoji:'🍛',name:'Dal + Roti + Rice',desc:'Basic dal with roti and rice',credits:0,nutri:'7.5',votes:74,free:true},
    {id:'d2',slot:'dinner',emoji:'🥔',name:'Aloo Matar',desc:'Potato and peas dry sabzi',credits:2,nutri:'7.6',votes:50,free:false},
    {id:'d3',slot:'dinner',emoji:'🥬',name:'Palak Paneer',desc:'Spinach with soft paneer cubes',credits:5,nutri:'9.1',votes:61,free:false},
    {id:'d4',slot:'dinner',emoji:'🍗',name:'Chicken Curry',desc:'Desi chicken curry with masala',credits:8,nutri:'9.4',votes:25,free:false},
  ]);
  await Facility.insertMany([
    {id:'f1',icon:'🍲',title:'Mess / Food Quality',status:'warn',label:'Needs Improvement',desc:'AI detected oily food complaints up 18% this week.'},
    {id:'f2',icon:'🧹',title:'Room Cleanliness',status:'bad',label:'Alert Sent',desc:'Management notified. Inspection scheduled Thursday.'},
    {id:'f3',icon:'♨️',title:'Hot Water (Geyser)',status:'ok',label:'Working Fine',desc:'Available 6–10 AM and 6–10 PM in all blocks.'},
    {id:'f4',icon:'🚰',title:'Drinking Water (RO)',status:'ok',label:'Purified & Safe',desc:'RO plant serviced 3 days ago. TDS: 48 ppm.'},
    {id:'f5',icon:'🌙',title:'Induction Kitchen',status:'ok',label:'Open 24×7',desc:'Induction available round the clock.'},
    {id:'f6',icon:'🏥',title:'Medical Facility',status:'warn',label:'Doctor on Call',desc:'Regular visits: Mon/Wed/Fri.'},
    {id:'f7',icon:'🔒',title:'Security',status:'ok',label:'24/7 Guard',desc:'CCTV + security at all entry points.'},
    {id:'f8',icon:'📶',title:'WiFi / Internet',status:'ok',label:'Fast Connection',desc:'1 Gbps fiber. All floors covered.'},
  ]);
  await Suggestion.insertMany([
    {id:'sg1',slot:'lunch',emoji:'🥘',name:'Pav Bhaji',reason:'Classic Mumbai street food!',votes:23,votedBy:[]},
    {id:'sg2',slot:'dinner',emoji:'🍕',name:'Veg Pizza',reason:'Occasional treat.',votes:18,votedBy:[]},
    {id:'sg3',slot:'breakfast',emoji:'🧀',name:'Paneer Paratha',reason:'High protein breakfast!',votes:31,votedBy:[]},
  ]);
  await Config.insertMany([
    {key:'navConfig',value:[{id:'home',label:'🏠 Home',visible:true,protected:true},{id:'food',label:'🍽 Vote',visible:true,protected:false},{id:'ratings',label:'⭐ Rate',visible:true,protected:false},{id:'credits',label:'💎 Credits',visible:true,protected:false},{id:'facilities',label:'🏗 Facility',visible:true,protected:false},{id:'sweet',label:'🍬 Sweet',visible:true,protected:false},{id:'feedback',label:'💬 Feedback',visible:true,protected:false}]},
    {key:'mealTimes',value:{breakfast:450,lunch:780,snacks:1020,dinner:1200}},
  ]);
  console.log('✅ Seeding complete!');
}

// ══════════════════════════════════════════════════════
// ██  ROUTES
// ══════════════════════════════════════════════════════

app.get('/api/hostels', async(req,res)=>{res.json(await Hostel.find({},'-_id -__v'));});
app.post('/api/hostels', async(req,res)=>{
  const{name,city,type,totalStudents,icon,adminName,adminPhone,adminEmail,adminPass}=req.body;
  if(!name||!city||!adminName||!adminEmail||!adminPass) return res.status(400).json({error:'Missing required fields'});
  if(adminPass.length<6) return res.status(400).json({error:'Admin password must be at least 6 characters'});
  if(await User.findOne({email:adminEmail.toLowerCase()})) return res.status(400).json({error:'Email already registered'});
  const newId='h_'+Date.now();
  const hostel=await Hostel.create({id:newId,name,city,type:type||'private',totalStudents:parseInt(totalStudents)||100,icon:icon||'🏫'});
  await User.create({id:'admin_'+Date.now(),name:adminName,email:adminEmail.toLowerCase(),phone:adminPhone||'',role:'admin',isVerified:true,credits:0,monthlyCredits:0,sweetUsedThisMonth:0,roomNumber:'Admin Office',studentId:'ADMIN',hostelId:newId,institutionName:name,passwordHash:hashPw(adminPass),todayVoteCount:0,lastLoginDate:'',lastBonusDate:''});
  const h=hostel.toObject();delete h._id;delete h.__v;
  res.json({success:true,hostel:h});
});

app.post('/api/auth/login', async(req,res)=>{
  const{email,password}=req.body;
  const user=await User.findOne({email:email?.toLowerCase()});
  if(!user||user.passwordHash!==hashPw(password)) return res.status(401).json({error:'Invalid email or password'});
  const today=new Date(),todayStr=today.toDateString(),bonus=getBonusInfo(today);
  if(user.lastBonusDate!==todayStr&&user.role==='student'){
    user.credits=(user.credits||0)+10+bonus.bonus;
    user.lastBonusDate=todayStr;
    await CreditHist.create({type:'earn',title:'🌅 Daily login bonus',date:'Today',amount:10});
    if(bonus.bonus>0) await CreditHist.create({type:'earn',title:bonus.label+' Credits',date:'Today',amount:bonus.bonus});
    await Student.updateOne({email:user.email},{credits:user.credits});
    await user.save();
  }
  const token=makeToken();
  sessions.set(token,{userId:user.id,email:user.email,role:user.role,hostelId:user.hostelId});
  res.json({token,user:safe(user),bonusToday:bonus});
});

app.post('/api/auth/register', async(req,res)=>{
  const{name,email,password,phone,roomNumber,studentId,hostelId}=req.body;
  const em=email?.toLowerCase();
  if(!name||!em||!password||!roomNumber||!studentId||!hostelId) return res.status(400).json({error:'Please fill all required fields'});
  if(password.length<6) return res.status(400).json({error:'Password must be at least 6 characters'});
  if(await User.findOne({email:em})) return res.status(400).json({error:'Email already registered. Please login.'});
  const hostel=await Hostel.findOne({id:hostelId});
  if(!hostel) return res.status(400).json({error:'Invalid hostel selected'});
  const mc=calcMonthlyCredits(),newId='u_'+Date.now();
  const newUser=await User.create({id:newId,name,email:em,phone:phone||'',role:'student',isVerified:false,credits:mc,monthlyCredits:mc,sweetUsedThisMonth:0,roomNumber,studentId,hostelId,institutionName:hostel.name,passwordHash:hashPw(password),todayVoteCount:0,lastLoginDate:'',lastBonusDate:''});
  await Student.create({id:newId,name,email:em,phone:phone||'',roll:studentId,room:roomNumber,credits:mc,isVerified:false,hostelId});
  const token=makeToken();
  sessions.set(token,{userId:newId,email:em,role:'student',hostelId});
  res.json({token,user:safe(newUser)});
});

app.post('/api/auth/logout', auth,(req,res)=>{sessions.delete(req.headers['x-token']);res.json({success:true});});

app.post('/api/auth/forgot', async(req,res)=>{
  const user=await User.findOne({email:req.body.email?.toLowerCase()});
  if(!user) return res.status(404).json({error:'No account found with this email'});
  const otp=String(Math.floor(100000+Math.random()*900000));
  sessions.set('otp_'+req.body.email,{otp,expires:Date.now()+10*60*1000});
  res.json({success:true,otp});
});

app.post('/api/auth/reset-password', async(req,res)=>{
  const{email,otp,newPassword}=req.body;
  const stored=sessions.get('otp_'+email);
  if(!stored||stored.otp!==otp||Date.now()>stored.expires) return res.status(400).json({error:'Invalid or expired OTP'});
  if(!newPassword||newPassword.length<6) return res.status(400).json({error:'Password must be at least 6 characters'});
  await User.updateOne({email},{passwordHash:hashPw(newPassword)});
  sessions.delete('otp_'+email);
  res.json({success:true});
});

app.get('/api/me', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email},'-passwordHash -_id -__v');
  if(!user) return res.status(404).json({error:'User not found'});
  res.json(user);
});

app.get('/api/bonus/today', auth,(req,res)=>res.json(getBonusInfo(new Date())));

app.get('/api/menus', auth, async(req,res)=>{
  const items=await MenuItem.find({},'-_id -__v');
  const menus={breakfast:[],lunch:[],snacks:[],dinner:[]};
  items.forEach(i=>{if(menus[i.slot]) menus[i.slot].push(i);});
  res.json(menus);
});

app.post('/api/menus/item', auth, adminOnly, async(req,res)=>{
  const{slot,emoji,name,desc,credits,free,nutri}=req.body;
  if(!slot||!name) return res.status(400).json({error:'Slot and name required'});
  const item=await MenuItem.create({id:'menu_'+Date.now(),slot,emoji:emoji||'🍽',name,desc:desc||'Admin added',credits:free?0:(parseInt(credits)||0),nutri:nutri||'7.0',votes:0,free:!!free});
  const p=item.toObject();delete p._id;delete p.__v;
  res.json({success:true,item:p});
});

app.delete('/api/menus/item/:slot/:id', auth, adminOnly, async(req,res)=>{
  await MenuItem.deleteOne({slot:req.params.slot,id:req.params.id});
  res.json({success:true});
});

app.post('/api/vote', auth, async(req,res)=>{
  const{slot,foodId}=req.body;
  const user=await User.findOne({email:req.session.email});
  if(!user) return res.status(404).json({error:'User not found'});
  if(!user.isVerified&&user.role!=='admin') return res.status(403).json({error:'Admin verification required to vote'});
  const voteKey=user.id+'_'+slot+'_'+new Date().toDateString();
  if(await Vote.findOne({key:voteKey})) return res.status(400).json({error:'Already voted for this meal today'});
  const food=await MenuItem.findOne({id:foodId,slot});
  if(!food) return res.status(404).json({error:'Food item not found'});
  if(food.credits>0&&user.credits<food.credits) return res.status(400).json({error:`Not enough credits! Need ${food.credits} extra.`});
  if(food.credits>0){
    user.credits-=food.credits;
    await CreditHist.create({type:'spend',title:`${slot}: ${food.name} (extra)`,date:'Today',amount:-food.credits});
    await Student.updateOne({email:user.email},{credits:user.credits});
  }
  food.votes=(food.votes||0)+1;
  user.todayVoteCount=(user.todayVoteCount||0)+1;
  await food.save(); await user.save();
  await Vote.create({key:voteKey});
  res.json({success:true,user:safe(user)});
});

app.get('/api/vote/status', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email});
  const slots=['breakfast','lunch','snacks','dinner'];
  const todayStr=new Date().toDateString();
  const voted={};
  for(const s of slots) voted[s]=!!(await Vote.findOne({key:user.id+'_'+s+'_'+todayStr}));
  res.json({voted});
});

app.get('/api/mealtimes', auth, async(req,res)=>{
  const cfg=await Config.findOne({key:'mealTimes'});
  res.json(cfg?cfg.value:{breakfast:450,lunch:780,snacks:1020,dinner:1200});
});

app.put('/api/mealtimes', auth, adminOnly, async(req,res)=>{
  const{breakfast,lunch,snacks,dinner}=req.body;
  const value={breakfast:parseInt(breakfast)||450,lunch:parseInt(lunch)||780,snacks:parseInt(snacks)||1020,dinner:parseInt(dinner)||1200};
  await Config.updateOne({key:'mealTimes'},{value},{upsert:true});
  res.json({success:true,mealTimes:value});
});

app.get('/api/credits/history', auth, async(req,res)=>{
  res.json(await CreditHist.find({},'-_id -__v').sort({_id:-1}).limit(50));
});

app.post('/api/credits/reset', auth, adminOnly, async(req,res)=>{
  const mc=calcMonthlyCredits();
  await Student.updateMany({},{credits:mc});
  await User.updateMany({role:'student'},{credits:mc});
  const n=new Date();
  await CreditHist.create({type:'reset',title:'Admin credit reset',date:n.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}),amount:mc});
  res.json({success:true,monthlyCredits:mc});
});

app.get('/api/suggestions', auth, async(req,res)=>{res.json(await Suggestion.find({},'-_id -__v').sort({votes:-1}));});
app.post('/api/suggestions', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email});
  if(!user.isVerified&&user.role!=='admin') return res.status(403).json({error:'Verification required to suggest food'});
  const{slot,emoji,name,reason}=req.body;
  if(!name) return res.status(400).json({error:'Food name required'});
  const s=await Suggestion.create({id:'sg_'+Date.now(),slot:slot||'lunch',emoji:emoji||'🍽',name,reason:reason||'Suggested by community.',votes:1,votedBy:[user.id]});
  const p=s.toObject();delete p._id;delete p.__v;
  res.json({success:true,suggestion:p});
});
app.post('/api/suggestions/:id/upvote', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email});
  const s=await Suggestion.findOne({id:req.params.id});
  if(!s) return res.status(404).json({error:'Not found'});
  if(s.votedBy.includes(user.id)) return res.status(400).json({error:'Already upvoted'});
  s.votes++;s.votedBy.push(user.id);await s.save();
  res.json({success:true,votes:s.votes});
});
app.post('/api/suggestions/:id/approve', auth, adminOnly, async(req,res)=>{
  const s=await Suggestion.findOne({id:req.params.id});
  if(!s) return res.status(404).json({error:'Not found'});
  await MenuItem.create({id:'sugg_'+Date.now(),slot:s.slot,emoji:s.emoji,name:s.name,desc:'Community suggested',credits:0,nutri:'7.0',votes:s.votes,free:true});
  await Suggestion.deleteOne({id:req.params.id});
  res.json({success:true});
});
app.delete('/api/suggestions/:id', auth, adminOnly, async(req,res)=>{await Suggestion.deleteOne({id:req.params.id});res.json({success:true});});

app.get('/api/facilities', auth, async(req,res)=>{res.json(await Facility.find({},'-_id -__v'));});
app.post('/api/facilities', auth, adminOnly, async(req,res)=>{
  const{icon,title,status,label,desc}=req.body;
  if(!title||!label) return res.status(400).json({error:'Title and label required'});
  const f=await Facility.create({id:'fac_'+Date.now(),icon:icon||'🏗',title,status:status||'ok',label,desc:desc||'No description.'});
  const p=f.toObject();delete p._id;delete p.__v;
  res.json({success:true,facility:p});
});
app.put('/api/facilities/:id', auth, adminOnly, async(req,res)=>{
  const u={};
  if(req.body.status) u.status=req.body.status;
  if(req.body.label)  u.label=req.body.label;
  await Facility.updateOne({id:req.params.id},u);
  res.json({success:true});
});
app.delete('/api/facilities/:id', auth, adminOnly, async(req,res)=>{await Facility.deleteOne({id:req.params.id});res.json({success:true});});

app.get('/api/students', auth, adminOnly, async(req,res)=>{res.json(await Student.find({hostelId:req.session.hostelId},'-_id -__v'));});
app.put('/api/students/:id/verify', auth, adminOnly, async(req,res)=>{
  const{approve}=req.body;
  await Student.updateOne({id:req.params.id},{isVerified:!!approve});
  await User.updateOne({id:req.params.id},{isVerified:!!approve});
  res.json({success:true});
});

app.get('/api/navconfig', auth, async(req,res)=>{const cfg=await Config.findOne({key:'navConfig'});res.json(cfg?cfg.value:[]);});
app.put('/api/navconfig', auth, adminOnly, async(req,res)=>{
  const{navConfig}=req.body;
  if(!Array.isArray(navConfig)) return res.status(400).json({error:'navConfig must be array'});
  await Config.updateOne({key:'navConfig'},{value:navConfig},{upsert:true});
  res.json({success:true});
});

app.post('/api/sweet/claim', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email});
  if(!user.isVerified&&user.role!=='admin') return res.status(403).json({error:'Verification required'});
  const today=new Date().getDate();
  if(![10,25].includes(today)) return res.status(400).json({error:'Not a sweet day'});
  if((user.sweetUsedThisMonth||0)>=2) return res.status(400).json({error:'Already used 2 sweet credits this month'});
  const key='sweet_'+user.id+'_'+new Date().toISOString().slice(0,7)+'_'+today;
  if(await Vote.findOne({key})) return res.status(400).json({error:'Already claimed today'});
  user.sweetUsedThisMonth=(user.sweetUsedThisMonth||0)+1;
  user.credits=(user.credits||0)+20;
  await user.save();
  await Vote.create({key});
  await CreditHist.create({type:'earn',title:'🍬 Sweet Day bonus credit',date:'Today',amount:20});
  await Student.updateOne({email:user.email},{credits:user.credits});
  res.json({success:true,user:safe(user)});
});

app.post('/api/ratings', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email});
  if(!user.isVerified&&user.role!=='admin') return res.status(403).json({error:'Verification required'});
  res.json({success:true});
});

app.post('/api/maintenance', auth, async(req,res)=>{
  const user=await User.findOne({email:req.session.email});
  if(!user.isVerified&&user.role!=='admin') return res.status(403).json({error:'Verification required'});
  const{room,desc,type}=req.body;
  if(!room||!desc) return res.status(400).json({error:'Room and description required'});
  res.json({success:true,message:'Maintenance request received'});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../frontend/public/index.html')));

// ── START ────────────────────────────────────────────────
async function startServer(){
  if(!MONGODB_URI){ console.error('❌ MONGODB_URI not set!'); process.exit(1); }
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected!');
  await seedIfEmpty();
  app.listen(PORT,()=>console.log(`🚀 HostelHub running at http://localhost:${PORT}`));
}
startServer().catch(err=>{console.error('❌ Failed:',err.message);process.exit(1);});
