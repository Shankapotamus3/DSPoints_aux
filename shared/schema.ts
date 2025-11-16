import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  pin: text("pin"), // Hashed PIN for quick family login
  points: integer("points").notNull().default(0),
  displayName: text("display_name"),
  avatar: text("avatar").default("👤"),
  avatarType: text("avatar_type").notNull().default("emoji"), // 'emoji' or 'image'
  avatarUrl: text("avatar_url"), // URL for uploaded images
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const chores = pgTable("chores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  points: integer("points").notNull(),
  estimatedTime: text("estimated_time"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  // Approval workflow fields
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'approved', 'rejected'
  approvedAt: timestamp("approved_at"),
  approvedById: varchar("approved_by_id").references(() => users.id),
  approvalComment: text("approval_comment"),
  // Recurring chore fields
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringType: text("recurring_type"), // 'daily', 'weekly', 'monthly'
  nextDueDate: timestamp("next_due_date"),
  // Family member assignment
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  completedById: varchar("completed_by_id").references(() => users.id), // Track who actually completed the chore
});

export const rewards = pgTable("rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  cost: integer("cost").notNull(),
  icon: text("icon").default("gift"),
  category: text("category").default("other"), // 'entertainment', 'treats', 'activities', 'shopping', 'other'
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'earn' or 'spend'
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  choreId: varchar("chore_id"),
  rewardId: varchar("reward_id"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'chore_completed', 'chore_approved', 'chore_rejected'
  isRead: boolean("is_read").notNull().default(false),
  choreId: varchar("chore_id").references(() => chores.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").references(() => users.id), // null for broadcast messages
  content: text("content").notNull(),
  imageUrl: text("image_url"), // Optional image attachment
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const punishments = pgTable("punishments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: integer("number").notNull(), // Random number 1-59
  text: text("text"), // Optional text description
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const lotteryTickets = pgTable("lottery_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  outcome: text("outcome").notNull(),
  pointsAwarded: integer("points_awarded").notNull(),
  specialReward: text("special_reward"), // For non-point outcomes like "Free reward" or "Have an orgasm"
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  points: true,
}).extend({
  avatarType: z.enum(['emoji', 'image']).optional(),
  avatarUrl: z.string().nullish().refine((url) => {
    if (!url) return true; // Allow empty/undefined/null
    // Accept both Cloudinary URLs and Replit object storage URLs
    return url.startsWith('/objects/') || 
           url.startsWith('https://storage.googleapis.com/') ||
           url.startsWith('https://res.cloudinary.com/');
  }, {
    message: 'Avatar URL must be a valid Cloudinary or object storage URL'
  }),
  pin: z.string().nullish().refine((pin) => {
    if (!pin) return true; // PIN is optional
    // PIN must be 4-6 digits
    return /^\d{4,6}$/.test(pin);
  }, {
    message: 'PIN must be 4-6 digits'
  }),
});

export const insertChoreSchema = createInsertSchema(chores).omit({
  id: true,
  isCompleted: true,
  completedAt: true,
  createdAt: true,
  nextDueDate: true,
  status: true,
  approvedAt: true,
  approvedById: true,
}).extend({
  recurringType: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export const insertRewardSchema = createInsertSchema(rewards).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
}).extend({
  imageUrl: z.string().nullish().refine((url) => {
    if (!url) return true;
    // Accept both Cloudinary URLs and Replit object storage URLs
    return url.startsWith('/objects/') || 
           url.startsWith('https://storage.googleapis.com/') ||
           url.startsWith('https://res.cloudinary.com/');
  }, {
    message: 'Image URL must be a valid Cloudinary or object storage URL'
  }),
});

export const insertPunishmentSchema = createInsertSchema(punishments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).extend({
  number: z.number().int().min(1).max(59),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertLotteryTicketSchema = createInsertSchema(lotteryTickets).omit({
  id: true,
  createdAt: true,
});

export const choreApprovalSchema = z.object({
  comment: z.string().optional(),
});

export const pointAdjustmentSchema = z.object({
  amount: z.number().int().refine((val) => val !== 0, {
    message: 'Amount cannot be zero'
  }),
  reason: z.string().min(1, 'Reason is required'),
});

export const choreCompletionSchema = z.object({
  completedAt: z.string().datetime().optional(),
}).refine((data) => {
  if (!data.completedAt) return true;
  const completionDate = new Date(data.completedAt);
  const now = new Date();
  // Allow completion dates within 24 hours in the future to account for timezone differences
  // This prevents obviously wrong dates while being lenient with timezone offsets
  const maxAllowedDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return completionDate <= maxAllowedDate;
}, {
  message: 'Completion date cannot be more than 24 hours in the future',
  path: ['completedAt'],
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertChore = z.infer<typeof insertChoreSchema>;
export type Chore = typeof chores.$inferSelect;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type Reward = typeof rewards.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertPunishment = z.infer<typeof insertPunishmentSchema>;
export type Punishment = typeof punishments.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertLotteryTicket = z.infer<typeof insertLotteryTicketSchema>;
export type LotteryTicket = typeof lotteryTickets.$inferSelect;
export type ChoreApproval = z.infer<typeof choreApprovalSchema>;
export type PointAdjustment = z.infer<typeof pointAdjustmentSchema>;
export type ChoreCompletion = z.infer<typeof choreCompletionSchema>;

// Enum-like types for better type safety
export type ChoreStatus = 'pending' | 'completed' | 'approved' | 'rejected';
export type NotificationType = 'chore_completed' | 'chore_approved' | 'chore_rejected';
export type AvatarType = 'emoji' | 'image';
