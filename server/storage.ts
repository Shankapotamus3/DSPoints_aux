import { 
  type User, 
  type InsertUser, 
  type Chore, 
  type InsertChore, 
  type Reward, 
  type InsertReward, 
  type Transaction, 
  type InsertTransaction,
  type Notification,
  type InsertNotification,
  type Message,
  type InsertMessage,
  type Punishment,
  type InsertPunishment,
  type PushSubscription,
  type InsertPushSubscription,
  type ChoreStatus,
  users,
  chores,
  rewards,
  transactions,
  notifications,
  messages,
  punishments,
  pushSubscriptions
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, or, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserPoints(id: string, points: number): Promise<User | undefined>;
  
  // Chore methods
  getChores(): Promise<Chore[]>;
  getChore(id: string): Promise<Chore | undefined>;
  createChore(chore: InsertChore): Promise<Chore>;
  updateChore(id: string, updates: Partial<Chore>): Promise<Chore | undefined>;
  deleteChore(id: string): Promise<boolean>;
  completeChore(id: string, completedById: string, completionDate?: Date): Promise<Chore | undefined>;
  approveChore(id: string, approvedById: string, comment?: string): Promise<Chore | undefined>;
  rejectChore(id: string, approvedById: string, comment?: string): Promise<Chore | undefined>;
  getPendingApprovalChores(): Promise<Chore[]>;
  getChoresByStatus(status: ChoreStatus): Promise<Chore[]>;
  resetRecurringChores(): Promise<void>;
  
  // Reward methods
  getRewards(): Promise<Reward[]>;
  getReward(id: string): Promise<Reward | undefined>;
  createReward(reward: InsertReward): Promise<Reward>;
  updateReward(id: string, updates: Partial<Reward>): Promise<Reward | undefined>;
  deleteReward(id: string): Promise<boolean>;
  
  // Transaction methods
  getTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // Notification methods
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Message methods
  getMessages(userId: string): Promise<Message[]>;
  getConversation(userId: string, otherUserId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message | undefined>;
  markConversationAsRead(userId: string, otherUserId: string): Promise<void>;

  // Punishment methods
  getPunishments(): Promise<Punishment[]>;
  createPunishment(punishment: InsertPunishment): Promise<Punishment>;
  updatePunishment(id: string, text: string): Promise<Punishment | undefined>;
  markPunishmentComplete(id: string): Promise<Punishment | undefined>;
  deletePunishment(id: string): Promise<boolean>;

  // Push subscription methods
  getPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  deletePushSubscriptionsByUserId(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserPoints(id: string, points: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ points })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Chore methods
  async getChores(): Promise<Chore[]> {
    return await db.select().from(chores);
  }

  async getChore(id: string): Promise<Chore | undefined> {
    const [chore] = await db.select().from(chores).where(eq(chores.id, id));
    return chore || undefined;
  }

  async createChore(insertChore: InsertChore): Promise<Chore> {
    const choreData: any = { ...insertChore };
    
    // Set next due date for recurring chores
    if (choreData.isRecurring && choreData.recurringType) {
      choreData.nextDueDate = this.calculateNextDueDate(choreData.recurringType);
    }
    
    const [chore] = await db
      .insert(chores)
      .values(choreData)
      .returning();
    return chore;
  }

  async updateChore(id: string, updates: Partial<Chore>): Promise<Chore | undefined> {
    const [chore] = await db
      .update(chores)
      .set(updates)
      .where(eq(chores.id, id))
      .returning();
    return chore || undefined;
  }

  async deleteChore(id: string): Promise<boolean> {
    const result = await db.delete(chores).where(eq(chores.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async completeChore(id: string, completedById: string, completionDate: Date = new Date()): Promise<Chore | undefined> {
    const existingChore = await this.getChore(id);
    if (!existingChore) return undefined;
    
    // For recurring chores, reset them and set status to completed (not award points yet)
    if (existingChore.isRecurring && existingChore.recurringType) {
      const nextDue = this.calculateNextDueDate(existingChore.recurringType as 'daily' | 'weekly' | 'monthly');
      const [chore] = await db
        .update(chores)
        .set({ 
          isCompleted: false,  // Reset to incomplete for next cycle
          completedAt: completionDate, // Track when it was completed
          completedById: completedById, // Track who completed it
          nextDueDate: nextDue,
          status: 'completed', // Set to completed status for approval workflow
          approvedAt: null, // Clear previous approval
          approvedById: null,
          approvalComment: null
        })
        .where(eq(chores.id, id))
        .returning();
      return chore || undefined;
    } else {
      // For one-time chores, set status to completed (not award points yet)
      const [chore] = await db
        .update(chores)
        .set({ 
          isCompleted: false, // Keep false until approved
          completedAt: completionDate,
          completedById: completedById, // Track who completed it
          status: 'completed', // Set to completed status for approval workflow
          approvedAt: null, // Clear previous approval
          approvedById: null,
          approvalComment: null
        })
        .where(eq(chores.id, id))
        .returning();
      return chore || undefined;
    }
  }

  async approveChore(id: string, approvedById: string, comment?: string): Promise<Chore | undefined> {
    const [chore] = await db
      .update(chores)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedById: approvedById,
        approvalComment: comment,
        isCompleted: true // Finally mark as completed when approved
      })
      .where(eq(chores.id, id))
      .returning();
    return chore || undefined;
  }

  async rejectChore(id: string, approvedById: string, comment?: string): Promise<Chore | undefined> {
    const [chore] = await db
      .update(chores)
      .set({
        status: 'pending', // Reset to pending so it can be completed again
        approvedAt: new Date(),
        approvedById: approvedById,
        approvalComment: comment,
        isCompleted: false // Keep as incomplete when rejected
      })
      .where(eq(chores.id, id))
      .returning();
    return chore || undefined;
  }

  async getPendingApprovalChores(): Promise<Chore[]> {
    return await db.select().from(chores).where(eq(chores.status, 'completed'));
  }

  async getChoresByStatus(status: ChoreStatus): Promise<Chore[]> {
    return await db.select().from(chores).where(eq(chores.status, status));
  }

  // Reward methods
  async getRewards(): Promise<Reward[]> {
    return await db.select().from(rewards);
  }

  async getReward(id: string): Promise<Reward | undefined> {
    const [reward] = await db.select().from(rewards).where(eq(rewards.id, id));
    return reward || undefined;
  }

  async createReward(insertReward: InsertReward): Promise<Reward> {
    const [reward] = await db
      .insert(rewards)
      .values(insertReward)
      .returning();
    return reward;
  }

  async updateReward(id: string, updates: Partial<Reward>): Promise<Reward | undefined> {
    const [reward] = await db
      .update(rewards)
      .set(updates)
      .where(eq(rewards.id, id))
      .returning();
    return reward || undefined;
  }

  async deleteReward(id: string): Promise<boolean> {
    const result = await db.delete(rewards).where(eq(rewards.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Transaction methods
  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  // Notification methods
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(sql`created_at DESC`);
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(sql`user_id = ${userId} AND is_read = false`)
      .orderBy(sql`created_at DESC`);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // Message methods - only return messages where user is sender or recipient
  async getMessages(userId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(
        and(
          or(
            eq(messages.senderId, userId),
            eq(messages.recipientId, userId)
          ),
          // Exclude broadcast messages (recipientId is null) unless user is sender
          or(
            eq(messages.senderId, userId),
            sql`${messages.recipientId} IS NOT NULL`
          )
        )
      )
      .orderBy(desc(messages.createdAt));
  }

  async getConversation(userId: string, otherUserId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(or(
        and(eq(messages.senderId, userId), eq(messages.recipientId, otherUserId)),
        and(eq(messages.senderId, otherUserId), eq(messages.recipientId, userId))
      ))
      .orderBy(messages.createdAt);
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(
        eq(messages.recipientId, userId),
        eq(messages.isRead, false)
      ));
    return result[0]?.count ?? 0;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();
    return message || undefined;
  }

  async markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.senderId, otherUserId),
        eq(messages.recipientId, userId),
        eq(messages.isRead, false)
      ));
  }

  // Punishment methods
  async getPunishments(): Promise<Punishment[]> {
    return await db.select().from(punishments).orderBy(punishments.createdAt);
  }

  async createPunishment(insertPunishment: InsertPunishment): Promise<Punishment> {
    const [punishment] = await db
      .insert(punishments)
      .values(insertPunishment)
      .returning();
    return punishment;
  }

  async updatePunishment(id: string, text: string): Promise<Punishment | undefined> {
    const [punishment] = await db
      .update(punishments)
      .set({ text })
      .where(eq(punishments.id, id))
      .returning();
    return punishment || undefined;
  }

  async markPunishmentComplete(id: string): Promise<Punishment | undefined> {
    const [punishment] = await db
      .update(punishments)
      .set({ isCompleted: true, completedAt: new Date() })
      .where(eq(punishments.id, id))
      .returning();
    return punishment || undefined;
  }

  async deletePunishment(id: string): Promise<boolean> {
    const result = await db.delete(punishments).where(eq(punishments.id, id)).returning();
    return result.length > 0;
  }

  // Push subscription methods
  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions);
  }

  async createPushSubscription(insertSubscription: InsertPushSubscription): Promise<PushSubscription> {
    // First try to delete any existing subscription with the same endpoint
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, insertSubscription.endpoint));
    
    // Then insert the new subscription
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).returning();
    return result.length > 0;
  }

  async deletePushSubscriptionsByUserId(userId: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }
  
  async resetRecurringChores(): Promise<void> {
    // Reset recurring chores that are past their due date
    const now = new Date();
    await db
      .update(chores)
      .set({ 
        isCompleted: false,
        status: 'pending',
        completedAt: null,
        completedById: null,
        approvedAt: null,
        approvedById: null,
        approvalComment: null,
        nextDueDate: sql`CASE 
          WHEN recurring_type = 'daily' THEN ${now} + interval '1 day'
          WHEN recurring_type = 'weekly' THEN ${now} + interval '1 week'
          WHEN recurring_type = 'monthly' THEN ${now} + interval '1 month'
          ELSE next_due_date
        END`
      })
      .where(sql`is_recurring = true AND next_due_date <= ${now}::timestamp`);
  }
  
  private calculateNextDueDate(type: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (type) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }
    return now;
  }
}

export const storage = new DatabaseStorage();