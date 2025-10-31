# Database Migration Guide: Replit → Railway

This guide will help you migrate all your existing data from Replit to Railway.

## What Gets Migrated

- ✅ All users (with passwords and PINs)
- ✅ All chores (including completion status and history)
- ✅ All rewards
- ✅ All transactions (points earned/spent)
- ✅ All notifications
- ✅ All messages
- ✅ All punishments
- ✅ All push subscriptions

## Step-by-Step Migration

### Part 1: Export Data from Replit

1. **In your Replit project**, open the Shell
2. **Run the export script**:
   ```bash
   npx tsx scripts/export-data.ts
   ```
3. **Download the export file**:
   - A file called `data-export.json` will be created
   - Click on the file in the file tree
   - Click the three dots (⋮) → **Download**
   - Save it to your computer

### Part 2: Import Data to Railway

1. **Go to your Railway project** dashboard
2. **Open the Railway shell**:
   - Click on your web service
   - Go to the **"Shell"** tab
   - Wait for it to connect

3. **Upload the export file**:
   - In the Railway shell, you can use `cat > data-export.json` and paste the content
   - OR use Railway's file upload feature if available
   - OR commit it to your GitHub repo temporarily

4. **Run the import script**:
   ```bash
   npx tsx scripts/import-data.ts
   ```

5. **Verify the import**:
   - Visit your Railway app URL
   - Log in with your existing user credentials
   - Check that your chores, rewards, and points are all there!

## Important Notes

### Safety Features

- The import script **checks for existing data** and warns you before proceeding
- If Railway already has users, you must set `FORCE_IMPORT=true` to continue
- Uses `onConflictDoNothing()` to prevent duplicate entries

### If You Get Errors

**"data-export.json not found"**
- Make sure you uploaded the file to Railway
- Check that the filename is exactly `data-export.json`

**"Foreign key constraint violation"**
- Run migrations first: `npm run db:push`
- Make sure your Railway database schema matches Replit

**"Database already contains users"**
- If this is intentional, set environment variable: `FORCE_IMPORT=true`
- Otherwise, the import is protecting you from duplicates

## Alternative: Quick Method Using GitHub

If you prefer, you can commit `data-export.json` to your GitHub repo:

1. **In Replit**, run export script
2. **Commit** `data-export.json` to GitHub
3. **Railway** will automatically pull it on next deploy
4. **In Railway shell**, run: `npx tsx scripts/import-data.ts`
5. **Remove** the file from GitHub afterward (for security)

## After Migration

1. **Test everything**:
   - Log in with existing users
   - Check points balances
   - Verify chores are correct
   - Test completing chores and claiming rewards

2. **Delete the export file** (contains sensitive data):
   ```bash
   rm data-export.json
   ```

3. **Optional**: Remove the default admin user created by seed script if you don't need it

## Need Help?

If something goes wrong:
1. Check the Railway logs for error messages
2. The import is safe - it won't delete existing data
3. You can run the import multiple times (it skips conflicts)
4. Keep your `data-export.json` file until migration is verified!
