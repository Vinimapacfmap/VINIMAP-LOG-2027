/**
 * OSRM (Open Source Routing Machine) Integration Service
 * Calculates real driving routes, distances (km), travel times (minutes), and ETAs via OpenStreetMap.
 */

export interface OsrmRouteResult {
  distanceKm: number;
  durationMinutes: number;
  etaText: string;
  etaClockTime: string;
  geometry: [number, number][]; // [lat, lng] points for Leaflet polyline
  success: boolean;
}

// Memory cache to prevent duplicate OSRM API calls for identical coordinate pairs
const osrmCache = new Map<string, OsrmRouteResult>();

/**
 * Fetch real driving route and ETA between coordinates using OSRM OpenStreetMap API
 */
export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<OsrmRouteResult> {
  if (!origin || !destination || isNaN(origin.lat) || isNaN(destination.lat)) {
    return createFallbackRoute(origin, destination);
  }

  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  if (osrmCache.has(cacheKey)) {
    return osrmCache.get(cacheKey)!;
  }

  try {
    // OSRM expects coordinates in format: longitude,latitude
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 sec timeout

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
      const geometry: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
      );

      const result: OsrmRouteResult = {
        distanceKm,
        durationMinutes,
        etaText,
        etaClockTime,
        geometry,
        success: true
      };

      osrmCache.set(cacheKey, result);
      return result;
    }

    return createFallbackRoute(origin, destination);
  } catch (err) {
    console.warn('[OSRM Route Service] Fallback to direct calculation:', err);
    return createFallbackRoute(origin, destination);
  }
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
