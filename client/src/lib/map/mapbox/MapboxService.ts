import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { 
  IMapService, 
  IAutocompleteService, 
  IDirectionsService, 
  Coordinates, 
  Place, 
  Route 
} from "../types";

// TODO: User needs to provide their own token here
const MAPBOX_TOKEN = "pk.eyJ1IjoiYW5raXRna3A5IiwiYSI6ImNta3J4dnNicDExbXgzZnM2eTN5djZhanMifQ.US0rWEz5xsAt_SNra9w_wA"; 

mapboxgl.accessToken = MAPBOX_TOKEN;

export class MapboxService implements IMapService, IAutocompleteService, IDirectionsService {
  private map: mapboxgl.Map | null = null;
  private markers: Map<string, mapboxgl.Marker> = new Map();

  initialize(container: HTMLElement, center: Coordinates = { lat: 0, lng: 0 }) {
    this.map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
  }

  resize() {
    if (this.map) {
      this.map.resize();
    }
  }

  syncMarkers(markerDefs: { lat: number; lng: number; type: "pickup" | "dropoff" | "driver"; heading?: number }[]) {
    if (!this.map) return;

    const currentKeys = new Set(this.markers.keys());
    const nextKeys = new Set<string>();

    markerDefs.forEach((m, index) => {
      // Use type + index as key for stability (since we usually have one of each type in trip view)
      const key = `${m.type}-${index}`;
      nextKeys.add(key);

      const existingMarker = this.markers.get(key);

      if (existingMarker) {
        // Update existing marker position
        existingMarker.setLngLat([m.lng, m.lat]);
        
        // Update rotation for driver
        if (m.type === "driver") {
          const el = existingMarker.getElement();
          el.style.transform = `rotate(${m.heading || 0}deg)`;
        }
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = `marker-${m.type}`;
        
        if (m.type === "driver") {
          el.style.width = "40px";
          el.style.height = "40px";
          el.style.backgroundImage = "url('/car-marker.png')";
          el.style.backgroundSize = "contain";
          el.style.backgroundRepeat = "no-repeat";
          el.style.backgroundPosition = "center";
          el.style.transition = "transform 0.5s ease-out, left 0.5s ease-out, top 0.5s ease-out";
          el.style.transform = `rotate(${m.heading || 0}deg)`;
        } else {
          el.style.width = "16px";
          el.style.height = "16px";
          el.style.backgroundColor = "black";
          el.style.borderRadius = "50%";
          el.style.border = "3px solid white";
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        }

        const marker = new mapboxgl.Marker(el)
          .setLngLat([m.lng, m.lat])
          .addTo(this.map!);
        
        this.markers.set(key, marker);
      }
    });

    // Remove markers that are no longer present
    currentKeys.forEach(key => {
      if (!nextKeys.has(key)) {
        this.markers.get(key)?.remove();
        this.markers.delete(key);
      }
    });
  }

  addMarker(lng: number, lat: number, type: "pickup" | "dropoff" | "driver" = "pickup", heading: number = 0) {
    this.syncMarkers([{ lat, lng, type, heading }]);
  }

  clearMarkers() {
    this.markers.forEach(m => m.remove());
    this.markers.clear();
  }

  drawRoute(route: any) {
    if (!this.map) return;

    const sourceId = "route";
    const layerId = "route-layer";

    if (this.map.getSource(sourceId)) {
      (this.map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: route.geometry,
      });
    } else {
      this.map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: route.geometry,
        },
      });

      this.map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#000000",
          "line-width": 4,
        },
      });
    }
    
    // Fit bounds to route
    this.fitBounds(50);
  }

  fitBounds(padding: number = 50) {
    if (!this.map || this.markers.size === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    this.markers.forEach(m => bounds.extend(m.getLngLat()));
    
    this.map.fitBounds(bounds, { padding, maxZoom: 15 });
  }

  flyTo(coords: Coordinates) {
    if (!this.map) return;
    this.map.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });
  }

  destory() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  on(event: string, callback: (e: any) => void) {
      if(this.map) {
          this.map.on(event, callback)
      }
  }

  // --- Autocomplete Implementation ---
  async search(query: string): Promise<Place[]> {
    if (!query) return [];
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=in&proximity=ip`
      );
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error("Mapbox search error:", error);
      return [];
    }
  }

  // --- Directions Implementation ---
  async getRoute(start: Coordinates, end: Coordinates): Promise<Route | null> {
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) return null;
      
      const route = data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      };
    } catch (error) {
      console.error("Mapbox directions error:", error);
      return null;
    }
  }
}

export const mapService = new MapboxService();
