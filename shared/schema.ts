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
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  points: true,
});

export const insertChoreSchema = createInsertSchema(chores).omit({
  id: true,
  isCompleted: true,
  completedAt: true,
  createdAt: true,
  nextDueDate: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertChore = z.infer<typeof insertChoreSchema>;
export type Chore = typeof chores.$inferSelect;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type Reward = typeof rewards.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
