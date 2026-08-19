/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AddressLookupResult {
  cep: string;
  cleanCep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  region: string;
  formattedAddress: string;
  lat?: number;
  lng?: number;
  source: 'viacep' | 'nominatim' | 'direct_cep';
}

export interface AddressSuggestionItem {
  id: string;
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  displayName: string;
  region: string;
  lat?: number;
  lng?: number;
}

// In-memory cache for address -> CEP lookups
const addressCepCache = new Map<string, AddressLookupResult>();
const suggestionsCache = new Map<string, AddressSuggestionItem[]>();

/**
 * Determine São Paulo region (Zona Norte, Sul, Leste, Oeste, Centro)
 * based on CEP prefix or neighborhood name
 */
export function getRegionFromCepOrBairro(cleanCep: string, bairro?: string, localidade = 'São Paulo'): string {
  if (localidade && localidade.toLowerCase() !== 'são paulo' && localidade.toLowerCase() !== 'sp') {
    return 'Outros';
  }

  const prefix = parseInt(cleanCep.substring(0, 5), 10) || 0;
  if (prefix >= 4000 && prefix <= 4999) return 'Zona Sul';
  if (prefix >= 5000 && prefix <= 5999) return 'Zona Oeste';
  if (prefix >= 2000 && prefix <= 2999) return 'Zona Norte';
  if (prefix >= 3000 && prefix <= 3999) return 'Zona Leste';
  if (prefix >= 1000 && prefix <= 1999) return 'Centro';

  // Fallback by neighborhood name
  if (bairro) {
    const b = bairro.toLowerCase();
    if (b.includes('pinheiros') || b.includes('lapa') || b.includes('butantã') || b.includes('perdizes') || b.includes('vila leopoldina') || b.includes('jaguaré') || b.includes('vila madalena') || b.includes('romana') || b.includes('morumbi')) {
      return 'Zona Oeste';
    }
    if (b.includes('moema') || b.includes('itaim') || b.includes('vila mariana') || b.includes('santo amaro') || b.includes('campo belo') || b.includes('jabaquara') || b.includes('saúde') || b.includes('socorro') || b.includes('interlagos')) {
      return 'Zona Sul';
    }
    if (b.includes('santana') || b.includes('tucuruvi') || b.includes('casa verde') || b.includes('freguesia') || b.includes('limão') || b.includes('mandaqui') || b.includes('tremembé') || b.includes('jaçanã')) {
      return 'Zona Norte';
    }
    if (b.includes('tatuapé') || b.includes('mooca') || b.includes('belém') || b.includes('brás') || b.includes('penha') || b.includes('anália franco') || b.includes('itaguera') || b.includes('sapopemba') || b.includes('vila prudente')) {
      return 'Zona Leste';
    }
    if (b.includes('sé') || b.includes('república') || b.includes('bela vista') || b.includes('consolação') || b.includes('liberdade') || b.includes('santa cecília') || b.includes('bom retiro') || b.includes('paulista')) {
      return 'Centro';
    }
  }

  return 'Centro';
}

/**
 * Format raw 8 digits into 00000-000
 */
