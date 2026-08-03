import { CompanyHub, DeliveryRider, Order } from '../types';

export interface MapCachePayload {
  timestamp: string;
  isOfflineSimulated?: boolean;
  hub: {
    id: string;
    name: string;
    address: string;
    cep?: string;
    lat: number;
    lng: number;
    phone?: string;
  };
  allHubs: Array<{
    id: string;
    name: string;
    address: string;
    cep?: string;
    lat: number;
    lng: number;
    active?: boolean;
  }>;
  orders: Array<{
    id: string;
    clientName: string;
    partnerName: string;
    address: string;
    cep: string;
    lat?: number;
    lng?: number;
    sequence?: number;
    status: string;
    priority: string;
    region: string;
    riderId?: string;
  }>;
  riders: Array<{
    id: string;
    name: string;
    status: string;
    avatar: string;
    phone: string;
    vehicle: string;
    vehiclePlate?: string;
    realGeoLat?: number;
    realGeoLng?: number;
    lat: number;
    lng: number;
    completedDeliveries: number;
    batteryPercent: number;
    isGpsRealActive?: boolean;
    lastGpsUpdate?: string;
  }>;
  activeRoutePoints: Array<[number, number]>;
}

const CACHE_KEY = 'vinimap_live_map_cache';

export function saveMapCache(payload: Omit<MapCachePayload, 'timestamp'>): MapCachePayload | null {
  try {
    const timestamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const fullPayload: MapCachePayload = {
      ...payload,
      timestamp
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(fullPayload));
    }
    return fullPayload;
  } catch (err) {
    console.warn('Erro ao salvar cache do mapa:', err);
    return null;
  }
}

export function getMapCache(): MapCachePayload | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.hub && Array.isArray(parsed.orders)) {
          return parsed as MapCachePayload;
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao ler cache do mapa:', err);
  }
  return null;
}

export function clearMapCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch (err) {
    console.warn('Erro ao limpar cache do mapa:', err);
  }
}
