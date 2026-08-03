/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DeliveryRider, Order, RiderStatus, OrderStatus, CompanyHub } from '../types';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import DateRangePicker from './DateRangePicker';
import { getSaoPauloDateTimeShort } from '../utils/dateUtils';
import { getCoordinatesFromCep } from '../utils/locationUtils';
import { saveMapCache, getMapCache, MapCachePayload } from '../utils/mapCacheService';
import SafeMapWrapper from './SafeMapWrapper';
import { initLeafletPosGuard } from '../utils/leafletPatch';
import { 
  Search, 
  MapPin, 
  Phone, 
  Battery, 
  Smartphone, 
  Navigation, 
  Clock, 
  Package, 
  Compass, 
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  User,
  ExternalLink,
  Map as MapIcon,
  CheckCircle2,
  TrendingUp,
  Layers,
  Wifi,
  WifiOff,
  Share2,
  Send,
  Terminal,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  Globe,
  X,
  ChevronDown,
  HardDrive,
  Database,
  Target,
  Activity,
  ShieldAlert,
  Radio,
  Zap,
  Crosshair
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

interface TelemetryLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'gps';
}

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

export default function RiderTrackingView({ riders, orders, onUpdateRiderCoords, onUpdateOrderStatus, activeHub }: RiderTrackingViewProps) {
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectedTimelineRider, setSelectedTimelineRider] = useState<DeliveryRider | null>(null);
  const [locationHistories, setLocationHistories] = useState<Record<string, RiderLocationPoint[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredOrder, setHoveredOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('openstreetmap');
  const [copiedRiderId, setCopiedRiderId] = useState<string | null>(null);
  const [recalibrateKey, setRecalibrateKey] = useState<number>(0);

  // Delivery Period Filter
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

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
      
      if (matchesRider) {
        matchesDate = true;
      }
      
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

    const timeNow = new Date().toLocaleTimeString();
    setTelemetryLogs(prev => [
      ...prev,
      { id: String(Date.now()), time: timeNow, message: `Sequência de entregas alterada para o condutor.`, type: 'info' }
    ]);
  };
  
  // Route individual visibility filters
  const [visibleRoutes, setVisibleRoutes] = useState<Record<string, boolean>>({});
  const [showRoutesDropdown, setShowRoutesDropdown] = useState(false);
  
  // Mini Fleet status filtering state
  const [statusFilter, setStatusFilter] = useState<RiderStatus | 'Todos'>('Todos');

  const hubLatLng = (activeHub ? [activeHub.lat, activeHub.lng] : [-23.5385556, -46.70118]) as [number, number];

  const getRiderRouteColor = (rId: string, isSelected: boolean) => {
    if (isSelected) return '#3b82f6'; // Bright default blue for selected
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

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isFullscreen]);

  const handleFullscreenToggle = () => {
    const element = document.getElementById('map-container');
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
  const [lastPingTime, setLastPingTime] = useState<Record<string, string>>({});
  const [pingCounters, setPingCounters] = useState<Record<string, number>>({});
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>([]);

  // Live GPS Telemetry Elapsed Timer State
  const [lastGpsUpdateTimestamp, setLastGpsUpdateTimestamp] = useState<number>(Date.now());
  const [gpsElapsedSeconds, setGpsElapsedSeconds] = useState<number>(0);

  // Reset elapsed timer when selected rider changes or when a new GPS ping occurs
  useEffect(() => {
    setLastGpsUpdateTimestamp(Date.now());
    setGpsElapsedSeconds(0);
  }, [selectedRiderId, lastPingTime[selectedRiderId || '']]);

  // Tick live elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setGpsElapsedSeconds(Math.floor((Date.now() - lastGpsUpdateTimestamp) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastGpsUpdateTimestamp]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Leaflet Interactive Map State & Refs
  const [leafletLoaded, setLeafletLoaded] = useState(!!(window as any).L);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routesGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const lastFittedRiderIdRef = useRef<string | null>(null);
  const riderMarkersRef = useRef<Record<string, any>>({});

  // Helper to calculate coordinates for an order
  const getOrderCoords = (order: Order) => {
    let bx = 500;
    let by = 300;
    
    if (order.region === 'Centro') { bx = 450; by = 240; }
    else if (order.region === 'Zona Sul') { bx = 560; by = 450; }
    else if (order.region === 'Zona Oeste') { bx = 220; by = 340; }
    else if (order.region === 'Zona Norte') { bx = 650; by = 130; }

    // Add deterministic jitter based on order ID so multiple orders in the same region don't overlap
    const idNum = parseInt(order.id.replace(/\D/g, '') || '0', 10) || 1;
    const jitterX = ((idNum % 7) - 3) * 22; // -66 to +66 px
    const jitterY = ((idNum % 5) - 2) * 22; // -44 to +44 px

    return { x: bx + jitterX, y: by + jitterY };
  };

  // Get current simulated coordinates for the selected rider
  const getRiderCoords = (rider: DeliveryRider) => {
    const offset = simulationOffsets[rider.id] || { latOffset: 0, lngOffset: 0 };
    const lat = rider.lat + offset.latOffset;
    const lng = rider.lng + offset.lngOffset;
    
    // Map percentages (lng, lat) to SVG coordinates (1000 x 600)
    return {
      x: (lng / 100) * 1000,
      y: (lat / 100) * 600
    };
  };

  // Convert map percentages / SVG coordinates to real latitude and longitude
  const convertToGeoLat = (svgLatPercent: number) => -23.52 - (svgLatPercent / 100) * 0.12;
  const convertToGeoLng = (svgLngPercent: number) => -46.72 + (svgLngPercent / 100) * 0.18;

  const getOrderGeoCoords = (order: Order) => {
    const coords = getCoordinatesFromCep(order.cep, order.region, order.address, order.lat, order.lng);
    return [coords.lat, coords.lng] as [number, number];
  };

  const getRiderGeoCoords = (rider: DeliveryRider) => {
    let baseLat: number;
    let baseLng: number;

    if (rider.isGpsRealActive && rider.realGeoLat !== undefined && rider.realGeoLng !== undefined) {
      baseLat = rider.realGeoLat;
      baseLng = rider.realGeoLng;
    } else if (rider.realGeoLat !== undefined && rider.realGeoLng !== undefined && rider.realGeoLat < -10) {
      baseLat = rider.realGeoLat;
      baseLng = rider.realGeoLng;
    } else if (rider.lat < -10) {
      baseLat = rider.lat;
      baseLng = rider.lng;
    } else {
      baseLat = convertToGeoLat(rider.lat);
      baseLng = convertToGeoLng(rider.lng);
    }

    const offset = simulationOffsets[rider.id];
    if (offset) {
      const latDelta = offset.latOffset * -0.0008;
      const lngDelta = offset.lngOffset * 0.0012;
      return [baseLat + latDelta, baseLng + lngDelta] as [number, number];
    }

    return [baseLat, baseLng] as [number, number];
  };

  // Haversine formula to calculate distance in km between two geo coordinates
  const getHaversineDistance = (coords1: [number, number], coords2: [number, number]) => {
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    const R = 6371; // Earth's radius in km
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

  // Maintain location history for each rider (up to 10 points, top 5 used in timeline)
  useEffect(() => {
    if (!riders || riders.length === 0) return;

    setLocationHistories(prevHistories => {
      const nextHistories = { ...prevHistories };
      let hasChanges = false;

      riders.forEach(rider => {
        const coords = getRiderGeoCoords(rider);
        const existing = nextHistories[rider.id] || [];

        if (existing.length === 0) {
          // Initialize 5 recent sample points for this rider backwards in time
          const nowMs = Date.now();
          const initialPoints: RiderLocationPoint[] = [];

          for (let i = 0; i < 5; i++) {
            const timeOffsetMs = i * 45 * 1000; // 45 seconds per step
            const timeStr = new Date(nowMs - timeOffsetMs).toLocaleTimeString();
            // Slight back-movement for older points to create a realistic path
            const latJitter = i * -0.0006;
            const lngJitter = i * -0.0008;

            initialPoints.push({
              id: `init-${rider.id}-${i}`,
              timestamp: i === 0 ? (rider.lastGpsUpdate || timeStr) : timeStr,
              geoLat: coords[0] + latJitter,
              geoLng: coords[1] + lngJitter,
              gpsAccuracy: rider.gpsAccuracy || (3.5 + i * 0.5),
              speedKmH: riderSpeeds[rider.id] || Math.max(15, 42 - i * 3),
              batteryPercent: rider.batteryPercent || 88,
              source: rider.isGpsRealActive ? 'GPS Celular Live' : 'Sinal Satélite GPRS'
            });
          }

          nextHistories[rider.id] = initialPoints;
          hasChanges = true;
        } else {
          // Check if latest position changed from previous recorded point
          const lastRecorded = existing[0];
          const distToLast = calcDistKm(lastRecorded.geoLat, lastRecorded.geoLng, coords[0], coords[1]);

          if (distToLast > 0.005) { // more than 5 meters movement
            const newPoint: RiderLocationPoint = {
              id: `pt-${rider.id}-${Date.now()}`,
              timestamp: rider.lastGpsUpdate || new Date().toLocaleTimeString(),
              geoLat: coords[0],
              geoLng: coords[1],
              gpsAccuracy: rider.gpsAccuracy || 4,
              speedKmH: riderSpeeds[rider.id] || 38,
              batteryPercent: rider.batteryPercent || 85,
              source: rider.isGpsRealActive ? 'GPS Celular Live' : 'Sinal Satélite GPRS'
            };

            nextHistories[rider.id] = [newPoint, ...existing].slice(0, 10);
            hasChanges = true;
          }
        }
      });

      return hasChanges ? nextHistories : prevHistories;
    });
  }, [riders, riderSpeeds]);

  // Generates a beautiful realistic street routing path following blocks
  const getStreetRoutePoints = (from: [number, number], to: [number, number], seedId: string): [number, number][] => {
    const [lat1, lng1] = from;
    const [lat2, lng2] = to;
    
    const points: [number, number][] = [from];
    // Hash seedId to make the routing deterministic for a specific order/rider pair
    const seed = seedId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    
    // We create a zig-zag route to simulate street grid
    const steps = 4;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      let lat, lng;
      if (i % 2 === 1) {
        lat = lat1 + (lat2 - lat1) * t;
        // Jitter creates grid turns that look like streets instead of a single diagonal straight line
        const jitter = Math.sin(seed + i) * 0.0006;
        lng = lng1 + (lng2 - lng1) * t + jitter;
      } else {
        lng = lng1 + (lng2 - lng1) * t;
        const jitter = Math.cos(seed + i) * 0.0006;
        lat = lat1 + (lat2 - lat1) * t + jitter;
      }
      points.push([lat, lng]);
    }
    
    points.push(to);
    return points;
  };

  // Calculate cumulative distance along a street polyline
  const getStreetRouteDistance = (points: [number, number][]) => {
    let totalDist = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDist += getHaversineDistance(points[i], points[i + 1]);
    }
    return totalDist;
  };

  const getRiderAverageSpeedKmMin = (rider: DeliveryRider) => {
    // If vehicle is Moto, average 30 km/h = 0.5 km/min.
    // If Bike, average 15 km/h = 0.25 km/min.
    return rider.vehicle === 'Moto' ? 0.5 : 0.25;
  };

  // Calculate optimal sequence starting ALWAYS from Hub Central (CD), nearest to farthest
  const calculateHubNearestSequence = (pendingOrders: Order[], startLatLng: [number, number]): Order[] => {
    if (pendingOrders.length === 0) return [];
    const pending = [...pendingOrders];
    const result: Order[] = [];
    let currentLatLng = startLatLng;

    while (pending.length > 0) {
      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < pending.length; i++) {
        const orderLatLng = getOrderGeoCoords(pending[i]);
        const dist = getHaversineDistance(currentLatLng, orderLatLng);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      const nextOrder = pending.splice(closestIdx, 1)[0];
      result.push(nextOrder);
      currentLatLng = getOrderGeoCoords(nextOrder);
    }

    return result;
  };

  // Get route calculations for all pending orders of the selected rider starting from Hub Central
  const getRiderRouteMetrics = (rider: DeliveryRider, pendingOrders: Order[]) => {
    if (!rider || pendingOrders.length === 0) return [];
    
    // Independent of driver's current position: route metrics always start at Central Hub
    const startLatLng = hubLatLng;
    const speed = getRiderAverageSpeedKmMin(rider);
    const stopHandlingTime = 5; // 5 minutes stop time per order

    const metrics: Array<{
      orderId: string;
      distanceFromPrevious: number; // km from previous point
      cumulativeDistance: number; // km from central hub
      etaMinutes: number; // minutes from central hub departure
    }> = [];

    let currentLatLng = startLatLng;
    let accumulatedTime = 0;
    let accumulatedDistance = 0;

    pendingOrders.forEach((order, index) => {
      const orderLatLng = getOrderGeoCoords(order);
      const streetPoints = getStreetRoutePoints(currentLatLng, orderLatLng, order.id);
      const segmentDistance = getStreetRouteDistance(streetPoints);
      
      accumulatedDistance += segmentDistance;
      const travelTime = segmentDistance / speed;
      
      if (index > 0) {
        accumulatedTime += stopHandlingTime;
      }
      accumulatedTime += travelTime;

      metrics.push({
        orderId: order.id,
        distanceFromPrevious: segmentDistance,
        cumulativeDistance: accumulatedDistance,
        etaMinutes: Math.max(2, Math.round(accumulatedTime)), // at least 2 minutes ETA
      });

      // Update current point to this order
      currentLatLng = orderLatLng;
    });

    return metrics;
  };

  const handleCenterOnSelectedRider = () => {
    if (!mapInstanceRef.current || !selectedRider) return;
    const map = mapInstanceRef.current;
    const riderLatLng = getRiderGeoCoords(selectedRider);
    map.setView(riderLatLng, 16, { animate: true });
  };

  const handleRecalibrateMap = () => {
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (err) {
        // Suppress Leaflet cleanup error
      }
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersGroupRef.current = null;
      routesGroupRef.current = null;
    }

    // Re-apply position guards and increment key to force clean re-mount of map DOM element
    initLeafletPosGuard();
    setRecalibrateKey(prev => prev + 1);

    const timeNow = new Date().toLocaleTimeString();
    setTelemetryLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        time: timeNow,
        message: '🔄 Mapa recalibrado com sucesso. Instâncias e cache de posição do Leaflet foram limpos.',
        type: 'info'
      }
    ]);
  };

  // Filter riders list: search term and status filter
  const filteredRiders = riders.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = r.name.toLowerCase().includes(term) || r.vehicle.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'Todos' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedRider = riders.find(r => r.id === selectedRiderId);

  // GET ALL PENDING ORDERS FOR THIS RIDER (filtered by date range)
  const rawRiderPendingOrders = useMemo(() => {
    if (!selectedRiderId) return [];
    return orders.filter(o => {
      const matchesRider = o.riderId === selectedRiderId;
      const matchesStatus = o.status !== 'Concluído' && o.status !== 'Cancelado';
      
      let matchesDate = true;
      if (filterDateFrom && o.date < filterDateFrom) matchesDate = false;
      if (filterDateTo && o.date > filterDateTo) matchesDate = false;
      
      if (matchesRider) {
        matchesDate = true;
      }
      
      return matchesRider && matchesStatus && matchesDate;
    });
  }, [selectedRiderId, orders, filterDateFrom, filterDateTo]);

  const riderPendingOrders = useMemo(() => {
    if (!selectedRiderId || rawRiderPendingOrders.length === 0) return [];
    const seq = customOrderSequences[selectedRiderId];
    if (seq && seq.length > 0) {
      return [...rawRiderPendingOrders].sort((a, b) => {
        const indexA = seq.indexOf(a.id);
        const indexB = seq.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    return calculateHubNearestSequence(rawRiderPendingOrders, hubLatLng);
  }, [selectedRiderId, rawRiderPendingOrders, customOrderSequences, hubLatLng]);

  const routeMetrics = selectedRider ? getRiderRouteMetrics(selectedRider, riderPendingOrders) : [];

  // Load Leaflet dynamically from CDN - Now pre-loaded in index.html, with a safe fallback watcher
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const interval = setInterval(() => {
      if ((window as any).L) {
        setLeafletLoaded(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Clean up Leaflet Map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Leaflet base map configuration and style
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;

    if (!mapInstanceRef.current) {
      // São Paulo Hub Center coords: -23.5505, -46.6333
      const map = L.map(mapContainerRef.current, {
        center: [-23.5505, -46.6333],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);
      mapInstanceRef.current = map;

      markersGroupRef.current = L.layerGroup().addTo(map);
      routesGroupRef.current = L.layerGroup().addTo(map);

      // Call invalidate size after a small delay to fix initial rendering dimension issues
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    let tileAttribution = '&copy; OpenStreetMap contributors &copy; CARTO';

    if (mapStyle === 'dark-vinimap') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileAttribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else if (mapStyle === 'openstreetmap') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileAttribution = '&copy; OpenStreetMap contributors';
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19,
    }).addTo(map);

    // Initial center on activeHub if available
    if (activeHub) {
      map.setView([activeHub.lat, activeHub.lng], 13);
    }
  }, [leafletLoaded, mapStyle]);

  // Center the map on activeHub whenever activeHub changes
  useEffect(() => {
    if (leafletLoaded && mapInstanceRef.current && activeHub) {
      mapInstanceRef.current.setView([activeHub.lat, activeHub.lng], 13);
    }
  }, [leafletLoaded, activeHub?.id, activeHub?.lat, activeHub?.lng]);

  // Sync Markers and Connections to the Map Group
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;

    const L = (window as any).L;
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    const routesGroup = routesGroupRef.current;

    if (!markersGroup || !routesGroup) return;

    // Force size invalidation to fix Leaflet rendering glitches
    try {
      map.invalidateSize();
      if (map.closePopup) map.closePopup();

      // Clear non-rider layers from markersGroup (orders, hub, etc.)
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

    // Hub Central CD Coords
    bounds.push(hubLatLng);

    const hubIcon = L.divIcon({
      className: 'custom-hub-icon-leaflet',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full bg-blue-500/20 animate-ping pointer-events-none"></div>
          <div class="w-7 h-7 rounded-full bg-slate-900 border-2 border-white shadow-xl overflow-hidden flex items-center justify-center p-0.5">
            <img src="${activeHub?.logoUrl || vinimapLogo}" class="w-full h-full object-cover rounded-full" />
          </div>
          <div class="absolute -top-7 whitespace-nowrap bg-slate-900 border border-slate-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-lg text-blue-400">
            ${activeHub ? activeHub.name.toUpperCase() : 'BASE VINIMAP (SEDE)'}
          </div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker(hubLatLng, { icon: hubIcon }).addTo(markersGroup);

    // Render ALL riders and their respective toggleable routes
    riders.forEach((rider) => {
      if (statusFilter !== 'Todos' && rider.status !== statusFilter) return;

      // Filter: if a specific driver is selected, show only that driver and their allocated orders on the map
      if (selectedRiderId && rider.id !== selectedRiderId) {
        return;
      }

      activeRiderIdsInView.add(rider.id);
      const riderLatLng = getRiderGeoCoords(rider);
      const isRiderSelected = rider.id === selectedRiderId;
      const isRouteVisible = visibleRoutes[rider.id] !== false;

      // Only add to zoom bounds if it is the selected rider or if no specific rider is selected to fit the map view properly
      if (isRiderSelected || !selectedRiderId) {
        bounds.push(riderLatLng);
      }

      // Draw rider marker
      const statusColor = rider.status === 'Disponível' ? '#10b981' :
                          rider.status === 'Em rota' ? '#3b82f6' :
                          rider.status === 'Alerta' ? '#f43f5e' : '#94a3b8';

      const riderIcon = L.divIcon({
        className: 'custom-rider-icon-leaflet',
        html: `
          <div class="relative w-12 h-12 flex items-center justify-center cursor-pointer group" title="${rider.name} (${rider.vehicle})">
            ${isRiderSelected ? `<div class="absolute inset-0 rounded-full bg-blue-500/35 animate-ping pointer-events-none"></div>` : ''}
            <div class="relative w-10 h-10 rounded-full bg-slate-900 border-2 shadow-2xl flex items-center justify-center p-0.5 transition-all" style="border-color: ${isRiderSelected ? '#3b82f6' : statusColor}">
              <img src="${rider.avatar}" alt="${rider.name}" class="w-full h-full rounded-full object-cover" />
              <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-[8px] shadow-md font-bold">
                ${rider.vehicle === 'Moto' ? '🏍️' : '🚲'}
              </span>
            </div>
            <!-- Condutor Hover Name Badge -->
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
        // Smooth position glide via setLatLng (animated by CSS transition)
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
          setTimeout(() => {
            setSelectedRiderId(rider.id);
          }, 0);
        });

        riderMarkersRef.current[rider.id] = riderMarker;
      }


      // Get pending orders for this rider
      const rawPendingOrders = orders.filter(o => {
        const matchesRider = o.riderId === rider.id;
        const matchesStatus = o.status !== 'Concluído' && o.status !== 'Cancelado';
        
        let matchesDate = true;
        if (filterDateFrom && o.date < filterDateFrom) matchesDate = false;
        if (filterDateTo && o.date > filterDateTo) matchesDate = false;
        
        if (matchesRider) {
          matchesDate = true;
        }
        
        return matchesRider && matchesStatus && matchesDate;
      });

      // Sort according to custom sequence chosen by the driver, or default to Central Hub nearest-to-farthest sequence
      const seq = customOrderSequences[rider.id];
      let rPendingOrders: Order[] = [];

      if (seq && seq.length > 0) {
        rPendingOrders = [...rawPendingOrders].sort((a, b) => {
          const indexA = seq.indexOf(a.id);
          const indexB = seq.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      } else {
        rPendingOrders = calculateHubNearestSequence(rawPendingOrders, hubLatLng);
      }

      // If route display is checked for this driver
      if (isRouteVisible) {
        let currentLatLng = hubLatLng;
        const routeColor = getRiderRouteColor(rider.id, isRiderSelected);

        // Sequence of pending orders starting from Base (CD)
        rPendingOrders.forEach((order, orderIndex) => {
          const orderLatLng = getOrderGeoCoords(order);
          if (isRiderSelected) {
            bounds.push(orderLatLng);
          }

          const isHovered = hoveredOrder?.id === order.id;
          const isSelected = selectedOrder?.id === order.id;

          const streetPoints = getStreetRoutePoints(currentLatLng, orderLatLng, order.id);

          // Ambient glow backdrop shadow path
          L.polyline(streetPoints, {
            color: routeColor,
            weight: isHovered || isSelected || isRiderSelected ? 8 : 4,
            opacity: isHovered || isSelected || isRiderSelected ? 0.35 : 0.15,
          }).addTo(routesGroup);

          // Core sharp street path
          L.polyline(streetPoints, {
            color: routeColor,
            weight: isHovered || isSelected || isRiderSelected ? 3.5 : 2,
            opacity: isHovered || isSelected || isRiderSelected ? 0.95 : 0.65,
            dashArray: isSimulating ? '3, 4' : 'none',
          }).addTo(routesGroup);

          // Place order marker (Show Parada # instead of order number)
          let pinColor = '#3b82f6'; // blue
          if (order.priority === 'Alta') pinColor = '#f43f5e'; // rose
          else if (order.priority === 'Média') pinColor = '#f59e0b'; // amber

          const pinIcon = L.divIcon({
            className: 'custom-order-pin-leaflet',
            html: `
              <div class="relative flex flex-col items-center cursor-pointer">
                <div class="bg-slate-900/90 border text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-md mb-1 whitespace-nowrap flex items-center gap-1 font-sans" style="border-color: ${routeColor}">
                  <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${pinColor}"></span>
                  <span>Parada #${orderIndex + 1}</span>
                </div>
                <div class="relative flex items-center justify-center">
                  <div class="absolute w-8 h-8 rounded-full ${isHovered || isSelected ? 'bg-slate-300/35 scale-125' : 'bg-slate-300/15'} transition-all duration-300 animate-pulse pointer-events-none"></div>
                  <svg width="26" height="30" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-lg relative">
                    <path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 28 12 28C12 28 24 21 24 12C24 5.37258 18.6274 0 12 0Z" fill="${pinColor}" stroke="${routeColor}" stroke-width="2"/>
                    <circle cx="12" cy="11" r="7.5" fill="#ffffff" />
                    <text x="12" y="14" text-anchor="middle" fill="#0f172a" font-size="9" font-weight="900">${orderIndex + 1}</text>
                  </svg>
                </div>
              </div>
            `,
            iconSize: [60, 65],
            iconAnchor: [30, 48]
          });

          const orderMarker = L.marker(orderLatLng, { icon: pinIcon }).addTo(markersGroup);

          orderMarker.bindTooltip(`
            <div class="p-1 font-sans text-left">
              <div class="font-black text-slate-900 text-xs">Parada #${orderIndex + 1}</div>
              <div class="font-bold text-slate-700 text-[11px]">${order.clientName}</div>
              <div class="text-[10px] text-slate-500">${order.address}</div>
            </div>
          `, { direction: 'top', offset: [0, -42] });

          orderMarker.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            setTimeout(() => {
              setSelectedOrder(order);
            }, 0);
          });
          orderMarker.on('mouseover', () => {
            setTimeout(() => {
              setHoveredOrder(order);
            }, 0);
          });
          orderMarker.on('mouseout', () => {
            setTimeout(() => {
              setHoveredOrder(null);
            }, 0);
          });

          currentLatLng = orderLatLng;
        });

        // Tracker line: Connect the rider's live position to their first/next destination (or Hub if none)
        const trackerTargetLatLng = rPendingOrders.length > 0 ? getOrderGeoCoords(rPendingOrders[0]) : hubLatLng;
        const riderToTargetPoints = getStreetRoutePoints(riderLatLng, trackerTargetLatLng, rider.id + '_tracker');
        L.polyline(riderToTargetPoints, {
          color: routeColor,
          weight: isRiderSelected ? 3 : 1.5,
          opacity: 0.65,
          dashArray: '5, 5',
        }).addTo(routesGroup);
      }
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

    if (bounds.length > 0 && map && selectedRiderId !== lastFittedRiderIdRef.current) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      lastFittedRiderIdRef.current = selectedRiderId || null;
    }
  }, [
    leafletLoaded, 
    selectedRiderId, 
    orders, 
    simulationOffsets, 
    hoveredOrder, 
    selectedOrder, 
    isSimulating, 
    customOrderSequences, 
    visibleRoutes,
    filterDateFrom,
    filterDateTo
  ]);


  // Reset selected order if selected rider changes
  useEffect(() => {
    setSelectedOrder(null);
    setHoveredOrder(null);
  }, [selectedRiderId]);

  // Add initial telemetry logs
  useEffect(() => {
    const timeNow = new Date().toLocaleTimeString();
    setTelemetryLogs([
      { id: '1', time: timeNow, message: 'Terminal de Monitoramento Vinimap V2 inicializado.', type: 'info' },
      { id: '2', time: timeNow, message: 'Serviço de Geolocalização GPS ativo e escutando conexões.', type: 'success' },
      { id: '3', time: timeNow, message: 'Rede de dados móveis estabelecida com 4 frotas ativas.', type: 'info' }
    ]);
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [telemetryLogs]);

  // Simulate rider movement and telemetry data
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const timestampNow = new Date().toLocaleTimeString();
      const newSpeeds: Record<string, number> = {};
      const newPings: Record<string, string> = {};

      setSimulationOffsets(prev => {
        const nextOffsets = { ...prev };

        riders.forEach(rider => {
          if (rider.status === 'Offline') return;

          const current = nextOffsets[rider.id] || { latOffset: 0, lngOffset: 0 };

          // Random slight drift to simulate courier moving through streets
          const stepLat = (Math.random() - 0.5) * 0.9;
          const stepLng = (Math.random() - 0.5) * 0.9;

          const newLatOffset = Math.min(6, Math.max(-6, current.latOffset + stepLat));
          const newLngOffset = Math.min(6, Math.max(-6, current.lngOffset + stepLng));

          nextOffsets[rider.id] = { latOffset: newLatOffset, lngOffset: newLngOffset };

          // Randomize speed fluctuation
          const speed = Math.floor(25 + Math.random() * 32); // 25 to 57 km/h
          newSpeeds[rider.id] = speed;

          // Update last transmission timestamp
          newPings[rider.id] = timestampNow;

          // Propagate coords
          if (onUpdateRiderCoords) {
            const finalLat = Math.min(95, Math.max(5, rider.lat + stepLat));
            const finalLng = Math.min(95, Math.max(5, rider.lng + stepLng));
            const realLat = convertToGeoLat(finalLat);
            const realLng = convertToGeoLng(finalLng);
            setTimeout(() => {
              onUpdateRiderCoords(rider.id, finalLat, finalLng, realLat, realLng, 5, 'Agora mesmo (Em Rota)', true);
            }, 0);
          }
        });

        return nextOffsets;
      });

      setRiderSpeeds(prev => ({ ...prev, ...newSpeeds }));
      setLastPingTime(prev => ({ ...prev, ...newPings }));
      setPingCounters(prev => {
        const nextCounters = { ...prev };
        Object.keys(newSpeeds).forEach(id => {
          nextCounters[id] = (nextCounters[id] || 0) + 1;
        });
        return nextCounters;
      });

      // Add a random simulation telemetry log
      const activeRiders = riders.filter(r => r.status !== 'Offline');
      if (activeRiders.length > 0) {
        const randomRider = activeRiders[Math.floor(Math.random() * activeRiders.length)];
        const speedVal = newSpeeds[randomRider.id] || 42;
        const randomMessages = [
          `Sinal GPS ativo de ${randomRider.name} - Vel: ${speedVal}km/h | Bat: ${randomRider.batteryPercent}%`,
          `Atualização de tráfego recebida da rota de ${randomRider.name}`,
          `Ping de presença recebido: ${randomRider.name} está em movimento`,
          `Status de bateria de ${randomRider.name}: ${randomRider.batteryPercent}% (${randomRider.batteryPercent < 25 ? 'ALERTA' : 'OK'})`
        ];
        const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
        const logType = randomMessage.includes('ALERTA') ? 'warn' : 'gps';

        setTelemetryLogs(prevLogs => [
          ...prevLogs.slice(-25), // Limit log array to last 26 entries to preserve memory
          { id: String(Date.now()), time: timestampNow, message: randomMessage, type: logType }
        ]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulating, riders, onUpdateRiderCoords]);

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'Média': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Em rota': return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'Disponível': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Alerta': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const handleResetSimulation = () => {
    setSimulationOffsets({});
    setRiderSpeeds({});
    setLastPingTime({});
    setPingCounters({});
    setIsSimulating(false);
    
    const timeNow = new Date().toLocaleTimeString();
    setTelemetryLogs(prev => [
      ...prev,
      { id: String(Date.now()), time: timeNow, message: 'Simulação de GPS reiniciada para posições de fábrica.', type: 'info' }
    ]);
  };

  const copyTrackingLink = (rider: DeliveryRider) => {
    const mockUrl = `https://digital.vinimap.com.br/rastreio/v2/condutor.aspx?id=14d9340a-39f9-4cab-8aaa-0dd62ab9d1fa&rider=${rider.id}`;
    navigator.clipboard.writeText(mockUrl);
    setCopiedRiderId(rider.id);
    
    const timeNow = new Date().toLocaleTimeString();
    setTelemetryLogs(prev => [
      ...prev,
      { id: String(Date.now()), time: timeNow, message: `Link de rastreamento copiado para o condutor ${rider.name}.`, type: 'success' }
    ]);

    setTimeout(() => {
      setCopiedRiderId(null);
    }, 2500);
  };

  // Generate dynamic WhatsApp link
  const getWhatsAppLink = (rider: DeliveryRider, order?: Order) => {
    const text = order
      ? `Olá ${rider.name}, aqui é da equipe de logística. Por favor, verifique o andamento do pedido ${order.id.toUpperCase()} destinado a ${order.clientName} (${order.address}). Link de rastreio: https://digital.vinimap.com.br/rastreio/v2/condutor.aspx?rider=${rider.id}`
      : `Olá ${rider.name}, enviando o link oficial do painel de rastreamento Vinimap para acompanhamento da sua jornada hoje: https://digital.vinimap.com.br/rastreio/v2/condutor.aspx?rider=${rider.id}`;
    
    return `https://api.whatsapp.com/send?phone=${rider.phone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6" id="vinimap-rider-tracking-view">
      {/* Leaflet override style to prevent white box background on divIcons */}
      <style>{`
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
        #map-container:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          border-radius: 0 !important;
          border: none !important;
          background-color: #f8fafc !important;
        }
        /* Custom styled scrollbars for timeline */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      
      {/* Top Header Panel */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xl border border-slate-700/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] font-black bg-sky-600 text-white rounded-md tracking-wider uppercase">
              Modelo Integrado Vinimap V2
            </span>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sincronização Ativa</span>
            </div>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Compass className="text-sky-400 animate-spin-slow" size={22} />
            <span>Módulo de Rastreamento de Condutores</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Simulador de visualização pública baseado no padrão nacional <span className="text-sky-300 font-semibold font-mono">digital.vinimap.com.br/rastreio</span>. Monitore rotas, posições instantâneas por satélite e o roteiro de entrega de cada condutor.
          </p>
        </div>

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* GPS Simulator Actions */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-1 flex items-center gap-2 shrink-0 shadow-inner">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isSimulating 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow'
              }`}
            >
              {isSimulating ? <Pause size={13} /> : <Play size={13} />}
              <span>{isSimulating ? 'Pausar Satélite' : 'Transmitir GPS'}</span>
            </button>

            {Object.keys(simulationOffsets).length > 0 && (
              <button
                onClick={handleResetSimulation}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Resetar Coordenadas"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Structural Grid */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* PANEL 1: TOP PANEL - RASTREAMENTO OPERACIONAL */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Col: Header info */}
            <div className="flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    <User size={13} className="text-slate-500" />
                    <span>Rastreamento Operacional</span>
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded-full font-mono">
                    Ativo
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Controle, monitoramento e localização de condutores em tempo real.
                </p>
              </div>

              {/* Connection Stats */}
              <div className="hidden md:flex items-center gap-4 text-[10px] text-slate-400 font-medium pt-3 border-t border-slate-100">
                <div className="flex gap-1.5">
                  <span>Frequência GPS:</span>
                  <span className="font-bold text-slate-600">GPRS 4G LTE</span>
                </div>
                <div className="flex gap-1.5">
                  <span>Servidor:</span>
                  <span className="font-mono font-bold text-slate-600">sinal.vinimap.com.br</span>
                </div>
              </div>
            </div>

            {/* Right Col: Dropdown & Selector */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-80">
              {/* Caixa Dropdown para Seleção de Condutor */}
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3.5 space-y-1.5 shadow-sm w-full">
                <label htmlFor="vinimap-rider-select-dropdown" className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <User size={11} className="text-sky-650" />
                  <span>Selecionar Condutor para Rastreio</span>
                </label>
                <div className="relative">
                  <select
                    id="vinimap-rider-select-dropdown"
                    value={selectedRiderId || 'todos'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedRiderId(value === 'todos' ? null : value);
                    }}
                    className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-250 hover:border-sky-400 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-500 transition-all cursor-pointer appearance-none shadow-sm"
                  >
                    <option value="todos">🌍 Todos os Condutores</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.vehicle === 'Moto' ? '🏍️' : '🚲'} {r.name} ({r.status})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2 & 3: MAIN DYNAMIC VINIMAP SITE WRAPPER */}
        <div className="flex flex-col gap-4 w-full">
          
          {/* HIGH FIDELITY SIMULATED BROWSER WINDOW */}
          <div className="bg-white border border-slate-350 rounded-2xl shadow-xl flex flex-col overflow-hidden h-[740px]">
            
            {/* 1. Browser Chrome Frame Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-4 shrink-0 select-none">
              {/* Window Controls */}
              <div className="flex gap-1.5 shrink-0">
                <div className="w-3 h-3 rounded-full bg-rose-450 border border-rose-500/20"></div>
                <div className="w-3 h-3 rounded-full bg-amber-450 border border-amber-500/20"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-450 border border-emerald-500/20"></div>
              </div>

              {/* Address bar mockup */}
              <div className="flex-1 bg-white border border-slate-250 rounded-lg px-3 py-1 flex items-center justify-between gap-3 text-[11px] text-slate-500 font-mono shadow-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-emerald-650 font-bold">https://</span>
                  <span className="text-slate-800 font-semibold">digital.vinimap.com.br</span>
                  <span className="text-slate-400">/rastreio/v2/condutor.aspx?id={selectedRider?.id || 'null'}&token=vinimap_9h3s</span>
                </div>
                <button 
                  onClick={() => {
                    const timeNow = new Date().toLocaleTimeString();
                    setTelemetryLogs(prev => [
                      ...prev,
                      { id: String(Date.now()), time: timeNow, message: 'Simulação de recarregamento da página pública de condutor.', type: 'info' }
                    ]);
                  }}
                  className="hover:text-sky-600 text-slate-400 transition-colors cursor-pointer shrink-0"
                  title="Recarregar Rastreio"
                >
                  <RefreshCw size={11} className={isSimulating ? "animate-spin-slow" : ""} />
                </button>
              </div>

              {/* Real World Browser Indicator badge */}
              <div className="hidden sm:flex items-center gap-1 bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-md border border-sky-100 text-[9px] font-black uppercase tracking-wider">
                <Globe size={10} /> Link Público
              </div>
            </div>

            {/* 2. Simulated Web Page Body Container */}
            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
              
              {/* Inner Branded Header (Vinimap tracking brand) */}
              <div className="bg-white border-b border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
                {/* Brand Logo and Title */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white font-black text-sm tracking-tight shadow-md">
                    VM
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 tracking-wider uppercase font-sans">
                      Vinimap Rastreamento
                    </h4>
                    <span className="text-[8.5px] text-slate-400 uppercase tracking-widest block font-bold font-mono">
                      Acompanhamento de Entrega em Tempo Real
                    </span>
                  </div>
                </div>

                {/* Live Connected Indicator */}
                <div className="flex items-center gap-2">
                  {selectedRider && (
                    <div className="bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                      Status: {selectedRider.status === 'Offline' ? 'Offline' : 'Em Trânsito'}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                    <Clock size={10} /> {getSaoPauloDateTimeShort().split(' ')[1]}
                  </div>
                </div>
              </div>

              {/* Driver Summary Profile Bar inside the Page */}
              {selectedRider ? (
                <>
                  {/* Real Vinimap styled Driver header */}
                  <div className="bg-slate-900 text-white px-4 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={selectedRider.avatar} 
                          alt={selectedRider.name} 
                          className="w-11 h-11 rounded-full object-cover border-2 border-sky-450 shadow-md"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute -bottom-1 -right-1 w-5.5 h-5.5 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-[9px] shadow-md font-bold">
                          {selectedRider.vehicle === 'Moto' ? '🏍️' : '🚲'}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-black text-white flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black tracking-tight">{selectedRider.name}</span>
                          <span className="px-1.5 py-0.5 text-[8px] bg-sky-500/15 text-sky-300 rounded font-mono font-bold uppercase tracking-wider">
                            Placa: VNM-{selectedRider.id.replace(/\D/g, '') || '2026'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{selectedRider.vehicle} de Logística</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 font-mono">
                            <Battery size={11} className="text-emerald-400" />
                            Bat: {selectedRider.batteryPercent}%
                          </span>
                          <span>•</span>
                          <span className="text-sky-300 flex items-center gap-0.5 font-mono">
                            <Wifi size={11} className="text-sky-400" /> {selectedRider.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Public Contact Actions */}
                    <div className="flex items-center gap-2">
                      <a 
                        href={`tel:${selectedRider.phone}`}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border border-slate-700/80 cursor-pointer shadow-xs"
                      >
                        <Phone size={11} className="text-sky-400" /> Ligar
                      </a>
                      <a 
                        href={getWhatsAppLink(selectedRider)}
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer shadow-md"
                      >
                        <Send size={11} /> WhatsApp
                      </a>
                    </div>
                  </div>

                  {/* HIGH-FIDELITY LIVE PROGRESS TRACKER (Linear stepper) */}
                  {(() => {
                    const riderAllOrders = orders.filter(o => o.riderId === selectedRider.id);
                    const completed = riderAllOrders.filter(o => o.status === 'Concluído').length;
                    const totalCount = riderAllOrders.length;
                    const progressPercent = totalCount > 0 ? (completed / totalCount) * 100 : 0;
                    
                    return (
                      <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs">
                        <div className="flex items-center gap-2 text-[10.5px] font-black text-slate-700 uppercase tracking-wide">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          <span>Progresso da Rota:</span>
                          <span className="text-slate-900 font-extrabold font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                            {completed}/{totalCount} Entregas
                          </span>
                        </div>
                        <div className="flex-1 max-w-sm h-2 bg-slate-200 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-700 rounded-full" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-[9.5px] text-slate-500 font-bold font-mono uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Navigation size={11} className="text-sky-500 rotate-45" /> Velocidade: <span className="text-slate-900 font-black">{isSimulating ? (riderSpeeds[selectedRider.id] || 38) : 0} km/h</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Layers size={11} className="text-sky-500" /> Precisão: <span className="text-slate-900 font-black">GPS &lt; 5m</span>
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* PAINEL DE TELEMETRIA GPS E DIAGNÓSTICO DE RASTREAMENTO */}
                  {(() => {
                    const selectedRiderCoords = getRiderGeoCoords(selectedRider);
                    const accuracy = Math.round(selectedRider.gpsAccuracy || (isSimulating ? 3.5 : 5.0));
                    const isSignalOk = gpsElapsedSeconds < 30;
                    const isSignalWarn = gpsElapsedSeconds >= 30 && gpsElapsedSeconds <= 120;
                    const isSignalError = gpsElapsedSeconds > 120;

                    return (
                      <div className="bg-slate-950 text-white border-b border-slate-800 px-4 py-3 shrink-0 shadow-md">
                        <div className="flex flex-col gap-2.5">
                          {/* Top Header line of Telemetry Panel */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/20">
                                <Activity size={13} className="animate-pulse" />
                              </span>
                              <span className="text-xs font-black uppercase tracking-wider text-white">
                                Painel de Telemetria GPS & Diagnóstico do Condutor
                              </span>
                              <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {selectedRider.name} ({selectedRider.phone})
                              </span>
                            </div>

                            {/* Actions: Timeline Modal & Direct Ping Test */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedTimelineRider(selectedRider)}
                                className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Ver Linha do Tempo das Últimas 5 Localizações Registradas"
                              >
                                <Clock size={11} className="text-sky-300" /> Timeline (5 Posições)
                              </button>
                              <button
                                onClick={() => {
                                  const timeNow = new Date().toLocaleTimeString();
                                  setLastGpsUpdateTimestamp(Date.now());
                                  setGpsElapsedSeconds(0);
                                  setTelemetryLogs(prev => [
                                    ...prev,
                                    {
                                      id: String(Date.now()),
                                      time: timeNow,
                                      message: `Ping manual disparado: GPS do condutor ${selectedRider.name} respondendo a -${selectedRiderCoords[0].toFixed(5)}, ${selectedRiderCoords[1].toFixed(5)} (Margem ±${accuracy}m).`,
                                      type: 'success'
                                    }
                                  ]);
                                }}
                                className="bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <Zap size={11} className="text-amber-300" /> Ping Diagnóstico GPS
                              </button>
                            </div>
                          </div>

                          {/* Grid of 4 Telemetry Metrics */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* Metric 1: Tempo decorrido desde última atualização */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                                isSignalOk ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                                isSignalWarn ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                                'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              }`}>
                                <Clock size={16} className={isSignalOk ? 'animate-pulse' : ''} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                  <span>Última Atualização GPS</span>
                                </div>
                                <div className="text-xs font-mono font-black text-white flex items-center gap-1.5 mt-0.5">
                                  <span className="text-sky-300">
                                    {gpsElapsedSeconds < 60 
                                      ? `há ${gpsElapsedSeconds}s` 
                                      : `há ${Math.floor(gpsElapsedSeconds / 60)}m ${gpsElapsedSeconds % 60}s`}
                                  </span>
                                  <span className={`text-[8px] px-1.5 py-0.2 rounded font-sans font-bold uppercase ${
                                    isSignalOk ? 'bg-emerald-500/20 text-emerald-300' :
                                    isSignalWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                                  }`}>
                                    {isSignalOk ? 'Sinal Ativo' : isSignalWarn ? 'Atraso' : 'Sinal Perdido'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Metric 2: Precisão da coordenada recebida */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 font-mono font-black text-xs">
                                <Target size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                  Precisão da Coordenada
                                </div>
                                <div className="text-xs font-mono font-black text-white mt-0.5 flex items-center gap-1.5">
                                  <span className="text-emerald-300">±{accuracy} metros</span>
                                  <span className="text-[8px] bg-sky-500/20 text-sky-300 px-1 rounded font-sans uppercase">
                                    {accuracy <= 5 ? 'Alta (<5m)' : accuracy <= 15 ? 'Boa' : 'Baixa'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Metric 3: Coordenadas Lat / Lng Reais */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                                <Crosshair size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                  Lat / Lng Receptor
                                </div>
                                <div className="text-[10px] font-mono font-bold text-slate-200 mt-0.5 truncate">
                                  {selectedRiderCoords[0].toFixed(5)}, {selectedRiderCoords[1].toFixed(5)}
                                </div>
                              </div>
                            </div>

                            {/* Metric 4: Dispositivo & Bateria */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                                <Battery size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                  Bateria & Conexão
                                </div>
                                <div className="text-xs font-mono font-black text-white mt-0.5 flex items-center gap-1.5">
                                  <span>{selectedRider.batteryPercent}%</span>
                                  <span className="text-[8px] bg-slate-800 text-sky-300 px-1 py-0.2 rounded font-sans uppercase">
                                    GPRS 4G
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Diagnosis & Street Route Rules Banner */}
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-[10px]">
                            <div className="flex items-start gap-2 text-slate-300 flex-1">
                              <ShieldAlert size={14} className={isSignalError ? "text-rose-400 shrink-0 mt-0.5" : "text-amber-400 shrink-0 mt-0.5"} />
                              <div>
                                <span className="font-black text-amber-300 uppercase tracking-wider mr-1.5">
                                  Diagnóstico de Falhas:
                                </span>
                                <span>
                                  {isSignalError 
                                    ? '🚨 FALHA DE TRANSMISSÃO: O sinal de GPS não é atualizado há mais de 2 minutos. Possível celular desligado, sem sinal 4G ou com economia de energia ativada.' 
                                    : isSignalWarn 
                                    ? '⚠️ ATENÇÃO: Sinal com pequeno atraso de dados. Verifique a cobertura de dados móveis do condutor.' 
                                    : '✅ RASTREAMENTO PERFEITO: Transmissão de localização GPS ativa e sem interrupções.'}
                                </span>
                              </div>
                            </div>

                            {/* Rule Notice: Hub reference and street paths */}
                            <div className="text-[9px] font-mono text-sky-300/90 bg-sky-950/60 border border-sky-800/60 px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1.5">
                              <MapPin size={10} className="text-sky-400 shrink-0" />
                              <span>Partida do HUB = Referência de Origem (Sem criar/vincular como pedido) | Trajeto real pelas ruas</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* All Riders Corporate Fleet Header */
                <div className="bg-slate-900 text-white px-4 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 shrink-0 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-405 border border-sky-500/30 flex items-center justify-center text-base shadow">
                      🌍
                    </div>
                    <div>
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <span className="text-sm font-black tracking-tight">Painel de Monitoramento da Frota</span>
                        <span className="px-1.5 py-0.5 text-[8px] bg-emerald-500/15 text-emerald-300 rounded font-mono font-bold uppercase tracking-wider animate-pulse">
                          Transmissão Online
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 font-semibold mt-0.5 flex items-center gap-1.5">
                        <span>FROTA TOTAL: {riders.length} Condutores ({riders.filter(r => r.status !== 'Offline').length} Ativos)</span>
                        <span>•</span>
                        <span className="text-emerald-400">Sincronizado via satélite GPRS</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-[9.5px] font-black uppercase bg-slate-800 px-3 py-1.5 rounded-xl text-slate-300 font-mono border border-slate-700/80">
                    Sinal Central: Excelência GPRS 4G
                  </div>
                </div>
              )}

              {/* SPLIT SCREEN MAP + TIMELINE AREA */}
              <div className="flex-1 flex flex-col md:flex-row items-stretch overflow-hidden">
                
                {/* 2A. LEFT COLUMN: THE STEP TIMELINE OR ACTIVE FLEET LIST */}
                <div className="w-full md:w-[280px] bg-white border-r border-slate-200/80 flex flex-col overflow-hidden shrink-0">
                  {selectedRider ? (
                    <>
                      {/* Active Driver Title */}
                      <div className="p-3 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between shrink-0">
                        <span className="text-[9.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Package size={12} className="text-sky-650" />
                          Roteiro de Entregas ({riderPendingOrders.length})
                        </span>
                        <button 
                          onClick={() => setSelectedRiderId(null)}
                          className="text-[8.5px] font-black text-sky-650 hover:text-sky-800 uppercase tracking-wider transition-colors bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg border border-sky-100 cursor-pointer flex items-center gap-1"
                        >
                          ‹ Ver Frota
                        </button>
                      </div>

                      {/* Scrollable Stepper Timeline */}
                      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar bg-slate-50/15">
                        {riderPendingOrders.length > 0 ? (
                          <div className="relative pl-3 space-y-4 border-l-2 border-slate-200">
                            {orders
                              .filter(o => {
                                const matchesRider = o.riderId === selectedRiderId;
                                const matchesStatus = o.status !== 'Concluído' && o.status !== 'Cancelado';
                                
                                let matchesDate = true;
                                if (filterDateFrom && o.date < filterDateFrom) matchesDate = false;
                                if (filterDateTo && o.date > filterDateTo) matchesDate = false;
                                
                                if (matchesRider) {
                                  matchesDate = true;
                                }
                                
                                return matchesRider && matchesStatus && matchesDate;
                              })
                              .sort((a, b) => {
                                const seq = customOrderSequences[selectedRiderId || ''];
                                if (!seq) return 0;
                                const indexA = seq.indexOf(a.id);
                                const indexB = seq.indexOf(b.id);
                                if (indexA === -1 && indexB === -1) return 0;
                                if (indexA === -1) return 1;
                                if (indexB === -1) return -1;
                                return indexA - indexB;
                              })
                              .map((order, idx, arr) => {
                                const isOrdHovered = hoveredOrder?.id === order.id;
                                const isOrdSelected = selectedOrder?.id === order.id;
                                const isNextStop = idx === 0; // The active/next delivery step
                                const orderMetric = routeMetrics.find(m => m.orderId === order.id);

                                return (
                                  <div 
                                    key={order.id} 
                                    className="relative"
                                    onMouseEnter={() => setHoveredOrder(order)}
                                    onMouseLeave={() => setHoveredOrder(null)}
                                    onClick={() => setSelectedOrder(order)}
                                  >
                                    {/* Timeline Dot override */}
                                    <div className="absolute -left-[21px] top-1.5 flex items-center justify-center z-10">
                                      {isNextStop ? (
                                        <div className="w-4.5 h-4.5 rounded-full bg-sky-600 border-2 border-white shadow flex items-center justify-center">
                                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></div>
                                        </div>
                                      ) : (
                                        <div className="w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white shadow"></div>
                                      )}
                                    </div>

                                    {/* Order Step Card */}
                                    <div 
                                      className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                                        isNextStop 
                                          ? 'border-sky-400 bg-sky-50/15 ring-1 ring-sky-100 shadow-sm'
                                          : isOrdSelected 
                                            ? 'border-slate-350 bg-slate-50 shadow-xs' 
                                            : 'border-slate-200 hover:border-slate-300 bg-white shadow-3xs'
                                      }`}
                                    >
                                      {/* Step Badge */}
                                      <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="px-1.5 py-0.5 text-[8.5px] font-black bg-slate-100 text-slate-500 rounded font-mono">
                                            PARADA {idx + 1}
                                          </span>
                                          <span className="font-mono font-black text-slate-800 text-[10px]">
                                            #{order.id.replace('ped-', '').toUpperCase()}
                                          </span>
                                        </div>
                                        <span className={`px-1.5 py-0.5 text-[8px] font-extrabold border rounded uppercase ${getPriorityBadgeColor(order.priority)}`}>
                                          {order.priority}
                                        </span>
                                      </div>

                                      {/* Client & Address */}
                                      <div className="space-y-0.5">
                                        <span className="font-extrabold text-[11px] text-slate-800 block truncate leading-tight">
                                          {order.clientName}
                                        </span>
                                        <span className="text-[10px] text-slate-505 block leading-tight font-medium">
                                          {order.address.split(',')[0]}, {order.address.split(',')[1] || ''}
                                        </span>
                                      </div>

                                      {/* ETA metric */}
                                      {isNextStop && orderMetric && (
                                        <div className="bg-sky-50 text-sky-855 p-1.5 rounded-lg border border-sky-100 flex items-center justify-between text-[9px] font-black uppercase tracking-wider font-mono mt-1">
                                          <span className="flex items-center gap-1 text-sky-700">
                                            <Navigation size={10} className="rotate-45" /> Faltam {orderMetric.cumulativeDistance.toFixed(1)} km
                                          </span>
                                          <span className="text-amber-700 flex items-center gap-1">
                                            <Clock size={10} /> Chegada: {orderMetric.etaMinutes} min
                                          </span>
                                        </div>
                                      )}

                                      {/* Active dispatcher controls (integrated seamlessly) */}
                                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 mt-1" onClick={(e) => e.stopPropagation()}>
                                        {/* Order Sequencer arrows */}
                                        <div className="flex items-center gap-1">
                                          <button
                                            disabled={idx === 0}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              moveOrderInSequence(selectedRiderId || '', order.id, 'up');
                                            }}
                                            className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] cursor-pointer disabled:opacity-20 disabled:pointer-events-none font-bold"
                                            title="Subir prioridade"
                                          >
                                            ▲
                                          </button>
                                          <button
                                            disabled={idx === arr.length - 1}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              moveOrderInSequence(selectedRiderId || '', order.id, 'down');
                                            }}
                                            className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] cursor-pointer disabled:opacity-20 disabled:pointer-events-none font-bold"
                                            title="Baixar prioridade"
                                          >
                                            ▼
                                          </button>
                                        </div>

                                        {/* Action execution buttons */}
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onUpdateOrderStatus) {
                                                onUpdateOrderStatus(order.id, 'Concluído');
                                                const timeNow = new Date().toLocaleTimeString();
                                                setTelemetryLogs(prev => [
                                                  ...prev,
                                                  { id: String(Date.now()), time: timeNow, message: `Pedido #${order.id.replace('ped-', '').toUpperCase()} concluído pelo condutor.`, type: 'success' }
                                                ]);
                                              }
                                            }}
                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-black uppercase flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                            title="Concluir entrega do pacote"
                                          >
                                            <Check size={10} className="stroke-[3]" /> Concluir
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (window.confirm(`Deseja cancelar a entrega do pedido #${order.id.replace('ped-', '').toUpperCase()}?`)) {
                                                if (onUpdateOrderStatus) {
                                                  onUpdateOrderStatus(order.id, 'Cancelado');
                                                  const timeNow = new Date().toLocaleTimeString();
                                                  setTelemetryLogs(prev => [
                                                    ...prev,
                                                    { id: String(Date.now()), time: timeNow, message: `Pedido #${order.id.replace('ped-', '').toUpperCase()} cancelado pelo condutor.`, type: 'warn' }
                                                  ]);
                                                }
                                              }
                                            }}
                                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-black uppercase flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                            title="Cancelar entrega"
                                          >
                                            <X size={10} className="stroke-[3]" /> Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4">
                            <Package size={24} className="text-slate-300 mx-auto mb-2" />
                            <span className="text-[10px] text-slate-400 font-extrabold block">Roteiro Limpo</span>
                            <p className="text-[9px] text-slate-400 font-medium leading-normal mt-1">Nenhuma entrega ativa alocada para este condutor no período.</p>
                          </div>
                        )}

                        {/* Completed deliveries in timeline for high fidelity history */}
                        {(() => {
                          const riderAllOrders = orders.filter(o => o.riderId === selectedRiderId);
                          const completedOrders = riderAllOrders.filter(o => o.status === 'Concluído' || o.status === 'Cancelado');
                          
                          if (completedOrders.length === 0) return null;
                          return (
                            <div className="pt-4 border-t border-slate-200">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">
                                Paradas Finalizadas ({completedOrders.length})
                              </span>
                              <div className="space-y-2 pl-3 border-l border-dashed border-slate-200">
                                {completedOrders.map((order) => (
                                  <div key={order.id} className="relative text-left opacity-60">
                                    <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                                    <div className="bg-slate-100/70 border border-slate-200 p-2.5 rounded-lg text-[10px]">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-mono font-bold text-slate-600">#{order.id.replace('ped-', '').toUpperCase()}</span>
                                        <span className={`px-1 py-0.2 rounded text-[7.5px] font-extrabold uppercase ${
                                          order.status === 'Concluído' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'bg-rose-50 text-rose-600 border border-rose-150'
                                        }`}>
                                          {order.status}
                                        </span>
                                      </div>
                                      <span className="font-bold text-slate-700 block truncate mt-1 leading-none">{order.clientName}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    /* General Mode left panel: Online Courier list */
                    <>
                      <div className="p-3 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between shrink-0 select-none">
                        <span className="text-[9.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <User size={12} className="text-sky-650 animate-pulse" />
                          Condutores da Frota ({filteredRiders.length})
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-50/15">
                        {filteredRiders.map((r) => {
                          const rOrders = orders.filter(o => o.riderId === r.id);
                          const rPending = rOrders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado');
                          
                          return (
                            <div 
                              key={r.id}
                              onClick={() => setSelectedRiderId(r.id)}
                              className="p-2.5 bg-white hover:bg-sky-50/40 border border-slate-200 hover:border-sky-300 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.015] shadow-3xs text-left"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <img src={r.avatar} alt={r.name} className="w-8.5 h-8.5 rounded-full border border-slate-200 object-cover" referrerPolicy="no-referrer" />
                                    <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-[7px] font-bold">
                                      {r.vehicle === 'Moto' ? '🏍️' : '🚲'}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className="font-black text-[11.5px] text-slate-800 leading-tight">{r.name}</h4>
                                    <span className="text-[8.5px] text-slate-400 font-mono font-bold uppercase">Placa: VNM-{r.id.replace(/\D/g, '') || '2026'}</span>
                                  </div>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider ${
                                  r.status === 'Disponível' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                  r.status === 'Em rota' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                  r.status === 'Alerta' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                  'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}>
                                  {r.status}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold font-mono border-t border-slate-100 pt-1.5 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Battery size={11} className="text-emerald-500" /> {r.batteryPercent}%
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRiderId(r.id);
                                      setSelectedTimelineRider(r);
                                    }}
                                    className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-[8px] font-black uppercase flex items-center gap-0.5 cursor-pointer"
                                    title="Ver Linha do Tempo das Últimas 5 Localizações"
                                  >
                                    <Clock size={9} /> Timeline
                                  </button>
                                  <span className="text-sky-600 font-black">
                                    {rPending.length} pendentes
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* 2B. RIGHT COLUMN: INTERACTIVE LEAFLET MAP */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div 
                    id="map-container"
                    className="flex-1 relative overflow-hidden bg-slate-900"
                  >
                  
                  {/* Floating overlay top left: Active details */}
                  <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
                    {selectedRider && (
                      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2.5">
                        <Wifi size={11} className={isSimulating ? "text-emerald-500 animate-pulse" : "text-slate-400"} />
                        <span className="text-[9px] font-black text-slate-800 tracking-wider uppercase font-mono">
                          {isSimulating ? 'GPRS SATÉLITE LIVE' : 'CONEXÃO STANDBY'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Map style selection overlay - Centered horizontally at the top */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex justify-center w-auto max-w-[90vw]">
                    {/* Layer selection overlay */}
                    <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-md flex items-center gap-1 pointer-events-auto whitespace-nowrap">
                      <div className="px-1 text-slate-400 flex items-center justify-center">
                        <Layers size={11} />
                      </div>
                      <button
                        onClick={() => setMapStyle('standard')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${mapStyle === 'standard' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Padrão
                      </button>
                      <button
                        onClick={() => setMapStyle('openstreetmap')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${mapStyle === 'openstreetmap' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        OSM
                      </button>
                      <button
                        onClick={() => setMapStyle('dark-vinimap')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${mapStyle === 'dark-vinimap' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Escuro
                      </button>
                      <button
                        onClick={() => setMapStyle('satellite')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${mapStyle === 'satellite' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Satélite
                      </button>
                    </div>
                  </div>

                  {/* Floating overlay top right: Map controls */}
                  <div className="absolute top-3 right-3 z-10 pointer-events-none flex flex-col items-end">
                    {/* Recalibrate, Fullscreen, Timeline and Focus Map Buttons */}
                    <div className="flex gap-1.5 pointer-events-auto">
                      {selectedRider && (
                        <button
                          onClick={() => setSelectedTimelineRider(selectedRider)}
                          className="bg-white/95 hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-sky-600 rounded-xl px-2.5 py-1.5 shadow-md cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                          title="Linha do Tempo das Últimas 5 Localizações do Condutor"
                          id="btn-timeline-map"
                        >
                          <Clock size={12} className="text-sky-600" />
                          <span className="hidden sm:inline">Timeline (5 Pts)</span>
                        </button>
                      )}
                      <button
                        onClick={handleRecalibrateMap}
                        className="bg-white/95 hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-sky-600 rounded-xl px-2.5 py-1.5 shadow-md cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                        title="Recalibrar Mapa (Limpar cache e redefinir posições do Leaflet)"
                        id="btn-recalibrate-map"
                      >
                        <RotateCcw size={12} className="text-sky-600" />
                        <span className="hidden sm:inline">Recalibrar Mapa</span>
                      </button>
                      <button
                        onClick={handleCenterOnSelectedRider}
                        className="bg-white/95 hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl p-2 shadow-md cursor-pointer transition-colors"
                        title="Centralizar no Condutor"
                      >
                        <MapPin size={12} className="text-sky-600" />
                      </button>
                      <button
                        onClick={handleFullscreenToggle}
                        className="bg-white/95 hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl p-2 shadow-md cursor-pointer transition-colors"
                        title="Alternar Tela Cheia"
                      >
                        {isFullscreen ? <Minimize2 size={12} className="text-sky-600" /> : <Maximize2 size={12} className="text-sky-600" />}
                      </button>
                    </div>
                  </div>

                  {/* The Leaflet Map Canvas */}
                  <div key={recalibrateKey} className={`w-full h-full relative overflow-hidden z-0 transition-colors duration-300 ${mapStyle === 'standard' ? 'bg-slate-100' : 'bg-slate-950'}`}>
                    <SafeMapWrapper>
                      <div 
                        ref={mapContainerRef} 
                        className="w-full h-full" 
                        style={{ minHeight: '100%', height: '100%', width: '100%' }}
                      />
                    </SafeMapWrapper>

                    {!leafletLoaded && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 backdrop-blur-xs z-30">
                        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <span className="text-xs font-semibold text-slate-600">Sincronizando coordenadas com o satélite...</span>
                      </div>
                    )}
                  </div>

                  {/* Hover/Selection Floating Detail overlay on map */}
                  <AnimatePresence>
                    {(hoveredOrder || selectedOrder) && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md border border-slate-200 p-3.5 rounded-xl shadow-xl flex items-center justify-between gap-4 z-20"
                      >
                          {(() => {
                            const ord = hoveredOrder || selectedOrder!;
                            const ordMetric = routeMetrics.find(m => m.orderId === ord.id);
                            return (
                              <>
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 text-[8px] font-black bg-sky-600 text-white rounded font-mono">
                                      #{ord.id.replace('ped-', '').toUpperCase()}
                                    </span>
                                    <span className={`px-1.5 py-0.5 text-[8px] font-black border rounded uppercase ${getPriorityBadgeColor(ord.priority)}`}>
                                      {ord.priority}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-bold">CEP: {ord.cep}</span>
                                  </div>
                                  <h4 className="text-xs font-extrabold text-slate-900 truncate leading-tight">{ord.clientName}</h4>
                                  <p className="text-[10px] text-slate-505 font-medium truncate max-w-[240px] leading-tight">{ord.address}</p>
                                  {ordMetric && (
                                    <div className="flex items-center gap-3 pt-0.5 text-[9px] font-black font-mono uppercase tracking-wider">
                                      <div className="flex items-center gap-0.5 text-sky-600">
                                        <Navigation size={10} className="rotate-45" /> {ordMetric.cumulativeDistance.toFixed(1)} km
                                      </div>
                                      <div className="flex items-center gap-0.5 text-amber-600">
                                        <Clock size={10} /> ETA: {ordMetric.etaMinutes} min
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="text-xs font-black text-slate-900 block font-mono">R$ {ord.value.toFixed(2)}</span>
                                  <span className="text-[9px] font-black text-sky-600 block mt-0.5 uppercase tracking-wider">{ord.status}</span>
                                </div>
                              </>
                            );
                          })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            </div>
          </div>
        </div>

      </div>

      {/* MODAL: LINHA DO TEMPO DAS ÚLTIMAS 5 LOCALIZAÇÕES DO CONDUTOR */}
      <AnimatePresence>
        {selectedTimelineRider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={selectedTimelineRider.avatar}
                      alt={selectedTimelineRider.name}
                      className="w-11 h-11 rounded-full border-2 border-sky-400 object-cover shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-[8px] font-bold">
                      {selectedTimelineRider.vehicle === 'Moto' ? '🏍️' : '🚲'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-white tracking-tight">{selectedTimelineRider.name}</h3>
                      <span className="px-2 py-0.5 text-[8.5px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded">
                        Placa: VNM-{selectedTimelineRider.id.replace(/\D/g, '') || '2026'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-medium mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sky-400 font-bold">
                        <Activity size={12} className="animate-pulse" /> Linha do Tempo de Rastreamento GPS
                      </span>
                      <span>•</span>
                      <span className="text-slate-400">Últimas 5 posições registadas</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTimelineRider(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Fechar Linha do Tempo"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/50">
                {(() => {
                  const rawHistory = locationHistories[selectedTimelineRider.id] || [];
                  const points = rawHistory.slice(0, 5);

                  let jumpsCount = 0;
                  let totalDistKm = 0;

                  const processedPoints = points.map((p, idx) => {
                    const olderP = points[idx + 1];
                    let distKm = 0;
                    let isJump = false;

                    if (olderP) {
                      distKm = calcDistKm(olderP.geoLat, olderP.geoLng, p.geoLat, p.geoLng);
                      totalDistKm += distKm;
                      if (distKm > 0.8) {
                        isJump = true;
                        jumpsCount++;
                      }
                    }

                    return {
                      ...p,
                      distKm,
                      isJump
                    };
                  });

                  const isTrajectoryCoherent = jumpsCount === 0;

                  return (
                    <>
                      {/* Trajectory Coherence Summary Banner */}
                      <div className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-2xs ${
                        isTrajectoryCoherent 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950' 
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-950'
                      }`}>
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          isTrajectoryCoherent ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {isTrajectoryCoherent ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="font-extrabold text-xs uppercase tracking-wider">
                              {isTrajectoryCoherent 
                                ? '✅ Trajeto Coerente: Sem Saltos Anormais' 
                                : `⚠️ Alerta: Detectado ${jumpsCount} ${jumpsCount === 1 ? 'Salto de GPS' : 'Saltos de GPS'}`}
                            </h4>
                            <span className="text-[9.5px] font-mono font-bold bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded text-slate-700 shadow-2xs">
                              Deslocamento Total: {totalDistKm < 1 ? `${(totalDistKm * 1000).toFixed(0)}m` : `${totalDistKm.toFixed(2)} km`}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed font-medium text-slate-700">
                            {isTrajectoryCoherent
                              ? 'Os últimos 5 pontos de GPS do condutor mantêm deslocamento uniforme e coerente pelas ruas, sem discrepâncias de teleport ou perda severa de sinal.'
                              : 'Identificamos um salto de posição elevado entre pings (> 800m). Isso normalmente ocorre por reconexão após túneis, perda temporária de dados móveis ou troca de satélite.'}
                          </p>
                        </div>
                      </div>

                      {/* Timeline Stepper */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={12} className="text-sky-600" />
                            Histórico Sequencial das Últimas 5 Localizações
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 font-bold">
                            #1 = Mais Recente | #5 = Mais Antigo
                          </span>
                        </div>

                        <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                          {processedPoints.map((pt, idx) => {
                            const isLatest = idx === 0;
                            return (
                              <div key={pt.id || idx} className="relative">
                                {/* Dot icon on line */}
                                <div className={`absolute -left-[24px] top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-black shadow-xs ${
                                  isLatest 
                                    ? 'bg-sky-600 border-white text-white ring-2 ring-sky-200' 
                                    : pt.isJump
                                    ? 'bg-amber-500 border-white text-white'
                                    : 'bg-slate-100 border-slate-300 text-slate-600'
                                }`}>
                                  {idx + 1}
                                </div>

                                {/* Card details */}
                                <div className={`p-3 rounded-xl border text-xs transition-all ${
                                  isLatest 
                                    ? 'bg-sky-50/50 border-sky-200 shadow-2xs' 
                                    : pt.isJump 
                                    ? 'bg-amber-50/60 border-amber-200' 
                                    : 'bg-slate-50/70 border-slate-200/80'
                                }`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-black text-slate-900 text-[11px]">
                                        ⏰ {pt.timestamp}
                                      </span>
                                      {isLatest && (
                                        <span className="px-1.5 py-0.2 bg-sky-600 text-white rounded text-[8px] font-extrabold uppercase tracking-wider">
                                          Último Ponto
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9.5px] font-mono text-slate-500 font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                      {pt.source}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                                    <div>
                                      <span className="text-slate-400 font-sans text-[9px] block uppercase font-bold">Coordenadas Lat / Lng</span>
                                      <span className="font-mono font-bold text-slate-800">
                                        {pt.geoLat.toFixed(5)}, {pt.geoLng.toFixed(5)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-sans text-[9px] block uppercase font-bold">Telemetria & Velocidade</span>
                                      <span className="font-mono font-bold text-slate-800 flex items-center gap-2">
                                        <span>{pt.speedKmH} km/h</span>
                                        <span>•</span>
                                        <span className="text-emerald-650">±{pt.gpsAccuracy.toFixed(1)}m precisão</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Jump / Distance Tag from older point */}
                                  {idx < processedPoints.length - 1 && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono font-bold">
                                      <span className="text-slate-500">Deslocamento desde o ponto #{idx + 2}:</span>
                                      {pt.isJump ? (
                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-black flex items-center gap-1 shadow-2xs">
                                          <AlertTriangle size={11} className="text-amber-600" />
                                          ⚠️ SALTO DETECTADO: +{pt.distKm < 1 ? `${(pt.distKm * 1000).toFixed(0)}m` : `${pt.distKm.toFixed(2)} km`}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-black flex items-center gap-1">
                                          <CheckCircle2 size={11} className="text-emerald-600" />
                                          ✅ Coerente: +{pt.distKm < 1 ? `${(pt.distKm * 1000).toFixed(0)}m` : `${pt.distKm.toFixed(2)} km`}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-100 border-t border-slate-200 p-3.5 flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={handleRecalibrateMap}
                  className="px-3 py-2 bg-white hover:bg-sky-50 text-sky-700 hover:text-sky-800 border border-sky-200 rounded-xl text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <RotateCcw size={12} className="text-sky-600" />
                  <span>Recalibrar Cache do Mapa</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleCenterOnSelectedRider();
                      setSelectedTimelineRider(null);
                    }}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                  >
                    <Target size={12} />
                    <span>Focar no Condutor</span>
                  </button>
                  <button
                    onClick={() => setSelectedTimelineRider(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
