/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Coordinate conversion helpers (São Paulo bounding box)
export const convertToGeoLat = (svgLatPercent: number) => -23.52 - (svgLatPercent / 100) * 0.12;
export const convertToGeoLng = (svgLngPercent: number) => -46.72 + (svgLngPercent / 100) * 0.18;

// Destinatary Region Coordinate mapping to real lat/lng in São Paulo
export const getRegionGeoCoords = (region: string) => {
  const r = region ? region.trim() : 'Centro';
  if (r === 'Centro') return { lat: -23.5489, lng: -46.6338 }; // Sé / Centro SP
  if (r === 'Zona Sul' || r.includes('Sul')) return { lat: -23.5960, lng: -46.6850 }; // Moema / Itaim Bibi
  if (r === 'Zona Oeste' || r.includes('Oeste')) return { lat: -23.5555, lng: -46.6900 }; // Pinheiros / Vila Madalena
  if (r === 'Zona Norte' || r.includes('Norte')) return { lat: -23.5042, lng: -46.6231 }; // Santana
  if (r === 'Zona Leste' || r.includes('Leste')) return { lat: -23.5510, lng: -46.5450 }; // Tatuapé
  
  return { lat: -23.5489, lng: -46.6338 };
};

export function getActiveHubCoords(): { lat: number; lng: number } {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('vinimap_active_hub');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && !isNaN(parsed.lat) && !isNaN(parsed.lng) && parsed.lat < -10) {
          // If old stale hub coordinates are saved, auto-sanitize to true Rua Cerro Corá 385 coordinates (-23.5385556, -46.7011800)
          if (Math.abs(parsed.lat - (-23.541023)) < 0.01 || Math.abs(parsed.lat - (-23.54388)) < 0.01) {
            return { lat: -23.5385556, lng: -46.70118 };
          }
          return { lat: parsed.lat, lng: parsed.lng };
        }
      }
    }
  } catch (e) {
    console.warn("Error reading active hub from localStorage:", e);
  }
  // Rua Cerro Corá, 385, CEP 05061-050, Vila Romana, São Paulo - SP
  return { lat: -23.5385556, lng: -46.70118 };
}

/**
 * Gets high-precision deterministic coordinates based on the order's CEP (postal code),
 * address, or explicit lat/lng, falling back to region coordinates.
 */
// In-memory cache for geocoded addresses/CEPs
const geocodeCache: Record<string, { lat: number; lng: number }> = {};

