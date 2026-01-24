import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, ArrowLeft, User as UserIcon, X, MapPin, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapboxMap } from "@/lib/map/mapbox/MapboxMap";
import { mapService } from "@/lib/map/mapbox/MapboxService";
import { nominatimService } from "@/lib/map/osm/NominatimService";
import { RideCard } from "@/components/RideCard";
import { useRides } from "@/hooks/use-rides";
import { useBookings } from "@/hooks/use-bookings";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Ride, User } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Place, Coordinates } from "@/lib/map/types";

export default function Home() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"search" | "select" | "confirm" | "waiting" | "trip">("search");
  
  // -- Map & Location State --
  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  
  const [dropoff, setDropoff] = useState("");
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);

  const [route, setRoute] = useState<any>(null);
  const [distance, setDistance] = useState(0); // km

  // -- Autocomplete State --
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [activeInput, setActiveInput] = useState<"pickup" | "dropoff" | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<{ id: number; name: string; mobile: string; avatar?: string } | null>(null);
  const [rideInfo, setRideInfo] = useState<{ id: number; carModel: string; carNumber: string } | null>(null);
  const [tripOtp, setTripOtp] = useState<string>("");
  const [tripStatus, setTripStatus] = useState<"accepted" | "arrived" | "in_progress" | "completed">("accepted");
  const [tripFare, setTripFare] = useState<number>(0);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverEta, setDriverEta] = useState<number | null>(null);
  
  const { data: user } = useQuery<User>({
    queryKey: [api.user.getProfile.path],
  });
  
  const { data: rides } = useRides();
  const { createBooking } = useBookings();
  const { toast } = useToast();

  // Debounce search with loading state
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeInput === "pickup" && pickup.length > 2) {
        setIsLoadingSuggestions(true);
        try {
          const results = await nominatimService.search(pickup);
          setSuggestions(results);
        } catch (e) {
          console.error("Search error:", e);
          toast({ title: "Search failed", variant: "destructive" });
        } finally {
          setIsLoadingSuggestions(false);
        }
      } else if (activeInput === "dropoff" && dropoff.length > 2) {
        setIsLoadingSuggestions(true);
        try {
          const results = await nominatimService.search(dropoff);
          setSuggestions(results);
        } catch (e) {
          console.error("Search error:", e);
          toast({ title: "Search failed", variant: "destructive" });
        } finally {
          setIsLoadingSuggestions(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [pickup, dropoff, activeInput, toast]);

  // GPS Auto-detect for pickup
  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported", variant: "destructive" });
      return;
    }
    
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPickupCoords({ lat: latitude, lng: longitude });
        mapService.flyTo({ lat: latitude, lng: longitude });
        
        // Reverse geocode to get address
        try {
          const res = await fetch(
            `/api/proxy/search?q=${latitude},${longitude}`
          );
          const data = await res.json();
          if (data && data[0]) {
            setPickup(data[0].display_name?.split(',').slice(0, 2).join(', ') || "Current Location");
          } else {
            setPickup("Current Location");
          }
        } catch (e) {
          setPickup("Current Location");
        }
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        toast({ title: "Could not get location", description: "Please enter manually", variant: "destructive" });
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  
  const handleSelectPlace = (place: Place) => {
    if (activeInput === "pickup") {
      setPickup(place.text);
      setPickupCoords({ lng: place.center[0], lat: place.center[1] });
      mapService.flyTo({ lng: place.center[0], lat: place.center[1] });
    } else if (activeInput === "dropoff") {
      setDropoff(place.text);
      setDropoffCoords({ lng: place.center[0], lat: place.center[1] });
      mapService.flyTo({ lng: place.center[0], lat: place.center[1] });
    }
    setSuggestions([]);
    setActiveInput(null);
  };

  const handleRouteCalculation = async () => {
    if (!pickupCoords || !dropoffCoords) {
      toast({ title: "Please select valid locations", variant: "destructive" });
      return;
    }

    // 1. Calculate Route
    const routeData = await mapService.getRoute(pickupCoords, dropoffCoords);
    if (!routeData) {
      toast({ title: "Could not calculate route", variant: "destructive" });
      return;
    }
    
    setRoute(routeData.geometry);
    setDistance(routeData.distance / 1000);

    // 2. Check for Pooling Matches
    try {
        const res = await fetch("/api/rides/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pickupLat: pickupCoords.lat,
                pickupLng: pickupCoords.lng,
                dropoffLat: dropoffCoords.lat,
                dropoffLng: dropoffCoords.lng
            })
        });
        const matches: Ride[] = await res.json();
        
        if (matches.length > 0) {
            // Logic to show matched rides
            toast({ 
                title: `Found ${matches.length} existing pools!`, 
                description: "You can join these rides to save money.",
                duration: 5000 
            });
            // For now, we will add them to the top of the list or handle them specifically
            // Ideally, we switch to a 'matches' step.
        }
    } catch (e) {
        console.error("Match check failed", e);
    }

    setStep("select");
  };

  const handleBooking = async () => {
    if (!selectedRide || !pickupCoords || !dropoffCoords) return;
    try {
      const booking = await createBooking.mutateAsync({
        userId: user?.id || 1,
        rideId: selectedRide.id,
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        dropoffLat: dropoffCoords.lat,
        dropoffLng: dropoffCoords.lng,
        fare: Math.round(selectedRide.pricePerKm * distance),
        otp: "4567",
        status: "pending"
      });
      setBookingId(booking.id);
      setStep("waiting");
    } catch (e) {
      console.error(e);
      toast({ title: "Booking failed", variant: "destructive" });
    }
  };

  // Poll for Booking Status
  useQuery({
    queryKey: ["booking-status", bookingId],
    queryFn: async () => {
        if (!bookingId) return null;
        const res = await fetch(`/api/bookings/${bookingId}`);
        const booking = await res.json();
        
        // Handle different statuses
        if (booking.status === "accepted" && step === "waiting") {
            if (booking.driver) setDriverInfo(booking.driver);
            if (booking.ride) setRideInfo(booking.ride);
            if (booking.otp) setTripOtp(booking.otp);
            if (booking.fare) setTripFare(booking.fare);
            setTripStatus("accepted");
            setStep("trip");
            toast({ title: "Driver Found!", description: "Your driver is on the way" });
        } else if (booking.status === "arrived" && tripStatus !== "arrived") {
            setTripStatus("arrived");
            toast({ title: "Driver Arrived!", description: "Your driver has reached your location", className: "bg-green-500 text-white border-none" });
        } else if (booking.status === "in_progress" && tripStatus !== "in_progress") {
            setTripStatus("in_progress");
            toast({ title: "Trip Started!", description: "Enjoy your ride" });
        } else if (booking.status === "completed" && tripStatus !== "completed") {
            setTripStatus("completed");
            toast({ title: "Trip Completed!", description: "Thank you for riding" });
            setTimeout(() => {
              setLocation("/review");
            }, 1500);
        } else if (booking.status === "pending") {
            const createdAt = new Date(booking.createdAt).getTime();
            const now = Date.now();
            if (now - createdAt > 70000) {
                toast({ title: "No drivers found", description: "Please try again later.", variant: "destructive" });
                setStep("search");
                setBookingId(null);
                return null;
            }
        }
        return booking;
    },
    refetchInterval: 1000,
    enabled: (step === "waiting" || step === "trip") && !!bookingId
  });

  // Poll for driver location when in trip mode
  useQuery({
    queryKey: ["driver-location", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      try {
        const res = await fetch(`/api/driver/location/${bookingId}`);
        if (!res.ok) return null;
        const location = await res.json();
        setDriverLocation({ lat: location.lat, lng: location.lng });
        
        // Calculate ETA if we have pickup coords
        if (pickupCoords && tripStatus === "accepted") {
          const distanceKm = calculateDistance(
            location.lat, location.lng,
            pickupCoords.lat, pickupCoords.lng
          );
          // Assume avg speed 30 km/h in city
          const etaMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));
          setDriverEta(etaMinutes);
        } else if (dropoffCoords && tripStatus === "in_progress") {
          const distanceKm = calculateDistance(
            location.lat, location.lng,
            dropoffCoords.lat, dropoffCoords.lng
          );
          const etaMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));
          setDriverEta(etaMinutes);
        }
        return location;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 3000,
    enabled: step === "trip" && !!bookingId && tripStatus !== "completed"
  });

  // Haversine distance calculation
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Construct markers for map
  const markers = [];
  if (pickupCoords) markers.push({ ...pickupCoords, type: "pickup" as const });
  if (dropoffCoords) markers.push({ ...dropoffCoords, type: "dropoff" as const });
  // Real driver location from tracking
  if (step === "trip" && driverLocation) {
    markers.push({ ...driverLocation, type: "driver" as const });
  }

  return (
    <div className="h-screen w-full relative flex flex-col bg-slate-50 overflow-hidden">
      {/* Real Map Component */}
      <div className="flex-1 relative z-0">
        <MapboxMap 
            markers={markers}
            route={route}
        />
      </div>

      {/* Profile Button Overlay */}
      <div className="absolute top-4 left-4 z-20">
        <Button 
          variant="ghost" 
          size="icon" 
          className="bg-white rounded-full shadow-lg border border-slate-100 h-12 w-12 hover:bg-slate-50"
          onClick={() => setLocation("/profile")}
        >
          <UserIcon className="w-6 h-6 text-slate-900" />
        </Button>
      </div>

      {/* Floating Search Panel (Uber Style) */}
      <AnimatePresence>
        {step === "search" && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-10"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-6">Where to?</h2>
            
            <div className="space-y-3 relative">
              {/* Pickup Input */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <Input 
                  className="h-auto p-0 border-0 bg-transparent text-base font-medium focus-visible:ring-0 placeholder:text-slate-400 flex-1"
                  placeholder="Enter pickup location" 
                  value={pickup}
                  onFocus={() => setActiveInput("pickup")}
                  onChange={(e) => setPickup(e.target.value)}
                />
                {pickup ? (
                  <X className="w-5 h-5 text-slate-400 cursor-pointer shrink-0" onClick={() => { setPickup(""); setPickupCoords(null); }} />
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-blue-600 font-medium shrink-0"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}
                  >
                    {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  </Button>
                )}
              </div>

              {/* Autocomplete Suggestions - Positioned below active input */}
              {(suggestions.length > 0 || isLoadingSuggestions) && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-52 overflow-y-auto">
                  {isLoadingSuggestions ? (
                    <div className="p-4 flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Searching...</span>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">No results found</div>
                  ) : (
                    suggestions.map(place => (
                      <div 
                        key={place.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3"
                        onClick={() => handleSelectPlace(place)}
                      >
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-900 truncate">{place.text}</p>
                          <p className="text-xs text-slate-500 truncate">{place.place_name}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Dropoff Input */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-2.5 h-2.5 bg-slate-900"></div>
                <Input 
                  className="h-auto p-0 border-0 bg-transparent text-base font-bold focus-visible:ring-0 placeholder:text-slate-500 flex-1"
                  placeholder="Where are you going?" 
                  value={dropoff}
                  onFocus={() => setActiveInput("dropoff")}
                  onChange={(e) => setDropoff(e.target.value)}
                />
                {dropoff && <X className="w-5 h-5 text-slate-400 cursor-pointer shrink-0" onClick={() => { setDropoff(""); setDropoffCoords(null); }} />}
              </div>

              <Button 
                onClick={handleRouteCalculation} 
                className="w-full h-16 bg-black text-white hover:bg-slate-900 rounded-2xl text-lg font-bold mt-2 shadow-xl shadow-black/10"
              >
                Request Ride
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ride Selection (Rapido Style) */}
      <AnimatePresence>
        {step === "select" && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-[32px] p-6 max-h-[85vh] overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe"
          >
            <div className="flex items-center gap-4 mb-6">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100" 
                onClick={() => setStep("search")}
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div>
                  <h3 className="text-xl font-bold">Recommended Rides</h3>
                  <p className="text-xs text-slate-500 font-medium">Trip distance: {distance.toFixed(1)} km</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide mb-20">
              {rides?.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  selected={selectedRide?.id === ride.id}
                  onSelect={setSelectedRide}
                  distance={distance}
                />
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-50">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment</span>
                  <div className="h-5 w-8 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold">CASH</div>
                </div>
                {selectedRide && (
                  <div className="text-lg font-bold">₹{Math.round(selectedRide.pricePerKm * distance)}</div>
                )}
              </div>
              <Button 
                disabled={!selectedRide || createBooking.isPending}
                onClick={handleBooking}
                className="w-full h-16 bg-black text-white rounded-2xl text-lg font-bold shadow-xl shadow-black/10"
              >
                {createBooking.isPending ? "Requesting..." : `Book ${selectedRide?.type || 'Ride'}`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finding Ride (Professional Loading) */}
      <AnimatePresence>
        {step === "waiting" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-40 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-24 h-24 mb-8">
               <div className="w-full h-full border-4 border-slate-100 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 border-4 border-black rounded-full border-t-transparent animate-spin"></div>
                  <Navigation className="w-8 h-8 text-black fill-black" />
               </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Connecting with driver</h2>
            <p className="text-slate-500 font-medium">Sit back while we find you the best ride</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Trip Panel - Dynamic based on trip status */}
      <AnimatePresence>
        {step === "trip" && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-[32px] p-6 shadow-[0_-10px_50px_rgba(0,0,0,0.15)] pb-safe"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"></div>
            
            {/* Status Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {tripStatus === "accepted" && "Driver on the way"}
                  {tripStatus === "arrived" && "Driver has arrived!"}
                  {tripStatus === "in_progress" && "Heading to destination"}
                  {tripStatus === "completed" && "Trip Completed!"}
                </h3>
                <p className="text-slate-500 text-sm">
                  {tripStatus === "accepted" && (driverEta ? `~${driverEta} min${driverEta > 1 ? 's' : ''} away • ${pickup}` : `Calculating ETA... • ${pickup}`)}
                  {tripStatus === "arrived" && "Meet your driver at pickup"}
                  {tripStatus === "in_progress" && (driverEta ? `~${driverEta} min${driverEta > 1 ? 's' : ''} to ${dropoff}` : dropoff)}
                  {tripStatus === "completed" && "Thank you for riding!"}
                </p>
              </div>
              {tripStatus !== "completed" && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">OTP</span>
                  <div className="bg-slate-100 text-black px-4 py-2 text-xl font-bold rounded-xl tracking-widest border border-slate-200">
                    {tripOtp || "----"}
                  </div>
                </div>
              )}
            </div>

            {/* Driver Info Card */}
            <div className={`flex items-center gap-4 p-4 rounded-2xl border mb-4 ${tripStatus === "arrived" ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-100"}`}>
              <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                <AvatarFallback className={`font-bold ${tripStatus === "arrived" ? "bg-green-600 text-white" : "bg-slate-900 text-white"}`}>
                  {driverInfo?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || "DR"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="text-lg font-bold">{driverInfo?.name || "Your Driver"}</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{rideInfo?.carModel || "Car"} • 4.9 ★</p>
              </div>
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm">
                {rideInfo?.carNumber || "---"}
              </div>
            </div>

            {/* Fare Display for in_progress */}
            {tripStatus === "in_progress" && (
              <div className="flex items-center justify-between bg-slate-100 p-4 rounded-2xl mb-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Trip Fare</p>
                  <p className="text-2xl font-bold text-slate-900">₹{tripFare || Math.round((selectedRide?.pricePerKm || 12) * distance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Distance</p>
                  <p className="text-lg font-bold text-slate-700">{distance.toFixed(1)} km</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-14 rounded-2xl border-slate-200 font-bold hover:bg-slate-50" 
                onClick={() => toast({ title: "Calling driver..." })}
              >
                <Phone className="w-5 h-5 mr-2" />
                Call
              </Button>
              {tripStatus !== "in_progress" && tripStatus !== "completed" && (
                <Button 
                  variant="ghost" 
                  className="flex-1 h-14 text-red-500 font-bold hover:bg-red-50" 
                  onClick={() => {
                    setStep("search");
                    setBookingId(null);
                    toast({ title: "Ride cancelled" });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
