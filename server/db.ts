import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect if we're using Neon (WebSocket-based) or standard PostgreSQL
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') || 
                       process.env.DATABASE_URL.includes('neon.app');

let pool: NeonPool | pg.Pool;
let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

if (isNeonDatabase) {
  // Use Neon serverless driver (WebSocket-based)
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle({ client: pool as NeonPool, schema });
  console.log("📊 Using Neon serverless database driver");
} else {
  // Use standard PostgreSQL driver (for Railway, Render, etc.)
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle({ client: pool as pg.Pool, schema });
  console.log("📊 Using standard PostgreSQL driver");
}

// Prewarm the database connection to avoid cold start delays
async function prewarmDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log("🔥 Database connection prewarmed");
  } catch (error) {
    console.error("⚠️ Failed to prewarm database:", error);
  }
}

// Keep-alive ping to prevent idle connection timeouts (every 4 minutes)
let keepAliveInterval: NodeJS.Timeout | null = null;

function startKeepAlive(): void {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      console.error("⚠️ Keep-alive ping failed:", error);
    }
  }, 4 * 60 * 1000); // 4 minutes
  
  console.log("💓 Database keep-alive started (4 min interval)");
}

export { pool, db, isNeonDatabase, prewarmDatabase, startKeepAlive };
