import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Booking } from "@shared/schema";
import { z } from "zod";

type CreateBookingInput = z.infer<typeof api.bookings.create.input>;
type UpdateStatusInput = z.infer<typeof api.bookings.updateStatus.input>;

export function useBookings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createBooking = useMutation({
    mutationFn: async (data: CreateBookingInput) => {
      const res = await fetch(api.bookings.create.path, {
        method: api.bookings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create booking");
      return api.bookings.create.responses[201].parse(await res.json());
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(["current-booking"], booking);
      toast({ title: "Ride Requested", description: "Finding your driver..." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not request ride", variant: "destructive" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateStatusInput) => {
      const url = buildUrl(api.bookings.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.bookings.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return api.bookings.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["current-booking"], updated);
    },
  });

  return { createBooking, updateStatus };
}

export function useCurrentBooking() {
  // Simulating a "current booking" query - in real app would fetch by ID or user's active booking
  return useQuery<Booking | null>({
    queryKey: ["current-booking"],
    queryFn: () => null, // Initially null
    staleTime: Infinity,
  });
}
