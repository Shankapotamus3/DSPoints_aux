import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChoreSchema, insertRewardSchema, insertTransactionSchema, insertUserSchema, choreApprovalSchema, insertMessageSchema, insertPunishmentSchema, insertPushSubscriptionSchema, pointAdjustmentSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
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
      console.error("Failed to initialize default admin:", error);
    }
  }

  // Initialize default admin on startup
  await initializeDefaultAdmin();

  // Setup session store - use PostgreSQL if available, otherwise fall back to memory store
  let sessionStore;
  
  if (process.env.DATABASE_URL) {
    const PgSession = connectPgSimple(session);
    sessionStore = new PgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: "session",
      createTableIfMissing: true,
    });
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
      const subscriptions = await storage.getPushSubscriptions(userId);
      
      const payload = JSON.stringify({
        title,
        message,
        type,
        choreId
      });

      // Send to all subscriptions for this user
      const promises = subscriptions.map(async (sub) => {
        try {
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
        } catch (error: any) {
          // If subscription is no longer valid (410 Gone), remove it
          if (error.statusCode === 410) {
            await storage.deletePushSubscription(sub.endpoint);
          }
          console.error(`Failed to send push to ${sub.endpoint}:`, error);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to send push notification:', error);
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
      const chores = await storage.getChores();
      res.json(chores);
    } catch (error) {
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

  app.post("/api/chores/:id/complete", async (req, res) => {
    try {
      const { id } = req.params;
      const chore = await storage.completeChore(id);
      if (!chore) {
        return res.status(404).json({ message: "Chore not found or already completed" });
      }

      // Send notification to admins about pending approval
      const allUsers = await storage.getUsers();
      const admins = allUsers.filter(user => user.isAdmin);
      
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          "Chore Completed - Pending Approval",
          `${chore.name} has been completed and needs your approval`,
          "chore_completed",
          chore.id
        );
      }

      res.json(chore);
    } catch (error) {
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

      // Award points to assigned user
      const userId = approvedChore.assignedToId;
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
      const userId = rejectedChore.assignedToId;
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

      const objectStorageService = new ObjectStorageService();
      // Use user-scoped upload URL for security
      const uploadURL = await objectStorageService.getUserScopedAvatarUploadURL(id);
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting avatar upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Update user avatar after upload (requires owner or admin access)
  app.put("/api/users/:id/avatar", requireAuth, requireOwnerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { avatarUrl } = req.body;

      if (!avatarUrl) {
        return res.status(400).json({ message: "avatarUrl is required" });
      }

      // Input validation for avatarUrl format
      try {
        insertUserSchema.pick({ avatarUrl: true }).parse({ avatarUrl });
      } catch (validationError) {
        return res.status(400).json({ 
          message: "Invalid avatar URL format",
          errors: validationError instanceof z.ZodError ? validationError.errors : []
        });
      }

      // Verify user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const objectStorageService = new ObjectStorageService();
      
      // SECURITY: Validate that the avatar URL belongs to this user
      const isValidOwnership = objectStorageService.validateAvatarUrlOwnership(avatarUrl, id);
      if (!isValidOwnership) {
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

      // Update user with new avatar settings
      const updatedUser = await storage.updateUser(id, {
        avatarType: "image",
        avatarUrl: objectPath,
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user avatar" });
      }

      res.json({ 
        objectPath: objectPath,
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

      const objectStorageService = new ObjectStorageService();
      // Use the entity upload URL - works for any private object
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting message image upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
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
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const subscriptionData = insertPushSubscriptionSchema.parse({
        userId,
        ...req.body,
      });

      const subscription = await storage.createPushSubscription(subscriptionData);
      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.errors });
      }
      console.error("Error creating push subscription:", error);
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

  const httpServer = createServer(app);
  return httpServer;
}
