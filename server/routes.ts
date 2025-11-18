import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChoreSchema, insertRewardSchema, insertTransactionSchema, insertUserSchema, choreApprovalSchema, insertMessageSchema, insertPunishmentSchema, insertPushSubscriptionSchema, pointAdjustmentSchema, choreCompletionSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { shouldUseCloudinary, getCloudinaryUploadSignature, isCloudinaryConfigured } from "./cloudinaryStorage";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import bcrypt from "bcrypt";
import crypto from "crypto";
import webpush from "web-push";

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for Railway and other platforms
  // Register this FIRST so it works even if other initialization fails
  app.get("/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  console.log("🏥 Health endpoint registered at /health");

  // Helper function to hash PIN/password using bcrypt (salted, secure)
  async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  // Helper function to verify password/PIN (supports legacy SHA-256 and new bcrypt)
  async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // Try bcrypt first (for new accounts)
    try {
      const isBcryptValid = await bcrypt.compare(password, hash);
      if (isBcryptValid) return true;
    } catch (error) {
      // If bcrypt fails, might be a legacy SHA-256 hash
    }
    
    // Fall back to SHA-256 for legacy accounts
    const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash === sha256Hash;
  }

  // Helper function to check if hash is bcrypt format
  function isBcryptHash(hash: string): boolean {
    return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
  }

  // Helper function to sanitize user object (remove sensitive fields)
  function sanitizeUser(user: any) {
    const { password, pin, ...safeUser } = user;
    return safeUser;
  }

  // Initialize default admin account if no users exist
  async function initializeDefaultAdmin() {
    try {
      const users = await storage.getUsers();
      if (users.length === 0) {
        const defaultPin = "1234"; // Default PIN
        await storage.createUser({
          username: "admin",
          password: await hashPassword("admin"),
          pin: await hashPassword(defaultPin),
          displayName: "Admin",
          avatar: "👑",
          avatarType: "emoji",
          isAdmin: true,
        });
        console.log("✅ Default admin account created");
        console.log("   Username: admin");
        console.log("   PIN: 1234");
        console.log("   ⚠️  Please change the PIN after first login for security!");
      }
    } catch (error) {
      console.error("⚠️  Failed to initialize default admin (will retry later):", error);
    }
  }

  // Initialize default admin on startup (non-blocking)
  initializeDefaultAdmin().catch((error) => {
    console.error("⚠️  Default admin initialization error:", error);
  });

  // Setup session store - use PostgreSQL if available, otherwise fall back to memory store
  let sessionStore;
  
  if (process.env.DATABASE_URL) {
    try {
      const PgSession = connectPgSimple(session);
      sessionStore = new PgSession({
        conObject: {
          connectionString: process.env.DATABASE_URL,
        },
        tableName: "session",
        createTableIfMissing: true,
      });
      console.log("✅ PostgreSQL session store configured");
    } catch (error) {
      console.error("⚠️  Failed to configure PostgreSQL session store, using memory store:", error);
    }
  } else {
    console.log("ℹ️  Using memory session store (DATABASE_URL not set)");
  }
  
  // Trust proxy for production deployments
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "chore-rewards-secret-key",
      resave: false,
      saveUninitialized: false,
      proxy: process.env.NODE_ENV === "production",
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    })
  );

  // Helper function to get current user from request
  function getCurrentUserId(req: Request): string | null {
    return req.session.userId || null;
  }

  // Middleware to require authentication
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  }

  // Helper function to check admin permissions for requesting user
  async function checkAdminPermission(req: Request): Promise<boolean> {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) return false;
    const user = await storage.getUser(currentUserId);
    return user?.isAdmin === true;
  }

  // Middleware to require admin access
  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = await checkAdminPermission(req);
      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Authentication error" });
    }
  }

  // Middleware to require owner or admin access for user-specific operations
  async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUserId = getCurrentUserId(req);
      const targetUserId = req.params.id;
      
      // Check if current user is the owner or an admin
      const isOwner = currentUserId === targetUserId;
      const isAdmin = await checkAdminPermission(req);
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Access denied. Only the user or an admin can perform this action." });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: "Authentication error" });
    }
  }

  // Configure web-push with VAPID keys
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails(
        'mailto:admin@chorerewards.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      console.log('Web push configured successfully');
    } catch (error) {
      console.error('Failed to configure web push - invalid VAPID keys:', error);
      console.log('Push notifications will not work until valid VAPID keys are set');
    }
  } else {
    console.log('VAPID keys not set - push notifications disabled');
  }

  // Helper function to send push notification to a specific user
  async function sendPushNotification(userId: string, title: string, message: string, type: string, choreId?: string) {
    try {
      console.log(`🔔 Attempting to send push notification to user ${userId}`);
      console.log(`📧 Title: "${title}", Type: ${type}`);
      
      const subscriptions = await storage.getPushSubscriptions(userId);
      console.log(`📱 Found ${subscriptions.length} push subscription(s) for user ${userId}`);
      
      if (subscriptions.length === 0) {
        console.log(`⚠️ No push subscriptions found for user ${userId} - notification will not be sent`);
        return;
      }
      
      const payload = JSON.stringify({
        title,
        message,
        type,
        choreId
      });

      // Send to all subscriptions for this user
      const promises = subscriptions.map(async (sub, index) => {
        try {
          console.log(`📤 Sending push notification ${index + 1}/${subscriptions.length} to endpoint: ${sub.endpoint.substring(0, 50)}...`);
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload
          );
          console.log(`✅ Push notification ${index + 1} sent successfully`);
        } catch (error: any) {
          // If subscription is no longer valid (410 Gone), remove it
          if (error.statusCode === 410) {
            console.log(`🗑️ Removing invalid push subscription (410 Gone): ${sub.endpoint.substring(0, 50)}...`);
            await storage.deletePushSubscription(sub.endpoint);
          }
          console.error(`❌ Failed to send push ${index + 1}:`, error.message || error);
        }
      });

      await Promise.all(promises);
      console.log(`✅ Completed sending push notifications to user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
    }
  }

  // Helper function to send notifications (both in-app and push)
  async function sendNotification(userId: string, title: string, message: string, type: string, choreId?: string) {
    try {
      // Create in-app notification
      await storage.createNotification({
        userId,
        title,
        message,
        type,
        choreId
      });

      // Send push notification
      await sendPushNotification(userId, title, message, type, choreId);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  // Authentication Routes
  
  // Get all users for login selection (public endpoint)
  app.get("/api/auth/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Return only safe user info for login screen
      const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        avatarType: u.avatarType,
        avatarUrl: u.avatarUrl,
        hasPin: !!u.pin,
      }));
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // PIN login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { userId, pin } = req.body;
      
      if (!userId || !pin) {
        return res.status(400).json({ message: "User ID and PIN are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user has a PIN set
      if (!user.pin) {
        return res.status(401).json({ message: "PIN not set for this user" });
      }

      // Verify PIN
      const isPinValid = await verifyPassword(pin, user.pin);
      if (!isPinValid) {
        return res.status(401).json({ message: "Invalid PIN" });
      }

      // Migrate legacy SHA-256 hash to bcrypt on successful login
      if (!isBcryptHash(user.pin)) {
        const newPinHash = await hashPassword(pin);
        await storage.updateUser(user.id, { pin: newPinHash });
      }

      // Set session and explicitly save it
      req.session.userId = user.id;
      
      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed - session error" });
        }
        
        res.json({ 
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            avatarType: user.avatarType,
            avatarUrl: user.avatarUrl,
            points: user.points,
            isAdmin: user.isAdmin,
          }
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user with points (requires authentication)
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });
  
  // Get all family members (requires authentication)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove sensitive fields from response
      const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        avatarType: u.avatarType,
        avatarUrl: u.avatarUrl,
        points: u.points,
        isAdmin: u.isAdmin,
      }));
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Update user profile (requires owner or admin access)
  app.put("/api/users/:id", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertUserSchema.partial().omit({ password: true }).parse(req.body);
      
      // Hash PIN if it's being updated
      if (updates.pin) {
        updates.pin = await hashPassword(updates.pin);
      }
      
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Create new family member (requires authentication)
  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const parsedData = insertUserSchema.omit({ password: true }).parse(req.body);
      
      // For family management, set a default password and hash it securely
      const userData = {
        ...parsedData,
        password: await hashPassword("family"), // Hash default password for family members
        isAdmin: false // Family members are not admins by default
      };

      // Hash PIN if provided
      if (userData.pin) {
        userData.pin = await hashPassword(userData.pin);
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(userData);
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create family member" });
    }
  });

  // Toggle admin status (admin only)
  app.put("/api/users/:id/admin", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin } = req.body;

      if (typeof isAdmin !== 'boolean') {
        return res.status(400).json({ message: "isAdmin must be a boolean value" });
      }

      // Get the target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Safety check: prevent removing the last admin
      if (!isAdmin && targetUser.isAdmin) {
        // Only check if we're removing admin from someone who is currently an admin
        const allUsers = await storage.getUsers();
        const adminCount = allUsers.filter(u => u.isAdmin).length;
        
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot remove the last admin. At least one admin is required." });
        }
      }

      const user = await storage.updateUser(id, { isAdmin });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update admin status" });
    }
  });

  // Adjust user points (admin only)
  app.post("/api/users/:id/adjust-points", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason } = pointAdjustmentSchema.parse(req.body);

      // Get the target user
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate new points
      const newPoints = targetUser.points + amount;
      
      // Prevent negative balances
      if (newPoints < 0) {
        return res.status(400).json({ 
          message: `Cannot remove ${Math.abs(amount)} points. User only has ${targetUser.points} points available.`,
          currentPoints: targetUser.points,
          requestedChange: amount
        });
      }
      
      // Update user points
      const user = await storage.updateUserPoints(id, newPoints);
      if (!user) {
        return res.status(500).json({ message: "Failed to update user points" });
      }

      // Create transaction record for audit trail
      await storage.createTransaction({
        type: amount > 0 ? "earn" : "spend",
        amount: Math.abs(amount),
        description: `Admin adjustment: ${reason}`,
        choreId: null,
        rewardId: null,
        userId: id,
      });

      res.json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid point adjustment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to adjust user points" });
    }
  });

  // Chore routes
  app.get("/api/chores", async (req, res) => {
    try {
      // Reset recurring chores that are due again
      await storage.resetRecurringChores();
      
      const chores = await storage.getChores();
      res.json(chores);
    } catch (error) {
      console.error("Error in GET /api/chores:", error);
      res.status(500).json({ message: "Failed to get chores" });
    }
  });

  app.post("/api/chores", async (req, res) => {
    try {
      const choreData = insertChoreSchema.parse(req.body);
      const chore = await storage.createChore(choreData);
      res.status(201).json(chore);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid chore data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create chore" });
    }
  });

  app.put("/api/chores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertChoreSchema.partial().parse(req.body);
      const chore = await storage.updateChore(id, updates);
      if (!chore) {
        return res.status(404).json({ message: "Chore not found" });
      }
      res.json(chore);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid chore data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update chore" });
    }
  });

  app.delete("/api/chores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteChore(id);
      if (!deleted) {
        return res.status(404).json({ message: "Chore not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete chore" });
    }
  });

  app.post("/api/chores/:id/complete", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { completedAt } = choreCompletionSchema.parse(req.body);
      
      const currentUserId = getCurrentUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Use provided date or default to now
      const completionDate = completedAt ? new Date(completedAt) : new Date();
      
      const chore = await storage.completeChore(id, currentUserId, completionDate);
      if (!chore) {
        return res.status(404).json({ message: "Chore not found or already completed" });
      }

      // Send notification to admins about pending approval
      const allUsers = await storage.getUsers();
      const admins = allUsers.filter(user => user.isAdmin);
      
      const completer = await storage.getUser(currentUserId);
      const completerName = completer?.displayName || completer?.username || "Someone";
      
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          "Chore Completed - Pending Approval",
          `${chore.name} has been completed by ${completerName} and needs your approval`,
          "chore_completed",
          chore.id
        );
      }

      res.json(chore);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid completion data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to complete chore" });
    }
  });

  // Approval routes (admin only)
  app.post("/api/chores/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { comment } = choreApprovalSchema.parse(req.body);
      
      const currentUserId = getCurrentUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const chore = await storage.getChore(id);
      if (!chore) {
        return res.status(404).json({ message: "Chore not found" });
      }

      if (chore.status !== 'completed') {
        return res.status(400).json({ message: "Chore must be completed before approval" });
      }

      // Approve the chore
      const approvedChore = await storage.approveChore(id, currentUserId, comment);
      if (!approvedChore) {
        return res.status(500).json({ message: "Failed to approve chore" });
      }

      // Award points to the user who completed the chore
      const userId = approvedChore.completedById;
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          const newPoints = user.points + approvedChore.points;
          await storage.updateUserPoints(userId, newPoints);
          
          // Create transaction record
          await storage.createTransaction({
            type: "earn",
            amount: approvedChore.points,
            description: `Approved: ${approvedChore.name}`,
            choreId: approvedChore.id,
            rewardId: null,
            userId: userId,
          });

          // Send approval notification to the user who completed the chore
          await sendNotification(
            userId,
            "Chore Approved! 🎉",
            `Your completion of "${approvedChore.name}" has been approved. You earned ${approvedChore.points} points!`,
            "chore_approved",
            approvedChore.id
          );
        }
      }

      res.json(approvedChore);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid approval data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to approve chore" });
    }
  });

  app.post("/api/chores/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { comment } = choreApprovalSchema.parse(req.body);
      
      const currentUserId = getCurrentUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const chore = await storage.getChore(id);
      if (!chore) {
        return res.status(404).json({ message: "Chore not found" });
      }

      if (chore.status !== 'completed') {
        return res.status(400).json({ message: "Chore must be completed before rejection" });
      }

      // Reject the chore
      const rejectedChore = await storage.rejectChore(id, currentUserId, comment);
      if (!rejectedChore) {
        return res.status(500).json({ message: "Failed to reject chore" });
      }

      // Send rejection notification to the user who completed the chore
      const userId = rejectedChore.completedById;
      if (userId) {
        await sendNotification(
          userId,
          "Chore Rejected",
          `Your completion of "${rejectedChore.name}" was rejected. ${comment ? `Reason: ${comment}` : 'Please try again.'}`,
          "chore_rejected",
          rejectedChore.id
        );
      }

      res.json(rejectedChore);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rejection data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to reject chore" });
    }
  });

  // Get pending approval chores (admin only)
  app.get("/api/chores/pending-approval", requireAdmin, async (req, res) => {
    try {
      const pendingChores = await storage.getPendingApprovalChores();
      res.json(pendingChores);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pending approval chores" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notifications = await storage.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread notifications" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Reward routes
  app.get("/api/rewards", async (req, res) => {
    try {
      const rewards = await storage.getRewards();
      res.json(rewards);
    } catch (error) {
      res.status(500).json({ message: "Failed to get rewards" });
    }
  });

  app.post("/api/rewards", async (req, res) => {
    try {
      const rewardData = insertRewardSchema.parse(req.body);
      const reward = await storage.createReward(rewardData);
      res.status(201).json(reward);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reward data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create reward" });
    }
  });

  app.put("/api/rewards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertRewardSchema.partial().parse(req.body);
      const reward = await storage.updateReward(id, updates);
      if (!reward) {
        return res.status(404).json({ message: "Reward not found" });
      }
      res.json(reward);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reward data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update reward" });
    }
  });

  app.delete("/api/rewards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteReward(id);
      if (!deleted) {
        return res.status(404).json({ message: "Reward not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete reward" });
    }
  });

  app.post("/api/rewards/:id/claim", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const reward = await storage.getReward(id);
      if (!reward) {
        return res.status(404).json({ message: "Reward not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.points < reward.cost) {
        return res.status(400).json({ message: "Insufficient points" });
      }

      // Deduct points from user
      const newPoints = user.points - reward.cost;
      await storage.updateUserPoints(userId, newPoints);

      // Mark reward as unavailable (one-time use)
      await storage.updateReward(id, { isAvailable: false });

      // Create transaction record
      await storage.createTransaction({
        type: "spend",
        amount: reward.cost,
        description: `Claimed: ${reward.name}`,
        choreId: null,
        rewardId: reward.id,
        userId: userId,
      });

      // Send notification to admins about reward claim
      const allUsers = await storage.getUsers();
      const admins = allUsers.filter(u => u.isAdmin);
      
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          "Reward Claimed",
          `${user.displayName || user.username} claimed "${reward.name}" for ${reward.cost} points`,
          "reward_claimed"
        );
      }

      res.json({ message: "Reward claimed successfully", newPoints });
    } catch (error) {
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  // Avatar upload routes using object storage integration blueprint
  
  // REMOVED INSECURE GENERIC ENDPOINT: Generic avatar upload endpoint removed for security.
  // All avatar uploads must now go through user-specific endpoints with authentication.
  app.post("/api/avatar-upload", (req, res) => {
    res.status(404).json({ 
      message: "This endpoint has been removed for security. Use /api/users/:id/avatar-upload instead." 
    });
  });
  
  // Serve private objects (avatars) with proper access control
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      // Get the current user for access control
      const currentUserId = getCurrentUserId(req);
      
      // Get the object file
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      // Check if user can access this object (with proper ACL enforcement)
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId: currentUserId || undefined, // Convert null to undefined
        objectFile: objectFile,
        requestedPermission: undefined // defaults to READ permission
      });
      
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied to this object" });
      }
      
      // Serve the object with appropriate caching
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for avatar image (requires owner or admin access)
  app.post("/api/users/:id/avatar-upload", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`🖼️  Getting avatar upload URL for user: ${id}`);
      
      // Use Cloudinary on Railway or when configured, otherwise use Replit object storage
      if (shouldUseCloudinary()) {
        console.log(`📤 Using Cloudinary for avatar upload`);
        const cloudinaryParams = await getCloudinaryUploadSignature('avatars');
        res.json({ 
          uploadURL: `https://api.cloudinary.com/v1_1/${cloudinaryParams.cloudName}/image/upload`,
          cloudinaryParams,
          storageType: 'cloudinary'
        });
      } else {
        console.log(`📤 Using Replit object storage for avatar upload`);
        const objectStorageService = new ObjectStorageService();
        const uploadURL = await objectStorageService.getUserScopedAvatarUploadURL(id);
        console.log(`✅ Avatar upload URL generated successfully`);
        res.json({ uploadURL, storageType: 'replit' });
      }
    } catch (error) {
      console.error("❌ Error getting avatar upload URL:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      res.status(500).json({ message: "Failed to get upload URL", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Update user avatar after upload (requires owner or admin access)
  app.put("/api/users/:id/avatar", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { avatarUrl } = req.body;

      console.log(`🖼️  Avatar update request for user ${id}`);
      console.log(`📥 Received avatarUrl:`, avatarUrl);

      if (!avatarUrl) {
        console.error(`❌ No avatarUrl provided`);
        return res.status(400).json({ message: "avatarUrl is required" });
      }

      // Input validation for avatarUrl format
      try {
        insertUserSchema.pick({ avatarUrl: true }).parse({ avatarUrl });
      } catch (validationError) {
        console.error(`❌ Invalid avatarUrl format:`, validationError);
        return res.status(400).json({ 
          message: "Invalid avatar URL format",
          errors: validationError instanceof z.ZodError ? validationError.errors : []
        });
      }

      // Verify user exists
      const user = await storage.getUser(id);
      if (!user) {
        console.error(`❌ User ${id} not found`);
        return res.status(404).json({ message: "User not found" });
      }

      // Check if this is a Cloudinary URL
      const isCloudinaryUrl = avatarUrl.includes('cloudinary.com');
      console.log(`🔍 Is Cloudinary URL: ${isCloudinaryUrl}`);
      
      let finalAvatarUrl = avatarUrl;
      
      if (isCloudinaryUrl) {
        // Cloudinary URLs are publicly accessible and managed by Cloudinary
        // No ownership validation or ACL policy needed
        console.log(`☁️ Saving Cloudinary avatar URL for user ${id}: ${avatarUrl}`);
      } else {
        // Replit object storage - validate ownership and set ACL
        const objectStorageService = new ObjectStorageService();
        
        // SECURITY: Validate that the avatar URL belongs to this user
        const isValidOwnership = objectStorageService.validateAvatarUrlOwnership(avatarUrl, id);
        if (!isValidOwnership) {
          console.error(`❌ Avatar ownership validation failed for user ${id}`);
          return res.status(403).json({ 
            message: "Avatar URL does not belong to this user. Upload URLs must be obtained through the proper avatar-upload endpoint." 
          });
        }
        
        // Set ACL policy to make avatar public (family members can view each other's avatars)
        const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          avatarUrl,
          {
            owner: id, // User owns their avatar
            visibility: "public", // Public so all family members can view
          }
        );
        finalAvatarUrl = objectPath;
        console.log(`📦 Saving Replit storage avatar URL for user ${id}: ${finalAvatarUrl}`);
      }

      console.log(`💾 Updating user with avatarType: "image", avatarUrl: ${finalAvatarUrl}`);

      // Update user with new avatar settings
      const updatedUser = await storage.updateUser(id, {
        avatarType: "image",
        avatarUrl: finalAvatarUrl,
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user avatar" });
      }

      res.json({ 
        user: sanitizeUser(updatedUser)
      });
    } catch (error) {
      console.error("Error updating user avatar:", error);
      res.status(500).json({ message: "Failed to update avatar" });
    }
  });

  // Message Routes
  
  // Get upload URL for message image attachment
  app.get("/api/messages/image-upload", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`📷 Getting message image upload URL for user: ${userId}`);
      
      // Use Cloudinary on Railway or when configured, otherwise use Replit object storage
      if (shouldUseCloudinary()) {
        console.log(`📤 Using Cloudinary for message image upload`);
        const cloudinaryParams = await getCloudinaryUploadSignature('messages');
        res.json({ 
          uploadURL: `https://api.cloudinary.com/v1_1/${cloudinaryParams.cloudName}/image/upload`,
          cloudinaryParams,
          storageType: 'cloudinary'
        });
      } else {
        console.log(`📤 Using Replit object storage for message image upload`);
        const objectStorageService = new ObjectStorageService();
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        console.log(`✅ Message image upload URL generated successfully`);
        res.json({ uploadURL, storageType: 'replit' });
      }
    } catch (error) {
      console.error("❌ Error getting message image upload URL:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      res.status(500).json({ message: "Failed to get upload URL", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Finalize message image upload and get public URL
  app.post("/api/messages/image-finalize", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { objectPath } = req.body;
      if (!objectPath) {
        return res.status(400).json({ message: "objectPath is required" });
      }

      const objectStorageService = new ObjectStorageService();
      // Make the message image publicly viewable by all family members
      const finalPath = await objectStorageService.trySetObjectEntityAclPolicy(
        objectPath,
        {
          owner: userId,
          visibility: "public",
        }
      );

      res.json({ imageUrl: finalPath });
    } catch (error) {
      console.error("Error finalizing message image:", error);
      res.status(500).json({ message: "Failed to finalize image upload" });
    }
  });
  
  // Get all messages for current user
  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const allMessages = await storage.getMessages(userId);
      res.json(allMessages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Get conversation between two users
  app.get("/api/messages/conversation/:otherUserId", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { otherUserId } = req.params;
      
      // Verify both users exist
      const otherUser = await storage.getUser(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const conversation = await storage.getConversation(userId, otherUserId);
      
      // Only mark as read the messages WHERE current user is the recipient
      await storage.markConversationAsRead(userId, otherUserId);
      
      res.json(conversation);
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  // Get unread message count
  app.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Send a message
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { recipientId, content, imageUrl } = insertMessageSchema.parse({
        senderId: userId,
        ...req.body,
      });

      const message = await storage.createMessage({
        senderId: userId,
        recipientId,
        content,
        imageUrl,
      });

      // Send push notification to recipient(s)
      const sender = await storage.getUser(userId);
      const senderName = sender?.displayName || sender?.username || "Someone";
      
      if (recipientId) {
        // Direct message - send to specific recipient
        await sendPushNotification(
          recipientId,
          `New message from ${senderName}`,
          content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          "new_message"
        );
      } else {
        // Broadcast message - send to all users except sender
        const allUsers = await storage.getUsers();
        for (const user of allUsers) {
          if (user.id !== userId) {
            await sendPushNotification(
              user.id,
              `Broadcast from ${senderName}`,
              content.substring(0, 100) + (content.length > 100 ? '...' : ''),
              "new_message"
            );
          }
        }
      }

      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Mark a message as read
  app.put("/api/messages/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;
      const message = await storage.markMessageAsRead(id);

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Only allow recipient to mark as read
      if (message.recipientId !== userId) {
        return res.status(403).json({ message: "Not authorized to mark this message as read" });
      }

      res.json(message);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // ====================
  // PUNISHMENT ROUTES
  // ====================

  // Get all punishments
  app.get("/api/punishments", requireAuth, async (req, res) => {
    try {
      const punishments = await storage.getPunishments();
      res.json(punishments);
    } catch (error) {
      console.error("Error getting punishments:", error);
      res.status(500).json({ message: "Failed to get punishments" });
    }
  });

  // Create a punishment
  app.post("/api/punishments", requireAuth, async (req, res) => {
    try {
      const punishmentData = insertPunishmentSchema.parse(req.body);
      const punishment = await storage.createPunishment(punishmentData);
      res.json(punishment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid punishment data", errors: error.errors });
      }
      console.error("Error creating punishment:", error);
      res.status(500).json({ message: "Failed to create punishment" });
    }
  });

  // Update punishment text
  app.put("/api/punishments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        text: z.string().trim().max(500).optional(),
      });
      const { text } = updateSchema.parse(req.body);
      const punishment = await storage.updatePunishment(id, text || "");

      if (!punishment) {
        return res.status(404).json({ message: "Punishment not found" });
      }

      res.json(punishment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid text data", errors: error.errors });
      }
      console.error("Error updating punishment:", error);
      res.status(500).json({ message: "Failed to update punishment" });
    }
  });

  // Mark punishment as complete
  app.put("/api/punishments/:id/complete", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const punishment = await storage.markPunishmentComplete(id);

      if (!punishment) {
        return res.status(404).json({ message: "Punishment not found" });
      }

      res.json(punishment);
    } catch (error) {
      console.error("Error marking punishment as complete:", error);
      res.status(500).json({ message: "Failed to mark punishment as complete" });
    }
  });

  // Delete a punishment
  app.delete("/api/punishments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePunishment(id);

      if (!deleted) {
        return res.status(404).json({ message: "Punishment not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting punishment:", error);
      res.status(500).json({ message: "Failed to delete punishment" });
    }
  });

  // ====================
  // PUSH SUBSCRIPTION ROUTES
  // ====================

  // Debug endpoint to receive client push support information
  app.post("/api/debug/push-support", (req, res) => {
    const { supported, serviceWorker, pushManager, notification, userAgent, notificationPermission } = req.body;
    console.log('📊 CLIENT PUSH SUPPORT CHECK:');
    console.log(`  Supported: ${supported}`);
    console.log(`  ServiceWorker: ${serviceWorker}`);
    console.log(`  PushManager: ${pushManager}`);
    console.log(`  Notification: ${notification}`);
    console.log(`  Permission: ${notificationPermission}`);
    console.log(`  User Agent: ${userAgent}`);
    res.json({ received: true });
  });

  // Debug endpoint to receive subscription flow steps
  app.post("/api/debug/push-step", (req, res) => {
    const { step, data } = req.body;
    console.log(`🔄 PUSH STEP: ${step}`, data ? JSON.stringify(data) : '');
    res.json({ received: true });
  });

  // Debug endpoint to receive client-side push errors
  app.post("/api/debug/push-error", (req, res) => {
    const { step, error, stack, userAgent } = req.body;
    console.log('🚨 CLIENT PUSH ERROR:');
    console.log(`  Step: ${step}`);
    console.log(`  Error: ${error}`);
    console.log(`  User Agent: ${userAgent}`);
    if (stack) {
      console.log(`  Stack: ${stack}`);
    }
    res.json({ received: true });
  });

  // Get VAPID public key for push subscription
  app.get("/api/push/vapid-public-key", (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
      return res.status(500).json({ message: "Push notifications not configured" });
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  });

  // Subscribe to push notifications
  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    try {
      console.log('📱 Push subscription request received');
      const userId = getCurrentUserId(req);
      if (!userId) {
        console.log('❌ Push subscribe: No user ID found');
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`📱 Processing push subscription for user ${userId}`);
      console.log(`📱 Subscription data:`, JSON.stringify(req.body, null, 2));

      const subscriptionData = insertPushSubscriptionSchema.parse({
        userId,
        ...req.body,
      });

      const subscription = await storage.createPushSubscription(subscriptionData);
      console.log(`✅ Push subscription created successfully for user ${userId}`);
      console.log(`✅ Subscription endpoint: ${subscription.endpoint.substring(0, 50)}...`);
      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log('❌ Push subscribe: Invalid data', error.errors);
        return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
      }
      console.error("❌ Error creating push subscription:", error);
      res.status(500).json({ message: "Failed to subscribe to push notifications" });
    }
  });

  // Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", requireAuth, async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint required" });
      }

      const deleted = await storage.deletePushSubscription(endpoint);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      res.status(500).json({ message: "Failed to unsubscribe from push notifications" });
    }
  });

  // ====================
  // LOTTERY TICKET ROUTES
  // ====================

  // Get user's lottery ticket history
  app.get("/api/lottery/tickets", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const tickets = await storage.getLotteryTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error getting lottery tickets:", error);
      res.status(500).json({ message: "Failed to get lottery tickets" });
    }
  });

  // Purchase and draw a lottery ticket
  app.post("/api/lottery/draw", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Import lottery logic
      const { drawLotteryTicket, LOTTERY_TICKET_COST } = await import('./lottery.js');

      // Check if user has enough points
      if (user.points < LOTTERY_TICKET_COST) {
        return res.status(400).json({ message: "Not enough points to purchase a lottery ticket" });
      }

      // Draw a random outcome
      const outcome = drawLotteryTicket();

      // Handle special case: "Lose all points"
      let actualPointsAwarded = outcome.pointsAwarded;
      if (outcome.pointsAwarded === -999) {
        actualPointsAwarded = -(user.points - LOTTERY_TICKET_COST);
      }

      // Calculate new point balance
      const newBalance = user.points - LOTTERY_TICKET_COST + actualPointsAwarded;

      // Update user points
      await storage.updateUserPoints(userId, newBalance);

      // Create lottery ticket record
      const ticket = await storage.createLotteryTicket({
        userId,
        outcome: outcome.outcome,
        pointsAwarded: actualPointsAwarded,
        specialReward: outcome.specialReward || null,
      });

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: 'spend',
        amount: LOTTERY_TICKET_COST,
        description: 'Lottery ticket purchase',
      });

      if (actualPointsAwarded > 0) {
        await storage.createTransaction({
          userId,
          type: 'earn',
          amount: actualPointsAwarded,
          description: `Lottery win: ${outcome.outcome}`,
        });
      } else if (actualPointsAwarded < 0) {
        await storage.createTransaction({
          userId,
          type: 'spend',
          amount: Math.abs(actualPointsAwarded),
          description: `Lottery loss: ${outcome.outcome}`,
        });
      }

      // Get updated user
      const updatedUser = await storage.getUser(userId);

      res.json({
        ticket,
        user: updatedUser,
        netChange: actualPointsAwarded - LOTTERY_TICKET_COST,
      });
    } catch (error) {
      console.error("Error drawing lottery ticket:", error);
      res.status(500).json({ message: "Failed to draw lottery ticket" });
    }
  });

  // YAHTZEE GAME ROUTES

  // Get current active game
  app.get("/api/yahtzee/current", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const game = await storage.getCurrentYahtzeeGame(userId);
      res.json(game);
    } catch (error) {
      console.error("Error getting current yahtzee game:", error);
      res.status(500).json({ message: "Failed to get current game" });
    }
  });

  // Start a new game
  app.post("/api/yahtzee/start", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { opponentId } = req.body;

      // Validate opponent exists and is not the same as current user
      if (!opponentId || opponentId === userId) {
        return res.status(400).json({ message: "Please select a valid opponent" });
      }

      const opponent = await storage.getUser(opponentId);
      if (!opponent) {
        return res.status(404).json({ message: "Opponent not found" });
      }
      
      // Check if user already has an active game
      const existingGame = await storage.getCurrentYahtzeeGame(userId);
      if (existingGame) {
        return res.status(400).json({ message: "You already have an active game" });
      }

      const { initializeScorecard } = await import('./yahtzee.js');
      const blankScorecard = initializeScorecard();
      
      const game = await storage.createYahtzeeGame({
        player1Id: userId,
        player2Id: opponentId,
        currentPlayerId: userId, // Player 1 goes first
        status: 'active',
        dice: '[]', // Empty until first roll
        heldDice: '[false,false,false,false,false]',
        rollsRemaining: 3,
        player1Scorecard: JSON.stringify(blankScorecard),
        player2Scorecard: JSON.stringify(blankScorecard),
        player1YahtzeeBonus: 0,
        player2YahtzeeBonus: 0,
        winnerId: null,
        player1FinalScore: null,
        player2FinalScore: null,
      });

      // Notify opponent about the new game challenge
      const challenger = await storage.getUser(userId);
      if (challenger) {
        await sendPushNotification(
          opponentId,
          "Yahtzee Challenge!",
          `${challenger.displayName || challenger.username} has challenged you to a game of Yahtzee!`,
          "yahtzee_challenge"
        );
      }

      res.json(game);
    } catch (error) {
      console.error("Error starting yahtzee game:", error);
      res.status(500).json({ message: "Failed to start game" });
    }
  });

  // Roll dice
  app.post("/api/yahtzee/roll", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { gameId, heldDice } = req.body;

      // Validate input
      if (!Array.isArray(heldDice) || heldDice.length !== 5) {
        return res.status(400).json({ message: "heldDice must be an array of 5 booleans" });
      }
      if (!heldDice.every(h => typeof h === 'boolean')) {
        return res.status(400).json({ message: "All heldDice values must be boolean" });
      }

      const game = await storage.getYahtzeeGame(gameId);
      if (!game || (game.player1Id !== userId && game.player2Id !== userId)) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Validate it's this player's turn
      if (game.currentPlayerId !== userId) {
        return res.status(403).json({ message: "It's not your turn" });
      }

      if (game.status !== 'active') {
        return res.status(400).json({ message: "Game is not active" });
      }

      if (game.rollsRemaining <= 0) {
        return res.status(400).json({ message: "No rolls remaining" });
      }

      const { rollDice } = await import('./yahtzee.js');
      const currentDice = JSON.parse(game.dice);
      const newDice = rollDice(currentDice, heldDice);

      const updatedGame = await storage.updateYahtzeeGame(gameId, {
        dice: JSON.stringify(newDice),
        heldDice: JSON.stringify(heldDice),
        rollsRemaining: game.rollsRemaining - 1,
      });

      res.json(updatedGame);
    } catch (error) {
      console.error("Error rolling dice:", error);
      res.status(500).json({ message: "Failed to roll dice" });
    }
  });

  // Score a category
  app.post("/api/yahtzee/score", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { gameId, category } = req.body;

      // Validate category
      const validCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 
                               'threeOfAKind', 'fourOfAKind', 'fullHouse', 
                               'smallStraight', 'largeStraight', 'yahtzee', 'chance'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      const game = await storage.getYahtzeeGame(gameId);
      if (!game || (game.player1Id !== userId && game.player2Id !== userId)) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Validate it's this player's turn
      if (game.currentPlayerId !== userId) {
        return res.status(403).json({ message: "It's not your turn" });
      }

      if (game.status !== 'active') {
        return res.status(400).json({ message: "Game is not active" });
      }

      const { calculateCategoryScore, calculateFinalScore, isGameComplete, calculatePointsAwarded, isYahtzee } = await import('./yahtzee.js');
      
      const dice = JSON.parse(game.dice);
      const isPlayer1 = game.player1Id === userId;
      
      // Get current player's scorecard and yahtzee bonus
      const scorecard = JSON.parse(isPlayer1 ? game.player1Scorecard : game.player2Scorecard);
      let yahtzeeBonus = isPlayer1 ? game.player1YahtzeeBonus : game.player2YahtzeeBonus;

      // Check if category already filled
      if (scorecard[category] !== null) {
        return res.status(400).json({ message: "Category already scored" });
      }

      // Check for Yahtzee bonus (additional Yahtzees after first)
      if (isYahtzee(dice) && scorecard.yahtzee !== null && scorecard.yahtzee > 0) {
        yahtzeeBonus += 1;
      }

      // Calculate and set the score for this category
      const score = calculateCategoryScore(dice, category);
      scorecard[category] = score;

      // Check if both players have completed their scorecards
      const currentPlayerComplete = isGameComplete(scorecard);
      const player1Scorecard = isPlayer1 ? scorecard : JSON.parse(game.player1Scorecard);
      const player2Scorecard = isPlayer1 ? JSON.parse(game.player2Scorecard) : scorecard;
      const bothPlayersComplete = isGameComplete(player1Scorecard) && isGameComplete(player2Scorecard);
      
      let updateData: any = {};

      // Update current player's scorecard and bonus
      if (isPlayer1) {
        updateData.player1Scorecard = JSON.stringify(scorecard);
        updateData.player1YahtzeeBonus = yahtzeeBonus;
      } else {
        updateData.player2Scorecard = JSON.stringify(scorecard);
        updateData.player2YahtzeeBonus = yahtzeeBonus;
      }

      if (bothPlayersComplete) {
        // Game is complete - calculate final scores and determine winner
        const player1FinalScore = calculateFinalScore(player1Scorecard, game.player1YahtzeeBonus);
        const player2FinalScore = calculateFinalScore(player2Scorecard, game.player2YahtzeeBonus);
        const winnerId = player1FinalScore > player2FinalScore ? game.player1Id : 
                         (player2FinalScore > player1FinalScore ? game.player2Id : null);
        
        // Get both players
        const player1 = await storage.getUser(game.player1Id);
        const player2 = await storage.getUser(game.player2Id);
        
        // Calculate points based on new reward system
        let player1PointsAwarded = 0;
        let player2PointsAwarded = 0;
        
        if (winnerId) {
          const winner = winnerId === game.player1Id ? player1 : player2;
          const loser = winnerId === game.player1Id ? player2 : player1;
          const winnerScore = winnerId === game.player1Id ? player1FinalScore : player2FinalScore;
          const loserScore = winnerId === game.player1Id ? player2FinalScore : player1FinalScore;
          const victoryMargin = winnerScore - loserScore;
          const isWinnerPlayer1 = winnerId === game.player1Id;
          
          // Winner rewards
          if (winner && !winner.isAdmin) {
            // Non-admin win: 1 base point + 1 point per 10-point margin
            const winPoints = 1 + Math.floor(victoryMargin / 10);
            if (isWinnerPlayer1) {
              player1PointsAwarded = winPoints;
            } else {
              player2PointsAwarded = winPoints;
            }
          }
          // Admin wins get no points
          
          // Loser handling
          if (loser && !loser.isAdmin) {
            // Non-admin loss: assign a punishment (no points)
            const loserId = isWinnerPlayer1 ? game.player2Id : game.player1Id;
            const punishmentNumber = Math.floor(Math.random() * 59) + 1; // Random 1-59
            await storage.createPunishment({
              userId: loserId,
              number: punishmentNumber,
              text: `Lost Yahtzee game to ${winner!.displayName || winner!.username} (${loserScore} - ${winnerScore})`,
              isCompleted: false,
            });
          }
          // Admin losses get no points
        } else {
          // Tie - award points only to non-admins
          if (player1 && !player1.isAdmin) {
            player1PointsAwarded = calculatePointsAwarded(player1FinalScore);
          }
          if (player2 && !player2.isAdmin) {
            player2PointsAwarded = calculatePointsAwarded(player2FinalScore);
          }
        }

        // Award points to both players
        await storage.updateUserPoints(game.player1Id, player1!.points + player1PointsAwarded);
        await storage.updateUserPoints(game.player2Id, player2!.points + player2PointsAwarded);

        // Create transaction records for both players
        if (player1PointsAwarded > 0) {
          await storage.createTransaction({
            userId: game.player1Id,
            type: 'earn',
            amount: player1PointsAwarded,
            description: `Yahtzee game vs ${player2!.displayName || player2!.username} - Score: ${player1FinalScore}`,
          });
        }
        if (player2PointsAwarded > 0) {
          await storage.createTransaction({
            userId: game.player2Id,
            type: 'earn',
            amount: player2PointsAwarded,
            description: `Yahtzee game vs ${player1!.displayName || player1!.username} - Score: ${player2FinalScore}`,
          });
        }

        updateData = {
          ...updateData,
          status: 'completed',
          winnerId,
          player1FinalScore,
          player2FinalScore,
          completedAt: new Date(),
        };
      } else {
        // Switch turns to the other player, reset dice for next turn (no auto-roll)
        const nextPlayerId = isPlayer1 ? game.player2Id : game.player1Id;
        updateData = {
          ...updateData,
          currentPlayerId: nextPlayerId,
          rollsRemaining: 3,
          dice: '[]', // Empty until next player rolls
          heldDice: '[false,false,false,false,false]',
        };
        
        // Send push notification to next player
        const currentPlayer = await storage.getUser(userId);
        const nextPlayer = await storage.getUser(nextPlayerId);
        if (nextPlayer && currentPlayer) {
          await sendPushNotification(
            nextPlayerId,
            "Your turn in Yahtzee!",
            `${currentPlayer.displayName || currentPlayer.username} just finished their turn. It's your turn to roll!`,
            "yahtzee_turn"
          );
        }
      }

      const updatedGame = await storage.updateYahtzeeGame(gameId, updateData);

      res.json({
        game: updatedGame,
        gameComplete: bothPlayersComplete,
        turnChanged: !bothPlayersComplete,
      });
    } catch (error) {
      console.error("Error scoring category:", error);
      res.status(500).json({ message: "Failed to score category" });
    }
  });

  // Get game history
  app.get("/api/yahtzee/games", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const games = await storage.getYahtzeeGames(userId);
      res.json(games);
    } catch (error) {
      console.error("Error getting yahtzee games:", error);
      res.status(500).json({ message: "Failed to get games" });
    }
  });

  const httpServer = createServer(app);
  console.log("🚀 HTTP server created successfully");
  return httpServer;
}
