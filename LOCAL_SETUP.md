# 🛠️ Local Setup Guide

This guide will help you set up HostelHub on your local machine for development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0.0 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **MongoDB** - You can use either:
  - Local MongoDB installation - [Download here](https://www.mongodb.com/try/download/community)
  - MongoDB Atlas (free cloud database) - [Sign up here](https://www.mongodb.com/cloud/atlas/register)
- **Git** - [Download here](https://git-scm.com/)
- A text editor (VS Code, Sublime, etc.)

## Step 1: Clone the Repository

```bash
git clone https://github.com/saransh-sh/hostelhub.git
cd hostelhub
```

## Step 2: Install Dependencies

### Install Root Dependencies
```bash
npm install
```

### Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

## Step 3: Set Up MongoDB

### Option A: Local MongoDB

1. Install MongoDB Community Edition on your system
2. Start MongoDB service:
   ```bash
   # On macOS (with Homebrew)
   brew services start mongodb-community

   # On Ubuntu/Debian
   sudo systemctl start mongod

   # On Windows
   # MongoDB runs as a service automatically after installation
   ```
3. Verify MongoDB is running:
   ```bash
   mongo --eval "db.version()"
   ```
4. Your MongoDB URI will be: `mongodb://localhost:27017/hostelhub`

### Option B: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a new cluster (free tier available)
3. Create a database user with password
4. Whitelist your IP address (or use `0.0.0.0/0` for development)
5. Get your connection string - it will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/hostelhub?retryWrites=true&w=majority
   ```

## Step 4: Configure Environment Variables

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your configuration:
   ```env
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/hostelhub
   # OR for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/hostelhub?retryWrites=true&w=majority

   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

### Environment Variables Explained

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | None |
| `PORT` | Port for the Express server | No | 3000 |
| `NODE_ENV` | Environment (development/production) | No | development |

## Step 5: Start the Application

### Development Mode

From the `backend` directory:
```bash
cd backend
npm run dev
```

Or from the root directory:
```bash
cd backend && npm start
```

You should see:
```
🚀 Server running at http://localhost:3000
🎉 Connected to MongoDB
🌱 Seeding default data...
✅ Seeded successfully
```

## Step 6: Access the Application

1. Open your browser and navigate to: `http://localhost:3000`
2. You should see the HostelHub login page

### Test with Default Credentials

**Admin Login:**
- Email: `admin@hostel.com`
- Password: `admin123`

**Student Login:**
- Email: `student@hostel.com`
- Password: `pass123`

## 📂 Project Structure

```
hostelhub/
├── backend/
│   ├── node_modules/      # Backend dependencies (generated)
│   ├── server.js          # Main Express server file
│   ├── package.json       # Backend package config
│   ├── package-lock.json  # Lock file
│   └── db.json           # Legacy JSON backup
│
├── frontend/
│   └── public/
│       ├── index.html    # Main HTML file
│       └── app.js        # Frontend JavaScript
│
├── node_modules/          # Root dependencies (generated)
├── package.json           # Root package config
├── package-lock.json      # Root lock file
├── .env                   # Environment variables (create this)
├── .env.example          # Example env file
├── README.md             # Project overview
├── LOCAL_SETUP.md        # This file
└── DEPLOYMENT.md         # Deployment guide
```

## 🔧 Development Tips

### Running with Auto-Reload

For development with auto-reload on file changes, install `nodemon`:

```bash
cd backend
npm install --save-dev nodemon
```

Then update `backend/package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

Now run:
```bash
npm run dev
```

### Resetting the Database

To reset the database and reseed with default data:

```bash
# Connect to MongoDB
mongo hostelhub

# Drop the database
> use hostelhub
> db.dropDatabase()
> exit

# Restart the server - it will auto-seed
cd backend
npm start
```

### Viewing Database Data

**Using MongoDB Compass (GUI):**
1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect using your MongoDB URI
3. Browse the `hostelhub` database

**Using MongoDB Shell:**
```bash
mongo hostelhub

# View all collections
> show collections

# View users
> db.users.find().pretty()

# View menu items
> db.menuitems.find().pretty()
```

## 🐛 Troubleshooting

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:** Change the port in `.env` or kill the process using port 3000:
```bash
# Find process on port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Make sure MongoDB is running: `brew services start mongodb-community` (macOS)
- Check your `MONGODB_URI` in `.env`
- For Atlas, verify your IP is whitelisted and credentials are correct

### Cannot Find Module Error
```
Error: Cannot find module 'express'
```

**Solution:** Reinstall dependencies:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Database Not Seeding
If you don't see seed data, manually delete the database and restart:
```bash
mongo hostelhub --eval "db.dropDatabase()"
cd backend && npm start
```

## 🧪 Testing the Application

### Manual Testing Checklist

1. **Registration & Login**
   - [ ] Register a new student account
   - [ ] Login with admin credentials
   - [ ] Login with student credentials
   - [ ] Logout functionality

2. **Student Features**
   - [ ] View menu items for all slots
   - [ ] Vote for menu items (max 3 per day)
   - [ ] Submit a suggestion
   - [ ] Vote for suggestions
   - [ ] View and edit profile
   - [ ] View credit history
   - [ ] Claim daily bonus (Sunday/festival)

3. **Admin Features**
   - [ ] View all students
   - [ ] Add new student
   - [ ] Edit student details
   - [ ] Delete student
   - [ ] Add menu item
   - [ ] Edit menu item
   - [ ] Delete menu item
   - [ ] Update facility status

## 🚀 Next Steps

Once your local setup is working:

1. Read the [API Documentation](README.md#-api-overview) to understand the endpoints
2. Explore the codebase in `backend/server.js`
3. Customize the frontend in `frontend/public/app.js` and `index.html`
4. Check out the [Deployment Guide](DEPLOYMENT.md) for production setup

## 📝 Notes

- Sessions are stored in-memory, so logging in again after server restart is required
- The database auto-seeds with sample data on first run
- All passwords are hashed using SHA-256
- CORS is enabled for all origins (restrict in production)

## 💡 Quick Commands Reference

```bash
# Start the application
cd backend && npm start

# Install new dependency
cd backend && npm install <package-name>

# View MongoDB logs (if running locally)
tail -f /usr/local/var/log/mongodb/mongo.log

# Check MongoDB status
brew services list | grep mongodb    # macOS
systemctl status mongod              # Linux

# Drop and reseed database
mongo hostelhub --eval "db.dropDatabase()" && cd backend && npm start
```

---

Happy Coding! 🎉 If you run into issues, check the [Troubleshooting](#-troubleshooting) section or open an issue on GitHub.
