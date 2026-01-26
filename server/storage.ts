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
  getDriverEarnings(driverId: number): Promise<number>;
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

  // Pool-related methods
  async getPoolPassengers(poolId: number): Promise<Booking[]> {
    // Get all bookings in a pool (where poolId matches OR id equals poolId for owner)
    return await db.select().from(bookings).where(
      and(
        eq(bookings.poolId, poolId),
        eq(bookings.joinStatus, "accepted" as any)
      )
    );
  }

  async updateBookingPool(id: number, updates: { joinStatus?: string; status?: string; fare?: number }): Promise<Booking> {
    const [updated] = await db
      .update(bookings)
      .set(updates as any)
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async incrementRideOccupied(rideId: number): Promise<Ride> {
    const ride = await this.getRide(rideId);
    if (!ride) throw new Error("Ride not found");
    
    const [updated] = await db
      .update(rides)
      .set({ occupied: (ride.occupied || 0) + 1 })
      .where(eq(rides.id, rideId))
      .returning();
    return updated;
  }

  async getPendingPoolRequests(rideId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(
      and(
        eq(bookings.rideId, rideId),
        eq(bookings.joinStatus, "pending" as any)
      )
    );
  }

  async getDriverEarnings(driverId: number): Promise<number> {
    const result = await db
      .select({
        total: db.$count(bookings.fare), // This is not correct for sum, using sum instead
      })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(rides.driverId, driverId),
          eq(bookings.status, "completed" as any)
        )
      );
    
    // Using a more manual approach since drizzle sum can be tricky to type here
    const driverBookings = await db.select({ fare: bookings.fare })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(rides.driverId, driverId),
          eq(bookings.status, "completed" as any)
        )
      );
    
    return driverBookings.reduce((sum, b) => sum + (b.fare || 0), 0);
  }
}

export const storage = new DatabaseStorage();
