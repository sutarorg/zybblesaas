import { admin, query } from "./supabase";
import { badRequest, notFound } from "./errors";

/**
 * Location resolution.
 *
 * Zybble deliberately does **not** depend on the Google Maps Places or
 * Geocoding APIs. Locations come from the maintained `geo_places` table
 * (city centroids, seeded by migration 0010 and editable by operators), and
 * every derived coordinate is real arithmetic over that data — never invented.
 */

export type GeoPlace = {
  id: string;
  name: string;
  name_norm: string;
  country_code: string;
  admin_area: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  population: number | null;
};

export async function findPlace(input: string): Promise<GeoPlace> {
  const term = input.trim();
  if (term.length < 2) throw badRequest("A city or location is required");

  const normalized = term.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const exact = await query<GeoPlace[]>(
    admin().from("geo_places").select("*").eq("name_norm", normalized).order("population", { ascending: false }).limit(1),
    "geo lookup",
  );
  if (exact[0]) return exact[0];

  const fuzzy = await query<GeoPlace[]>(
    admin()
      .from("geo_places")
      .select("*")
      .ilike("name", `${term}%`)
      .order("population", { ascending: false })
      .limit(1),
    "geo lookup",
  );
  if (fuzzy[0]) return fuzzy[0];

  throw notFound(
    `We do not have coordinates for “${term}”. Pick a city from the supported list or provide a latitude/longitude pair.`,
  );
}

export async function nearbyPlaces(input: string, limit = 8): Promise<GeoPlace[]> {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return [];
  return query<GeoPlace[]>(
    admin()
      .from("geo_places")
      .select("*")
      .or(`name_norm.ilike.%${normalized}%,admin_area.ilike.%${normalized}%,country_code.ilike.${normalized}%`)
      .order("population", { ascending: false })
      .limit(limit),
    "geo search",
  );
}

const KM_PER_DEGREE_LAT = 110.574;

function kmPerDegreeLon(latitude: number): number {
  return Math.max(1, 111.32 * Math.cos((latitude * Math.PI) / 180));
}

export type GridCell = { label: string; lat: number; lon: number };

/**
 * Splits a circle around `center` into a square grid of cells covering the
 * requested radius. Deterministic: the same search always produces the same
 * cells, which is what makes retries and resume safe.
 */
export function gridCells(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  cellSizeKm: number,
  maxCells = 144,
): GridCell[] {
  if (radiusKm <= 0) return [{ label: "center", lat: center.latitude, lon: center.longitude }];

  const spanKm = radiusKm * 2;
  const divisions = Math.max(1, Math.ceil(spanKm / Math.max(0.2, cellSizeKm)));
  const stepKm = spanKm / divisions;
  const latStep = stepKm / KM_PER_DEGREE_LAT;
  const lonStep = stepKm / kmPerDegreeLon(center.latitude);

  const startLat = center.latitude - (stepKm * (divisions - 1)) / 2 / KM_PER_DEGREE_LAT;
  const startLon = center.longitude - (stepKm * (divisions - 1)) / 2 / kmPerDegreeLon(center.latitude);

  const cells: GridCell[] = [];
  for (let row = 0; row < divisions; row++) {
    for (let col = 0; col < divisions; col++) {
      if (cells.length >= maxCells) return cells;
      cells.push({
        label: `r${row + 1}c${col + 1}`,
        lat: Number((startLat + row * latStep).toFixed(6)),
        lon: Number((startLon + col * lonStep).toFixed(6)),
      });
    }
  }
  return cells;
}

/** Zoom that matches the requested radius (Gosom needs an explicit zoom level). */
export function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 1) return 16;
  if (radiusKm <= 3) return 15;
  if (radiusKm <= 8) return 14;
  if (radiusKm <= 20) return 13;
  if (radiusKm <= 50) return 12;
  if (radiusKm <= 120) return 11;
  return 10;
}

export async function geoPlaceCount(): Promise<number> {
  const { count, error } = await admin().from("geo_places").select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}
