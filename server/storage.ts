import { users, rides, bookings, type User, type InsertUser, type Ride, type Booking } from "@shared/schema";
import { db } from "./db";
import { eq, and, lt, inArray, ne, gt } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  
  getRides(): Promise<Ride[]>;
  getRide(id: number): Promise<Ride | undefined>;
  getActivePoolRides(): Promise<Ride[]>;
  getActiveRideForDriver(driverId: number): Promise<Ride | undefined>; // New Check
  createRide(ride: Omit<Ride, "id">): Promise<Ride>;
  
  createBooking(booking: Omit<Booking, "id" | "createdAt">): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  updateBookingStatus(id: number, status: string, otp?: string): Promise<Booking>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getRides(): Promise<Ride[]> {
    return await db.select().from(rides);
  }

  async getRide(id: number): Promise<Ride | undefined> {
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride;
  }

  async getActivePoolRides(): Promise<Ride[]> {
    return await db.select().from(rides).where(
      and(
        eq(rides.type, "pool"),
        inArray(rides.status, ["empty", "boarding"]),
        lt(rides.occupied, rides.capacity)
      )
    );
  }

  async getActiveRideForDriver(driverId: number): Promise<Ride | undefined> {
    const [ride] = await db.select().from(rides).where(
      and(
        eq(rides.driverId, driverId),
        ne(rides.status, "completed")
      )
    );
    return ride;
  }

  async createRide(ride: Omit<Ride, "id">): Promise<Ride> {
    const [newRide] = await db.insert(rides).values(ride).returning();
    return newRide;
  }

  async createBooking(booking: Omit<Booking, "id" | "createdAt">): Promise<Booking> {
    const [newBooking] = await db.insert(bookings).values(booking).returning();
    return newBooking;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async updateBookingStatus(id: number, status: string, otp?: string): Promise<Booking> {
    const [updated] = await db
      .update(bookings)
      .set({ 
        status: status as any, 
        otp: otp || undefined 
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async getBookingsByStatus(status: string): Promise<Booking[]> {
    const oneMinuteAgo = new Date(Date.now() - 60000); // Expiry filter
    return await db.select().from(bookings).where(
      and(
        eq(bookings.status, status as any),
        gt(bookings.createdAt, oneMinuteAgo)
      )
    );
  }
}

export const storage = new DatabaseStorage();
