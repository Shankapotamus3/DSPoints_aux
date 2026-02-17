import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { prewarmDatabase, startKeepAlive, db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("🔧 Starting server initialization...");
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    
    // Prewarm database connection BEFORE routes to avoid cold start delays
    await prewarmDatabase();
    startKeepAlive();

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS voice_messages (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          audio_url TEXT NOT NULL,
          created_by_id VARCHAR NOT NULL REFERENCES users(id),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        ALTER TABLE chores ADD COLUMN IF NOT EXISTS voice_message_id VARCHAR
      `);
    } catch (e) {
      console.warn("⚠️ Voice messages table auto-migration skipped:", (e as Error).message);
    }

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log("🔨 Setting up Vite dev server...");
      await setupVite(app, server);
    } else {
      console.log("📦 Serving static files...");
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    // Listen on both IPv4 and IPv6 for compatibility with different platforms
    // Railway v2 requires IPv6 (::) for healthchecks
    const host = process.env.RAILWAY_ENVIRONMENT ? "::" : "0.0.0.0";
    
    console.log(`🌐 Starting server on ${host}:${port}...`);
    
    server.listen({
      port,
      host,
      reusePort: true,
    }, () => {
      log(`✅ Server running on port ${port} (host: ${host})`);
      console.log(`🏥 Health check available at http://localhost:${port}/health`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      console.error("❌ Server error:", error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();