export function formatCepString(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Parse an address string to extract street, city, state, number and potential CEP
 */
export function parseAddressQuery(input: string): {
  embeddedCep: string | null;
  streetName: string;
  houseNumber: string;
  city: string;
  state: string;
} {
  const trimmed = (input || '').toString().trim();
  
  // 1. Check if the string already contains a CEP (e.g. "01310-100", "01310100", "CEP: 05061-050")
  const cepMatch = trimmed.match(/\b(\d{5})[- ]?(\d{3})\b/);
  const embeddedCep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : null;

  // 2. Detect State/UF
  let state = 'SP';
  const stateMatch = trimmed.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  if (stateMatch) {
    state = stateMatch[1].toUpperCase();
  }

  // 3. Detect City
  let city = 'São Paulo';
  const lower = trimmed.toLowerCase();
  const knownCities = [
    'são paulo', 'sao paulo', 'guarulhos', 'campinas', 'são bernardo do campo', 
    'santo andré', 'osasco', 'são caetano do sul', 'barueri', 'diadema', 
    'taboão da serra', 'mauá', 'jundiaí', 'sorocaba', 'santos', 'ribeirão preto',
    'rio de janeiro', 'curitiba', 'belo horizonte', 'brasília', 'porto alegre'
  ];
  
  for (const c of knownCities) {
    if (lower.includes(c)) {
      city = c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // 4. Extract House Number if present (e.g. ", 1000", "nº 385", "1000", "385")
  let houseNumber = '';
  const numberMatch = trimmed.match(/(?:,\s*|\bn[ºo°]?\s*|\bnum(?:ero)?\s*)(\d+)/i) || trimmed.match(/\b(\d+)\b/);
  if (numberMatch && (!embeddedCep || numberMatch[1] !== embeddedCep.slice(0, 5))) {
    houseNumber = numberMatch[1];
  }

  // 5. Clean Street Name
  let streetName = trimmed;
  // Remove CEP
  if (cepMatch) {
    streetName = streetName.replace(cepMatch[0], '');
  }
  // Remove "CEP:", "CEP"
  streetName = streetName.replace(/\bcep\s*:?/gi, '');
  // Remove city and state if at the end
  streetName = streetName.replace(/,\s*[A-Za-zÀ-ÿ\s]+-[A-Za-z]{2}\b/gi, '');
  // Remove comma number
  streetName = streetName.replace(/,\s*\d+.*$/i, '');
  // Remove apto, bloco, etc.
  streetName = streetName.replace(/\b(apto|ap|bloco|bl|cj|sala|andar)\s*.*$/gi, '');
  // Trim common punctuation
  streetName = streetName.replace(/^[-,\s]+|[-,\s]+$/g, '').trim();

  // If streetName still has prefixes like "Rua", "Av.", "Avenida", "Alameda", "Al."
  // we can use it directly or strip for ViaCEP search
  return {
    embeddedCep,
    streetName,
    houseNumber,
    city,
    state
  };
}

/**
 * Search CEP for an address query.
 * Combines ViaCEP address search, OpenStreetMap Nominatim, and Direct CEP resolution.
 */
export async function searchCepByAddress(
  addressInput: string,
  preferredCity = 'São Paulo',
  preferredState = 'SP'
): Promise<AddressLookupResult | null> {
  const trimmed = (addressInput || '').toString().trim();
  if (!trimmed || trimmed.length < 3) return null;

  const cacheKey = `${trimmed.toLowerCase()}_${preferredCity}_${preferredState}`;
  if (addressCepCache.has(cacheKey)) {
    return addressCepCache.get(cacheKey)!;
  }

  const parsed = parseAddressQuery(trimmed);
  const city = parsed.city || preferredCity;
  const state = parsed.state || preferredState;

  // 1. If an embedded CEP was found in the string (e.g. user typed "Paulista 1000 - 01310-100")
  if (parsed.embeddedCep && parsed.embeddedCep.length === 8) {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${parsed.embeddedCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          const logradouro = data.logradouro || parsed.streetName;
          const bairro = data.bairro || '';
          const localidade = data.localidade || city;
          const uf = data.uf || state;
          const formattedCep = formatCepString(parsed.embeddedCep);
          const region = getRegionFromCepOrBairro(parsed.embeddedCep, bairro, localidade);

          const result: AddressLookupResult = {
            cep: formattedCep,
            cleanCep: parsed.embeddedCep,
            logradouro,
            bairro,
            localidade,
            uf,
            region,
            formattedAddress: `${logradouro}${bairro ? ` - ${bairro}` : ''}, ${localidade} - ${uf}`,
            source: 'direct_cep'
          };
          addressCepCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (e) {
      console.warn('[searchCepByAddress] Direct CEP fetch error:', e);
    }
  }

  // 2. Query ViaCEP street search: https://viacep.com.br/ws/{UF}/{Cidade}/{Logradouro}/json/
  // ViaCEP requires at least 3 characters in the street name
  let cleanStreetForViaCep = parsed.streetName
    .replace(/^(rua|r\.|avenida|av\.|av|alameda|al\.|travessa|tv\.|praça|praca|pç\.|estrada|est\.|rodovia|rod\.)\s+/gi, '')
    .trim();

  // If cleaning made it too short, keep the original streetName
  if (cleanStreetForViaCep.length < 3) {
    cleanStreetForViaCep = parsed.streetName;
  }

  if (cleanStreetForViaCep.length >= 3) {
    try {
      // Normalize city name for ViaCEP (remove accents or keep standard)
      const encodedCity = encodeURIComponent(city.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const encodedStreet = encodeURIComponent(cleanStreetForViaCep.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const viaCepUrl = `https://viacep.com.br/ws/${state}/${encodedCity}/${encodedStreet}/json/`;

      const response = await fetch(viaCepUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          // If we have a house number, try to match by 'complemento' or take the first/closest
          let bestMatch = data[0];
          if (parsed.houseNumber && data.length > 1) {
            const numVal = parseInt(parsed.houseNumber, 10);
            const matchingComplement = data.find(item => {
              if (!item.complemento) return false;
              const rangeMatch = item.complemento.match(/de\s*(\d+)\s*(?:a|ao|até)\s*(\d+)/i);
              if (rangeMatch) {
                const min = parseInt(rangeMatch[1], 10);
                const max = parseInt(rangeMatch[2], 10);
                return numVal >= min && numVal <= max;
              }
              return item.complemento.includes(parsed.houseNumber);
            });
            if (matchingComplement) {
              bestMatch = matchingComplement;
            }
          }

          const rawCep = (bestMatch.cep || '').replace(/\D/g, '');
          if (rawCep.length === 8) {
            const formattedCep = formatCepString(rawCep);
            const region = getRegionFromCepOrBairro(rawCep, bestMatch.bairro, bestMatch.localidade);

            const result: AddressLookupResult = {
              cep: formattedCep,
              cleanCep: rawCep,
              logradouro: bestMatch.logradouro || parsed.streetName,
              bairro: bestMatch.bairro || '',
              localidade: bestMatch.localidade || city,
              uf: bestMatch.uf || state,
              region,
              formattedAddress: `${bestMatch.logradouro || parsed.streetName}${bestMatch.bairro ? ` - ${bestMatch.bairro}` : ''}, ${bestMatch.localidade || city} - ${bestMatch.uf || state}`,
              source: 'viacep'
            };
            addressCepCache.set(cacheKey, result);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn('[searchCepByAddress] ViaCEP search error:', err);
    }
  }

  // 3. Fallback: Query OpenStreetMap Nominatim with Brazilian address details
  try {
    const nominatimQuery = `${trimmed}, ${city} - ${state}, Brasil`;
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nominatimQuery)}&addressdetails=1&countrycodes=br&limit=3`;
    
    const nomRes = await fetch(nomUrl, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        for (const item of nomData) {
          const addr = item.address || {};
          const rawPostcode = addr.postcode || '';
          const cleanPostcode = rawPostcode.replace(/\D/g, '');

          if (cleanPostcode.length === 8) {
            const formattedCep = formatCepString(cleanPostcode);
            const road = addr.road || addr.pedestrian || addr.street || parsed.streetName;
            const bairro = addr.suburb || addr.neighbourhood || addr.city_district || '';
            const localidade = addr.city || addr.town || addr.municipality || city;
            const uf = addr.state_code || addr.state || state;
            const region = getRegionFromCepOrBairro(cleanPostcode, bairro, localidade);

            const result: AddressLookupResult = {
              cep: formattedCep,
              cleanCep: cleanPostcode,
              logradouro: road,
              bairro,
              localidade,
              uf,
              region,
              formattedAddress: `${road}${bairro ? ` - ${bairro}` : ''}, ${localidade} - ${uf}`,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              source: 'nominatim'
            };
            addressCepCache.set(cacheKey, result);
            return result;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[searchCepByAddress] Nominatim search error:', err);
  }

  // 4. Neighborhood / Landmark Fallback for São Paulo (if specific neighborhood detected)
  const region = getRegionFromCepOrBairro('', trimmed, city);
  let fallbackCep = '';
  if (region === 'Zona Oeste') fallbackCep = '05061-050';
  else if (region === 'Zona Sul') fallbackCep = '04001-000';
  else if (region === 'Zona Norte') fallbackCep = '02011-000';
  else if (region === 'Zona Leste') fallbackCep = '03001-000';
  else fallbackCep = '01310-100';

  const cleanFallback = fallbackCep.replace(/\D/g, '');
  const fallbackResult: AddressLookupResult = {
    cep: fallbackCep,
    cleanCep: cleanFallback,
    logradouro: parsed.streetName,
    bairro: '',
    localidade: city,
    uf: state,
    region,
    formattedAddress: `${parsed.streetName}, ${city} - ${state}`,
    source: 'nominatim'
  };

  return fallbackResult;
}

/**
 * Fetch multiple address suggestions for an autocomplete dropdown
 */
export async function fetchAddressSuggestions(
  query: string,
  preferredCity = 'São Paulo',
  preferredState = 'SP'
): Promise<AddressSuggestionItem[]> {
  const trimmed = (query || '').toString().trim();
  if (trimmed.length < 3) return [];

  const cacheKey = `${trimmed.toLowerCase()}_${preferredCity}_${preferredState}`;
  if (suggestionsCache.has(cacheKey)) {
    return suggestionsCache.get(cacheKey)!;
  }

  const results: AddressSuggestionItem[] = [];
  const parsed = parseAddressQuery(trimmed);
  const city = parsed.city || preferredCity;
  const state = parsed.state || preferredState;

  let cleanStreet = parsed.streetName
    .replace(/^(rua|r\.|avenida|av\.|av|alameda|al\.|travessa|tv\.|praça|praca|pç\.|estrada|est\.|rodovia|rod\.)\s+/gi, '')
    .trim();

  if (cleanStreet.length < 3) {
    cleanStreet = parsed.streetName;
  }

  // 1. Query ViaCEP
  if (cleanStreet.length >= 3) {
    try {
      const encodedCity = encodeURIComponent(city.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const encodedStreet = encodeURIComponent(cleanStreet.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const res = await fetch(`https://viacep.com.br/ws/${state}/${encodedCity}/${encodedStreet}/json/`);
      
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.slice(0, 6).forEach((item, index) => {
            const rawCep = (item.cep || '').replace(/\D/g, '');
            if (rawCep.length === 8) {
              const formattedCep = formatCepString(rawCep);
              const logradouro = item.logradouro || parsed.streetName;
              const bairro = item.bairro || '';
              const localidade = item.localidade || city;
              const uf = item.uf || state;
              const complementInfo = item.complemento ? ` (${item.complemento})` : '';

              results.push({
                id: `viacep_${rawCep}_${index}`,
                cep: formattedCep,
                logradouro,
                bairro,
                localidade,
                uf,
                displayName: `${logradouro}${complementInfo} - ${bairro}, ${localidade} - ${uf}`,
                region: getRegionFromCepOrBairro(rawCep, bairro, localidade)
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[fetchAddressSuggestions] ViaCEP error:', e);
    }
  }

  // 2. Query Nominatim if ViaCEP has few results
  if (results.length < 3) {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${trimmed}, ${city} - ${state}, Brasil`)}&addressdetails=1&countrycodes=br&limit=4`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
      });

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData)) {
          nomData.forEach((item, index) => {
            const addr = item.address || {};
            const rawPostcode = (addr.postcode || '').replace(/\D/g, '');
            if (rawPostcode.length === 8) {
              const formattedCep = formatCepString(rawPostcode);
              const road = addr.road || addr.pedestrian || addr.street || parsed.streetName;
              const bairro = addr.suburb || addr.neighbourhood || addr.city_district || '';
              const localidade = addr.city || addr.town || addr.municipality || city;
              const uf = addr.state_code || addr.state || state;

              // Check if not already in results
              if (!results.some(r => r.cep === formattedCep)) {
                results.push({
                  id: `nominatim_${rawPostcode}_${index}`,
                  cep: formattedCep,
                  logradouro: road,
                  bairro,
                  localidade,
                  uf,
                  displayName: `${road} - ${bairro ? `${bairro}, ` : ''}${localidade} - ${uf}`,
                  region: getRegionFromCepOrBairro(rawPostcode, bairro, localidade),
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon)
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[fetchAddressSuggestions] Nominatim error:', e);
    }
  }

  suggestionsCache.set(cacheKey, results);
  return results;
}
