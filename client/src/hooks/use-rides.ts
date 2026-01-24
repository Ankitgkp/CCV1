import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useRides(lat?: number, lng?: number) {
  return useQuery({
    queryKey: [api.rides.list.path, lat, lng],
    queryFn: async () => {
      // Construct URL with query params if they exist
      const url = new URL(api.rides.list.path, window.location.origin);
      if (lat) url.searchParams.append("lat", lat.toString());
      if (lng) url.searchParams.append("lng", lng.toString());

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch rides");
      
      return api.rides.list.responses[200].parse(await res.json());
    },
    // Mock data fallback if backend is empty/not ready
    initialData: [
      { id: 1, driverId: 101, carModel: "Toyota Prius", carNumber: "ABC-123", latitude: 0, longitude: 0, heading: 0, isAvailable: true, type: "economy", pricePerKm: 12 },
      { id: 2, driverId: 102, carModel: "Honda City", carNumber: "XYZ-789", latitude: 0.01, longitude: 0.01, heading: 90, isAvailable: true, type: "premium", pricePerKm: 18 },
      { id: 3, driverId: 103, carModel: "Maruti Swift", carNumber: "POOL-001", latitude: -0.01, longitude: -0.01, heading: 180, isAvailable: true, type: "pool", pricePerKm: 8 },
    ] as any[], // Casting to avoid strict type mismatch during prototyping
  });
}
