import { 
  type User, 
  type InsertUser, 
  type Chore, 
  type InsertChore, 
  type Reward, 
  type InsertReward, 
  type Transaction, 
  type InsertTransaction,
  users,
  chores,
  rewards,
  transactions
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPoints(id: string, points: number): Promise<User | undefined>;
  
  // Chore methods
  getChores(): Promise<Chore[]>;
  getChore(id: string): Promise<Chore | undefined>;
  createChore(chore: InsertChore): Promise<Chore>;
  updateChore(id: string, updates: Partial<Chore>): Promise<Chore | undefined>;
  deleteChore(id: string): Promise<boolean>;
  completeChore(id: string): Promise<Chore | undefined>;
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

  async completeChore(id: string): Promise<Chore | undefined> {
    const existingChore = await this.getChore(id);
    if (!existingChore) return undefined;
    
    // Note: Point awarding handled in routes layer where USER_ID is available
    
    // For recurring chores, reset them instead of marking complete permanently
    if (existingChore.isRecurring && existingChore.recurringType) {
      const nextDue = this.calculateNextDueDate(existingChore.recurringType as 'daily' | 'weekly' | 'monthly');
      const [chore] = await db
        .update(chores)
        .set({ 
          isCompleted: false,  // Reset to incomplete
          completedAt: new Date(), // Track when it was completed
          nextDueDate: nextDue
        })
        .where(eq(chores.id, id))
        .returning();
      return chore || undefined;
    } else {
      // For one-time chores, mark as completed
      const [chore] = await db
        .update(chores)
        .set({ 
          isCompleted: true, 
          completedAt: new Date() 
        })
        .where(eq(chores.id, id))
        .returning();
      return chore || undefined;
    }
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
  
  async resetRecurringChores(): Promise<void> {
    // Reset recurring chores that are past their due date
    const now = new Date();
    await db
      .update(chores)
      .set({ 
        isCompleted: false,
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