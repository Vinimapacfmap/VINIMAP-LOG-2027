/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DeliveryRider, Order, CompanyHub } from '../types';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Battery, 
  Phone, 
  MapPin, 
  ShieldAlert, 
  Smartphone,
  Layers,
  Wifi,
  WifiOff,
  HardDrive,
  RefreshCw,
  Database,
  CheckCircle2,
  RotateCcw,
  Navigation,
  Zap
} from 'lucide-react';
import { initLeafletPosGuard } from '../utils/leafletPatch';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Polyline, Popup, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import SafeMapWrapper from './SafeMapWrapper';

import { getCoordinatesFromCep, getRegionGeoCoords, convertToGeoLat, convertToGeoLng, getRiderGeoCoords } from '../utils/locationUtils';
import { saveMapCache, getMapCache, MapCachePayload } from '../utils/mapCacheService';
import { fetchOsrmRoute, OsrmRouteResult } from '../utils/osrmService';
import OrderQuickViewTooltip from './OrderQuickViewTooltip';

interface MapContainerProps {
  riders: DeliveryRider[];
  orders: Order[];
  selectedRiderId: string | null;
  setSelectedRiderId: (id: string | null) => void;
  activeHub?: CompanyHub;
}

// Controller component to safely pan/zoom the map instance imperatively
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

