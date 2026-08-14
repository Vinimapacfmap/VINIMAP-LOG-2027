/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import { initLeafletPosGuard } from '../utils/leafletPatch';
import { DeliveryRider, Order, RiderStatus, OrderStatus, CompanyHub } from '../types';
import { getDriverAppInstallUrl } from '../utils/pwaUtils';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import { getSaoPauloDateTimeShort, getSaoPauloISODate, isOrderInDatePeriod } from '../utils/dateUtils';
import { getCoordinatesFromCep } from '../utils/locationUtils';
import SafeMapWrapper from './SafeMapWrapper';
import { fetchOsrmMultiStopRoute, getCachedOsrmRoute } from '../utils/osrmService';
import { 
  MapPin, 
  Phone, 
  Battery, 
  Navigation, 
  Clock, 
  Package, 
  RotateCcw, 
  User, 
  CheckCircle2, 
  Layers, 
  Wifi, 
  Send, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  X, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Target, 
  Activity, 
  ShieldAlert, 
  Zap, 
  Crosshair,
  Check,
  AlertTriangle,
  Play,
  Pause,
  Filter
} from 'lucide-react';

interface RiderTrackingViewProps {
  riders: DeliveryRider[];
  orders: Order[];
  onUpdateRiderCoords?: (
    riderId: string, 
    lat: number, 
    lng: number, 
    realGeoLat?: number, 
    realGeoLng?: number, 
    gpsAccuracy?: number, 
    lastGpsUpdate?: string, 
    isGpsRealActive?: boolean
  ) => void;
  onUpdateOrderStatus?: (orderId: string, status: OrderStatus) => void;
  activeHub?: CompanyHub;
}

type MapStyle = 'standard' | 'satellite' | 'dark-vinimap' | 'openstreetmap';

export interface RiderLocationPoint {
  id: string;
  timestamp: string;
  geoLat: number;
  geoLng: number;
  gpsAccuracy: number;
  speedKmH: number;
  batteryPercent: number;
  source: string;
}

const MOCK_RIDER_IDS = ['ent-1', 'ent-2', 'ent-3', 'ent-4', 'ent-5'];
const MOCK_ORDER_IDS = ['ped-101', 'ped-102', 'ped-103', 'ped-104', 'ped-105', 'ped-106', 'ped-107', 'ped-108'];

