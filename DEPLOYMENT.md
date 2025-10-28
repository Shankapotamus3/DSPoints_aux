# Deployment Guide for ChoreRewards PWA

This guide will help you deploy your ChoreRewards app to a platform that fully supports push notifications and all PWA features.

## Why Deploy Outside Replit?

Push notifications require specific browser APIs that aren't available in Replit's webview or published apps. By deploying to platforms like Railway or Vercel, your app will have access to:
- Full Notification API support
- Service Worker functionality on all browsers
- HTTPS by default (required for PWA features)
- Better performance and scalability

---

## Option 1: Deploy to Railway (Recommended for Full-Stack Apps)

**Railway** is perfect for your app because it handles both the Node.js backend and PostgreSQL database with minimal configuration.

### Step 1: Push Your Code to GitHub

1. **In Replit**, open the Git panel (left sidebar)
2. Click **"Create a Git Repo"** if you haven't already
3. Make sure all your changes are committed:
   - Review changed files
   - Add a commit message like "Prepare for deployment"
   - Click **"Commit & push"**
4. **Connect to GitHub**:
   - Click the GitHub icon in the Git panel
   - Follow the prompts to push your repo to GitHub

### Step 2: Set Up Railway

1. Go to [railway.app](https://railway.app)
2. Sign up or log in with your GitHub account
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your ChoreRewards repository

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a database and set the `DATABASE_URL` environment variable

### Step 4: Configure Environment Variables

1. Click on your web service (not the database)
2. Go to the **"Variables"** tab
3. Add these environment variables:

```
NODE_ENV=production
SESSION_SECRET=your-random-secret-here
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

**To get your VAPID keys** (from your current Replit):
- Check the Secrets panel in Replit
- Copy `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` values
- Or generate new ones using: `npx web-push generate-vapid-keys`

**To generate a SESSION_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Deploy!

1. Railway will automatically deploy your app
2. Once deployed, click **"View Logs"** to monitor the deployment
3. After successful deployment, click the **"URL"** to open your live app

### Step 6: Run Database Migrations

1. In Railway, go to your web service
2. Click **"Settings"** → **"Deploy Triggers"**
3. Or use Railway CLI to run migrations:
```bash
npm install -g @railway/cli
railway login
railway run npm run db:push
```

---

## Option 2: Deploy to Vercel (Alternative)

**Vercel** is great for frontend-heavy apps and supports full-stack Node.js applications.

### Step 1: Push to GitHub

(Same as Railway Step 1 above)

### Step 2: Set Up Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with your GitHub account
3. Click **"Add New..."** → **"Project"**
4. Import your ChoreRewards repository
5. Configure your project:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 3: Add PostgreSQL Database

1. In your Vercel project, go to the **"Storage"** tab
2. Click **"Create Database"** → **"Postgres"**
3. Follow the prompts to create a Neon PostgreSQL database
4. Vercel will automatically set the `DATABASE_URL` environment variable

### Step 4: Configure Environment Variables

1. Go to your project **"Settings"** → **"Environment Variables"**
2. Add the same variables as Railway (see Railway Step 4)

### Step 5: Deploy!

1. Click **"Deploy"** to trigger a deployment
2. Vercel will build and deploy your app
3. Once complete, click the **"Visit"** button to see your live app

---

## Option 3: Deploy to Render (Another Great Option)

1. Go to [render.com](https://render.com)
2. Sign up and create a **"New Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Add a **PostgreSQL database** from the Render dashboard
6. Set environment variables (same as above)
7. Deploy!

---

## After Deployment Checklist

Once your app is deployed, test these features:

- [ ] **Login works** - Test PIN-based authentication
- [ ] **Database works** - Create a chore and verify it's saved
- [ ] **Push notifications work** - Complete a chore and check if notifications arrive
- [ ] **PWA installation** - Try installing the app on your phone
  - On iOS: Safari → Share → Add to Home Screen
  - On Android: Chrome → Menu → Install app
- [ ] **Service Worker works** - Check offline functionality
- [ ] **All features work** - Test chores, rewards, messaging, punishments

---

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly in environment variables
- Make sure you ran `npm run db:push` to create tables
- Check the deployment logs for connection errors

### Push Notifications Not Working
- Ensure your app is accessed via HTTPS (all deployment platforms provide this)
- Check that VAPID keys are set correctly
- Test on different browsers (Chrome, Firefox, Safari)
- Note: iOS Safari has limited Web Push support; use Chrome or Firefox

### Build Failures
- Check deployment logs for specific error messages
- Verify all dependencies are in `package.json` (not just devDependencies)
- Ensure Node.js version is compatible (v18 or higher recommended)

### Environment Variables
- Make sure all required secrets are set on the deployment platform
- Don't commit `.env` files to GitHub (they're in `.gitignore`)
- Redeploy after adding new environment variables

---

## Updating Your Deployed App

After making changes in Replit:

1. **Commit your changes** in the Git panel
2. **Push to GitHub**
3. Your deployment platform will **automatically redeploy** (if auto-deploy is enabled)
4. Or manually trigger a deployment from the platform dashboard

---

## Need Help?

- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Render**: [render.com/docs](https://render.com/docs)

Your app is now production-ready with full push notification support! 🎉
