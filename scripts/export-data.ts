import { db } from "../server/db";
import { users, chores, rewards, transactions, notifications, messages, punishments, pushSubscriptions } from "../shared/schema";
import fs from "fs";

async function exportData() {
  try {
    console.log("📦 Starting data export from Replit database...\n");

    // Export all tables
    const data = {
      users: await db.select().from(users),
      chores: await db.select().from(chores),
      rewards: await db.select().from(rewards),
      transactions: await db.select().from(transactions),
      notifications: await db.select().from(notifications),
      messages: await db.select().from(messages),
      punishments: await db.select().from(punishments),
      pushSubscriptions: await db.select().from(pushSubscriptions),
    };

    // Log counts
    console.log("📊 Export Summary:");
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Chores: ${data.chores.length}`);
    console.log(`   Rewards: ${data.rewards.length}`);
    console.log(`   Transactions: ${data.transactions.length}`);
    console.log(`   Notifications: ${data.notifications.length}`);
    console.log(`   Messages: ${data.messages.length}`);
    console.log(`   Punishments: ${data.punishments.length}`);
    console.log(`   Push Subscriptions: ${data.pushSubscriptions.length}`);

    // Save to JSON file
    const exportPath = "data-export.json";
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Data exported successfully to: ${exportPath}`);
    console.log(`📁 File size: ${(fs.statSync(exportPath).size / 1024).toFixed(2)} KB`);
    console.log("\n🚀 Next steps:");
    console.log("   1. Download 'data-export.json' from Replit");
    console.log("   2. Upload it to Railway via the shell");
    console.log("   3. Run: npx tsx scripts/import-data.ts");

    process.exit(0);
  } catch (error) {
    console.error("❌ Export failed:", error);
    process.exit(1);
  }
}

exportData();
