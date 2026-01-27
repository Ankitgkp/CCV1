import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Booking } from "@shared/schema";

export default function RideHistory() {
  const [, setLocation] = useLocation();

  const { data: history, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/user/history"],
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white px-6 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/profile")}
          className="-ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-slate-800" />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Ride History</h1>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        {isLoading ? (
          <div className="text-center text-slate-400 py-10">Loading history...</div>
        ) : history?.length === 0 ? (
          <div className="text-center text-slate-400 py-10">No rides found.</div>
        ) : (
          history?.map((ride) => (
            <div key={ride.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase">
                  <Calendar className="w-3 h-3" />
                  {ride.createdAt && format(new Date(ride.createdAt), "MMM d, yyyy • h:mm a")}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  ride.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {ride.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3 mb-3">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <div className="w-0.5 h-full bg-slate-100 min-h-[20px]" />
                    <div className="w-2 h-2 rounded-full bg-slate-800" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Pickup</p>
                      <p className="text-sm font-medium text-slate-900">{ride.pickupAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Dropoff</p>
                      <p className="text-sm font-medium text-slate-900">{ride.dropoffAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-50 pt-3 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Total Fare</span>
                <span className="text-lg font-bold text-slate-900">₹{ride.fare || 0}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
