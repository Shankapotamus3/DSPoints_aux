# Quick Deployment Checklist

## Before You Deploy

- [ ] All features tested and working locally
- [ ] All code committed to Git
- [ ] Environment secrets documented (VAPID keys, SESSION_SECRET)
- [ ] Production build tested (`npm run build`)

## Choose Your Platform

**Railway** (Easiest for full-stack + database)
- ✅ Automatic PostgreSQL setup
- ✅ Simple configuration
- ✅ Free tier available
- ✅ Great for beginners
- ✅ Perfect for Express + WebSocket apps

**Render** (Excellent alternative)
- ✅ Simple setup
- ✅ PostgreSQL included
- ✅ Free tier available
- ✅ Great for traditional Node.js servers

**Note:** This app requires a platform that supports persistent Node.js processes (not serverless functions) due to WebSockets, sessions, and Express server architecture.

## Required Environment Variables

Copy these from your Replit Secrets panel:

```
NODE_ENV=production
DATABASE_URL=(automatically set by platform)
SESSION_SECRET=(generate new: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
VAPID_PUBLIC_KEY=(copy from Replit Secrets)
VAPID_PRIVATE_KEY=(copy from Replit Secrets)
```

## Steps (All Platforms)

1. **Push to GitHub**
   - Open Git panel in Replit
   - Commit all changes
   - Push to GitHub

2. **Create Account on Platform**
   - Sign up with GitHub
   - Connect your repository

3. **Add PostgreSQL Database**
   - Use platform's database service
   - DATABASE_URL will be set automatically

4. **Set Environment Variables**
   - Add all variables from above
   - Double-check VAPID keys are correct

5. **Deploy**
   - Platform will auto-deploy from GitHub
   - Watch logs for any errors

6. **Run Database Migration**
   - Use platform CLI or dashboard
   - Run: `npm run db:push`

7. **Test Your App**
   - Open deployed URL
   - Test push notifications
   - Install as PWA on your phone

## Quick Test Commands

Test build locally:
```bash
npm run build
npm start
```

Generate new VAPID keys if needed:
```bash
npx web-push generate-vapid-keys
```

Generate SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## After Deployment

- Test on real mobile devices
- Enable push notifications when prompted
- Try installing the PWA
- Verify all features work

## Updating

After making changes:
1. Commit in Replit
2. Push to GitHub
3. Platform auto-deploys (if enabled)

---

**Need detailed instructions?** See `DEPLOYMENT.md` for step-by-step guides for each platform.
