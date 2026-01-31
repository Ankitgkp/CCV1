import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Booking } from "@shared/schema";

export default function DriverHistory() {
  const [, setLocation] = useLocation();

  const { data: history, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/driver/history"],
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white px-6 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/driver/profile")}
          className="-ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-slate-800" />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Your Rides</h1>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        {isLoading ? (
          <div className="text-center text-slate-400 py-10">Loading history...</div>
        ) : history?.length === 0 ? (
          <div className="text-center text-slate-400 py-10">No rides completed yet.</div>
        ) : (
          history?.map((ride) => (
            <div key={ride.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase">
                  <Calendar className="w-3 h-3" />
                  {ride.createdAt && format(new Date(ride.createdAt), "MMM d, yyyy • h:mm a")}
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
                  COMPLETED
                </span>
              </div>

              <div className="space-y-3 mb-3">
                 <div className="opacity-80">
                    <p className="text-xs font-bold text-slate-400 uppercase">Route</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{ride.pickupAddress}</p>
                    <p className="text-xs text-slate-400">To</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{ride.dropoffAddress}</p>
                 </div>
              </div>

              <div className="border-t border-slate-50 pt-3 flex justify-between items-center bg-green-50/50 -mx-4 -mb-4 p-4 mt-2">
                <span className="text-xs font-bold text-green-700 uppercase">You Earned</span>
                <span className="text-xl font-bold text-green-700">₹{ride.fare || 0}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
