# 🚀 Deployment Guide

This guide covers deploying HostelHub to production environments.

## Table of Contents
- [Deployment Options](#deployment-options)
- [Deploy to Render](#deploy-to-render-recommended)
- [Deploy to Railway](#deploy-to-railway)
- [Deploy to Heroku](#deploy-to-heroku)
- [Deploy to DigitalOcean](#deploy-to-digitalocean)
- [Deploy with Docker](#deploy-with-docker)
- [Environment Variables](#environment-variables)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Production Best Practices](#production-best-practices)

## Deployment Options

| Platform | Difficulty | Free Tier | Best For |
|----------|-----------|-----------|----------|
| Render | Easy | ✅ Yes | Quick deployment, automatic scaling |
| Railway | Easy | ✅ Yes (limited) | Simple setup, good DX |
| Heroku | Medium | ✅ Yes (limited) | Enterprise features |
| DigitalOcean | Medium | ❌ No | Full control, custom setup |
| Docker | Hard | N/A | Any cloud provider |

## Prerequisites for All Deployments

1. **MongoDB Database** - You'll need a cloud MongoDB instance:
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Recommended - Free tier available)
   - Any managed MongoDB service

2. **Git Repository** - Your code should be in a Git repository (GitHub, GitLab, etc.)

## Deploy to Render (Recommended)

Render offers easy deployment with automatic builds and free tier.

### Step 1: Prepare Your Repository

Ensure your project has the following structure:
```
hostelhub/
├── backend/
│   ├── server.js
│   └── package.json
├── frontend/
│   └── public/
└── package.json
```

### Step 2: Create Render Account

1. Sign up at [Render](https://render.com)
2. Connect your GitHub/GitLab account

### Step 3: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your repository
3. Configure the service:
   - **Name:** `hostelhub`
   - **Environment:** `Node`
   - **Region:** Choose closest to your users
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free

### Step 4: Set Environment Variables

In Render dashboard, add these environment variables:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/hostelhub?retryWrites=true&w=majority
NODE_ENV=production
PORT=3000
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will automatically deploy your app
3. You'll get a URL like: `https://hostelhub.onrender.com`

### Important Notes for Render:
- Free tier services spin down after 15 minutes of inactivity
- First request after inactivity may take 30-60 seconds
- Upgrade to paid tier for 24/7 availability

## Deploy to Railway

Railway provides simple deployment with excellent developer experience.

### Steps:

1. **Sign up** at [Railway](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js
5. **Add MongoDB** (or use external MongoDB Atlas)
6. **Set Environment Variables:**
   ```
   MONGODB_URI=<your-mongodb-uri>
   NODE_ENV=production
   ```
7. **Configure Start Command:**
   - Go to Settings → Start Command: `cd backend && node server.js`
8. **Deploy** - Railway will build and deploy automatically

Your app will be available at: `https://<your-app>.up.railway.app`

## Deploy to Heroku

Heroku is a mature platform with extensive features.

### Step 1: Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Ubuntu/Debian
curl https://cli-assets.heroku.com/install.sh | sh

# Windows
# Download from https://devcenter.heroku.com/articles/heroku-cli
```

### Step 2: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create new app
heroku create hostelhub-app

# Add MongoDB addon (optional - or use Atlas)
heroku addons:create mongolab:sandbox
```

### Step 3: Configure for Heroku

Create a `Procfile` in the root directory:
```
web: cd backend && node server.js
```

Update `backend/package.json` to specify Node version:
```json
{
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### Step 4: Set Environment Variables

```bash
heroku config:set MONGODB_URI="mongodb+srv://<user>:<pass>@cluster.mongodb.net/hostelhub"
heroku config:set NODE_ENV=production
```

### Step 5: Deploy

```bash
# Add and commit all changes
git add .
git commit -m "Prepare for Heroku deployment"

# Deploy to Heroku
git push heroku main

# Open your app
heroku open
```

## Deploy to DigitalOcean

For full control over your server.

### Step 1: Create Droplet

1. Sign up at [DigitalOcean](https://www.digitalocean.com)
2. Create a new Droplet:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($6/month)
   - **Add SSH key** for secure access

### Step 2: Connect to Droplet

```bash
ssh root@<your-droplet-ip>
```

### Step 3: Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install nginx (reverse proxy)
apt install -y nginx

# Install git
apt install -y git
```

### Step 4: Clone and Setup Application

```bash
# Clone repository
cd /var/www
git clone https://github.com/saransh-sh/hostelhub.git
cd hostelhub

# Install dependencies
npm install
cd backend && npm install
cd ..

# Create .env file
nano .env
# Add your environment variables (see below)
```

### Step 5: Configure Environment

Create `/var/www/hostelhub/.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/hostelhub
NODE_ENV=production
PORT=3000
```

### Step 6: Setup PM2

```bash
# Start application with PM2
cd /var/www/hostelhub/backend
pm2 start server.js --name hostelhub

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup ubuntu
```

### Step 7: Configure Nginx

Create `/etc/nginx/sites-available/hostelhub`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/hostelhub /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 8: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

## Deploy with Docker

### Step 1: Create Dockerfile

Create `Dockerfile` in the root directory:
```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install root dependencies
RUN npm install

# Copy backend files
COPY backend ./backend

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Copy frontend files
WORKDIR /app
COPY frontend ./frontend

# Expose port
EXPOSE 3000

# Start the application
WORKDIR /app/backend
CMD ["node", "server.js"]
```

### Step 2: Create .dockerignore

Create `.dockerignore`:
```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
.vscode
```

### Step 3: Build and Run

```bash
# Build image
docker build -t hostelhub .

# Run container
docker run -d \
  -p 3000:3000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e NODE_ENV=production \
  --name hostelhub-container \
  hostelhub
```

### Step 4: Deploy to Cloud

You can now deploy this Docker image to:
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**

## Environment Variables

All deployments require these environment variables:

### Required Variables

```env
# MongoDB connection string (REQUIRED)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/hostelhub?retryWrites=true&w=majority

# Environment (REQUIRED for production optimizations)
NODE_ENV=production

# Port (optional - many platforms set this automatically)
PORT=3000
```

### How to Get MongoDB URI (MongoDB Atlas):

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster (free tier available)
3. Click **"Connect"** → **"Connect your application"**
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with `hostelhub`

## Post-Deployment Checklist

After deploying, verify these items:

- [ ] Application loads successfully at your URL
- [ ] MongoDB connection is successful (check logs)
- [ ] Database seeds with initial data
- [ ] Can login with default credentials
- [ ] Can register new users
- [ ] All API endpoints work
- [ ] Frontend assets load correctly
- [ ] CORS is properly configured
- [ ] Environment variables are set correctly
- [ ] HTTPS is enabled (for production)
- [ ] Monitor application logs for errors

### Testing Deployment

```bash
# Test health (modify URL to your deployment)
curl https://your-app-url.com/api/hostels

# Test login
curl -X POST https://your-app-url.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hostel.com","password":"admin123"}'
```

## Production Best Practices

### 1. Security

**Update CORS Configuration** in `backend/server.js`:
```javascript
// Replace this:
app.use(cors());

// With this (restrict to your frontend domain):
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

**Use Environment Variables** for sensitive data:
```javascript
// Don't hardcode credentials in source code
const MONGODB_URI = process.env.MONGODB_URI;
```

**Add Rate Limiting:**
```bash
cd backend
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 2. Performance

**Enable Compression:**
```bash
cd backend
npm install compression
```

```javascript
const compression = require('compression');
app.use(compression());
```

**Use Production MongoDB Connection:**
```env
# Add these options for better performance
MONGODB_URI=mongodb+srv://user:pass@cluster.net/hostelhub?retryWrites=true&w=majority&maxPoolSize=50
```

### 3. Monitoring

**Add Health Check Endpoint** in `server.js`:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

**Setup Logging:**
```bash
cd backend
npm install winston
```

**Use PM2 for Process Management** (if deploying to VPS):
```bash
pm2 start server.js --name hostelhub
pm2 logs hostelhub
pm2 monit
```

### 4. Database

- **Enable MongoDB backups** in Atlas
- **Create database indexes** for better query performance
- **Monitor database metrics** (connections, queries, storage)
- **Set up alerts** for high usage or errors

### 5. Session Management

For production, replace in-memory sessions with Redis:

```bash
npm install connect-redis redis
```

Consider implementing JWT tokens for better scalability.

## Monitoring and Maintenance

### View Logs

**Render:**
- Dashboard → Logs tab

**Railway:**
- Project → Deployments → View Logs

**Heroku:**
```bash
heroku logs --tail
```

**DigitalOcean/PM2:**
```bash
pm2 logs hostelhub
```

### Update Application

**For Git-based deployments (Render/Railway/Heroku):**
```bash
git add .
git commit -m "Update application"
git push origin main
# Auto-deploys on most platforms
```

**For manual deployments (DigitalOcean):**
```bash
ssh root@your-server
cd /var/www/hostelhub
git pull
cd backend && npm install
pm2 restart hostelhub
```

## Troubleshooting

### Application Won't Start
- Check logs for error messages
- Verify `MONGODB_URI` is correct
- Ensure Node.js version is compatible (v14+)
- Check if PORT is already in use

### Database Connection Failed
- Verify MongoDB Atlas IP whitelist (add `0.0.0.0/0` for testing)
- Check database user credentials
- Ensure connection string is properly formatted
- Test connection string locally first

### 502 Bad Gateway (Nginx)
- Check if Node.js process is running: `pm2 list`
- Verify port in nginx config matches app port
- Check nginx error logs: `tail -f /var/log/nginx/error.log`

### Out of Memory
- Increase dyno/instance size on hosting platform
- Optimize database queries
- Check for memory leaks in application code

## Cost Estimation

### Free Tier Options
- **Render Free:** $0/month (with limitations)
- **Railway Free:** $5 credit/month
- **MongoDB Atlas Free:** $0/month (512MB storage)

### Paid Options (Monthly)
- **Render Standard:** $7/month
- **Railway Pro:** $5-20/month
- **Heroku Hobby:** $7/dyno/month
- **DigitalOcean Droplet:** $6-12/month
- **MongoDB Atlas Shared:** $9/month (2GB storage)

## Next Steps

After successful deployment:

1. **Configure custom domain** (if applicable)
2. **Set up SSL certificate** (Let's Encrypt or platform-provided)
3. **Enable monitoring** and alerts
4. **Create backup strategy** for database
5. **Document your deployment process**
6. **Set up CI/CD pipeline** (GitHub Actions, etc.)

## Support

If you encounter issues:
1. Check the application logs
2. Review the [Local Setup Guide](LOCAL_SETUP.md)
3. Search existing GitHub issues
4. Create a new issue with deployment logs

---

🎉 Congratulations on deploying HostelHub! Your application is now live and ready to serve hostel students.
