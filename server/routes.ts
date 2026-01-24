import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { matchingService } from "./services/MatchingService";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Proxy for OpenStreetMap Search (to avoid CORS)
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
            "User-Agent": "RideShareApp/1.0", // Nominatim requires a User-Agent
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

  // Auth routes
  app.post(api.auth.loginWithMobile.path, async (req, res) => {
    try {
      const { mobile, otp, role } = api.auth.loginWithMobile.input.parse(req.body);
      
      // MOCK OTP verification - always succeed for prototype
      if (otp !== "1234") {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      let user = await storage.getUserByMobile(mobile);
      if (!user) {
        // Create user on first login
        user = await storage.createUser({
          mobile,
          role,
          isVerified: true
        } as any);
      } else {
          // If user exists, maybe update role if needed, but for now just login
          // Or we could enforce role consistency
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

  // User routes
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

  // Rides routes
  app.get(api.rides.list.path, async (req, res) => {
    const rides = await storage.getRides();
    res.json(rides);
  });

  // Bookings routes
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
      });
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
    
    // If booking has a rideId, fetch ride and driver details
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

  // Update booking status (for drivers to accept, etc.)
  app.patch("/api/bookings/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.bookings.updateStatus.input.parse(req.body);
      
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const updatedBooking = await storage.updateBookingStatus(id, input.status, input.otp);
      
      res.json(updatedBooking);
    } catch (err) {
      console.error("Update Booking Status Error:", err);
      res.status(400).json({ message: "Invalid status update" });
    }
  });

  // Driver location tracking - in-memory store for simplicity
  const driverLocations: Map<number, { lat: number; lng: number; updatedAt: number }> = new Map();

  // Driver updates their location
  app.post("/api/driver/location", async (req, res) => {
    try {
      const { bookingId, lat, lng } = req.body;
      if (!bookingId || lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "bookingId, lat, lng required" });
      }
      driverLocations.set(bookingId, { lat, lng, updatedAt: Date.now() });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Failed to update location" });
    }
  });

  // Passenger gets driver location
  app.get("/api/driver/location/:bookingId", async (req, res) => {
    const bookingId = parseInt(req.params.bookingId);
    const location = driverLocations.get(bookingId);
    if (!location) {
      return res.status(404).json({ message: "Driver location not available" });
    }
    res.json(location);
  });

  // Seed data
  await seedDatabase();

  // Create Ride Route (For Driver Going Online)
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

  // Match Rides Route
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

  return httpServer;
}

async function seedDatabase() {
  // Seed User
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
