

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapboxMap } from "@/lib/map/mapbox/MapboxMap";
import { mapService } from "@/lib/map/mapbox/MapboxService";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { LogOut, MapPin } from "lucide-react";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import type { Booking } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBookings } from "@/hooks/use-bookings";


export default function DriverHome() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [incomingRequests, setIncomingRequests] = useState<Booking[]>([]);
  const [activeTrip, setActiveTrip] = useState<Booking | null>(null);
  const [tripStage, setTripStage] = useState<"to_pickup" | "arrived" | "in_progress" | "completed">("to_pickup");
  const prevRequestsRef = useRef<Set<number>>(new Set());
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // 1. Get Initial Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location", error);
          // Fallback to New Delhi
          setCurrentLocation({ lat: 28.6139, lng: 77.2090 });
        }
      );
    }
  }, []);

  // Send location updates when active trip exists
  useEffect(() => {
    if (!activeTrip || !currentLocation) return;
    
    // Send initial location
    const sendLocation = async () => {
      try {
        await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: activeTrip.id,
            lat: currentLocation.lat,
            lng: currentLocation.lng
          })
        });
      } catch (e) {
        console.error("Failed to send location", e);
      }
    };
    
    sendLocation();
    
    // Update location every 3 seconds
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setCurrentLocation(newLocation);
            try {
              await fetch("/api/driver/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bookingId: activeTrip.id,
                  lat: newLocation.lat,
                  lng: newLocation.lng
                })
              });
            } catch (e) {
              console.error("Failed to send location", e);
            }
          },
          () => {},
          { enableHighAccuracy: true }
        );
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [activeTrip, currentLocation]);

  const { updateStatus } = useBookings();

  // 2. Poll for Requests
  useQuery({
    queryKey: ["driver-requests"],
    queryFn: async () => {
        if (!isOnline) return null;
        const res = await apiRequest("GET", "/api/bookings?status=pending");
        const bookings: Booking[] = await res.json();
        
        setIncomingRequests(bookings);

        // Flash Notification Logic
        const currentIds = new Set(bookings.map(b => b.id));
        const newRequests = bookings.filter(b => !prevRequestsRef.current.has(b.id));
        
        if (newRequests.length > 0) {
            toast({ 
                title: "New Ride Request!", 
                description: `${newRequests.length} new request(s) found`,
                className: "bg-green-500 text-white border-none"
            });
        }
        
        prevRequestsRef.current = currentIds;
        return bookings;
    },
    refetchInterval: 2000,
    enabled: isOnline && !activeTrip // Stop polling when active trip
  });

  const handleAccept = async (booking: Booking) => {
      try {
          await updateStatus.mutateAsync({
              id: booking.id,
              status: "accepted",
              otp: "4567" 
          });
          toast({ title: "Ride Accepted", description: "Navigate to pickup location" });
          // Store accepted booking as active trip
          setActiveTrip(booking);
          setTripStage("to_pickup");
          // Clear from requests list
          setIncomingRequests([]);
      } catch (e) {
          toast({ title: "Failed to accept", variant: "destructive" });
      }
  };

  const handleArrivedAtPickup = async () => {
    if (!activeTrip) return;
    try {
      await updateStatus.mutateAsync({ id: activeTrip.id, status: "arrived" });
      setTripStage("arrived");
      toast({ title: "Marked as Arrived", description: "Verify passenger OTP to start trip" });
    } catch (e) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    try {
      await updateStatus.mutateAsync({ id: activeTrip.id, status: "in_progress" });
      setTripStage("in_progress");
      toast({ title: "Trip Started", description: "Navigate to dropoff" });
    } catch (e) {
      toast({ title: "Failed to start trip", variant: "destructive" });
    }
  };

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    try {
      await updateStatus.mutateAsync({ id: activeTrip.id, status: "completed" });
      setTripStage("completed");
      toast({ title: "Trip Completed!", description: `Earned ₹${activeTrip.fare}`, className: "bg-green-500 text-white border-none" });
      // Reset after a short delay
      setTimeout(() => {
        setActiveTrip(null);
        setTripStage("to_pickup");
      }, 2000);
    } catch (e) {
      toast({ title: "Failed to complete trip", variant: "destructive" });
    }
  };

  const startShiftMutation = useMutation({
    mutationFn: async () => {
        if (!user || !currentLocation) return;
        
        // Create an "Idle" Ride (Empty Container for Metadata)
        const res = await apiRequest("POST", "/api/rides", {
            driverId: user.id, // REAL ID
            carModel: "Toyota Innova", // Mock Car
            carNumber: "DL-1P-5555",
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            heading: 0,
            isAvailable: true,
            type: "pool",
            pricePerKm: 12,
            capacity: 6,
            occupied: 0,
            status: "empty", // Idle state
            finalDestination: null,
            currentRouteGeometry: null
        });
        return res.json();
    },
    onSuccess: () => {
        setIsOnline(true);
        toast({ title: "You are ONLINE", description: "Waiting for requests..." });
    },
    onError: (e) => {
        console.error(e);
        toast({ title: "Failed to go online", variant: "destructive" });
    }
  });

  const goOfflineMutation = useMutation({
      mutationFn: async () => {
          setCurrentRoute(null);
          setIncomingRequests([]);
          prevRequestsRef.current = new Set();
      },
      onSuccess: () => {
          setIsOnline(false);
          toast({ title: "You are OFFLINE" });
      }
  })

  return (
    <div className="h-screen w-full relative bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-white/90 backdrop-blur p-4 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <h1 className="font-bold text-lg">{isOnline ? (incomingRequests.length > 0 ? `${incomingRequests.length} Requests` : "Online (Idle)") : "Offline"}</h1>
            </div>
            <div className="flex items-center gap-2">
                <Switch 
                    checked={isOnline}
                    onCheckedChange={(checked) => {
                        if (checked) startShiftMutation.mutate();
                        else goOfflineMutation.mutate();
                    }}
                />
            </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
            {currentLocation && (
                <MapboxMap 
                    center={currentLocation}
                    route={currentRoute}
                    markers={
                        [
                            { ...currentLocation, type: "driver" },
                            ...incomingRequests.map(req => ({ lat: req.pickupLat, lng: req.pickupLng, type: "pickup" as const }))
                        ]
                    }
                />
            )}
        </div>

        {/* Action Panel */}
        {isOnline && incomingRequests.length === 0 && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-black/80 text-white backdrop-blur px-6 py-3 rounded-full flex items-center gap-3 animate-pulse">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="font-bold text-sm tracking-wide">Scanning area...</span>
                </div>
            </div>
        )}

        {isOnline && incomingRequests.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-slate-50 rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom flex flex-col max-h-[60vh]">
                <div className="p-6 bg-white rounded-t-[32px] border-b border-slate-100 sticky top-0 z-10">
                    <h3 className="text-xl font-bold">Ride Requests ({incomingRequests.length})</h3>
                </div>
                
                <div className="overflow-y-auto p-4 space-y-4 pb-10">
                    {incomingRequests.map(req => (
                        <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                             <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                    <MapPin className="w-6 h-6 text-black"/>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pickup</p>
                                    <p className="font-bold text-slate-900 leading-tight line-clamp-2">{req.pickupAddress}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-xl">
                                <div>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fare</p>
                                     <p className="text-xl font-bold text-slate-900">₹{req.fare}</p>
                                </div>
                                <div className="text-right">
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distance</p>
                                     <p className="text-sm font-bold text-slate-900">2.5 km</p>
                                </div>
                            </div>

                            <Button 
                                onClick={() => handleAccept(req)}
                                disabled={updateStatus.isPending}
                                className="w-full h-14 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg font-bold shadow-lg shadow-green-500/20"
                            >
                                {updateStatus.isPending ? "Accepting..." : "Accept"}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Active Trip Panel - After Accepting */}
        {activeTrip && (
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom p-6">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"></div>
                
                {/* Stage Header */}
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-900">
                        {tripStage === "to_pickup" && "Navigate to Pickup"}
                        {tripStage === "arrived" && "At Pickup Location"}
                        {tripStage === "in_progress" && "Trip in Progress"}
                        {tripStage === "completed" && "Trip Completed!"}
                    </h3>
                    <p className="text-slate-500 text-sm">
                        {tripStage === "to_pickup" && "Passenger is waiting"}
                        {tripStage === "arrived" && "Verify OTP from passenger"}
                        {tripStage === "in_progress" && "Heading to dropoff"}
                        {tripStage === "completed" && "Great job!"}
                    </p>
                </div>
                
                {/* Trip Info */}
                <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-3 h-3 rounded-full ${tripStage === "in_progress" ? "bg-slate-400" : "bg-green-500"}`}></div>
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup</p>
                            <p className="font-bold text-slate-900 text-sm">{activeTrip.pickupAddress}</p>
                        </div>
                        {tripStage === "to_pickup" && (
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">NEXT</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${tripStage === "in_progress" ? "bg-blue-500" : "bg-slate-300"}`}></div>
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dropoff</p>
                            <p className="font-bold text-slate-900 text-sm">{activeTrip.dropoffAddress}</p>
                        </div>
                        {tripStage === "in_progress" && (
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">NEXT</span>
                        )}
                    </div>
                </div>
                
                {/* OTP & Fare */}
                <div className="flex items-center justify-between bg-slate-100 p-4 rounded-2xl mb-4">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Passenger OTP</p>
                        <p className="text-2xl font-bold tracking-widest">{activeTrip.otp || "4567"}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Fare</p>
                        <p className="text-xl font-bold text-green-600">₹{activeTrip.fare}</p>
                    </div>
                </div>
                
                {/* Action Buttons based on stage */}
                <div className="flex gap-3">
                    {tripStage === "to_pickup" && (
                        <>
                            <Button 
                                onClick={() => {
                                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.pickupLat},${activeTrip.pickupLng}`, '_blank');
                                }}
                                variant="outline"
                                className="flex-1 h-14 rounded-xl font-bold border-slate-200"
                            >
                                Open Maps
                            </Button>
                            <Button 
                                onClick={handleArrivedAtPickup}
                                disabled={updateStatus.isPending}
                                className="flex-1 h-14 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold"
                            >
                                {updateStatus.isPending ? "Updating..." : "I've Arrived"}
                            </Button>
                        </>
                    )}
                    
                    {tripStage === "arrived" && (
                        <Button 
                            onClick={handleStartTrip}
                            disabled={updateStatus.isPending}
                            className="flex-1 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold"
                        >
                            {updateStatus.isPending ? "Starting..." : "Start Trip"}
                        </Button>
                    )}
                    
                    {tripStage === "in_progress" && (
                        <>
                            <Button 
                                onClick={() => {
                                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.dropoffLat},${activeTrip.dropoffLng}`, '_blank');
                                }}
                                variant="outline"
                                className="flex-1 h-14 rounded-xl font-bold border-slate-200"
                            >
                                Navigate to Drop
                            </Button>
                            <Button 
                                onClick={handleCompleteTrip}
                                disabled={updateStatus.isPending}
                                className="flex-1 h-14 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold"
                            >
                                {updateStatus.isPending ? "Completing..." : "Complete Trip"}
                            </Button>
                        </>
                    )}
                    
                    {tripStage === "completed" && (
                        <div className="flex-1 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                            <span className="text-green-700 font-bold text-lg">✓ Trip Completed</span>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