export default function MapContainer({ riders, orders, selectedRiderId, setSelectedRiderId, activeHub }: MapContainerProps) {
  const [activeLegendFilter, setActiveLegendFilter] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'standard' | 'mapbox-streets' | 'mapbox-satellite' | 'mapbox-dark' | 'dark-vinimap' | 'satellite' | 'openstreetmap'>('mapbox-streets');
  const [showOptimizedRoute, setShowOptimizedRoute] = useState<boolean>(true);
  const [osrmEtas, setOsrmEtas] = useState<Record<string, OsrmRouteResult>>({});

  // Calculate real OSRM routes and ETAs for all riders with active pending deliveries
  useEffect(() => {
    let isMounted = true;

    async function calculateOsrmEtas() {
      const hubLat = activeHub?.lat || -23.5385556;
      const hubLng = activeHub?.lng || -46.70118;

      const newEtas: Record<string, OsrmRouteResult> = {};

      for (const rider of riders) {
        const riderOrders = orders.filter(
          o => o.riderId === rider.id && o.status !== 'Concluído' && o.status !== 'Cancelado'
        );
        if (riderOrders.length === 0) continue;

        const nextOrder = riderOrders[0];
        const riderCoords = getRiderGeoCoords(rider, { lat: hubLat, lng: hubLng });
        const destCoords = getCoordinatesFromCep(nextOrder.cep, nextOrder.region, nextOrder.address, nextOrder.lat, nextOrder.lng);

        const routeResult = await fetchOsrmRoute(
          { lat: riderCoords[0], lng: riderCoords[1] },
          { lat: destCoords.lat, lng: destCoords.lng }
        );

        if (isMounted) {
          newEtas[rider.id] = routeResult;
        }
      }

      if (isMounted) {
        setOsrmEtas(newEtas);
      }
    }

    calculateOsrmEtas();

    return () => {
      isMounted = false;
    };
  }, [riders, orders, activeHub?.id, activeHub?.lat, activeHub?.lng]);

  // Offline Map Cache State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [cachedData, setCachedData] = useState<MapCachePayload | null>(() => getMapCache());
  const [lastSyncNotice, setLastSyncNotice] = useState<string>('');

  // Effective Offline Mode Flag
  const isEffectiveOffline = !isOnline || simulatedOffline;

  // Window network status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setCachedData(getMapCache());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fallback coords for main hub: Rua Cerro Corá, 385, CEP 05061-050, Vila Romana, São Paulo
  const hubLat = activeHub?.lat || cachedData?.hub?.lat || -23.5385556;
  const hubLng = activeHub?.lng || cachedData?.hub?.lng || -46.70118;
  const hubName = activeHub?.name || cachedData?.hub?.name || 'Sede Principal Vinimap';
  const hub: [number, number] = [hubLat, hubLng];

  // Auto Synchronize Map State to Local Cache whenever online data updates
  useEffect(() => {
    if (isOnline && !simulatedOffline) {
      const currentHubInfo = activeHub ? {
        id: activeHub.id,
        name: activeHub.name,
        address: activeHub.address,
        cep: activeHub.cep,
        lat: activeHub.lat,
        lng: activeHub.lng,
        phone: activeHub.phone
      } : {
        id: 'hub-main',
        name: 'Sede Principal Vinimap',
        address: 'Rua Cerro Corá, 385 - Vila Romana, São Paulo - SP',
        cep: '05061-050',
        lat: hubLat,
        lng: hubLng
      };

      const activeRoutePoints: Array<[number, number]> = [[hubLat, hubLng]];

      const cachedOrders = orders.map(o => {
        const coords = getCoordinatesFromCep(o.cep, o.region, o.address, o.lat, o.lng);
        if (o.status === 'Em rota' || (o.status as string) === 'Entregando') {
          activeRoutePoints.push([coords.lat, coords.lng]);
        }
        return {
          id: o.id,
          clientName: o.clientName,
          partnerName: o.partnerName,
          address: o.address,
          cep: o.cep,
          lat: coords.lat,
          lng: coords.lng,
          sequence: o.sequence,
          status: o.status,
          priority: o.priority,
          region: o.region,
          riderId: o.riderId
        };
      });

      const cachedRiders = riders.map(r => {
        const rCoords = getRiderGeoCoords(r, { lat: hubLat, lng: hubLng });
        return {
          id: r.id,
          name: r.name,
          status: r.status,
          avatar: r.avatar,
          phone: r.phone,
          vehicle: r.vehicle,
          vehiclePlate: r.vehiclePlate,
          realGeoLat: r.realGeoLat,
          realGeoLng: r.realGeoLng,
          lat: rCoords[0],
          lng: rCoords[1],
          completedDeliveries: r.completedDeliveries,
          batteryPercent: r.batteryPercent,
          isGpsRealActive: r.isGpsRealActive,
          lastGpsUpdate: r.lastGpsUpdate
        };
      });

      const saved = saveMapCache({
        hub: currentHubInfo,
        allHubs: [currentHubInfo],
        orders: cachedOrders,
        riders: cachedRiders,
        activeRoutePoints,
        isOfflineSimulated: false
      });

      if (saved) {
        setCachedData(saved);
        setLastSyncNotice(`Cache atualizado (${saved.timestamp})`);
      }
    }
  }, [orders, riders, activeHub?.id, activeHub?.lat, activeHub?.lng, isOnline, simulatedOffline]);

  const [zoom, setZoom] = useState<number>(13);
  const [center, setCenter] = useState<[number, number]>(hub);

  // Effective display data (uses live props when online, or cached data if offline)
  const effectiveOrders = isEffectiveOffline && cachedData?.orders && cachedData.orders.length > 0
    ? (cachedData.orders as unknown as Order[])
    : orders;

  const effectiveRiders = isEffectiveOffline && cachedData?.riders && cachedData.riders.length > 0
    ? (cachedData.riders as unknown as DeliveryRider[])
    : riders;

  const selectedRider = effectiveRiders.find(r => r.id === selectedRiderId);
  const activeRiderOrders = selectedRider
    ? effectiveOrders.filter(o => o.riderId === selectedRider.id && o.status !== 'Concluído' && o.status !== 'Cancelado')
    : [];

  const sortedActiveRiderOrders = [...activeRiderOrders].sort((a, b) => {
    const seqA = a.sequence !== undefined ? a.sequence : 999999;
    const seqB = b.sequence !== undefined ? b.sequence : 999999;
    if (seqA !== seqB) return seqA - seqB;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id || '').localeCompare(String(b.id || ''));
  });

  const selectedRiderOrder = selectedRider?.currentOrderId
    ? (effectiveOrders.find(o => o.id === selectedRider.currentOrderId && o.status !== 'Concluído' && o.status !== 'Cancelado') || sortedActiveRiderOrders[0])
    : sortedActiveRiderOrders[0];

  // Sync center and zoom when selectedRider or activeHub changes
  useEffect(() => {
    if (selectedRider) {
      setCenter(getRiderGeoCoords(selectedRider, { lat: hubLat, lng: hubLng }));
      setZoom(15);
    } else {
      setCenter(hub);
      setZoom(13);
    }
  }, [selectedRiderId, activeHub?.lat, activeHub?.lng, hubLat, hubLng]);

  // Zoom handlers
  const [recalibrateKey, setRecalibrateKey] = useState<number>(0);
  const handleZoomIn = () => setZoom(prev => Math.min(18, prev + 1));
  const handleZoomOut = () => setZoom(prev => Math.max(10, prev - 1));
  const handleResetZoom = () => {
    setCenter(hub);
    setZoom(13);
    setSelectedRiderId(null);
  };

  const handleRecalibrateMap = () => {
    initLeafletPosGuard();
    setRecalibrateKey(prev => prev + 1);
    setCenter(hub);
    setZoom(13);
  };

  // Filter riders based on active legend status selection
  const filteredRiders = activeLegendFilter 
    ? effectiveRiders.filter(r => r.status === activeLegendFilter)
    : effectiveRiders;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em rota': return 'bg-blue-500 text-white';
      case 'Disponível': return 'bg-emerald-500 text-white';
      case 'Alerta': return 'bg-rose-500 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'Em rota': return 'border-blue-500 ring-blue-100';
      case 'Disponível': return 'border-emerald-500 ring-emerald-100';
      case 'Alerta': return 'border-rose-500 ring-rose-100';
      default: return 'border-slate-400 ring-slate-100';
    }
  };

  // Custom Hub Leaflet Icon Creator
  const createHubIcon = (name: string) => L.divIcon({
    className: 'custom-hub-icon',
    html: `
      <div class="flex flex-col items-center">
        <div class="relative flex h-10 w-10 items-center justify-center">
          <span class="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-20 animate-ping"></span>
          <span class="absolute inline-flex h-7 w-7 rounded-full bg-blue-500 opacity-35 animate-pulse"></span>
          <div class="relative h-7 w-7 rounded-full bg-slate-900 border-2 border-white shadow-lg overflow-hidden flex items-center justify-center p-0.5">
            <img src="${activeHub?.logoUrl || vinimapLogo}" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null;this.src='${vinimapLogo}';" />
          </div>
        </div>
        <div class="bg-blue-600 border border-blue-500 rounded-lg px-2.5 py-0.5 shadow-md -mt-1 text-[9px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap">
          ${name}
        </div>
      </div>
    `,
    iconSize: [120, 50],
    iconAnchor: [60, 20]
  });

  // Custom Order Leaflet Icon Creator
  const createOrderIcon = (id: string, isHigh: boolean) => L.divIcon({
    className: 'custom-order-icon',
    html: `
      <div class="relative group cursor-help">
        <div class="absolute -inset-1.5 rounded-full blur-xs opacity-70 ${isHigh ? 'bg-rose-500 animate-ping' : 'bg-orange-500 animate-pulse'}"></div>
        <div class="relative w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-md ${isHigh ? 'bg-rose-500' : 'bg-orange-500'}">
          <div class="w-1.2 h-1.2 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  // Custom Sequenced Order Leaflet Icon Creator - clean uncluttered map view
  const createSequencedOrderIcon = (id: string, sequenceNum: number, isHigh: boolean) => L.divIcon({
    className: 'custom-sequenced-order-icon',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-115">
        <div class="relative w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-lg ${isHigh ? 'bg-rose-600' : 'bg-orange-600'} text-white text-[10px] font-black">
          ${sequenceNum}
        </div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  // Custom Rider Leaflet Icon Creator
  const createRiderIcon = (rider: DeliveryRider, isSelected: boolean) => {
    const isOffline = rider.status === 'Offline';
    const isRealGps = !!(rider.realGeoLat && rider.realGeoLng) || rider.isGpsRealActive;
    const statusColor = rider.status === 'Em rota' ? 'bg-blue-500' :
                        rider.status === 'Disponível' ? 'bg-emerald-500' :
                        rider.status === 'Alerta' ? 'bg-rose-500' : 'bg-slate-400';
    const borderClass = isSelected 
      ? 'border-slate-900 ring-4 ring-blue-100 scale-110' 
      : getStatusBorderColor(rider.status);
    const vehicleEmoji = rider.vehicle === 'Moto' ? '🏍️' : 
                         rider.vehicle === 'Bicicleta' ? '🚲' : 
                         rider.vehicle === 'Elétrico' ? '⚡' : '🚗';

    return L.divIcon({
      className: 'custom-rider-icon',
      html: `
        <div class="relative transition-transform duration-200 hover:scale-110 group" title="${rider.name} (${rider.vehicle})">
          ${isRealGps ? `
            <div class="absolute -inset-3 flex items-center justify-center pointer-events-none">
              <span class="animate-ping absolute inline-flex h-11 w-11 rounded-full opacity-40 bg-emerald-400"></span>
            </div>
          ` : (!isOffline ? `
            <div class="absolute -inset-2.5 flex items-center justify-center pointer-events-none">
              <span class="animate-ping absolute inline-flex h-9 w-9 rounded-full opacity-25 ${
                rider.status === 'Em rota' ? 'bg-blue-400' :
                rider.status === 'Disponível' ? 'bg-emerald-400' :
                'bg-rose-400'
              }"></span>
            </div>
          ` : '')}
          <div class="relative w-9 h-9 rounded-full bg-white border-2 shadow-md flex items-center justify-center ${borderClass}">
            <img
              src="${rider.avatar}"
              alt="${rider.name}"
              class="w-full h-full rounded-full object-cover"
              referrerpolicy="no-referrer"
            />
            <span class="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] border border-white font-extrabold shadow-sm ${statusColor} text-white">
              ${vehicleEmoji}
            </span>
            ${isRealGps ? `
              <span class="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 border border-white text-white flex items-center justify-center text-[7px] font-black shadow-sm animate-pulse">
                📡
              </span>
            ` : ''}
          </div>
          <!-- Condutor Hover Name Badge -->
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 text-white text-[9.5px] font-black px-2 py-0.5 rounded-md shadow-xl border border-slate-700 pointer-events-none transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 z-50">
            <span class="w-1.5 h-1.5 rounded-full ${statusColor}"></span>
            <span>${rider.name}</span>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  // Active deliveries currently out on route ('Em rota' status)
  const activeDeliveries = effectiveOrders.filter(o => o.status === 'Em rota');

  // Comprehensive list of active orders to render on the map with exact coordinates
  const mapOrdersToShow = isEffectiveOffline
    ? [...effectiveOrders]
    : [...effectiveOrders.filter(o => o.status === 'Em rota')];
    
  if (selectedRider && !isEffectiveOffline) {
    sortedActiveRiderOrders.forEach(o => {
      if (!mapOrdersToShow.some(existing => existing.id === o.id)) {
        mapOrdersToShow.push(o);
      }
    });
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col relative h-[520px]" id="map-section-container">
      
      {/* Map Control Header Overlay */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col sm:flex-row items-start sm:items-center gap-2" id="map-header-overlay">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl px-3.5 py-1.5 shadow-md flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEffectiveOffline ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isEffectiveOffline ? 'bg-amber-600' : 'bg-emerald-600'}`}></span>
          </span>
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            {isEffectiveOffline ? 'Mapa Off-Grid (Cache)' : 'Centro de Operações Livre'}
          </span>
          <span className="text-[10px] text-slate-500 font-bold border-l border-slate-200 pl-2">
            {effectiveRiders.filter(r => r.status !== 'Offline').length} Ativos
          </span>
        </div>

        {/* Offline Cache Status Pill & Toggle */}
        <div className="bg-slate-900/90 text-white backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2 text-[10.5px]">
          <Database size={13} className={isEffectiveOffline ? "text-amber-400 animate-pulse" : "text-emerald-400"} />
          <div className="flex flex-col">
            <span className="font-extrabold leading-tight text-white flex items-center gap-1">
              {isEffectiveOffline ? (
                <span className="text-amber-300 font-mono">MODO OFFLINE ATIVO</span>
              ) : (
                <span className="text-emerald-300 font-mono">CACHE SINCRONIZADO</span>
              )}
            </span>
            {cachedData?.timestamp && (
              <span className="text-[8.5px] text-slate-400 font-medium">
                Sync: {cachedData.timestamp}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSimulatedOffline(!simulatedOffline)}
            className={`ml-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
              simulatedOffline 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title="Alternar entre modo online e simulação de cache offline"
          >
            {simulatedOffline ? <WifiOff size={11} /> : <Wifi size={11} />}
            <span>{simulatedOffline ? 'Sair do Offline' : 'Simular Offline'}</span>
          </button>
        </div>

        {/* Route Optimization Polyline Toggle Button */}
        <button
          type="button"
          onClick={() => setShowOptimizedRoute(!showOptimizedRoute)}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 border backdrop-blur-md ${
            showOptimizedRoute
              ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 shadow-sky-950/30'
              : 'bg-white/90 hover:bg-white text-slate-600 border-slate-200'
          }`}
          title="Exibir ou ocultar a linha de polilinha da rota otimizada"
        >
          <Navigation size={13} className={showOptimizedRoute ? 'text-sky-200 animate-pulse' : 'text-slate-400'} />
          <span>{showOptimizedRoute ? 'Rota Otimizada: ON' : 'Rota Otimizada: OFF'}</span>
        </button>
      </div>

      {/* Map Action Controls (Style Selector & Zoom Controls) */}
      <div className="absolute top-4 right-4 z-[1000] flex items-start gap-2" id="map-action-controls">
        {/* Style Selection Selector */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl p-1.5 shadow-md flex items-center gap-1">
          <Layers size={13} className="text-slate-400 mx-1 shrink-0" />
          <button
            onClick={() => setMapStyle('mapbox-streets')}
            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${
              mapStyle === 'mapbox-streets' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Mapbox HD
          </button>
          <button
            onClick={() => setMapStyle('standard')}
            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${
              mapStyle === 'standard' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            CARTO
          </button>
          <button
            onClick={() => setMapStyle('mapbox-dark')}
            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${
              mapStyle === 'mapbox-dark' || mapStyle === 'dark-vinimap' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Escuro HD
          </button>
          <button
            onClick={() => setMapStyle('mapbox-satellite')}
            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all cursor-pointer ${
              mapStyle === 'mapbox-satellite' || mapStyle === 'satellite' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            Satélite HD
          </button>
        </div>

        {/* Zoom & Recenter controls */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl p-1 shadow-md flex flex-col gap-1">
          <button 
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
            title="Aumentar Zoom"
            id="map-zoom-in"
          >
            <ZoomIn size={16} />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
            title="Diminuir Zoom"
            id="map-zoom-out"
          >
            <ZoomOut size={16} />
          </button>
          <div className="h-px bg-slate-100 mx-1.5" />
          <button 
            onClick={handleResetZoom}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Redefinir Centralização"
            id="map-reset-zoom"
          >
            <Maximize2 size={14} />
          </button>
          <button 
            onClick={handleRecalibrateMap}
            className="p-2 hover:bg-slate-50 rounded-lg text-sky-600 hover:text-sky-700 transition-colors cursor-pointer"
            title="Recalibrar Mapa (Limpar cache e re-montar Leaflet)"
            id="map-recalibrate"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Leaflet OpenStreetMap Container */}
      <div 
        className="w-full flex-1 relative bg-slate-50 overflow-hidden"
        id="live-map-container"
      >
        <SafeMapWrapper>
        <LeafletMapContainer
          key={recalibrateKey}
          center={hub}
          zoom={13}
          zoomControl={false}
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
          {/* Dynamic Map panning and zoom controller */}
          <MapController center={center} zoom={zoom} />

          {/* Dynamic Map tiles selection based on mode */}
          {mapStyle === 'mapbox-streets' && (
            <TileLayer
              attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          )}
          {mapStyle === 'mapbox-dark' && (
            <TileLayer
              attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> Dark'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          )}
          {mapStyle === 'mapbox-satellite' && (
            <TileLayer
              attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> Satellite'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}
          {mapStyle === 'standard' && (
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          )}
          {mapStyle === 'dark-vinimap' && (
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          )}
          {mapStyle === 'satellite' && (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}
          {mapStyle === 'openstreetmap' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          {/* High Precision GPS Signal Accuracy Radius Circle (±83m) around Sede Vinimap */}
          <Circle
            center={hub}
            radius={83}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '4, 4'
            }}
          />

          {/* Central Hub Marker (Sede Vinimap) */}
          <Marker 
            position={hub} 
            icon={createHubIcon(activeHub ? activeHub.name : 'Sede Principal')}
            eventHandlers={{
              click: () => setSelectedRiderId(null)
            }}
          />

          {/* Active Destination/Order Markers with high-precision CEP geocoding and popups */}
          {mapOrdersToShow.map((order, orderIdx) => {
            const isHigh = order.priority === 'Alta';
            const destCoords = getCoordinatesFromCep(order.cep, order.region, order.address, order.lat, order.lng);
            
            // Check if this order is part of the selected rider's current route sequence
            let sequenceIndex = -1;
            if (selectedRider) {
              sequenceIndex = sortedActiveRiderOrders.findIndex(o => o.id === order.id);
            }

            const stopNum = sequenceIndex !== -1 ? sequenceIndex + 1 : orderIdx + 1;
            const icon = createSequencedOrderIcon(order.id, stopNum, isHigh);

            return (
              <Marker
                key={`dest-${order.id}`}
                position={[destCoords.lat, destCoords.lng]}
                icon={icon}
              >
                <Popup>
                  <div className="p-2.5 font-sans min-w-[200px] max-w-[260px] text-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                      <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                        📍 Parada #{stopNum}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        order.priority === 'Alta' ? 'bg-rose-100 text-rose-700' :
                        order.priority === 'Média' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {order.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 text-[11px] leading-relaxed">
                      <p className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Parceiro:</span> 
                        <span className="font-bold text-slate-700 truncate max-w-[120px]">{order.partnerName}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Cliente:</span> 
                        <span className="font-bold text-slate-700 truncate max-w-[120px]">{order.clientName}</span>
                      </p>
                      <p className="flex flex-col mt-0.5">
                        <span className="text-slate-400 font-semibold">Endereço de Destino:</span> 
                        <span className="font-medium text-slate-700 mt-0.5 bg-slate-50 p-1 rounded border border-slate-100/50 leading-tight">
                          {order.address}
                        </span>
                      </p>
                      <p className="flex justify-between mt-1">
                        <span className="text-slate-400 font-semibold">CEP:</span> 
                        <span className="font-mono font-bold text-slate-700">{order.cep || 'Não informado'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Status:</span> 
                        <span className={`font-bold px-1.5 py-0.2 rounded-md ${
                          order.status === 'Concluído' ? 'bg-emerald-50 text-emerald-600' :
                          order.status === 'Cancelado' ? 'bg-slate-100 text-slate-500' :
                          order.status === 'Em rota' ? 'bg-blue-50 text-blue-600' :
                          order.status === 'Ocorrência' ? 'bg-rose-50 text-rose-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>{order.status}</span>
                      </p>
                      
                      {sequenceIndex !== -1 && (
                        <div className="mt-2.5 pt-2 border-t border-orange-100 flex items-center justify-between text-orange-700 font-extrabold bg-orange-50/50 -mx-2.5 -mb-2.5 px-2.5 py-1.5 rounded-b-lg">
                          <span className="text-[10px] uppercase tracking-wider flex items-center gap-1">
                            🚀 Ordem da Entrega
                          </span>
                          <span className="bg-orange-600 text-white px-2 py-0.5 text-xs font-black rounded-lg shadow-sm">
                            #{sequenceIndex + 1}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Delivery Rider Markers */}
          {filteredRiders.map((rider) => {
            const isSelected = selectedRiderId === rider.id;
            const riderCoords = getRiderGeoCoords(rider, { lat: hubLat, lng: hubLng });
            const isRealGps = !!(rider.realGeoLat && rider.realGeoLng) || rider.isGpsRealActive;

            return (
              <React.Fragment key={`rider-group-${rider.id}`}>
                {/* Real GPS accuracy circle (e.g. ±83 meters) */}
                {isRealGps && (
                  <Circle
                    center={riderCoords}
                    radius={rider.gpsAccuracy || 83}
                    pathOptions={{
                      color: isSelected ? '#3b82f6' : '#10b981',
                      fillColor: isSelected ? '#60a5fa' : '#34d399',
                      fillOpacity: 0.15,
                      weight: 1,
                      dashArray: '3, 3'
                    }}
                  />
                )}
                <Marker
                  position={riderCoords}
                  icon={createRiderIcon(rider, isSelected)}
                  eventHandlers={{
                    click: () => setSelectedRiderId(rider.id)
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.98} sticky>
                    <div className="px-2 py-1 font-sans text-xs font-bold text-slate-900 flex items-center gap-1.5 shadow-sm">
                      <span className={`w-2 h-2 rounded-full ${
                        rider.status === 'Em rota' ? 'bg-blue-500' :
                        rider.status === 'Disponível' ? 'bg-emerald-500' :
                        rider.status === 'Alerta' ? 'bg-rose-500' : 'bg-slate-400'
                      }`} />
                      <span>{rider.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({rider.vehicle})</span>
                    </div>
                  </Tooltip>
                  <Popup>
                  <div className="p-1 min-w-[200px] text-slate-800 space-y-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <img src={rider.avatar} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                      <div>
                        <h4 className="font-extrabold text-xs leading-tight">{rider.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.2 text-[8px] font-black rounded text-white ${
                            rider.status === 'Em rota' ? 'bg-blue-600' :
                            rider.status === 'Disponível' ? 'bg-emerald-600' :
                            rider.status === 'Alerta' ? 'bg-rose-600' : 'bg-slate-500'
                          }`}>
                            {rider.status}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold">{rider.vehicle}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Telefone:</span>
                        <span className="font-semibold text-slate-700">{rider.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Placa/Doc:</span>
                        <span className="font-semibold text-slate-700">{rider.vehiclePlate || 'N/A'}</span>
                      </div>
                    </div>

                    {isRealGps ? (
                      <div className="bg-emerald-950 text-emerald-300 p-2 rounded-lg font-mono text-[8.5px] space-y-0.5 border border-emerald-500/30">
                        <div className="flex items-center gap-1 text-emerald-400 font-sans font-black">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>📡 SINAL GPS REAL DO CELULAR</span>
                        </div>
                        <div>LAT: <strong className="text-white">{rider.realGeoLat?.toFixed(6)}</strong></div>
                        <div>LNG: <strong className="text-white">{rider.realGeoLng?.toFixed(6)}</strong></div>
                        <div>PRECISÃO: <strong className="text-emerald-200">±{Math.round(rider.gpsAccuracy || 0)}m</strong></div>
                        {rider.lastGpsUpdate && (
                          <div className="text-[7.5px] text-slate-400 pt-0.5 border-t border-slate-800">
                            Última sync: {rider.lastGpsUpdate}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 text-slate-500 p-1.5 rounded-lg text-[8.5px] font-medium border border-slate-200">
                        📍 Simulador de Deslocamento Ativo
                      </div>
                    )}

                    {/* Real-time OSRM ETA Card */}
                    {(() => {
                      const osrm = osrmEtas[rider.id];
                      const riderOrders = orders.filter(o => o.riderId === rider.id && o.status !== 'Concluído' && o.status !== 'Cancelado');
                      const nextOrder = riderOrders[0];

                      if (!nextOrder) {
                        return (
                          <div className="bg-slate-100 text-slate-600 p-2 rounded-xl text-[9.5px] font-bold text-center border border-slate-200 mt-1">
                            ✅ Sem entregas pendentes na fila.
                          </div>
                        );
                      }

                      return (
                        <div className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white p-2.5 rounded-xl text-[10px] space-y-1.5 shadow-md border border-blue-600/80 mt-1">
                          <div className="flex items-center justify-between font-extrabold text-blue-200">
                            <span className="flex items-center gap-1 uppercase tracking-wider text-[8.5px]">
                              🚀 OSRM / OpenStreetMap ETA
                            </span>
                            <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase">
                              Ao Vivo
                            </span>
                          </div>
                          
                          {osrm ? (
                            <>
                              <div className="text-xs font-black text-amber-300 flex items-center justify-between">
                                <span>⏱️ CHEGADA PREVISTA:</span>
                                <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-mono text-xs shadow-sm font-black">
                                  {osrm.etaClockTime}
                                </span>
                              </div>
                              <div className="text-[9.5px] text-blue-100 flex items-center justify-between pt-0.5 border-t border-blue-800/80">
                                <span>Tempo de Percurso: <strong>~{osrm.durationMinutes} min</strong></span>
                                <span>Distância: <strong>{osrm.distanceKm} km</strong></span>
                              </div>
                            </>
                          ) : (
                            <div className="text-[9px] text-blue-200 animate-pulse py-1">
                              Calculando rota real OSRM...
                            </div>
                          )}

                          <div className="text-[8.5px] text-blue-200/90 truncate border-t border-blue-800/80 pt-1 font-medium">
                            <strong>Próxima Parada:</strong> #{nextOrder.id.replace('ped-', '').toUpperCase()} • {nextOrder.clientName}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
          })}

          {/* Static and Active Interactive Polylines */}
          {/* Subtle connection lines from Hub to each online active rider */}
          {filteredRiders.map(rider => {
            if (rider.status === 'Offline') return null;
            const rPos = getRiderGeoCoords(rider, { lat: hubLat, lng: hubLng });
            return (
              <Polyline
                key={`poly-hub-rider-${rider.id}`}
                positions={[hub, rPos]}
                color={rider.status === 'Alerta' ? '#f43f5e' : '#3b82f6'}
                weight={1.5}
                opacity={0.3}
              />
            );
          })}

          {/* Real OSRM Street Polylines for Active Riders */}
          {filteredRiders.map(rider => {
            const osrm = osrmEtas[rider.id];
            if (!osrm || !osrm.geometry || osrm.geometry.length < 2) return null;
            const isSelected = selectedRiderId === rider.id;
            return (
              <Polyline
                key={`osrm-line-${rider.id}`}
                positions={osrm.geometry}
                color={isSelected ? '#2563eb' : '#0284c7'}
                weight={isSelected ? 5 : 3.5}
                opacity={isSelected ? 0.9 : 0.65}
              />
            );
          })}

          {/* Active Synced Polyline Path for Offline Cache Mode */}
          {isEffectiveOffline && cachedData?.activeRoutePoints && cachedData.activeRoutePoints.length > 1 && (
            <Polyline
              positions={cachedData.activeRoutePoints}
              color="#f59e0b"
              weight={4.5}
              opacity={0.9}
              dashArray="8, 6"
            />
          )}

          {/* High-fidelity primary route line overlays for selected rider */}
          {selectedRider && selectedRider.status !== 'Offline' && showOptimizedRoute && (
            <>
              {/* Hub to Rider (Initial position leg) */}
              <Polyline
                positions={[
                  hub,
                  getRiderGeoCoords(selectedRider, { lat: hubLat, lng: hubLng })
                ]}
                color="#0284c7"
                weight={3}
                opacity={0.6}
                dashArray="6, 6"
              />

              {/* High-fidelity active route sequence of the rider (Continuous sequential leg path originating from Rider to Stops) */}
              {sortedActiveRiderOrders.length > 0 && (() => {
                const riderPos = getRiderGeoCoords(selectedRider, { lat: hubLat, lng: hubLng });
                const pointsFromRider: [number, number][] = [riderPos];
                const pointsFromHub: [number, number][] = [hub];

                sortedActiveRiderOrders.forEach(o => {
                  const coords = getCoordinatesFromCep(o.cep, o.region, o.address, o.lat, o.lng);
                  pointsFromRider.push([coords.lat, coords.lng]);
                  pointsFromHub.push([coords.lat, coords.lng]);
                });

                return (
                  <React.Fragment key={`rider-opt-route-${selectedRider.id}`}>
                    {/* Background glow polyline */}
                    <Polyline
                      positions={pointsFromRider}
                      color="#0284c7"
                      weight={8}
                      opacity={0.35}
                    />
                    {/* Main vibrant foreground route polyline */}
                    <Polyline
                      positions={pointsFromRider}
                      color="#f97316"
                      weight={4.5}
                      opacity={0.95}
                    />
                  </React.Fragment>
                );
              })()}
            </>
          )}

        </LeafletMapContainer>
        </SafeMapWrapper>

        {/* Selected Rider Optimized Route Overlay Summary Card */}
        {selectedRider && sortedActiveRiderOrders.length > 0 && showOptimizedRoute && (
          <div className="absolute bottom-16 left-4 z-[998] bg-slate-900/90 text-white backdrop-blur-md border border-sky-500/40 rounded-2xl p-3 shadow-2xl max-w-xs space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 font-extrabold text-sky-400">
                <Navigation size={14} className="animate-pulse" />
                <span>Rota Otimizada Ativa</span>
              </div>
              <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold uppercase tracking-wider">
                {sortedActiveRiderOrders.length} {sortedActiveRiderOrders.length === 1 ? 'Parada' : 'Paradas'}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>Condutor: <strong className="text-sky-300">{selectedRider.name}</strong></span>
              </p>
              <div className="flex items-center gap-1 font-mono text-[9.5px] text-slate-300 overflow-x-auto py-1 scrollbar-none">
                <span className="bg-slate-800 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">Hub</span>
                <span>➔</span>
                <span className="bg-slate-800 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">Condutor</span>
                <span>➔</span>
                {sortedActiveRiderOrders.map((o, idx) => (
                  <React.Fragment key={o.id}>
                    <span className="bg-sky-950 text-sky-300 font-bold px-1.5 py-0.5 rounded border border-sky-500/30 shrink-0">
                      #{idx + 1} ({o.clientName?.split(' ')[0] || 'Parada'})
                    </span>
                    {idx < sortedActiveRiderOrders.length - 1 && <span>➔</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Offline Cache Status Banner Overlay on Map Canvas */}
        {isEffectiveOffline && (
          <div className="absolute bottom-3 left-4 right-4 z-[999] bg-slate-900/95 text-white backdrop-blur-md border border-amber-500/40 rounded-xl p-3 shadow-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
                <HardDrive size={16} className="animate-pulse" />
              </span>
              <div className="min-w-0">
                <span className="font-extrabold text-amber-300 block text-xs tracking-tight">
                  Visualização Off-Grid — Rota e Hubs Carregados do Cache Local
                </span>
                <span className="text-[10px] text-slate-300 truncate block mt-0.5">
                  Sede: <strong className="text-white font-mono">{hubName}</strong> ({hubLat.toFixed(4)}, {hubLng.toFixed(4)}) • <strong className="text-amber-200">{mapOrdersToShow.length} paradas</strong> salvas em cache.
                </span>
              </div>
            </div>

            {cachedData?.timestamp && (
              <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Última Sync</span>
                <span className="font-mono text-xs font-bold text-emerald-400">{cachedData.timestamp}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Legend Footer overlay */}
      <div className="bg-white border-t border-slate-100 px-5 py-3 flex flex-wrap items-center justify-between gap-4 z-10" id="map-legend">
        <div className="flex items-center gap-4.5 text-xs text-slate-500 font-semibold" id="map-legend-items">
          <button 
            onClick={() => setActiveLegendFilter(activeLegendFilter === 'Em rota' ? null : 'Em rota')}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              activeLegendFilter === 'Em rota' ? 'bg-blue-50 text-blue-700 font-extrabold' : 'hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Em Rota ({riders.filter(r => r.status === 'Em rota').length})</span>
          </button>
          
          <button 
            onClick={() => setActiveLegendFilter(activeLegendFilter === 'Disponível' ? null : 'Disponível')}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              activeLegendFilter === 'Disponível' ? 'bg-emerald-50 text-emerald-700 font-extrabold' : 'hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Disponíveis ({riders.filter(r => r.status === 'Disponível').length})</span>
          </button>
          
          <button 
            onClick={() => setActiveLegendFilter(activeLegendFilter === 'Alerta' ? null : 'Alerta')}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              activeLegendFilter === 'Alerta' ? 'bg-rose-50 text-rose-700 font-extrabold' : 'hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Alerta/Incidente ({riders.filter(r => r.status === 'Alerta').length})</span>
          </button>
          
          <button 
            onClick={() => setActiveLegendFilter(activeLegendFilter === 'Offline' ? null : 'Offline')}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              activeLegendFilter === 'Offline' ? 'bg-slate-100 text-slate-700 font-extrabold' : 'hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Offline ({riders.filter(r => r.status === 'Offline').length})</span>
          </button>
        </div>

        {activeLegendFilter && (
          <button 
            onClick={() => setActiveLegendFilter(null)}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-extrabold uppercase cursor-pointer"
          >
            Limpar Filtro da Legenda
          </button>
        )}
      </div>

      {/* Dynamic Popover/Slide-over detailing active rider details */}
      <AnimatePresence>
        {selectedRider && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-16 bottom-0 right-0 w-80 bg-white border-l border-slate-100 shadow-2xl z-[1001] flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()} // Stop propagation from closing
            id="map-rider-popup-overlay"
          >
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              
              {/* Header Profile details */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={selectedRider.avatar} 
                      alt={selectedRider.name} 
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <span className={`absolute -bottom-1 -right-1 px-1 py-0.5 rounded text-[8px] font-extrabold shadow border border-white ${getStatusColor(selectedRider.status)}`}>
                      {selectedRider.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{selectedRider.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                      <span>★ {selectedRider.rating.toFixed(1)}</span>
                      <span>•</span>
                      <span>Veículo: {selectedRider.vehicle}</span>
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedRiderId(null)}
                  className="p-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Status Indicator Alerts */}
              {selectedRider.batteryPercent <= 20 && selectedRider.status !== 'Offline' && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 flex items-start gap-2.5 text-xs font-semibold">
                  <ShieldAlert size={16} className="shrink-0 text-rose-500 mt-0.5" />
                  <div>
                    <span className="block font-bold">Incidente de Bateria Crítica</span>
                    <span className="text-[11px] leading-relaxed text-rose-600 font-medium">Bateria do celular do entregador está em {selectedRider.batteryPercent}%. Risco iminente de perda de sinal de GPS!</span>
                  </div>
                </div>
              )}

              {/* Grid with core rider stats */}
              <div className="grid grid-cols-2 gap-3" id="rider-popup-metrics">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Concluídas</span>
                  <span className="text-sm font-extrabold text-slate-800">{selectedRider.completedDeliveries} entregas</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Bateria Celular</span>
                  <span className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Battery size={14} className={selectedRider.batteryPercent <= 20 ? 'text-rose-500' : 'text-emerald-500'} />
                    <span>{selectedRider.batteryPercent}%</span>
                  </span>
                </div>
              </div>

              {/* Active Delivery information */}
              {selectedRiderOrder ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3" id="rider-popup-delivery-card">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                        Próxima: {selectedRiderOrder.id}
                      </span>
                      {selectedRiderOrder.timeRemaining && (
                        <span className="text-[11px] font-bold text-slate-600 font-mono flex items-center gap-1">
                          ⏱ {selectedRiderOrder.timeRemaining} min rest.
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Destinatário</span>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5">{selectedRiderOrder.clientName}</span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5 leading-normal">{selectedRiderOrder.address}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-blue-100/40 text-xs text-blue-700 font-semibold">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={12} className="text-blue-500 shrink-0" />
                        <span className="truncate">Região: {selectedRiderOrder.region}</span>
                      </div>
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0">
                        {selectedRiderOrder.status}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Queue (Fila de Entregas) if there are multiple active orders */}
                  {sortedActiveRiderOrders.length > 1 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                        Fila de Entregas ({sortedActiveRiderOrders.length} pendentes)
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {sortedActiveRiderOrders.map((order, idx) => (
                          <OrderQuickViewTooltip key={order.id} order={order} rider={selectedRider} className="w-full">
                            <div 
                              className={`p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                order.id === selectedRiderOrder?.id 
                                  ? 'bg-blue-50/60 border-blue-200' 
                                  : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-[10px] text-blue-600 font-mono">
                                    {idx + 1}º
                                  </span>
                                  <span className="font-bold text-slate-700 truncate">
                                    #{order.id}
                                  </span>
                                  <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold uppercase border shrink-0 ${
                                    order.status === 'Não iniciado' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                    order.status === 'Em rota' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                    'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}>
                                    {order.status}
                                  </span>
                                </div>
                                <div className="text-slate-500 font-medium truncate mt-0.5 leading-tight">
                                  {order.clientName} • {order.address}
                                </div>
                              </div>
                            </div>
                          </OrderQuickViewTooltip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center text-xs font-semibold py-6 text-slate-400">
                  Nenhum pedido atrelado no momento. Disponível para despacho de novas demandas.
                </div>
              )}

              {/* Action buttons list */}
              <div className="space-y-2 pt-2">
                <a 
                  href={`tel:${selectedRider.phone}`}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-200/50"
                >
                  <Phone size={14} />
                  <span>Ligar para Entregador</span>
                </a>
                <button 
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-50"
                  id="rider-popup-chat-btn"
                >
                  <Smartphone size={14} />
                  <span>Enviar Alerta Push</span>
                </button>
              </div>

            </div>

            {/* Sticky contact details bottom footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-[10px] font-mono text-slate-400">Rastreamento ID: {selectedRider.id}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
