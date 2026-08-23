/**
 * OSRM (Open Source Routing Machine) Integration Service
 * Calculates real driving routes, distances (km), travel times (minutes), and ETAs via OpenStreetMap.
 * Fetches turn-by-turn street geometries for exact road paths in São Paulo and Brazil.
 */

export interface OsrmRouteResult {
  distanceKm: number;
  durationMinutes: number;
  etaText: string;
  etaClockTime: string;
  geometry: [number, number][]; // [lat, lng] points for Leaflet polyline
  success: boolean;
}

export interface OsrmMultiStopResult {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  fullGeometry: [number, number][];
  legs: Array<{
    distanceKm: number;
    durationMinutes: number;
    geometry: [number, number][];
  }>;
  success: boolean;
}

// In-memory cache to prevent duplicate OSRM API calls for identical coordinate pairs
const osrmCache = new Map<string, OsrmRouteResult>();
const osrmMultiCache = new Map<string, OsrmMultiStopResult>();

// Preload common cached routes from localStorage if available
try {
  const savedCache = localStorage.getItem('vinimap_osrm_cache_v2');
  if (savedCache) {
    const parsed = JSON.parse(savedCache);
    Object.entries(parsed).forEach(([k, v]) => {
      osrmCache.set(k, v as OsrmRouteResult);
    });
  }
} catch (e) {
  // Ignore local storage error
}

function persistCache() {
  try {
    const obj: Record<string, OsrmRouteResult> = {};
    let count = 0;
    // Save up to 200 most recent items to avoid quota issues
    for (const [k, v] of osrmCache.entries()) {
      if (count++ > 200) break;
      obj[k] = v;
    }
    localStorage.setItem('vinimap_osrm_cache_v2', JSON.stringify(obj));
  } catch (e) {
    // Ignore storage quota
  }
}

/**
 * Synchronously retrieves cached route if present
 */
export function getCachedOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): OsrmRouteResult | null {
  if (!origin || !destination || isNaN(origin.lat) || isNaN(destination.lat)) return null;
  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  return osrmCache.get(cacheKey) || null;
}

/**
 * Fetch real driving route and ETA between coordinates using OSRM OpenStreetMap API
 */
export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<OsrmRouteResult> {
  if (!origin || !destination || isNaN(origin.lat) || isNaN(destination.lat) || isNaN(origin.lng) || isNaN(destination.lng)) {
    return createFallbackRoute(origin, destination);
  }

  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  if (osrmCache.has(cacheKey)) {
    return osrmCache.get(cacheKey)!;
  }

  try {
    // OSRM expects coordinates in format: longitude,latitude
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng.toFixed(6)},${origin.lat.toFixed(6)};${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5 sec timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10; // km rounded to 1 decimal
      const durationMinutes = Math.max(1, Math.round(route.duration / 60)); // minutes

      // Calculate estimated arrival clock time
      const now = new Date();
      now.setMinutes(now.getMinutes() + durationMinutes);
      const etaClockTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const etaText = `${etaClockTime} (~${durationMinutes} min • ${distanceKm} km)`;

      // Convert OSRM GeoJSON geometry [lng, lat] to Leaflet [lat, lng]
      const geometry: [number, number][] = (route.geometry?.coordinates || []).map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
      );

      const result: OsrmRouteResult = {
        distanceKm,
        durationMinutes,
        etaText,
        etaClockTime,
        geometry: geometry.length > 0 ? geometry : [[origin.lat, origin.lng], [destination.lat, destination.lng]],
        success: true
      };

      osrmCache.set(cacheKey, result);
      persistCache();
      return result;
    }

    return createFallbackRoute(origin, destination);
  } catch (err) {
    console.warn('[OSRM Route Service] Fallback to direct calculation:', err);
    return createFallbackRoute(origin, destination);
  }
}

/**
 * Fetch a multi-stop real driving route across a sequence of stops [Hub, Stop1, Stop2, ...]
 */
export async function fetchOsrmMultiStopRoute(
  points: Array<{ lat: number; lng: number }>
): Promise<OsrmMultiStopResult> {
  if (!points || points.length < 2) {
    return {
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      fullGeometry: points.map(p => [p.lat, p.lng]),
      legs: [],
      success: false
    };
  }

  const cacheKey = points.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';');
  if (osrmMultiCache.has(cacheKey)) {
    return osrmMultiCache.get(cacheKey)!;
  }

  try {
    const coordsParam = points.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM Multi HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const totalDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const totalDurationMinutes = Math.max(1, Math.round(route.duration / 60));

      const fullGeometry: [number, number][] = (route.geometry?.coordinates || []).map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
      );

      const legs = (route.legs || []).map((leg: any, idx: number) => {
        const legDist = Math.round((leg.distance / 1000) * 10) / 10;
        const legDur = Math.max(1, Math.round(leg.duration / 60));
        
        // Approximate leg geometry slice if steps not present
        const p1 = points[idx];
        const p2 = points[idx + 1];
        return {
          distanceKm: legDist,
          durationMinutes: legDur,
          geometry: [[p1.lat, p1.lng], [p2.lat, p2.lng]] as [number, number][]
        };
      });

      const result: OsrmMultiStopResult = {
        totalDistanceKm,
        totalDurationMinutes,
        fullGeometry: fullGeometry.length > 0 ? fullGeometry : points.map(p => [p.lat, p.lng]),
        legs,
        success: true
      };

      osrmMultiCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('[OSRM MultiStop Service] Fallback to segment-by-segment calculation:', err);
  }

  // Fallback: Calculate segment by segment
  const legs: Array<{ distanceKm: number; durationMinutes: number; geometry: [number, number][] }> = [];
  const fullGeometry: [number, number][] = [];
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const seg = await fetchOsrmRoute(points[i], points[i + 1]);
    totalDistanceKm += seg.distanceKm;
    totalDurationMinutes += seg.durationMinutes;
    legs.push({
      distanceKm: seg.distanceKm,
      durationMinutes: seg.durationMinutes,
      geometry: seg.geometry
    });
    if (i === 0) {
      fullGeometry.push(...seg.geometry);
    } else {
      fullGeometry.push(...seg.geometry.slice(1));
    }
  }

  return {
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMinutes,
    fullGeometry,
    legs,
    success: true
  };
}

/**
 * Fallback route calculation using Haversine formula + estimated driving speed (25 km/h urban SP)
 */
function createFallbackRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): OsrmRouteResult {
  const R = 6371; // Earth radius in km
  const dLat = (destination.lat - origin.lat) * (Math.PI / 180);
  const dLng = (destination.lng - origin.lng) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin.lat * (Math.PI / 180)) *
      Math.cos(destination.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directDist = R * c;
  const distanceKm = Math.round(directDist * 1.35 * 10) / 10; // multiply by 1.35 for street winding factor

  // Urban driving speed ~22 km/h
  const durationMinutes = Math.max(2, Math.round((distanceKm / 22) * 60));

  const now = new Date();
  now.setMinutes(now.getMinutes() + durationMinutes);
  const etaClockTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const etaText = `${etaClockTime} (~${durationMinutes} min • ${distanceKm} km)`;

  // Straight line geometry
  const geometry: [number, number][] = [
    [origin.lat, origin.lng],
    [destination.lat, destination.lng]
  ];

  return {
    distanceKm,
    durationMinutes,
    etaText,
    etaClockTime,
    geometry,
    success: false
  };
}

