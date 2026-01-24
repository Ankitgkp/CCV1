import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  mobile: text("mobile").notNull().unique(),
  name: text("name"),
  email: text("email"),
  role: text("role", { enum: ["passenger", "driver"] }).notNull().default("passenger"),
  isVerified: boolean("is_verified").default(false),
  avatar: text("avatar"),
  bio: text("bio"),
});

export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => users.id),
  carModel: text("car_model").notNull(),
  carNumber: text("car_number").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  heading: doublePrecision("heading").default(0),
  isAvailable: boolean("is_available").default(true),
  type: text("type", { enum: ["economy", "premium", "pool"] }).notNull().default("economy"),
  pricePerKm: integer("price_per_km").notNull(),
  capacity: integer("capacity").default(4).notNull(),
  occupied: integer("occupied").default(0).notNull(),
  status: text("status", { enum: ["empty", "boarding", "full", "in_progress", "completed"] }).default("empty"),
  finalDestination: json("final_destination"), // Store {lat, lng, text}
  currentRouteGeometry: json("current_route_geometry"), // Store GeoJSONLineString
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  rideId: integer("ride_id").references(() => rides.id),
  pickupAddress: text("pickup_address").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  pickupLat: doublePrecision("pickup_lat").notNull(),
  pickupLng: doublePrecision("pickup_lng").notNull(),
  dropoffLat: doublePrecision("dropoff_lat").notNull(),
  dropoffLng: doublePrecision("dropoff_lng").notNull(),
  status: text("status", { enum: ["pending", "accepted", "arrived", "in_progress", "completed", "cancelled"] }).default("pending"),
  otp: text("otp"),
  fare: integer("fare"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRideSchema = createInsertSchema(rides).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Ride = typeof rides.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
