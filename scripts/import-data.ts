import { db } from "../server/db";
import { users, chores, rewards, transactions, notifications, messages, punishments, pushSubscriptions } from "../shared/schema";
import fs from "fs";
import { sql } from "drizzle-orm";

async function importData() {
  try {
    console.log("📥 Starting data import to Railway database...\n");

    // Read exported data
    const exportPath = "data-export.json";
    if (!fs.existsSync(exportPath)) {
      console.error("❌ Error: data-export.json not found!");
      console.log("   Please upload the exported file first.");
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(exportPath, "utf-8"));

    console.log("📊 Import Summary:");
    console.log(`   Users to import: ${data.users.length}`);
    console.log(`   Chores to import: ${data.chores.length}`);
    console.log(`   Rewards to import: ${data.rewards.length}`);
    console.log(`   Transactions to import: ${data.transactions.length}`);
    console.log(`   Notifications to import: ${data.notifications.length}`);
    console.log(`   Messages to import: ${data.messages.length}`);
    console.log(`   Punishments to import: ${data.punishments.length}`);
    console.log(`   Push Subscriptions to import: ${data.pushSubscriptions.length}`);

    // Check if database already has data
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log(`\n⚠️  WARNING: Database already contains ${existingUsers.length} user(s)!`);
      console.log("   This import will ADD data, not replace it.");
      console.log("   To continue, set FORCE_IMPORT=true as environment variable.");
      
      if (process.env.FORCE_IMPORT !== "true") {
        console.log("\n❌ Import cancelled to prevent duplicates.");
        process.exit(1);
      }
      console.log("\n⚠️  FORCE_IMPORT enabled, proceeding...");
    }

    console.log("\n🚀 Starting import...");

    // Import in correct order (respecting foreign key constraints)
    
    // 1. Users (no dependencies)
    if (data.users.length > 0) {
      console.log("   Importing users...");
      await db.insert(users).values(data.users).onConflictDoNothing();
      console.log(`   ✅ ${data.users.length} users imported`);
    }

    // 2. Chores (depends on users)
    if (data.chores.length > 0) {
      console.log("   Importing chores...");
      await db.insert(chores).values(data.chores).onConflictDoNothing();
      console.log(`   ✅ ${data.chores.length} chores imported`);
    }

    // 3. Rewards (no dependencies)
    if (data.rewards.length > 0) {
      console.log("   Importing rewards...");
      await db.insert(rewards).values(data.rewards).onConflictDoNothing();
      console.log(`   ✅ ${data.rewards.length} rewards imported`);
    }

    // 4. Transactions (depends on users, chores, rewards)
    if (data.transactions.length > 0) {
      console.log("   Importing transactions...");
      await db.insert(transactions).values(data.transactions).onConflictDoNothing();
      console.log(`   ✅ ${data.transactions.length} transactions imported`);
    }

    // 5. Notifications (depends on users)
    if (data.notifications.length > 0) {
      console.log("   Importing notifications...");
      await db.insert(notifications).values(data.notifications).onConflictDoNothing();
      console.log(`   ✅ ${data.notifications.length} notifications imported`);
    }

    // 6. Messages (depends on users)
    if (data.messages.length > 0) {
      console.log("   Importing messages...");
      await db.insert(messages).values(data.messages).onConflictDoNothing();
      console.log(`   ✅ ${data.messages.length} messages imported`);
    }

    // 7. Punishments (no dependencies)
    if (data.punishments.length > 0) {
      console.log("   Importing punishments...");
      await db.insert(punishments).values(data.punishments).onConflictDoNothing();
      console.log(`   ✅ ${data.punishments.length} punishments imported`);
    }

    // 8. Push Subscriptions (depends on users)
    if (data.pushSubscriptions.length > 0) {
      console.log("   Importing push subscriptions...");
      await db.insert(pushSubscriptions).values(data.pushSubscriptions).onConflictDoNothing();
      console.log(`   ✅ ${data.pushSubscriptions.length} push subscriptions imported`);
    }

    console.log("\n✅ Import completed successfully!");
    console.log("\n🎉 Your Railway database now has all your Replit data!");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Import failed:", error);
    console.error("\nIf you see foreign key errors, make sure:");
    console.error("   - Database migrations have been run (npm run db:push)");
    console.error("   - The export file is from a compatible schema version");
    process.exit(1);
  }
}

importData();
