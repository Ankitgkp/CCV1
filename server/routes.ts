import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { matchingService } from "./services/MatchingService";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

declare global {
  namespace Express {
    interface Request {
      user?: any; 
    
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/proxy/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q as string
        )}&countrycodes=in&limit=5`,
        {
          headers: {
            "User-Agent": "RideShareApp/1.0", 
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy Search Error:", error);
      res.status(500).json({ message: "Failed to fetch search results" });
    }
  });
  app.use(
    session({
      cookie: { maxAge: 86400000 },
      store: new SessionStore({
        checkPeriod: 86400000
      }),
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "secret",
    })
  );


  app.use(async (req, res, next) => {
    const userId = (req.session as any).userId;
    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  });


  app.post(api.auth.loginWithMobile.path, async (req, res) => {
    try {
      const { mobile, otp, role } = api.auth.loginWithMobile.input.parse(req.body);
      
   
      if (otp !== "1234") {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      let user = await storage.getUserByMobile(mobile);
      if (!user) {

        user = await storage.createUser({
          mobile,
          role,
          isVerified: true
        } as any);
      } else {

      }

      (req.session as any).userId = user.id;
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.auth.logout.path, async (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });


  app.get(api.user.getProfile.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(userId);
    res.json(user);
  });

  app.patch(api.user.updateProfile.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    try {
      const updates = api.user.updateProfile.input.parse(req.body);
      const user = await storage.updateUser(userId, updates);
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: "Invalid updates" });
    }
  });

  app.get(api.rides.list.path, async (req, res) => {
    const rides = await storage.getRides();
    res.json(rides);
  });

  app.post(api.bookings.create.path, async (req, res) => {
    try {
      const input = api.bookings.create.input.parse(req.body);
      const booking = await storage.createBooking({
        ...input,
        otp: input.otp ?? null,
        status: input.status ?? "pending",
        userId: input.userId ?? null,
        rideId: input.rideId ?? null,
        fare: input.fare ?? null,
        isPool: input.isPool ?? null,
        distance: input.distance ?? null,
        joinStatus: input.joinStatus ?? null,
      } as any);
      res.status(201).json(booking);
    } catch (err) {
      console.error("Booking Creation Error:", err);
      res.status(400).json({ message: "Invalid booking data" });
    }
  });

  app.get(api.bookings.create.path, async (req, res) => {
    const status = req.query.status as string;
    if (!status) {
      return res.status(400).json({ message: "Status required" });
    }
    const bookings = await storage.getBookingsByStatus(status);
    res.json(bookings);
  });

  app.get("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    
    let ride = null;
    let driver = null;
    if (booking.rideId) {
      ride = await storage.getRide(booking.rideId);
      if (ride?.driverId) {
        driver = await storage.getUser(ride.driverId);
      }
    }
    
    res.json({
      ...booking,
      ride: ride ? {
        id: ride.id,
        carModel: ride.carModel,
        carNumber: ride.carNumber,
        latitude: ride.latitude,
        longitude: ride.longitude,
      } : null,
      driver: driver ? {
        id: driver.id,
        name: driver.name || "Driver",
        mobile: driver.mobile,
        avatar: driver.avatar,
      } : null,
    });
  });


  app.patch("/api/bookings/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.bookings.updateStatus.input.parse(req.body);
      
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // OTP Verification for starting trip
      if (input.status === "in_progress") {
        if (!input.otp) {
          return res.status(400).json({ message: "OTP is required to start trip" });
        }
        if (input.otp !== booking.otp) {
          return res.status(400).json({ message: "Invalid OTP" });
        }
      }
      
      // Don't overwrite OTP when accepting
      const updateData: any = { status: input.status };
      if (input.status === "accepted") {
        // Do not set OTP here
      } else if (input.otp) {
         // Only update OTP if explicitly needed (unlikely for other statuses, but safe)
         // Actually, for in_progress verification, we don't change the OTP, just verify it.
         // But let's keep it clean: strict update.
      }

      const updatedBooking = await storage.updateBookingStatus(id, input.status);
      
      res.json(updatedBooking);
    } catch (err) {
      console.error("Update Booking Status Error:", err);
      res.status(400).json({ message: "Invalid status update" });
    }
  });

  // Driver location tracking - in-memory store for simplicity
  const driverLocations: Map<number, { lat: number; lng: number; heading: number; updatedAt: number }> = new Map();

  app.post("/api/driver/location", async (req, res) => {
    try {
      const { bookingId, lat, lng, heading } = req.body;
      if (!bookingId || lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "bookingId, lat, lng required" });
      }
      driverLocations.set(bookingId, { lat, lng, heading: heading || 0, updatedAt: Date.now() });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Failed to update location" });
    }
  });

  app.get("/api/driver/location/:bookingId", async (req, res) => {
    const bookingId = parseInt(req.params.bookingId);
    const location = driverLocations.get(bookingId);
    if (!location) {
      return res.status(404).json({ message: "Driver location not available" });
    }
    res.json(location);
  });

  app.get("/api/user/active-booking", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    let booking;
    if (req.user.role === "driver") {
      booking = await storage.getActiveBookingForDriver(req.user.id);
    } else {
      booking = await storage.getActiveBookingForUser(req.user.id);
    }

    if (!booking) {
      return res.json(null);
    }

    // Attach ride and driver details if needed (reusing logic from get booking)
    // For simplicity, just fetching the full details as the client likely needs them
    
    let ride = null;
    let driver = null;
    if (booking.rideId) {
      ride = await storage.getRide(booking.rideId);
      if (ride?.driverId) {
        driver = await storage.getUser(ride.driverId);
      }
    }
    
    res.json({
      ...booking,
      ride: ride ? {
        id: ride.id,
        carModel: ride.carModel,
        carNumber: ride.carNumber,
        latitude: ride.latitude,
        longitude: ride.longitude,
        pricePerKm: ride.pricePerKm,
      } : null,
      driver: driver ? {
        id: driver.id,
        name: driver.name || "Driver",
        mobile: driver.mobile,
        avatar: driver.avatar,
      } : null,
    });
  });

  app.get("/api/driver/stats", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const earnings = await storage.getDriverEarnings(req.user.id);
    const totalTrips = await storage.getDriverTripCount(req.user.id);
    res.json({ earnings, totalTrips });
  });

  app.get("/api/user/history", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const history = await storage.getUserRideHistory(req.user.id);
    res.json(history);
  });

  app.get("/api/driver/history", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const history = await storage.getDriverRideHistory(req.user.id);
    res.json(history);
  });

  app.get("/api/driver/earnings", async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const earnings = await storage.getDriverEarnings(req.user.id);
    res.json({ earnings });
  });

  // Seed data
  await seedDatabase();

  app.post("/api/rides", async (req, res) => {
    try {
      // In a real app, validate with Zod
      const rideData = req.body;
      const ride = await storage.createRide(rideData);
      res.status(201).json(ride);
    } catch (err) {
      console.error("Create Ride Error:", err);
      res.status(400).json({ message: "Failed to create ride" });
    }
  });

  app.post("/api/rides/match", async (req, res) => {
    try {
      const schema = z.object({
        pickupLat: z.number(),
        pickupLng: z.number(),
        dropoffLat: z.number(),
        dropoffLng: z.number(),
      });
      const { pickupLat, pickupLng, dropoffLat, dropoffLng } = schema.parse(req.body);

      const matches = await matchingService.findMatches(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng
      );
      res.json(matches);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: "Invalid matching parameters" });
    }
  });


  const calculateHaversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  app.post("/api/pools/available", async (req, res) => {
    try {
      const schema = z.object({
        pickupLat: z.number(),
        pickupLng: z.number(),
        dropoffLat: z.number(),
        dropoffLng: z.number(),
      });
      const { pickupLat, pickupLng, dropoffLat, dropoffLng } = schema.parse(req.body);

      // Get all active pool bookings that are accepted (in progress)
      const allBookings = await storage.getBookingsByStatus("accepted");
      const poolBookings = allBookings.filter(b => b.isPool && b.joinStatus === "owner");

      const availablePools = [];
      for (const booking of poolBookings) {
        // Check if pickup is within 4km of pool's route
        const pickupDistance = calculateHaversine(pickupLat, pickupLng, booking.pickupLat, booking.pickupLng);
        const dropoffDistance = calculateHaversine(dropoffLat, dropoffLng, booking.dropoffLat, booking.dropoffLng);
        
        // Must be within 4km of pickup and dropoff points
        if (pickupDistance < 4 && dropoffDistance < 4) {
          const ride = booking.rideId ? await storage.getRide(booking.rideId) : null;
          const driver = ride?.driverId ? await storage.getUser(ride.driverId) : null;
          
          if (ride && ride.occupied < ride.capacity) {
            availablePools.push({
              booking,
              ride,
              driver,
              pickupDistance: pickupDistance.toFixed(1),
              dropoffDistance: dropoffDistance.toFixed(1),
              availableSeats: ride.capacity - ride.occupied,
            });
          }
        }
      }

      res.json(availablePools);
    } catch (err) {
      console.error("Find Pools Error:", err);
      res.status(400).json({ message: "Failed to find pools" });
    }
  });

  // Get all passengers in a pool
  app.get("/api/pools/:poolId/passengers", async (req, res) => {
    try {
      const poolId = parseInt(req.params.poolId);
      const passengers = await storage.getPoolPassengers(poolId);
      res.json(passengers);
    } catch (err) {
      res.status(400).json({ message: "Failed to get passengers" });
    }
  });

  app.post("/api/pools/join-request", async (req, res) => {
    try {
      const schema = z.object({
        poolId: z.number(), 
        userId: z.number(),
        pickupAddress: z.string(),
        dropoffAddress: z.string(),
        pickupLat: z.number(),
        pickupLng: z.number(),
        dropoffLat: z.number(),
        dropoffLng: z.number(),
        distance: z.number(), 
      });
      const data = schema.parse(req.body);

      const originalBooking = await storage.getBooking(data.poolId);
      if (!originalBooking || !originalBooking.isPool) {
        return res.status(404).json({ message: "Pool not found" });
      }

      const booking = await storage.createBooking({
        userId: data.userId,
        rideId: originalBooking.rideId,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        status: "pending",
        otp: Math.floor(1000 + Math.random() * 9000).toString(),
        fare: 0,
        isPool: true,
        poolId: data.poolId,
        distance: data.distance,
        joinStatus: "pending",
      });

      res.status(201).json(booking);
    } catch (err) {
      console.error("Join Pool Error:", err);
      res.status(400).json({ message: "Failed to create join request" });
    }
  });

  app.patch("/api/pools/respond/:bookingId", async (req, res) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      const schema = z.object({
        action: z.enum(["accept", "reject"]),
        pricePerKm: z.number().optional(), // For fare calculation
      });
      const { action, pricePerKm = 10 } = schema.parse(req.body);

      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.joinStatus !== "pending") {
        return res.status(404).json({ message: "Join request not found" });
      }

      if (action === "accept") {
        const fare = Math.round((booking.distance || 0) * pricePerKm);
        
        await storage.updateBookingPool(bookingId, {
          joinStatus: "accepted",
          status: "accepted",
          fare,
        });

        if (booking.rideId) {
          await storage.incrementRideOccupied(booking.rideId);
        }

        res.json({ message: "Join request accepted", fare });
      } else {
        await storage.updateBookingPool(bookingId, {
          joinStatus: "rejected",
          status: "cancelled",
        });
        res.json({ message: "Join request rejected" });
      }
    } catch (err) {
      console.error("Respond to Join Error:", err);
      res.status(400).json({ message: "Failed to respond to join request" });
    }
  });

  app.get("/api/pools/requests/:rideId", async (req, res) => {
    try {
      const rideId = parseInt(req.params.rideId);
      const requests = await storage.getPendingPoolRequests(rideId);
      res.json(requests);
    } catch (err) {
      res.status(400).json({ message: "Failed to get requests" });
    }
  });

  return httpServer;
}

async function seedDatabase() {
  const users = await storage.getUser(1);
  if (!users) {
    await storage.createUser({
      mobile: "9999999999",
      role: "passenger",
      isVerified: true,
      name: "Demo User",
      email: "demo@example.com"
    });
  }

  const rides = await storage.getRides();
  if (rides.length === 0) {
    await storage.createRide({
      driverId: null,
      carModel: "Toyota Prius",
      carNumber: "KA-01-AB-1234",
      latitude: 12.9716,
      longitude: 77.5946,
      heading: 0,
      isAvailable: true,
      type: "economy",
      pricePerKm: 15,
      capacity: 4,
      occupied: 0,
      status: "empty",
      finalDestination: null,
      currentRouteGeometry: null,
    });
    await storage.createRide({
      driverId: null,
      carModel: "Honda City",
      carNumber: "KA-01-XY-9876",
      latitude: 12.9720,
      longitude: 77.5950,
      heading: 90,
      isAvailable: true,
      type: "premium",
      pricePerKm: 25,
      capacity: 4,
      occupied: 0,
      status: "empty",
      finalDestination: null,
      currentRouteGeometry: null,
    });
    await storage.createRide({
      driverId: null,
      carModel: "Maruti Swift",
      carNumber: "KA-05-ZZ-5555",
      latitude: 12.9710,
      longitude: 77.5940,
      heading: 180,
      isAvailable: true,
      type: "pool",
      pricePerKm: 10,
      capacity: 4,
      occupied: 0,
      status: "empty",
      finalDestination: null,
      currentRouteGeometry: null,
    });
  }

}
