import { useEffect, useRef } from "react";
import { mapService } from "./MapboxService";
import { Coordinates } from "../types";

interface MapProps {
  markers?: { lat: number; lng: number; type: "pickup" | "dropoff" | "driver"; heading?: number }[];
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

        // Add ResizeObserver to handle container size changes
        const resizeObserver = new ResizeObserver(() => {
            mapService.resize();
        });
        resizeObserver.observe(mapContainer.current);

        return () => {
            resizeObserver.disconnect();
            // We generally don't destroy the map on re-renders in strict mode to avoid flashing
            // but for full cleanup: mapService.destory();
        }
    }
  }, []);

  // Handle Markers
  const lastMarkersCount = useRef(0);

  useEffect(() => {
    if (!initialized.current) return;
    
    mapService.syncMarkers(markers);
    
    // Only fit bounds if the NUMBER of markers has changed
    // This prevents "deflection" when markers move but the set remains same
    if (markers.length !== lastMarkersCount.current) {
        if (markers.length > 1) {
            mapService.fitBounds(100);
        } else if (markers.length === 1) {
            mapService.flyTo({ lat: markers[0].lat, lng: markers[0].lng });
        }
        lastMarkersCount.current = markers.length;
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
