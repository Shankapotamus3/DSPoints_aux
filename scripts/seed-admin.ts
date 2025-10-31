import { db } from "../server/db";
import { users } from "../shared/schema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function seedAdmin() {
  try {
    console.log("🌱 Starting admin seed...");
    
    // Check if any users exist
    const existingUsers = await db.select().from(users);
    
    if (existingUsers.length > 0) {
      console.log(`✅ Database already has ${existingUsers.length} user(s). Skipping seed.`);
      console.log("   Existing users:", existingUsers.map(u => u.username).join(", "));
      process.exit(0);
    }
    
    // Create default admin
    const defaultPassword = "admin123"; // More secure default password
    const defaultPin = "1234";
    
    const [admin] = await db.insert(users).values({
      username: "admin",
      password: await hashPassword(defaultPassword),
      pin: await hashPassword(defaultPin),
      displayName: "Admin",
      avatar: "👑",
      avatarType: "emoji",
      isAdmin: true,
      points: 0,
    }).returning();
    
    console.log("✅ Default admin account created successfully!");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   PIN: 1234");
    console.log("   ⚠️  IMPORTANT: Change the PIN after first login for security!");
    console.log("   User ID:", admin.id);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to seed admin user:", error);
    process.exit(1);
  }
}

seedAdmin();