export function getCoordinatesFromCep(
  cep: string | undefined, 
  region?: string,
  address?: string,
  lat?: number,
  lng?: number
): { lat: number; lng: number } {
  // If valid explicit coordinates are already provided, return them
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat < -10) {
    return { lat, lng };
  }

  const clean = (cep || '').replace(/\D/g, '');
  const cacheKey = `${clean}_${(address || '').trim().toLowerCase()}`;

  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }

  if (clean.length < 5) {
    return getRegionGeoCoords(region || 'Centro');
  }

  // Check specific high-priority addresses first (e.g., Rua Cerro Corá 385 / Hub)
  const normAddr = (address || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if ((normAddr.includes("cerro cora") || normAddr.includes("cero cora")) && (normAddr.includes("385") || normAddr.includes("hub") || normAddr.includes("sede")) || clean === "05061050") {
    return getActiveHubCoords();
  }

  // Sector base coordinates for SP & Greater SP CEP sectors
  let baseLat = -23.55052; // Praça da Sé (default)
  let baseLng = -46.633308;

  const prefix5 = parseInt(clean.substring(0, 5)) || 0;
  const prefix2 = clean.substring(0, 2);

  if (clean.startsWith('010') || clean.startsWith('011')) { // Sé, República, Centro
    baseLat = -23.5489; baseLng = -46.6338;
  } else if (clean.startsWith('012')) { // Santa Cecília, Higienópolis
    baseLat = -23.5392; baseLng = -46.6521;
  } else if (clean.startsWith('013')) { // Bela Vista, Consolação, Paulista
    baseLat = -23.5615; baseLng = -46.6560;
  } else if (clean.startsWith('014')) { // Jardins, Cerqueira César
    baseLat = -23.5682; baseLng = -46.6661;
  } else if (clean.startsWith('015')) { // Liberdade, Cambuci, Aclimação
    baseLat = -23.5620; baseLng = -46.6290;
  } else if (prefix5 >= 2000 && prefix5 <= 2199) { // Santana, Carandiru
    baseLat = -23.5042; baseLng = -46.6231;
  } else if (prefix5 >= 2200 && prefix5 <= 2499) { // Tucuruvi, Mandaqui, Tremembé
    baseLat = -23.4750; baseLng = -46.6120;
  } else if (prefix5 >= 2500 && prefix5 <= 2999) { // Casa Verde, Freguesia do Ó, Jaraguá
    baseLat = -23.4980; baseLng = -46.6850;
  } else if (prefix5 >= 3000 && prefix5 <= 3199) { // Brás, Mooca, Pari
    baseLat = -23.5450; baseLng = -46.6020;
  } else if (prefix5 >= 3200 && prefix5 <= 3599) { // Tatuapé, Vila Formosa, Carrão
    baseLat = -23.5510; baseLng = -46.5450;
  } else if (prefix5 >= 3600 && prefix5 <= 3999) { // Penha, Aricanduva
    baseLat = -23.5320; baseLng = -46.5050;
  } else if (prefix5 >= 4000 && prefix5 <= 4199) { // Vila Mariana, Saúde
    baseLat = -23.5890; baseLng = -46.6360;
  } else if (prefix5 >= 4200 && prefix5 <= 4499) { // Ipiranga, Sacomã, Jabaquara
    baseLat = -23.6120; baseLng = -46.6110;
  } else if (prefix5 >= 4500 && prefix5 <= 4699) { // Itaim Bibi, Vila Olímpia, Moema
    baseLat = -23.5960; baseLng = -46.6850;
  } else if (prefix5 >= 4700 && prefix5 <= 4999) { // Santo Amaro, Granja Julieta, Interlagos
    baseLat = -23.6520; baseLng = -46.7020;
  } else if (prefix5 >= 5000 && prefix5 <= 5099) { // Perdizes, Barra Funda, Lapa
    baseLat = -23.5290; baseLng = -46.6710;
  } else if (prefix5 >= 5100 && prefix5 <= 5299) { // Pirituba, Jaguara
    baseLat = -23.4820; baseLng = -46.7410;
  } else if (prefix5 >= 5300 && prefix5 <= 5599) { // Jaguaré, Butantã, Pinheiros
    baseLat = -23.5610; baseLng = -46.7310;
  } else if (prefix5 >= 5600 && prefix5 <= 5899) { // Morumbi, Campo Limpo, Capão Redondo
    baseLat = -23.6150; baseLng = -46.7350;
  } else if (prefix2 === '06') { // Osasco, Barueri, Alphaville
    baseLat = -23.5120; baseLng = -46.8120;
  } else if (prefix2 === '07') { // Guarulhos
    baseLat = -23.4540; baseLng = -46.5330;
  } else if (prefix2 === '08') { // Itaquera, Guaianases, São Miguel
    baseLat = -23.5410; baseLng = -46.4520;
  } else if (prefix2 === '09') { // ABC Paulista (Santo André, São Bernardo, São Caetano)
    baseLat = -23.6620; baseLng = -46.5320;
  } else if (prefix2 === '11' || prefix2 === '12' || prefix2 === '13' || prefix2 === '19') { // Interior / Litoral SP
    baseLat = -23.9608; baseLng = -46.3339;
  } else if (prefix2 === '20' || prefix2 === '21' || prefix2 === '22' || prefix2 === '23' || prefix2 === '24') { // Rio de Janeiro
    baseLat = -22.9068; baseLng = -43.1729;
  } else if (prefix2 === '30' || prefix2 === '31' || prefix2 === '32' || prefix2 === '33') { // Minas Gerais (BH)
    baseLat = -19.9167; baseLng = -43.9345;
  } else if (prefix2 === '40' || prefix2 === '41' || prefix2 === '42') { // Bahia (Salvador)
    baseLat = -12.9777; baseLng = -38.5016;
  } else if (prefix2 === '70' || prefix2 === '71' || prefix2 === '72') { // Brasília DF
    baseLat = -15.7975; baseLng = -47.8919;
  } else if (prefix2 === '80' || prefix2 === '81' || prefix2 === '82') { // Paraná (Curitiba)
    baseLat = -25.4284; baseLng = -49.2733;
  } else if (prefix2 === '90' || prefix2 === '91' || prefix2 === '92') { // RS (Porto Alegre)
    baseLat = -30.0346; baseLng = -51.2177;
  } else {
    const regCoords = getRegionGeoCoords(region || 'Centro');
    baseLat = regCoords.lat;
    baseLng = regCoords.lng;
  }

  // Generate a deterministic hash based on clean CEP + address length for unique micro-dispersion
  let hash = 0;
  const combineStr = `${clean}_${address || ''}`;
  for (let i = 0; i < combineStr.length; i++) {
    hash = combineStr.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Fine street-level precision offset (~100m to 200m)
  const offsetLat = ((Math.abs(hash) % 100) / 100) * 0.003 - 0.0015;
  const offsetLng = (((Math.abs(hash) >> 8) % 100) / 100) * 0.003 - 0.0015;

  const result = {
    lat: baseLat + offsetLat,
    lng: baseLng + offsetLng
  };

  geocodeCache[cacheKey] = result;
  return result;
}

export interface CepGeocodeFullResult {
  cep: string;
  formattedCep: string;
  address: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  region: string;
  lat: number;
  lng: number;
  isExactGeocode: boolean;
}

/**
 * Full CEP lookup & geocoding helper that queries ViaCEP for address info
 * and OpenStreetMap Nominatim for exact latitude/longitude coordinates.
 */
export async function fetchAddressAndGeocodeByCep(
  cepInput: string,
  extraAddressInfo?: string
): Promise<CepGeocodeFullResult> {
  const cleanCep = cepInput.replace(/\D/g, '');
  if (cleanCep.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos numéricos.');
  }

  const formattedCep = `${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`;

  // 1. Query ViaCEP API for address details
  let logradouro = '';
  let bairro = '';
  let localidade = 'São Paulo';
  let uf = 'SP';

  try {
    const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (viaCepRes.ok) {
      const data = await viaCepRes.json();
      if (!data.erro) {
        logradouro = data.logradouro || '';
        bairro = data.bairro || '';
        localidade = data.localidade || 'São Paulo';
        uf = data.uf || 'SP';
      }
    }
  } catch (err) {
    console.warn('[fetchAddressAndGeocodeByCep] ViaCEP query error:', err);
  }

  // Construct readable street address
  let constructedAddress = '';
  if (logradouro) {
    constructedAddress = logradouro;
    if (extraAddressInfo) constructedAddress += `, ${extraAddressInfo}`;
    if (bairro) constructedAddress += ` - ${bairro}`;
    constructedAddress += `, ${localidade} - ${uf}`;
  } else {
    constructedAddress = extraAddressInfo ? `${extraAddressInfo}, ${localidade} - ${uf}` : `${localidade} - ${uf}`;
  }

  // Determine Region in SP
  let region = 'Centro';
  if (localidade.toLowerCase() === 'são paulo') {
    const prefix = parseInt(cleanCep.substring(0, 5)) || 0;
    if (prefix >= 4000 && prefix <= 4999) region = 'Zona Sul';
    else if (prefix >= 5000 && prefix <= 5999) region = 'Zona Oeste';
    else if (prefix >= 2000 && prefix <= 2999) region = 'Zona Norte';
    else if (prefix >= 3000 && prefix <= 3999) region = 'Zona Leste';
    else region = 'Centro';
  }

  // 2. Geocode to obtain exact Lat/Lng
  let lat = -23.55052;
  let lng = -46.633308;
  let isExactGeocode = false;

  const queriesToTry = [];
  if (logradouro && localidade) {
    queriesToTry.push(`${logradouro}, ${bairro ? bairro + ', ' : ''}${localidade}, ${uf}, Brasil`);
  }
  queriesToTry.push(`CEP ${formattedCep}, Brasil`);

  for (const q of queriesToTry) {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0 && geoData[0].lat && geoData[0].lon) {
          const parsedLat = parseFloat(geoData[0].lat);
          const parsedLng = parseFloat(geoData[0].lon);
          if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat < -10) {
            lat = parsedLat;
            lng = parsedLng;
            isExactGeocode = true;
            break;
          }
        }
      }
    } catch (e) {
      console.warn(`[fetchAddressAndGeocodeByCep] Geocoding query failed for "${q}":`, e);
    }
  }

  // Fallback if geocoding API yielded no exact match
  if (!isExactGeocode) {
    const fallback = getCoordinatesFromCep(cleanCep, region, constructedAddress);
    lat = fallback.lat;
    lng = fallback.lng;
  }

  return {
    cep: cleanCep,
    formattedCep,
    address: constructedAddress,
    logradouro,
    bairro,
    localidade,
    uf,
    region,
    lat,
    lng,
    isExactGeocode
  };
}

