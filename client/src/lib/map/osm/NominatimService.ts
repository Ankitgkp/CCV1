import { IAutocompleteService, Place } from "../types";

export class NominatimService implements IAutocompleteService {
  async search(query: string): Promise<Place[]> {
    if (!query) return [];

    try {
      // Use our backend proxy to avoid CORS issues
      const response = await fetch(
        `/api/proxy/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      return data.map((item: any) => ({
        id: item.place_id.toString(),
        text: item.name || item.display_name.split(",")[0],
        place_name: item.display_name,
        center: [parseFloat(item.lon), parseFloat(item.lat)], // Nominatim returns strings
      }));
    } catch (error) {
      console.error("Nominatim search error:", error);
      return [];
    }
  }
}

export const nominatimService = new NominatimService();
