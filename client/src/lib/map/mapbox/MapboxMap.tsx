import { useEffect, useRef } from "react";
import { mapService } from "./MapboxService";
import { Coordinates } from "../types";

interface MapProps {
  markers?: { lat: number; lng: number; type: "pickup" | "dropoff" | "driver" }[];
  route?: any; // GeoJSON geometry
  center?: Coordinates; // Initial center
  className?: string;
}

export const MapboxMap = ({ markers = [], route, center, className }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Initialize Map
  useEffect(() => {
    if (mapContainer.current && !initialized.current) {
        // Default to New Delhi if no center provided
        const initialCenter = center || { lat: 28.6139, lng: 77.2090 };
        mapService.initialize(mapContainer.current, initialCenter);
        initialized.current = true;
    }

    return () => {
        // We generally don't destroy the map on re-renders in strict mode to avoid flashing
        // but for full cleanup: mapService.destory();
    }
  }, []);

  // Handle Markers
  useEffect(() => {
    if (!initialized.current) return;
    
    mapService.clearMarkers();
    markers.forEach(m => {
        mapService.addMarker(m.lng, m.lat, m.type);
    });
    
    // Fit bounds if we have multiple markers
    if (markers.length > 1) {
        mapService.fitBounds(100);
    } else if (markers.length === 1) {
        mapService.flyTo({ lat: markers[0].lat, lng: markers[0].lng });
    }

  }, [markers]);

  // Handle Route
  useEffect(() => {
      if (!initialized.current) return;

      if (route) {
          mapService.drawRoute({ geometry: route });
      }
  }, [route]);


  return (
    <div 
        ref={mapContainer} 
        className={`w-full h-full ${className}`}
        style={{ minHeight: "100%" }}
    />
  );
};
