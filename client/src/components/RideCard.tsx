import { Car, Zap, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ride } from "@shared/schema";

interface RideCardProps {
  ride: Ride;
  selected: boolean;
  onSelect: (ride: Ride) => void;
  distance: number; // in km
}

export function RideCard({ ride, selected, onSelect, distance }: RideCardProps) {
  const price = Math.round(ride.pricePerKm * distance);
  
  const getIcon = () => {
    switch (ride.type) {
      case "premium": return <Zap className="w-5 h-5" />;
      case "pool": return <Users className="w-5 h-5" />;
      default: return <Car className="w-5 h-5" />;
    }
  };

  const getLabel = () => {
    switch (ride.type) {
      case "premium": return "Premium";
      case "pool": return "Share";
      default: return "Economy";
    }
  };

  const getTime = () => {
    // Fake time calc
    return Math.round(distance * 3) + 2; 
  };

  return (
    <button
      onClick={() => onSelect(ride)}
      className={cn(
        "relative w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 text-left",
        selected 
          ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
          : "border-transparent bg-slate-50 hover:bg-slate-100"
      )}
    >
      <div className={cn(
        "p-3 rounded-full flex items-center justify-center",
        ride.type === "premium" ? "bg-amber-100 text-amber-700" :
        ride.type === "pool" ? "bg-green-100 text-green-700" :
        "bg-blue-100 text-blue-700"
      )}>
        {getIcon()}
      </div>
      
      <div className="flex-1">
        <h4 className="font-bold text-slate-900">{getLabel()}</h4>
        <p className="text-xs text-slate-500">{getTime()} min away • {ride.carModel}</p>
      </div>

      <div className="text-right">
        <span className="block text-lg font-bold text-slate-900">${price}</span>
        {ride.type === "pool" && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            SAVE 30%
          </span>
        )}
      </div>
      
      {selected && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
      )}
    </button>
  );
}
