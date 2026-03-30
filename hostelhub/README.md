# HostelHub — Full Stack Setup Guide

## Tech Stack
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Auth**: JWT Tokens
- **Cron**: node-cron (daily deduction + monthly reset)

---

## Step 1: MongoDB Install Karo

### Windows:
1. https://www.mongodb.com/try/download/community se download karo
2. Install karke MongoDB Compass bhi install kar sakte ho (GUI)
3. Service start karo: `net start MongoDB`

### Ya MongoDB Atlas (Cloud - free):
1. https://cloud.mongodb.com pe account banao
2. Free cluster create karo
3. Connection string copy karo
4. .env mein `MONGODB_URI` update karo

---

## Step 2: Node.js Install Karo
- https://nodejs.org se LTS version download karo

---

## Step 3: Project Setup

```bash
# Project folder mein jao
cd hostelhub/backend

# Dependencies install karo
npm install

# Server start karo
node server.js
```

Server `http://https://hostelhub-rw44.onrender.com` pe chalega.
Frontend automatically serve hoga same port pe!

---

## Step 4: Browser mein kholo
```
http://https://hostelhub-rw44.onrender.com
```

---

## Default Admin Login
```
Email: admin@hostelhub.com
Password: admin123
```

---

## File Structure
```
hostelhub/
├── backend/
│   ├── server.js          ← Main server
│   ├── .env               ← Config (MongoDB URI, JWT Secret)
│   ├── models/
│   │   ├── User.js        ← Student/Admin model
│   │   ├── Rating.js      ← Ratings model
│   │   └── Vote.js        ← Votes + Credit transactions
│   ├── routes/
│   │   ├── auth.js        ← Login/Register
│   │   ├── admin.js       ← Verify students, stats
│   │   ├── ratings.js     ← Rating submit/view
│   │   └── votes.js       ← Vote, credits, sweet
│   ├── middleware/
│   │   └── auth.js        ← JWT + Verified check
│   └── cron/
│       └── jobs.js        ← Daily deduction + Monthly reset
└── frontend/
    └── public/
        └── index.html     ← Complete frontend
```

---

## Key Features
1. **Verified-only Rating**: Sirf admin se verify hue students rating de sakte hain
2. **Daily Deduction**: Har raat 12:01 AM pe 6 credits katte hain (chahe khao ya nahi)
3. **Monthly Reset**: 1 tarikh ko auto-reset — din × 6 credits
4. **Excess Credits**: 4 extra credits har mahine — kisi bhi din use karo premium ke liye
5. **Sweet System**: Month mein 2 baar free sweet + last Sunday sabko
6. **JWT Auth**: Secure token-based authentication

---

## .env Configuration
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hostelhub
JWT_SECRET=apna_secret_yahan_likho
JWT_EXPIRES_IN=7d
NODE_ENV=development
```
