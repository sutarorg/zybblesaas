import { route, ok } from "./_lib/http";
import { nearbyPlaces } from "./_lib/geo";
import { badRequest } from "./_lib/errors";

/**
 * Location lookup used by the search form and the AI plan review step.
 *
 * Zybble resolves cities from its own `geo_places` table (seeded by migration)
 * instead of calling the Google Geocoding API: no Google Maps API key is needed
 * anywhere in the product, and quota/abuse is bounded locally.
 */
export default route({ methods: ["GET"], auth: "both", scopes: ["searches:read"], limit: { bucket: "geo", perMinute: 300 } }, async (ctx) => {
  const query = (ctx.query.q ?? "").trim();
  if (query.length < 2) throw badRequest("Provide at least two characters to search for a location");

  const places = await nearbyPlaces(query, Math.min(10, Number(ctx.query.limit ?? 8)));

  return ok({
    query,
    places: places.map((place) => ({
      name: place.name,
      countryCode: place.country_code,
      adminArea: place.admin_area,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
      population: place.population,
    })),
    found: places.length,
    note: places.length === 0 ? "No matching location is in the Zybble table yet — try a nearby larger city or contact support to add it." : undefined,
  });
});