export default function RiderTrackingView({ 
  riders: propsRiders, 
  orders: propsOrders, 
  onUpdateRiderCoords, 
  onUpdateOrderStatus, 
  activeHub 
}: RiderTrackingViewProps) {
  const riders = useMemo(() => propsRiders.filter(r => !MOCK_RIDER_IDS.includes(r.id)), [propsRiders]);
  const orders = useMemo(() => propsOrders.filter(o => !MOCK_ORDER_IDS.includes(o.id)), [propsOrders]);

  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState<boolean>(false);
  const [selectedTimelineRider, setSelectedTimelineRider] = useState<DeliveryRider | null>(null);
  const [locationHistories, setLocationHistories] = useState<Record<string, RiderLocationPoint[]>>({});
  const [hoveredOrder, setHoveredOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('openstreetmap');
  const [recalibrateKey, setRecalibrateKey] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<RiderStatus | 'Todos'>('Todos');

  // Real street routing states (OSRM - OpenStreetMap)
  const [realStreetSegments, setRealStreetSegments] = useState<Record<string, [number, number][]>>({});
  const [isLoadingRealRoutes, setIsLoadingRealRoutes] = useState<boolean>(false);

  // Delivery Period Filter
  const [filterDateFrom] = useState<string>('');
  const [filterDateTo] = useState<string>('');

  // Persistent custom order sequences (chosen manually by drivers)
  const [customOrderSequences, setCustomOrderSequences] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('vinimap_custom_order_sequences');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing custom order sequences', e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('vinimap_custom_order_sequences', JSON.stringify(customOrderSequences));
  }, [customOrderSequences]);

  const moveOrderInSequence = (riderId: string, orderId: string, direction: 'up' | 'down') => {
    const riderPending = orders.filter(o => {
      const matchesRider = o.riderId === riderId;
      const matchesStatus = o.status !== 'Concluído' && o.status !== 'Cancelado';
      let matchesDate = true;
      if (filterDateFrom && o.date < filterDateFrom) matchesDate = false;
      if (filterDateTo && o.date > filterDateTo) matchesDate = false;
      return matchesRider && matchesStatus && matchesDate;
    });

    let currentSeq = customOrderSequences[riderId] || [];
    const activePendingIds = riderPending.map(o => o.id);
    currentSeq = currentSeq.filter(id => activePendingIds.includes(id));
    
    activePendingIds.forEach(id => {
      if (!currentSeq.includes(id)) {
        currentSeq.push(id);
      }
    });

    const index = currentSeq.indexOf(orderId);
    if (index === -1) return;

    const newSeq = [...currentSeq];
    if (direction === 'up' && index > 0) {
      newSeq[index] = newSeq[index - 1];
      newSeq[index - 1] = orderId;
    } else if (direction === 'down' && index < newSeq.length - 1) {
      newSeq[index] = newSeq[index + 1];
      newSeq[index + 1] = orderId;
    }

    setCustomOrderSequences(prev => ({
      ...prev,
      [riderId]: newSeq
    }));
  };

  const hubLatLng = useMemo<[number, number]>(() => {
    return (activeHub ? [activeHub.lat, activeHub.lng] : [-23.5385556, -46.70118]) as [number, number];
  }, [activeHub?.lat, activeHub?.lng]);

  const getRiderRouteColor = (rId: string, isSelected: boolean) => {
    if (isSelected) return '#3b82f6';
    const colors = ['#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
    const index = rId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Fullscreen Map State & Logic
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleFullscreenToggle = () => {
    const element = document.getElementById('vinimap-rider-tracking-view');
    if (!element) return;

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch((err) => {
        console.error(`Erro ao ativar modo tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // GPS Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationOffsets, setSimulationOffsets] = useState<Record<string, { latOffset: number; lngOffset: number }>>({});
  const [riderSpeeds, setRiderSpeeds] = useState<Record<string, number>>({});
  const [lastGpsUpdateTimestamp, setLastGpsUpdateTimestamp] = useState<number>(Date.now());
  const [gpsElapsedSeconds, setGpsElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    setLastGpsUpdateTimestamp(Date.now());
    setGpsElapsedSeconds(0);
  }, [selectedRiderId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setGpsElapsedSeconds(Math.floor((Date.now() - lastGpsUpdateTimestamp) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastGpsUpdateTimestamp]);

  // Leaflet Interactive Map State & Refs
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routesGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const lastFittedRiderIdRef = useRef<string | null>(null);
  const riderMarkersRef = useRef<Record<string, any>>({});

  // Convert map percentages / SVG coordinates to real latitude and longitude
  const convertToGeoLat = (svgLatPercent: number) => -23.52 - (svgLatPercent / 100) * 0.12;
  const convertToGeoLng = (svgLngPercent: number) => -46.72 + (svgLngPercent / 100) * 0.18;

  const getOrderGeoCoords = (order: Order) => {
    const coords = getCoordinatesFromCep(order.cep, order.region, order.address, order.lat, order.lng);
    return [coords.lat, coords.lng] as [number, number];
  };

  const getRiderGeoCoords = (rider: DeliveryRider): [number, number] => {
    let baseLat: number;
    let baseLng: number;

    const isRealDeviceGps = !!(
      rider.isGpsRealActive ||
      (rider.realGeoLat !== undefined && rider.realGeoLat < -10 && rider.realGeoLng !== undefined && rider.realGeoLng < -30)
    );

    if (isRealDeviceGps && rider.realGeoLat !== undefined && rider.realGeoLng !== undefined) {
      baseLat = rider.realGeoLat;
      baseLng = rider.realGeoLng;
      // Real device GPS takes absolute priority - do NOT apply simulation offsets
      return [baseLat, baseLng];
    }

    if (rider.lat < -10) {
      baseLat = rider.lat;
      baseLng = rider.lng;
    } else {
      baseLat = convertToGeoLat(rider.lat);
      baseLng = convertToGeoLng(rider.lng);
    }

    const offset = simulationOffsets[rider.id];
    if (offset && isSimulating) {
      const latDelta = offset.latOffset * -0.0008;
      const lngDelta = offset.lngOffset * 0.0012;
      return [baseLat + latDelta, baseLng + lngDelta];
    }

    return [baseLat, baseLng];
  };

  const getHaversineDistance = (coords1: [number, number], coords2: [number, number]) => {
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calcDistKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return getHaversineDistance([lat1, lon1], [lat2, lon2]);
  };

  // Maintain location history for each rider with live priority
  useEffect(() => {
    if (!riders || riders.length === 0) return;

    setLocationHistories(prevHistories => {
      const nextHistories = { ...prevHistories };
      let hasChanges = false;

      riders.forEach(rider => {
        const coords = getRiderGeoCoords(rider);
        const existing = nextHistories[rider.id] || [];
        const isRealGps = !!(rider.isGpsRealActive || (rider.realGeoLat !== undefined && rider.realGeoLat < -10));

        if (existing.length === 0) {
          const currentPoint: RiderLocationPoint = {
            id: `live-${rider.id}-${Date.now()}`,
            timestamp: rider.lastGpsUpdate || 'Agora mesmo',
            geoLat: coords[0],
            geoLng: coords[1],
            gpsAccuracy: rider.gpsAccuracy || 4,
            speedKmH: riderSpeeds[rider.id] || 0,
            batteryPercent: rider.batteryPercent || 88,
            source: isRealGps ? 'GPS Celular (Dispositivo Real)' : 'Rastreamento Satélite'
          };
          nextHistories[rider.id] = [currentPoint];
          hasChanges = true;
        } else {
          const lastRecorded = existing[0];
          const distToLast = calcDistKm(lastRecorded.geoLat, lastRecorded.geoLng, coords[0], coords[1]);

          // Update whenever there's any movement or when timestamp changes or for real GPS
          if (distToLast > 0.001 || (isRealGps && distToLast > 0.0002) || lastRecorded.timestamp !== rider.lastGpsUpdate) {
            const newPoint: RiderLocationPoint = {
              id: `pt-${rider.id}-${Date.now()}`,
              timestamp: rider.lastGpsUpdate || new Date().toLocaleTimeString(),
              geoLat: coords[0],
              geoLng: coords[1],
              gpsAccuracy: rider.gpsAccuracy || 4,
              speedKmH: riderSpeeds[rider.id] || (isSimulating ? 38 : 0),
              batteryPercent: rider.batteryPercent || 85,
              source: isRealGps ? 'GPS Celular (Dispositivo Real)' : 'Rastreamento Satélite'
            };

            nextHistories[rider.id] = [newPoint, ...existing.filter(p => calcDistKm(p.geoLat, p.geoLng, coords[0], coords[1]) > 0.0005)].slice(0, 15);
            hasChanges = true;
          }
        }
      });

      return hasChanges ? nextHistories : prevHistories;
    });
  }, [riders, riderSpeeds, isSimulating]);

  // Real Street Routing via OSRM
  useEffect(() => {
    let isMounted = true;

    async function calculateAllRealStreetRoutes() {
      if (!riders || riders.length === 0) return;

      setIsLoadingRealRoutes(true);
      const newSegments: Record<string, [number, number][]> = {};

      const targetRiders = selectedRiderId 
        ? riders.filter(r => r.id === selectedRiderId)
        : riders.filter(r => r.status !== 'Offline');

      for (const rider of targetRiders) {
        const rawPending = orders.filter(o => {
          const matchesRider = o.riderId === rider.id;
          const matchesStatus = o.status !== 'Concluído' && o.status !== 'Cancelado';
          return matchesRider && matchesStatus;
        });

        if (rawPending.length === 0) continue;

        const seq = customOrderSequences[rider.id];
        let orderedPending = [...rawPending];
        if (seq && seq.length > 0) {
          orderedPending.sort((a, b) => {
            const indexA = seq.indexOf(a.id);
            const indexB = seq.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        }

        const coordsList = [
          hubLatLng,
          ...orderedPending.map(getOrderGeoCoords)
        ];
        const waypoints = coordsList.map(c => ({ lat: c[0], lng: c[1] }));

        try {
          const osrmResult = await fetchOsrmMultiStopRoute(waypoints);
          if (!isMounted) return;

          if (osrmResult && osrmResult.fullGeometry && osrmResult.fullGeometry.length > 1) {
            newSegments[rider.id] = osrmResult.fullGeometry;
          }
        } catch (err) {
          console.warn(`OSRM error for rider ${rider.name}:`, err);
        }
      }

      if (isMounted) {
        setRealStreetSegments(prev => ({ ...prev, ...newSegments }));
        setIsLoadingRealRoutes(false);
      }
    }

    calculateAllRealStreetRoutes();

    return () => {
      isMounted = false;
    };
  }, [riders, orders, selectedRiderId, customOrderSequences, hubLatLng]);

  // Leaflet map initialization and lifecycle
  useEffect(() => {
    initLeafletPosGuard();
    if (!mapContainerRef.current) return;

    const container = mapContainerRef.current;

    // Reset leaflet id if container was previously registered with a destroyed map
    if ((container as any)._leaflet_id && !mapInstanceRef.current) {
      delete (container as any)._leaflet_id;
    }

    if (!mapInstanceRef.current) {
      try {
        const map = L.map(container, {
          center: hubLatLng,
          zoom: 13,
          zoomControl: false,
        });

        L.control.zoom({ position: 'topright' }).addTo(map);
        mapInstanceRef.current = map;

        markersGroupRef.current = L.layerGroup().addTo(map);
        routesGroupRef.current = L.layerGroup().addTo(map);

        // Immediate and staged invalidations to ensure full layout rendering
        map.invalidateSize();
        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 100);
        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 350);
      } catch (err) {
        console.error("Leaflet map initialization error:", err);
      }
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      try {
        map.removeLayer(tileLayerRef.current);
      } catch (e) {}
    }

    let tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    let tileAttribution = '&copy; OpenStreetMap contributors &copy; CARTO';

    if (mapStyle === 'dark-vinimap') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileAttribution = 'Tiles &copy; Esri';
    } else if (mapStyle === 'openstreetmap') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileAttribution = '&copy; OpenStreetMap contributors';
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19,
    }).addTo(map);

    if (activeHub) {
      map.setView([activeHub.lat, activeHub.lng], 13);
    }

    // ResizeObserver to automatically invalidate size when container dimensions change
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapStyle, activeHub, recalibrateKey, hubLatLng]);

  // Clean up Leaflet map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("Leaflet cleanup warning:", e);
        }
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
        routesGroupRef.current = null;
        riderMarkersRef.current = {};
      }
    };
  }, [recalibrateKey]);

  // Ensure map size is recalculated when sidebar or fullscreen state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, isFullscreen]);

  // Marker and Polyline update effect (Crucial: riders dependency included!)
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;

    const L = (window as any).L;
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    const routesGroup = routesGroupRef.current;

    if (!markersGroup || !routesGroup) return;

    try {
      map.invalidateSize();
      markersGroup.eachLayer((layer: any) => {
        const isRiderMarker = Object.values(riderMarkersRef.current).includes(layer);
        if (!isRiderMarker) {
          markersGroup.removeLayer(layer);
        }
      });
      routesGroup.clearLayers();
    } catch (err) {
      console.warn("Leaflet layer clearing handled:", err);
    }

    const bounds: any[] = [];
    const activeRiderIdsInView = new Set<string>();

    bounds.push(hubLatLng);

    const hubIcon = L.divIcon({
      className: 'custom-hub-icon-leaflet',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-9 h-9 rounded-full bg-sky-500/20 animate-ping pointer-events-none"></div>
          <div class="w-8 h-8 rounded-full bg-slate-950 border-2 border-white shadow-2xl overflow-hidden flex items-center justify-center p-0.5">
            <img src="${activeHub?.logoUrl || vinimapLogo}" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null;this.src='${vinimapLogo}';" />
          </div>
          <div class="absolute -top-7 whitespace-nowrap bg-slate-900 border border-slate-700 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md shadow-xl text-sky-400">
            ${activeHub ? activeHub.name.toUpperCase() : 'BASE CENTRAL (SEDE)'}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker(hubLatLng, { icon: hubIcon }).addTo(markersGroup);

    // Render riders and their route polylines
    riders.forEach((rider) => {
      if (statusFilter !== 'Todos' && rider.status !== statusFilter) return;
      if (selectedRiderId && rider.id !== selectedRiderId) return;

      activeRiderIdsInView.add(rider.id);
      const riderLatLng = getRiderGeoCoords(rider);
      const isRiderSelected = rider.id === selectedRiderId;

      if (isRiderSelected || !selectedRiderId) {
        bounds.push(riderLatLng);
      }

      const statusColor = rider.status === 'Disponível' ? '#10b981' :
                          rider.status === 'Em rota' ? '#3b82f6' :
                          rider.status === 'Alerta' ? '#f43f5e' : '#94a3b8';

      const riderIcon = L.divIcon({
        className: 'custom-rider-icon-leaflet',
        html: `
          <div class="relative w-12 h-12 flex items-center justify-center cursor-pointer group" title="${rider.name} (${rider.vehicle})">
            ${isRiderSelected ? `<div class="absolute inset-0 rounded-full bg-sky-500/35 animate-ping pointer-events-none"></div>` : ''}
            <div class="relative w-10 h-10 rounded-full bg-slate-950 border-2 shadow-2xl flex items-center justify-center p-0.5 transition-all" style="border-color: ${isRiderSelected ? '#38bdf8' : statusColor}">
              <img src="${rider.avatar}" alt="${rider.name}" class="w-full h-full rounded-full object-cover" />
              <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-[8px] shadow-md font-bold">
                ${rider.vehicle === 'Moto' ? '🏍️' : '🚲'}
              </span>
            </div>
            <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 text-white text-[9.5px] font-black px-2 py-0.5 rounded-md shadow-xl border border-slate-700 pointer-events-none transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 z-50">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${statusColor}"></span>
              <span>${rider.name}</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });

      let riderMarker = riderMarkersRef.current[rider.id];

      if (riderMarker && markersGroup.hasLayer(riderMarker)) {
        riderMarker.setLatLng(riderLatLng);
        riderMarker.setIcon(riderIcon);
      } else {
        riderMarker = L.marker(riderLatLng, { 
          icon: riderIcon,
          title: `${rider.name} (${rider.vehicle})`
        }).addTo(markersGroup);

        riderMarker.bindTooltip(`
          <div class="px-2 py-1 font-sans text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" style="background-color: ${statusColor}"></span>
            <span>${rider.name}</span>
            <span class="text-[10px] text-slate-500 font-semibold">(${rider.vehicle})</span>
          </div>
        `, {
          direction: 'top',
          offset: [0, -22],
          opacity: 0.98
        });

        riderMarker.on('click', () => {
          setSelectedRiderId(rider.id);
        });

        riderMarkersRef.current[rider.id] = riderMarker;
      }

      // Draw route for this rider
      const rawPendingOrders = orders.filter(o => {
        const matchesRider = o.riderId === rider.id;
        const matchesStatus = o.status !== 'Concluído' && o.status !== 'Cancelado';
        return matchesRider && matchesStatus;
      });

      const seq = customOrderSequences[rider.id];
      let rPendingOrders: Order[] = [...rawPendingOrders];
      if (seq && seq.length > 0) {
        rPendingOrders.sort((a, b) => {
          const indexA = seq.indexOf(a.id);
          const indexB = seq.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      const routeColor = getRiderRouteColor(rider.id, isRiderSelected);
      const streetRoute = realStreetSegments[rider.id];

      if (streetRoute && streetRoute.length > 1) {
        L.polyline(streetRoute, {
          color: routeColor,
          weight: isRiderSelected ? 7 : 4,
          opacity: isRiderSelected ? 0.35 : 0.2,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routesGroup);

        L.polyline(streetRoute, {
          color: routeColor,
          weight: isRiderSelected ? 3.5 : 2,
          opacity: isRiderSelected ? 0.95 : 0.75,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: isSimulating ? '6, 6' : 'none',
        }).addTo(routesGroup);
      }

      // Order stop markers (only when driver has pending orders) - clean uncluttered map view
      rPendingOrders.forEach((order, orderIndex) => {
        const orderLatLng = getOrderGeoCoords(order);
        if (isRiderSelected) {
          bounds.push(orderLatLng);
        }

        const isHovered = hoveredOrder?.id === order.id;
        const isSelected = selectedOrder?.id === order.id;

        const pinColor = isHovered || isSelected ? '#f59e0b' : '#0284c7';

        const orderIcon = L.divIcon({
          className: 'custom-order-icon-leaflet',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer transition-transform ${isHovered || isSelected ? 'scale-125 z-40' : 'hover:scale-115'}">
              <div class="w-6 h-6 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-[10px] font-mono" style="background-color: ${pinColor}">
                ${orderIndex + 1}
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const orderMarker = L.marker(orderLatLng, { icon: orderIcon }).addTo(markersGroup);

        orderMarker.bindTooltip(`
          <div class="px-2 py-1 font-sans text-xs font-bold text-slate-900 leading-tight">
            <div class="flex items-center gap-1 font-extrabold text-sky-700">📍 Parada #${orderIndex + 1}</div>
            <div class="text-slate-800 text-[11px] mt-0.5">${order.clientName || 'Cliente'}</div>
            <div class="text-[10px] text-slate-500 font-normal truncate max-w-[180px]">${order.address}</div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -12],
          opacity: 0.98
        });

        orderMarker.on('click', () => {
          setSelectedOrder(order);
          setSelectedRiderId(rider.id);
        });

        orderMarker.on('mouseover', () => {
          setHoveredOrder(order);
        });

        orderMarker.on('mouseout', () => {
          setHoveredOrder(null);
        });
      });
    });

    // Remove markers of riders no longer in active view
    Object.keys(riderMarkersRef.current).forEach(rId => {
      if (!activeRiderIdsInView.has(rId)) {
        const m = riderMarkersRef.current[rId];
        if (m && markersGroup.hasLayer(m)) {
          markersGroup.removeLayer(m);
        }
        delete riderMarkersRef.current[rId];
      }
    });

    if (map && selectedRiderId !== lastFittedRiderIdRef.current) {
      if (selectedRiderId) {
        const selRider = riders.find(r => r.id === selectedRiderId);
        if (selRider) {
          const rPending = orders.filter(o => o.riderId === selectedRiderId && o.status !== 'Concluído' && o.status !== 'Cancelado');
          if (rPending.length > 0 && bounds.length > 1) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          } else {
            const rCoords = getRiderGeoCoords(selRider);
            map.setView(rCoords, 15, { animate: true });
          }
        }
      } else if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
      lastFittedRiderIdRef.current = selectedRiderId || null;
    }
  }, [
    leafletLoaded, 
    riders, 
    orders, 
    selectedRiderId, 
    statusFilter, 
    simulationOffsets, 
    hoveredOrder, 
    selectedOrder, 
    isSimulating, 
    customOrderSequences, 
    realStreetSegments, 
    hubLatLng
  ]);

  const handleCenterOnSelectedRider = () => {
    if (!mapInstanceRef.current) return;
    const targetRider = riders.find(r => r.id === selectedRiderId);
    if (targetRider) {
      const coords = getRiderGeoCoords(targetRider);
      mapInstanceRef.current.setView(coords, 15, { animate: true });
    } else {
      mapInstanceRef.current.setView(hubLatLng, 13, { animate: true });
    }
  };

  const handleRecalibrateMap = () => {
    setRecalibrateKey(prev => prev + 1);
    if (mapInstanceRef.current) {
      lastFittedRiderIdRef.current = null;
      mapInstanceRef.current.invalidateSize();
      setTimeout(() => {
        handleCenterOnSelectedRider();
      }, 150);
    }
  };

  const selectedRider = useMemo(() => {
    return riders.find(r => r.id === selectedRiderId) || null;
  }, [riders, selectedRiderId]);

  const riderPendingOrders = useMemo(() => {
    if (!selectedRiderId) return [];
    return orders.filter(o => o.riderId === selectedRiderId && o.status !== 'Concluído' && o.status !== 'Cancelado');
  }, [orders, selectedRiderId]);

  const getWhatsAppLink = (rider: DeliveryRider) => {
    const liveUrl = getDriverAppInstallUrl(rider.id);
    const text = `Olá ${rider.name}, aqui é da central de logística Vinimap. Link do seu app de entregas: ${liveUrl}`;
    return `https://api.whatsapp.com/send?phone=${rider.phone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;
  };

  return (
    <div 
      id="vinimap-rider-tracking-view"
      className="flex flex-col h-[calc(100vh-75px)] w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 text-slate-100 select-none"
    >
      <style>{`
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>

      {/* TOP COMPACT TOOLBAR - DIRECTLY ATTACHED TO MAP */}
      <div className="bg-slate-950/95 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        
        {/* Left: Driver Selector (Dropdown + Quick Avatar Pills) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Main Dropdown */}
          <div className="relative min-w-[210px]">
            <select
              id="vinimap-quick-rider-select"
              value={selectedRiderId || 'todos'}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedRiderId(val === 'todos' ? null : val);
              }}
              className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-700 hover:border-sky-500 rounded-xl text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer appearance-none shadow-inner"
            >
              <option value="todos">🌍 Todos os Condutores ({riders.length})</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicle === 'Moto' ? '🏍️' : '🚲'} {r.name} • {r.status}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Quick One-Click Driver Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[420px] py-0.5 custom-scrollbar">
            <button
              onClick={() => setSelectedRiderId(null)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                selectedRiderId === null 
                  ? 'bg-sky-600 text-white shadow-md' 
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              🌍 Frota
            </button>
            {riders.map((r) => {
              const isSel = r.id === selectedRiderId;
              const statusDot = r.status === 'Disponível' ? 'bg-emerald-400' :
                                r.status === 'Em rota' ? 'bg-sky-400' :
                                r.status === 'Alerta' ? 'bg-rose-400' : 'bg-slate-500';
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRiderId(r.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                    isSel 
                      ? 'bg-sky-600/90 text-white border-sky-400 shadow-md' 
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                  title={`${r.name} - ${r.status}`}
                >
                  <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0">
                    <img src={r.avatar} alt={r.name} className="w-full h-full object-cover" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                  </div>
                  <span className="truncate max-w-[70px]">{r.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Real Street Status + Map Style Picker */}
        <div className="flex items-center gap-2">
          {/* Map Layer Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center gap-0.5 shadow-inner">
            <button
              onClick={() => setMapStyle('standard')}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase transition-all cursor-pointer ${
                mapStyle === 'standard' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Padrão
            </button>
            <button
              onClick={() => setMapStyle('openstreetmap')}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase transition-all cursor-pointer ${
                mapStyle === 'openstreetmap' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OSM
            </button>
            <button
              onClick={() => setMapStyle('dark-vinimap')}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase transition-all cursor-pointer ${
                mapStyle === 'dark-vinimap' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Escuro
            </button>
            <button
              onClick={() => setMapStyle('satellite')}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase transition-all cursor-pointer ${
                mapStyle === 'satellite' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satélite
            </button>
          </div>
        </div>

        {/* Right: Actions (GPS Simulation, Recalibrate, Center, Telemetry, Fullscreen) */}
        <div className="flex items-center gap-1.5">
          {/* Toggle GPS Simulation */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              isSimulating 
                ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title={isSimulating ? 'Pausar Simulação de GPS' : 'Iniciar Simulação de GPS'}
          >
            {isSimulating ? <Pause size={12} /> : <Play size={12} />}
            <span className="hidden sm:inline">{isSimulating ? 'Pausar GPS' : 'Transmitir GPS'}</span>
          </button>

          {/* Recalibrate Map */}
          <button
            onClick={handleRecalibrateMap}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Recalibrar e Redefinir Dimensões do Mapa"
          >
            <RotateCcw size={14} />
          </button>

          {/* Center map */}
          <button
            onClick={handleCenterOnSelectedRider}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Centralizar no Condutor Selecionado ou HUB"
          >
            <Target size={14} className="text-sky-400" />
          </button>

          {/* Telemetry drawer toggle */}
          <button
            onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer ${
              showTelemetryDrawer 
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' 
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Painel de Diagnóstico & Telemetria"
          >
            <Activity size={12} className={gpsElapsedSeconds < 30 ? "text-emerald-400 animate-pulse" : "text-amber-400"} />
            <span className="hidden md:inline">Telemetria</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleFullscreenToggle}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Alternar Modo Tela Cheia"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Sidebar collapse toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
            title={isSidebarOpen ? "Ocultar Painel Lateral" : "Exibir Painel Lateral"}
          >
            {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

      </div>

      {/* MAIN SPLIT VIEW: COLLAPSIBLE SIDEBAR + FULL MAP STAGE */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* 1. LEFT COLLAPSIBLE DOCK (Rider profile & delivery stops OR Fleet overview) */}
        {isSidebarOpen && (
          <div className="w-full md:w-[340px] bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden shrink-0 z-10 animate-in slide-in-from-left duration-200">
            {selectedRider ? (
              <>
                {/* Back to Fleet Bar + Driver Profile Card */}
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 shrink-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedRiderId(null)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={12} /> Ver Toda a Frota
                    </button>
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                      riderPendingOrders.length > 0
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        : selectedRider.status === 'Disponível'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {riderPendingOrders.length > 0 ? `Em rota (${riderPendingOrders.length})` : selectedRider.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img 
                          src={selectedRider.avatar} 
                          alt={selectedRider.name} 
                          className="w-10 h-10 rounded-full object-cover border-2 border-sky-400 shadow-md"
                        />
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border border-slate-800 text-white flex items-center justify-center text-[8px] font-bold">
                          {selectedRider.vehicle === 'Moto' ? '🏍️' : '🚲'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-black text-white truncate">{selectedRider.name}</h3>
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-sky-400 font-bold">Placa: VNM-{selectedRider.id.replace(/\D/g, '') || '2026'}</span>
                          <span>•</span>
                          <span className="text-emerald-400 flex items-center gap-0.5 font-mono">
                            <Battery size={10} /> {selectedRider.batteryPercent}%
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Quick Contacts */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${selectedRider.phone}`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors"
                        title="Ligar para o condutor"
                      >
                        <Phone size={13} />
                      </a>
                      <a
                        href={getWhatsAppLink(selectedRider)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 transition-colors"
                        title="Abrir WhatsApp com o condutor"
                      >
                        <Send size={13} />
                      </a>
                    </div>
                  </div>

                  {/* Route Progress Header (Only if has orders) */}
                  {(() => {
                    const completed = orders.filter(o => o.riderId === selectedRider.id && o.status === 'Concluído').length;
                    const total = orders.filter(o => o.riderId === selectedRider.id && o.status !== 'Cancelado').length;
                    if (total === 0) return null;
                    const percent = (completed / total) * 100;
                    return (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between text-[9.5px] font-black uppercase text-slate-400">
                          <span>Progresso do Roteiro</span>
                          <span className="text-sky-400 font-mono">{completed}/{total} Concluídas ({Math.round(percent)}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                          <div 
                            className="h-full bg-sky-500 rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Conditional Content: Deliveries List vs Available Driver State */}
                {riderPendingOrders.length > 0 ? (
                  <>
                    {/* Delivery Stops List Header */}
                    <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between shrink-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={11} className="text-sky-400" />
                        Entregas Alocadas ({riderPendingOrders.length})
                      </span>
                      <button
                        onClick={() => setSelectedTimelineRider(selectedRider)}
                        className="text-[9px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Clock size={10} /> Timeline
                      </button>
                    </div>

                    {/* Scrollable Stops */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                      {riderPendingOrders.map((order, idx, arr) => {
                        const isNext = idx === 0;
                        const isSel = selectedOrder?.id === order.id;
                        const isHov = hoveredOrder?.id === order.id;

                        return (
                          <div
                            key={order.id}
                            onMouseEnter={() => setHoveredOrder(order)}
                            onMouseLeave={() => setHoveredOrder(null)}
                            onClick={() => setSelectedOrder(order)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                              isSel || isHov
                                ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400/30'
                                : isNext
                                ? 'bg-slate-900/95 border-sky-500/50'
                                : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 text-[8px] font-black bg-sky-600 text-white rounded font-mono">
                                  #{idx + 1}
                                </span>
                                <span className="font-mono font-black text-white text-[9.5px]">
                                  #{order.id.replace('ped-', '').toUpperCase()}
                                </span>
                              </div>
                              <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase border ${
                                order.priority === 'Alta' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                                order.priority === 'Média' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              }`}>
                                {order.priority}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <span className="font-black text-[11px] text-white block truncate leading-tight">
                                {order.clientName}
                              </span>
                              <span className="text-[9.5px] text-slate-400 block truncate leading-tight mt-0.5">
                                {order.address}
                              </span>
                            </div>

                            {/* Stop actions: Re-order and Complete */}
                            <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800 mt-0.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button
                                  disabled={idx === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveOrderInSequence(selectedRiderId, order.id, 'up');
                                  }}
                                  className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] cursor-pointer disabled:opacity-20 font-bold"
                                  title="Subir prioridade da parada"
                                >
                                  ▲
                                </button>
                                <button
                                  disabled={idx === arr.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveOrderInSequence(selectedRiderId, order.id, 'down');
                                  }}
                                  className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] cursor-pointer disabled:opacity-20 font-bold"
                                  title="Baixar prioridade da parada"
                                >
                                  ▼
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onUpdateOrderStatus) {
                                      onUpdateOrderStatus(order.id, 'Concluído');
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8.5px] font-black uppercase flex items-center gap-0.5 cursor-pointer shadow-sm"
                                >
                                  <Check size={10} /> Concluir
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Deseja cancelar o pedido #${order.id.replace('ped-', '').toUpperCase()}?`)) {
                                      if (onUpdateOrderStatus) {
                                        onUpdateOrderStatus(order.id, 'Cancelado');
                                      }
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-[8.5px] font-black uppercase flex items-center gap-0.5 cursor-pointer shadow-sm"
                                >
                                  <X size={10} /> Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  /* Driver is AVAILABLE (No allocated deliveries) */
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
                    <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wide">Condutor Disponível</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Sem entregas pendentes alocadas no momento. Exibindo localização GPS em tempo real no mapa.</p>
                      </div>
                    </div>

                    {/* Live GPS Diagnostic Card */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                          <Activity size={12} className="text-emerald-400 animate-pulse" />
                          Telemetria do Condutor
                        </span>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {selectedRider.isGpsRealActive ? 'GPS Real' : 'GPS Simulado'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Velocidade</span>
                          <span className="text-xs font-black font-mono text-white mt-0.5 block">
                            {riderSpeeds[selectedRider.id] || 0} km/h
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Precisão GPS</span>
                          <span className="text-xs font-black font-mono text-emerald-400 mt-0.5 block">
                            ±{selectedRider.gpsAccuracy || 4.2}m
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Bateria</span>
                          <span className="text-xs font-black font-mono text-emerald-400 mt-0.5 block">
                            {selectedRider.batteryPercent}%
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Veículo</span>
                          <span className="text-xs font-black font-mono text-sky-400 mt-0.5 block">
                            {selectedRider.vehicle}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-[9.5px] font-mono text-slate-300">
                        <span className="text-slate-400 block mb-0.5">Coordenadas Atuais:</span>
                        <span className="text-sky-300 font-bold">
                          {getRiderGeoCoords(selectedRider)[0].toFixed(5)}, {getRiderGeoCoords(selectedRider)[1].toFixed(5)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleCenterOnSelectedRider}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                        >
                          <Target size={12} className="text-sky-400" /> Centralizar
                        </button>
                        <button
                          onClick={() => setSelectedTimelineRider(selectedRider)}
                          className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Clock size={12} /> Timeline
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* All Fleet Drivers View */
              <>
                <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <User size={12} className="text-sky-400" />
                    Frota Operacional ({riders.length})
                  </span>
                  <span className="text-[8.5px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {riders.filter(r => r.status !== 'Offline').length} Online
                  </span>
                </div>

                {/* Filter tabs */}
                <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-850 flex items-center gap-1 overflow-x-auto custom-scrollbar">
                  {(['Todos', 'Disponível', 'Em rota', 'Alerta'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer shrink-0 ${
                        statusFilter === st 
                          ? 'bg-sky-600 text-white' 
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {st === 'Todos' ? `Todos (${riders.length})` : st}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {riders
                    .filter(r => statusFilter === 'Todos' || r.status === statusFilter)
                    .map((r) => {
                      const rPending = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado');
                      const isAvailable = rPending.length === 0;
                      const statusDot = isAvailable ? 'bg-emerald-400' :
                                        r.status === 'Em rota' ? 'bg-sky-400' :
                                        r.status === 'Alerta' ? 'bg-rose-400' : 'bg-slate-500';

                      return (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRiderId(r.id)}
                          className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-sky-500 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all shadow-sm group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <img src={r.avatar} alt={r.name} className="w-8.5 h-8.5 rounded-full object-cover border border-slate-700" />
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDot} ring-1 ring-slate-950`}></span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-xs text-white truncate group-hover:text-sky-300 transition-colors">{r.name}</h4>
                              <span className="text-[9px] text-slate-400 font-mono block">
                                {r.vehicle === 'Moto' ? '🏍️ Moto' : '🚲 Bike'} • Bat: {r.batteryPercent}%
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {rPending.length > 0 ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 block font-mono">
                                {rPending.length} {rPending.length === 1 ? 'entrega' : 'entregas'}
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 block font-mono">
                                Disponível
                              </span>
                            )}
                            <span className="text-[8px] text-slate-400 font-bold uppercase block mt-0.5">{r.status}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 2. RIGHT FULL-STAGE INTERACTIVE MAP */}
        <div className="flex-1 relative overflow-hidden bg-slate-950">
          
          {/* Main Leaflet Container */}
          <div key={recalibrateKey} className="w-full h-full relative z-0">
            <SafeMapWrapper>
              <div 
                ref={mapContainerRef} 
                className="w-full h-full" 
                style={{ minHeight: '100%', height: '100%', width: '100%' }}
              />
            </SafeMapWrapper>

            {!leafletLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30">
                <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-xs font-bold text-slate-300">Carregando mapa e telemetria...</span>
              </div>
            )}
          </div>

          {/* Real-time Status Badge (Floating Top Left) */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5">
            {selectedRider ? (
              <div className="bg-slate-950/95 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-white">
                <div className="relative w-3 h-3 flex items-center justify-center">
                  <span className={`w-2 h-2 rounded-full ${riderPendingOrders.length > 0 ? 'bg-sky-400 animate-ping' : 'bg-emerald-400 animate-ping'}`}></span>
                  <span className={`absolute w-2 h-2 rounded-full ${riderPendingOrders.length > 0 ? 'bg-sky-400' : 'bg-emerald-400'}`}></span>
                </div>
                <div className="text-[10px] font-black uppercase font-mono tracking-wider text-slate-200 flex items-center gap-1.5">
                  <span>{selectedRider.name}</span>
                  <span className="text-slate-500">•</span>
                  {riderPendingOrders.length > 0 ? (
                    <span className="text-sky-400">{riderPendingOrders.length} Entregas Alocadas (Rastreio)</span>
                  ) : (
                    <span className="text-emerald-400">Condutor Disponível (Sem Entregas)</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg shadow-xl flex items-center gap-2 text-white">
                <span className={`w-2 h-2 rounded-full ${gpsElapsedSeconds < 30 ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                <span className="text-[9px] font-black uppercase font-mono tracking-wider text-slate-200">
                  {isSimulating ? 'SIMULAÇÃO GPS ATIVA' : 'SINAL GPS AO VIVO'} • TODA A FROTA
                </span>
              </div>
            )}

            {isLoadingRealRoutes && (
              <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg shadow-xl flex items-center gap-1.5 text-white animate-pulse">
                <Navigation size={10} className="text-sky-400 animate-spin" />
                <span className="text-[8.5px] font-black uppercase font-mono text-sky-300">
                  Traçando ruas (OSRM)...
                </span>
              </div>
            )}
          </div>

          {/* Hover / Selection Detail Floating Card (Bottom of Map) */}
          <AnimatePresence>
            {(hoveredOrder || selectedOrder) && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="absolute bottom-3 left-3 right-3 max-w-xl mx-auto bg-slate-950/95 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-20"
              >
                {(() => {
                  const ord = hoveredOrder || selectedOrder!;
                  return (
                    <>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 text-[8px] font-black bg-sky-600 text-white rounded font-mono">
                            #{ord.id.replace('ped-', '').toUpperCase()}
                          </span>
                          <span className="text-[8.5px] font-bold text-slate-400 font-mono">CEP: {ord.cep}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase border ${
                            ord.priority === 'Alta' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                            ord.priority === 'Média' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}>
                            {ord.priority}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-white truncate">{ord.clientName}</h4>
                        <p className="text-[9.5px] text-slate-400 truncate">{ord.address}</p>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-xs font-black text-white font-mono">R$ {ord.value.toFixed(2)}</span>
                        <span className="text-[8.5px] font-black text-sky-400 uppercase tracking-wider">{ord.status}</span>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* 3. TELEMETRY & DIAGNOSIS SLIDE-OVER DRAWER */}
        <AnimatePresence>
          {showTelemetryDrawer && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="absolute top-0 right-0 bottom-0 w-80 bg-slate-950/98 backdrop-blur-md border-l border-slate-800 p-4 flex flex-col z-30 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-sky-400 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Telemetria & Diagnóstico</h3>
                </div>
                <button
                  onClick={() => setShowTelemetryDrawer(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {selectedRider ? (
                  <>
                    {/* Rider details */}
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
                      <div className="text-[10px] font-black uppercase text-slate-400">Condutor em Foco</div>
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>{selectedRider.name}</span>
                        <span className="text-sky-400 font-mono">{selectedRider.vehicle}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-300">
                        Lat/Lng: {getRiderGeoCoords(selectedRider)[0].toFixed(5)}, {getRiderGeoCoords(selectedRider)[1].toFixed(5)}
                      </div>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Precisão GPS</span>
                        <span className="text-xs font-black font-mono text-emerald-400 mt-0.5 block">
                          ±{selectedRider.gpsAccuracy || 5}m
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Tempo do Sinal</span>
                        <span className="text-xs font-black font-mono text-sky-400 mt-0.5 block">
                          {gpsElapsedSeconds < 60 ? `${gpsElapsedSeconds}s atrás` : `${Math.floor(gpsElapsedSeconds / 60)}m atrás`}
                        </span>
                      </div>
                    </div>

                    {/* Timeline button */}
                    <button
                      onClick={() => setSelectedTimelineRider(selectedRider)}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Clock size={12} /> Ver Histórico das 5 Posições
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Selecione um condutor no mapa ou no seletor para ver os diagnósticos em tempo real.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* 4. MODAL: TIMELINE DAS ÚLTIMAS 5 POSIÇÕES DO CONDUTOR */}
      <AnimatePresence>
        {selectedTimelineRider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden text-left"
            >
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <img src={selectedTimelineRider.avatar} alt={selectedTimelineRider.name} className="w-8 h-8 rounded-full object-cover border border-sky-400" />
                  <div>
                    <h3 className="font-black text-xs text-white">{selectedTimelineRider.name}</h3>
                    <span className="text-[9px] text-slate-400 font-mono">Últimas 5 posições de GPS registradas</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTimelineRider(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                {(() => {
                  const points = (locationHistories[selectedTimelineRider.id] || []).slice(0, 5);
                  return points.map((pt, idx) => (
                    <div key={pt.id || idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-mono border-b border-slate-800 pb-1 mb-1.5">
                        <span className="text-sky-400 font-bold">Ponto #{idx + 1} • {pt.timestamp}</span>
                        <span className="text-emerald-400 font-bold">{pt.source}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-300">
                        Coord: {pt.geoLat.toFixed(5)}, {pt.geoLng.toFixed(5)} • Vel: {pt.speedKmH} km/h • Precisão: ±{pt.gpsAccuracy.toFixed(1)}m
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
