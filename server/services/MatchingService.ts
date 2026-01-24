import { storage } from "../storage";
import * as turf from "@turf/turf";
import type { Ride } from "@shared/schema";

export class MatchingService {
  async findMatches(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number
  ): Promise<Ride[]> {
    // 1. Get all active pooled rides with capacity
    const activeRides = await storage.getActivePoolRides();
    
    const matches: Ride[] = [];
    const pickupPoint = turf.point([pickupLng, pickupLat]);
    const dropoffPoint = turf.point([dropoffLng, dropoffLat]);

    for (const ride of activeRides) {
      if (!ride.finalDestination || !ride.currentRouteGeometry) continue;

      // 2. Check Destination Proximity (Cluster Logic)
      // Is the user's dropoff close to the ride's final destination? (e.g., 3km radius for "Metro Station Area")
      const finalDest = ride.finalDestination as { lat: number; lng: number };
      const rideDestPoint = turf.point([finalDest.lng, finalDest.lat]);
      const distToDest = turf.distance(dropoffPoint, rideDestPoint, { units: "kilometers" });

      if (distToDest > 3) {
        continue; // Destination is too far, not a match
      }

      // 3. Check Pickup "Along the Path"
      // Is the user's pickup point within 500m (0.5km) of the driver's current route?
      const routeLine = turf.lineString((ride.currentRouteGeometry as any).coordinates);
      const distToRoute = turf.pointToLineDistance(pickupPoint, routeLine, { units: "kilometers" });

      if (distToRoute <= 0.5) {
        matches.push(ride);
      }
    }

    return matches;
  }
}

export const matchingService = new MatchingService();