/**
 * Backend geocoding API caller that resolves address and CEP using backend API service
 */
export async function geocodeAddressBackend(
  address: string,
  cep?: string,
  region?: string
): Promise<{ lat: number; lng: number; formattedAddress?: string; isExactGeocode?: boolean }> {
  const clean = (cep || '').replace(/\D/g, '');
  const cacheKey = `backend_${clean}_${(address || '').trim().toLowerCase()}_${(region || '').toLowerCase()}`;

  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey] as any;
  }

  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, cep: clean, region })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && typeof data.lat === 'number' && typeof data.lng === 'number') {
        const result = {
          lat: data.lat,
          lng: data.lng,
          formattedAddress: data.formattedAddress,
          isExactGeocode: !!data.isExactGeocode
        };
        geocodeCache[cacheKey] = result;
        return result;
      }
    }
  } catch (e) {
    console.warn('[geocodeAddressBackend] Backend call failed, falling back to client geocode:', e);
  }

  // Fallback to local client geocode
  const fallback = getCoordinatesFromCep(cep || '01310-100', region || 'Centro', address);
  geocodeCache[cacheKey] = fallback;
  return fallback;
}

/**
 * Async geocoding helper that calls backend API for exact address/CEP lookup.
 */
export async function geocodeCepAddress(
  cep: string,
  address?: string,
  region?: string
): Promise<{ lat: number; lng: number }> {
  const clean = cep.replace(/\D/g, '');
  const cacheKey = `async_${clean}_${(address || '').trim().toLowerCase()}`;

  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }

  // Quick check for Hub / Rua Cerro Corá 385
  const normAddr = (address || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if ((normAddr.includes("cerro cora") || normAddr.includes("cero cora")) && (normAddr.includes("385") || normAddr.includes("hub") || normAddr.includes("sede")) || clean === "05061050") {
    const hubCoords = getActiveHubCoords();
    geocodeCache[cacheKey] = hubCoords;
    return hubCoords;
  }

  const backendRes = await geocodeAddressBackend(address || '', cep, region);
  const result = { lat: backendRes.lat, lng: backendRes.lng };
  geocodeCache[cacheKey] = result;
  return result;
}

