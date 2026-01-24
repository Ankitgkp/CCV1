export interface Coordinates {
    lat: number;
    lng: number;
}
  
export interface Place {
    id: string;
    text: string;
    place_name: string;
    center: [number, number]; // [lng, lat] for Mapbox
}
  
export interface Route {
    distance: number; // in meters
    duration: number; // in seconds
    geometry: any; // GeoJSON geometry
}
  
export interface IMapService {
    initialize(container: HTMLElement, center?: Coordinates): void;
    addMarker(lng: number, lat: number, type?: "pickup" | "dropoff" | "driver"): void;
    clearMarkers(): void;
    drawRoute(route: any): void;
    fitBounds(padding?: number): void;
    flyTo(coords: Coordinates): void;
    destory(): void;
    on(event: string, callback: (e: any) => void): void;
}
  
export interface IAutocompleteService {
    search(query: string): Promise<Place[]>;
}
  
export interface IDirectionsService {
    getRoute(start: Coordinates, end: Coordinates): Promise<Route | null>;
}
