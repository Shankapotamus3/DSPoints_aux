import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  points: true,
}).extend({
  avatarType: z.enum(['emoji', 'image']).optional(),
  avatarUrl: z.string().nullish().refine((url) => {
    if (!url) return true; // Allow empty/undefined/null
    // Must be a valid URL that starts with /objects/ (internal path) or https://storage.googleapis.com/
    return url.startsWith('/objects/') || url.startsWith('https://storage.googleapis.com/');
  }, {
    message: 'Avatar URL must be a valid object storage URL (must start with /objects/ or https://storage.googleapis.com/)'
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

export const choreApprovalSchema = z.object({
  comment: z.string().optional(),
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
export type ChoreApproval = z.infer<typeof choreApprovalSchema>;

// Enum-like types for better type safety
export type ChoreStatus = 'pending' | 'completed' | 'approved' | 'rejected';
export type NotificationType = 'chore_completed' | 'chore_approved' | 'chore_rejected';
export type AvatarType = 'emoji' | 'image';