export function getRiderGeoCoords(
  rider: { name?: string; phone?: string; lat: number; lng: number; realGeoLat?: number; realGeoLng?: number; isGpsRealActive?: boolean }, 
  hubCoords?: { lat: number; lng: number }
): [number, number] {
  if (rider.isGpsRealActive && rider.realGeoLat !== undefined && rider.realGeoLng !== undefined) {
    return [rider.realGeoLat, rider.realGeoLng];
  }
  if (rider.realGeoLat !== undefined && rider.realGeoLng !== undefined && rider.realGeoLat < -10) {
    return [rider.realGeoLat, rider.realGeoLng];
  }
  // If the coordinate is already a valid geographical coordinate (not percentage 0-100)
  if (rider.lat < -10) {
    return [rider.lat, rider.lng];
  }

  return [convertToGeoLat(rider.lat), convertToGeoLng(rider.lng)];
}

export const generateStaticSvgMap = (lat: number, lng: number, address: string) => {
  const safeLat = typeof lat === 'number' && !isNaN(lat) ? lat : -23.55052;
  const safeLng = typeof lng === 'number' && !isNaN(lng) ? lng : -46.633308;
  const safeAddr = (address || 'São Paulo, SP').replace(/[&<>'"]/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <!-- Map Grid Background -->
    <rect width="300" height="300" fill="#f1f5f9"/>
    
    <!-- Stylized Grid Lines representing blocks -->
    <g stroke="#cbd5e1" stroke-width="2.5">
      <line x1="0" y1="40" x2="300" y2="40"/>
      <line x1="0" y1="110" x2="300" y2="110"/>
      <line x1="0" y1="180" x2="300" y2="180"/>
      <line x1="0" y1="250" x2="300" y2="250"/>
      
      <line x1="60" y1="0" x2="60" y2="300"/>
      <line x1="140" y1="0" x2="140" y2="300"/>
      <line x1="220" y1="0" x2="220" y2="300"/>
    </g>

    <!-- Secondary detailed street routes -->
    <g stroke="#e2e8f0" stroke-width="1.2">
      <line x1="0" y1="75" x2="300" y2="75"/>
      <line x1="0" y1="145" x2="300" y2="145"/>
      <line x1="0" y1="215" x2="300" y2="215"/>
      
      <line x1="100" y1="0" x2="100" y2="300"/>
      <line x1="180" y1="0" x2="180" y2="300"/>
      <line x1="260" y1="0" x2="260" y2="300"/>
    </g>

    <!-- Water Canal or Green Belt feature to simulate real terrain -->
    <path d="M -10,145 C 50,155 100,120 180,135 C 240,145 280,110 310,125" fill="none" stroke="#93c5fd" stroke-width="12" opacity="0.75"/>
    <path d="M -10,145 C 50,155 100,120 180,135 C 240,145 280,110 310,125" fill="none" stroke="#60a5fa" stroke-width="4" opacity="0.9"/>
    
    <!-- Park Area -->
    <rect x="15" y="15" width="35" height="45" rx="4" fill="#dcfce7" stroke="#bbf7d0" stroke-width="1" opacity="0.8"/>
    <text x="32" y="42" font-family="system-ui, sans-serif" font-size="6" font-weight="extrabold" fill="#166534" text-anchor="middle">PARQUE</text>

    <!-- Navigation Compass / GPS Data Overlay -->
    <rect x="10" y="235" width="125" height="55" rx="8" fill="#1e293b" opacity="0.92" stroke="#475569" stroke-width="0.5"/>
    <text x="20" y="248" font-family="monospace" font-size="7" font-weight="bold" fill="#38bdf8">AUTO-REGISTRO GPS</text>
    <text x="20" y="259" font-family="monospace" font-size="6.5" fill="#94a3b8">LAT: ${safeLat.toFixed(6)}</text>
    <text x="20" y="269" font-family="monospace" font-size="6.5" fill="#94a3b8">LNG: ${safeLng.toFixed(6)}</text>
    <text x="20" y="279" font-family="monospace" font-size="6" font-weight="bold" fill="#10b981">CONFORMIDADE ✓</text>

    <!-- Target Pin Location Marker -->
    <g transform="translate(140, 110)">
      <!-- Radar Pulse Ring -->
      <circle r="18" fill="#ef4444" opacity="0.25"/>
      <circle r="8" fill="#ef4444" opacity="0.4"/>
      
      <!-- High Contrast Pin Marker -->
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#dc2626" transform="translate(-12, -22)"/>
      <circle cx="0" cy="-13" r="3.5" fill="#ffffff"/>
    </g>

    <!-- Address Tag Banner -->
    <g transform="translate(140, 75)">
      <rect x="-65" y="-10" width="130" height="15" rx="3" fill="#ffffff" stroke="#ef4444" stroke-width="1" />
      <text x="0" y="0" font-family="system-ui, sans-serif" font-size="6.5" font-weight="bold" fill="#0f172a" text-anchor="middle">COORDENADA DE ENTREGA</text>
    </g>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

export function calculateHaversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GreaterSpValidationResult {
  isValidInGsp: boolean;
  distanceFromSpCenterKm: number;
  warningMessage?: string;
}

export function validateGreaterSpCoordinates(lat: number, lng: number): GreaterSpValidationResult {
  // Center of São Paulo Metropolitan Area (Praça da Sé)
  const CENTER_LAT = -23.55052;
  const CENTER_LNG = -46.633308;
  const distanceKm = calculateHaversineDistanceKm(lat, lng, CENTER_LAT, CENTER_LNG);

  // Bounding Box for Região Metropolitana de São Paulo (RMSP)
  const isWithinBoundingBox = (lat >= -24.20 && lat <= -23.10) && (lng >= -47.30 && lng <= -45.60);
  const isWithinRadius = distanceKm <= 65; // Within 65km from SP Center

  const isValidInGsp = isWithinBoundingBox && isWithinRadius;

  if (!isValidInGsp) {
    return {
      isValidInGsp: false,
      distanceFromSpCenterKm: Math.round(distanceKm * 10) / 10,
      warningMessage: `Aviso: As coordenadas inseridas (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}) estão localizadas a ${distanceKm.toFixed(1)} km do centro da Grande São Paulo, fora dos limites normais da RMSP.`
    };
  }

  return {
    isValidInGsp: true,
    distanceFromSpCenterKm: Math.round(distanceKm * 10) / 10
  };
}

export interface ReverseGeocodeResult {
  address: string;
  road: string;
  houseNumber: string;
  cep: string;
  neighborhood: string;
  city: string;
  state: string;
  displayName: string;
}

const reverseCache: Record<string, ReverseGeocodeResult> = {};

export async function reverseGeocodeCoords(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const roundedLat = lat.toFixed(6);
  const roundedLng = lng.toFixed(6);
  const cacheKey = `${roundedLat}_${roundedLng}`;

  if (reverseCache[cacheKey]) {
    return reverseCache[cacheKey];
  }

  // Exact match or close proximity to official Vinimap Hub (Rua Cerro Corá, 385, Vila Romana, CEP 05061-050)
  if ((Math.abs(lat - (-23.5385556)) < 0.005 || Math.abs(lat - (-23.541023)) < 0.005 || Math.abs(lat - (-23.54388)) < 0.005) && (Math.abs(lng - (-46.70118)) < 0.005 || Math.abs(lng - (-46.700709)) < 0.005)) {
    const hubResult: ReverseGeocodeResult = {
      address: "Rua Cerro Corá, 385",
      road: "Rua Cerro Corá",
      houseNumber: "385",
      cep: "05061-050",
      neighborhood: "Vila Romana",
      city: "São Paulo",
      state: "SP",
      displayName: "Rua Cerro Corá, 385, Vila Romana, São Paulo - SP, CEP 05061-050"
    };
    reverseCache[cacheKey] = hubResult;
    return hubResult;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.street || addr.suburb || 'Rua sem nome';
        const houseNumber = addr.house_number || '';
        const rawCep = addr.postcode || '';
        const cleanCep = rawCep.replace(/\D/g, '');
        const formattedCep = cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : rawCep;
        const neighborhood = addr.neighbourhood || addr.suburb || addr.city_district || '';
        const city = addr.city || addr.town || addr.municipality || 'São Paulo';
        const state = addr.state_code || addr.state || 'SP';

        const fullStreet = houseNumber ? `${road}, ${houseNumber}` : road;
        const displayName = data.display_name || `${fullStreet}, ${neighborhood}, ${city} - ${state}`;

        const result: ReverseGeocodeResult = {
          address: fullStreet,
          road,
          houseNumber,
          cep: formattedCep,
          neighborhood,
          city,
          state,
          displayName
        };

        reverseCache[cacheKey] = result;
        return result;
      }
    }
  } catch (e) {
    console.warn('[reverseGeocodeCoords] Nominatim reverse geocode error:', e);
  }

  return null;
}

/**
 * Calculates straight-line distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function getHaversineDistance(
  lat1OrCoords1: number | [number, number],
  lon1OrCoords2: number | [number, number],
  lat2?: number,
  lon2?: number
): number {
  let lat1: number, lon1: number, p2Lat: number, p2Lon: number;

  if (Array.isArray(lat1OrCoords1) && Array.isArray(lon1OrCoords2)) {
    lat1 = lat1OrCoords1[0];
    lon1 = lat1OrCoords1[1];
    p2Lat = lon1OrCoords2[0];
    p2Lon = lon1OrCoords2[1];
  } else {
    lat1 = Number(lat1OrCoords1);
    lon1 = Number(lon1OrCoords2);
    p2Lat = Number(lat2);
    p2Lon = Number(lon2);
  }

  if (isNaN(lat1) || isNaN(lon1) || isNaN(p2Lat) || isNaN(p2Lon)) return 0;

  const R = 6371; // Earth's radius in km
  const dLat = ((p2Lat - lat1) * Math.PI) / 180;
  const dLon = ((p2Lon - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((p2Lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export { searchCepByAddress, fetchAddressSuggestions, formatCepString, getRegionFromCepOrBairro } from './addressLookupService';
export type { AddressLookupResult, AddressSuggestionItem } from './addressLookupService';


