import { users, rides, bookings, type User, type InsertUser, type Ride, type Booking } from "@shared/schema";
import { db } from "./db";
import { eq, and, lt, inArray, ne, gt, desc } from "drizzle-orm";

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
  getActiveBookingForUser(userId: number): Promise<Booking | undefined>;
  getActiveBookingForDriver(driverId: number): Promise<Booking | undefined>;
  updateBookingStatus(id: number, status: string, otp?: string): Promise<Booking>;
  getDriverEarnings(driverId: number): Promise<number>;
  getDriverTripCount(driverId: number): Promise<number>;
  getUserRideHistory(userId: number): Promise<Booking[]>;
  getDriverRideHistory(driverId: number): Promise<Booking[]>;
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

  async getActiveBookingForUser(userId: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["pending", "accepted", "arrived", "in_progress"])
      )
    );
    return booking;
  }

  async getActiveBookingForDriver(driverId: number): Promise<Booking | undefined> {
    // Find a booking that is associated with a ride driven by this driver, and is active
    // We join bookings with rides to filter by driverId
    const [booking] = await db.select({
        id: bookings.id,
        userId: bookings.userId,
        rideId: bookings.rideId,
        pickupAddress: bookings.pickupAddress,
        dropoffAddress: bookings.dropoffAddress,
        pickupLat: bookings.pickupLat,
        pickupLng: bookings.pickupLng,
        dropoffLat: bookings.dropoffLat,
        dropoffLng: bookings.dropoffLng,
        status: bookings.status,
        otp: bookings.otp,
        fare: bookings.fare,
        createdAt: bookings.createdAt,
        isPool: bookings.isPool,
        poolId: bookings.poolId,
        distance: bookings.distance,
        joinStatus: bookings.joinStatus
      })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(rides.driverId, driverId),
          inArray(bookings.status, ["accepted", "arrived", "in_progress"])
        )
      );
    return booking;
  }

  async updateBookingStatus(id: number, status: string, otp?: string): Promise<Booking> {
    const updateData: any = { status: status as any };
    if (otp !== undefined) {
      updateData.otp = otp;
    }

    const [updated] = await db
      .update(bookings)
      .set(updateData)
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
    const driverBookings = await db.select()
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(rides.driverId, driverId),
          eq(bookings.status, "completed")
        )
      );
    
    // driverBookings is now an array of { bookings: Booking, rides: Ride } objects due to the join
    return driverBookings.reduce((sum, row) => sum + (row.bookings.fare || 0), 0);
  }

  async getDriverTripCount(driverId: number): Promise<number> {
    const driverBookings = await db.select()
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(rides.driverId, driverId),
          eq(bookings.status, "completed")
        )
      );
    return driverBookings.length;
  }

  async getUserRideHistory(userId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["completed", "cancelled"])
      )
    ).orderBy(desc(bookings.createdAt));
  }

  async getDriverRideHistory(driverId: number): Promise<Booking[]> {
    return await db.select({
        id: bookings.id,
        userId: bookings.userId,
        rideId: bookings.rideId,
        pickupAddress: bookings.pickupAddress,
        dropoffAddress: bookings.dropoffAddress,
        pickupLat: bookings.pickupLat,
        pickupLng: bookings.pickupLng,
        dropoffLat: bookings.dropoffLat,
        dropoffLng: bookings.dropoffLng,
        status: bookings.status,
        otp: bookings.otp,
        fare: bookings.fare,
        createdAt: bookings.createdAt,
        isPool: bookings.isPool,
        poolId: bookings.poolId,
        distance: bookings.distance,
        joinStatus: bookings.joinStatus
    })
      .from(bookings)
      .innerJoin(rides, eq(bookings.rideId, rides.id))
      .where(
        and(
          eq(rides.driverId, driverId),
          eq(bookings.status, "completed")
        )
      )
      .orderBy(desc(bookings.createdAt));
  }
}

export const storage = new DatabaseStorage();
