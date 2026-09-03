/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Order, DeliveryRider, ActivityLog, OrderStatus, CompanyHub } from '../types';
import { resolveOrderDisplayName } from '../utils/partnerUtils';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import { 
  Zap, 
  MapPin, 
  Truck, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Navigation, 
  RefreshCw, 
  Check, 
  Play,
  Layers,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  Info,
  ExternalLink,
  Smartphone,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Retrieve Leaflet L from the window context safely inside component/effects to avoid race conditions.

import { getCoordinatesFromCep } from '../utils/locationUtils';
import { initLeafletPosGuard } from '../utils/leafletPatch';
import { isOrderMatchingRider } from '../utils/partnerUtils';
import OrderQuickViewTooltip from './OrderQuickViewTooltip';

interface OtimizadorRotasInteligenteProps {
  riders: DeliveryRider[];
  orders: Order[];
  onUpdateRiderCoords: (riderId: string, lat: number, lng: number) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, reason?: string) => void;
  onSaveLogs: (logs: ActivityLog[]) => void;
  onUpdateOrders: (updatedOrders: Order[]) => void;
  activeHub?: CompanyHub;
}

interface AIInsightResponse {
  summary: string;
  tips: {
    title: string;
    description: string;
    type: 'traffic' | 'weather' | 'battery' | 'safety';
  }[];
  efficiencyScore: number;
}

export default function OtimizadorRotasInteligente({
  riders,
  orders,
  onUpdateRiderCoords,
  onUpdateOrderStatus,
  onSaveLogs,
  onUpdateOrders,
  activeHub
}: OtimizadorRotasInteligenteProps) {
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationLogs, setOptimizationLogs] = useState<string[]>([]);
  const [showOptimized, setShowOptimized] = useState(true);
  const [aiInsights, setAiInsights] = useState<AIInsightResponse | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Persistent custom order sequences (linked with RiderTrackingView and localStorage)
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

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routesGroupRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(!!(window as any).L);

  // Check if Leaflet loads dynamically if not loaded yet
  useEffect(() => {
    if (!leafletLoaded) {
      const interval = setInterval(() => {
        if ((window as any).L) {
          setLeafletLoaded(true);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [leafletLoaded]);

  // Select first available rider with pending orders by default
  useEffect(() => {
    if (riders.length > 0 && !selectedRiderId) {
      const riderWithOrders = riders.find(r => 
        orders.some(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado')
      );
      if (riderWithOrders) {
        setSelectedRiderId(riderWithOrders.id);
      } else {
        setSelectedRiderId(riders[0].id);
      }
    }
  }, [riders, orders, selectedRiderId]);

  const selectedRider = riders.find(r => r.id === selectedRiderId);

  // Get current pending orders for this rider
  const riderPendingOrders = selectedRiderId
    ? orders.filter(o => isOrderMatchingRider(o, selectedRiderId, riders) && o.status !== 'Concluído' && o.status !== 'Cancelado')
    : [];

  // Helper coordinate resolution from svg to Geo coordinates
  const getOrderCoords = (order: Order) => {
    let bx = 500;
    let by = 300;
    if (order.region === 'Centro') { bx = 450; by = 240; }
    else if (order.region === 'Zona Sul') { bx = 560; by = 450; }
    else if (order.region === 'Zona Oeste') { bx = 220; by = 340; }
    else if (order.region === 'Zona Norte') { bx = 650; by = 130; }

    const idNum = parseInt(order.id.replace(/\D/g, '') || '0', 10) || 1;
    const jitterX = ((idNum % 7) - 3) * 22;
    const jitterY = ((idNum % 5) - 2) * 22;
    return { x: bx + jitterX, y: by + jitterY };
  };

  const convertToGeoLat = (svgLatPercent: number) => -23.52 - (svgLatPercent / 100) * 0.12;
  const convertToGeoLng = (svgLngPercent: number) => -46.72 + (svgLngPercent / 100) * 0.18;

  const getOrderGeoCoords = (order: Order) => {
    const coords = getCoordinatesFromCep(order.cep, order.region, order.address, order.lat, order.lng);
    return [coords.lat, coords.lng] as [number, number];
  };

  const getRiderGeoCoords = (rider: DeliveryRider) => {
    if (rider.isGpsRealActive && rider.realGeoLat !== undefined && rider.realGeoLng !== undefined) {
      return [rider.realGeoLat, rider.realGeoLng] as [number, number];
    }
    if (rider.realGeoLat !== undefined && rider.realGeoLng !== undefined && rider.realGeoLat < -10) {
      return [rider.realGeoLat, rider.realGeoLng] as [number, number];
    }
    if (rider.lat < -10) {
      return [rider.lat, rider.lng] as [number, number];
    }
    const latPercent = rider.lat;
    const lngPercent = rider.lng;
    return [convertToGeoLat(latPercent), convertToGeoLng(lngPercent)] as [number, number];
  };

  const getBaseCdCoords = (): [number, number] => {
    return activeHub ? [activeHub.lat, activeHub.lng] : [-23.5385556, -46.70118];
  };

  // Distance helper (Euclidean distance on Geo coordinates)
  const calculateDistance = (coord1: [number, number], coord2: [number, number]) => {
    const latDiff = coord1[0] - coord2[0];
    const lngDiff = coord1[1] - coord2[1];
    // Scale difference to approximate km (1 deg Lat ≈ 111km, 1 deg Lng ≈ 102km in SP)
    return Math.sqrt(Math.pow(latDiff * 111, 2) + Math.pow(lngDiff * 102, 2));
  };

  // Extract sequence of order IDs
  const getOriginalSequenceIds = () => {
    return riderPendingOrders.map(o => o.id);
  };

  const getCustomSequenceIds = () => {
    const currentSeq = customOrderSequences[selectedRiderId] || [];
    // Filter to only include active pending order IDs
    const activePendingIds = riderPendingOrders.map(o => o.id);
    const filteredSeq = currentSeq.filter(id => activePendingIds.includes(id));
    
    // Add missing pending IDs to the end
    activePendingIds.forEach(id => {
      if (!filteredSeq.includes(id)) {
        filteredSeq.push(id);
      }
    });
    return filteredSeq;
  };

  // Heuristic TSP solver starting from Base Central (HUB) coordinates
  const calculateOptimizedSequenceIds = () => {
    if (!selectedRider || riderPendingOrders.length === 0) return [];
    
    const startCoord = getBaseCdCoords();
    const pending = [...riderPendingOrders];
    const optimizedIds: string[] = [];
    
    let currentCoord = startCoord;
    while (pending.length > 0) {
      let closestIdx = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < pending.length; i++) {
        const orderCoord = getOrderGeoCoords(pending[i]);
        const dist = calculateDistance(currentCoord, orderCoord);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }
      
      const nextOrder = pending.splice(closestIdx, 1)[0];
      optimizedIds.push(nextOrder.id);
      currentCoord = getOrderGeoCoords(nextOrder);
    }
    
    return optimizedIds;
  };

  const currentSequenceIds = showOptimized ? calculateOptimizedSequenceIds() : getOriginalSequenceIds();

  // Calculate metrics for original sequence vs optimized sequence
  const calculateMetrics = (seqIds: string[]) => {
    if (!selectedRider || seqIds.length === 0) {
      return { distance: 0, time: 0, fuelCost: 0, co2: 0 };
    }
    
    const startCoord = getBaseCdCoords();
    let totalDist = 0;
    let currentCoord = startCoord;
    
    seqIds.forEach(id => {
      const order = riderPendingOrders.find(o => o.id === id);
      if (order) {
        const orderCoord = getOrderGeoCoords(order);
        totalDist += calculateDistance(currentCoord, orderCoord);
        currentCoord = orderCoord;
      }
    });

    // Moto fuel cost: R$ 0.45 per km; time: average 25 km/h in SP including traffic; CO2: 0.12 kg per km
    const timeInMinutes = Math.round((totalDist / 22) * 60 + seqIds.length * 7); // average speed 22km/h + 7 min per checkout
    const fuelCost = totalDist * 0.48;
    const co2 = totalDist * 0.115;
    
    return {
      distance: parseFloat(totalDist.toFixed(1)),
      time: timeInMinutes,
      fuelCost: parseFloat(fuelCost.toFixed(2)),
      co2: parseFloat(co2.toFixed(2))
    };
  };

  const originalMetrics = calculateMetrics(getOriginalSequenceIds());
  const optimizedMetrics = calculateMetrics(calculateOptimizedSequenceIds());
  
  // Percent savings
  const distanceSavingsPercent = originalMetrics.distance > 0 
    ? Math.round(((originalMetrics.distance - optimizedMetrics.distance) / originalMetrics.distance) * 100)
    : 0;
  
  const timeSavingsPercent = originalMetrics.time > 0
    ? Math.round(((originalMetrics.time - optimizedMetrics.time) / originalMetrics.time) * 100)
    : 0;

  // Render Leaflet Map
  useEffect(() => {
    initLeafletPosGuard();
    if (!leafletLoaded || !mapContainerRef.current || !selectedRider) return;

    const L = (window as any).L;
    if (!L) return;

    const container = mapContainerRef.current;

    // Reset Map instance if already created
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        // ignore map cleanup error
      }
      mapInstanceRef.current = null;
    }

    if ((container as any)._leaflet_id && !mapInstanceRef.current) {
      delete (container as any)._leaflet_id;
    }

    const riderCoords = getRiderGeoCoords(selectedRider);
    
    // Create Map
    const map = L.map(container, {
      center: riderCoords,
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });
    
    mapInstanceRef.current = map;

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Standard high-contrast clean tiles
    const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const tiles = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

    // Add marker and polyline groups
    markersGroupRef.current = L.layerGroup().addTo(map);
    routesGroupRef.current = L.layerGroup().addTo(map);

    // Fit map bounds initially
    if (riderPendingOrders.length > 0) {
      const bounds = L.latLngBounds([riderCoords]);
      riderPendingOrders.forEach(o => {
        bounds.extend(getOrderGeoCoords(o));
      });
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore map cleanup error
        }
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, selectedRiderId]);

  // Update Route Polylines and Markers whenever sequence or showOptimized changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedRider || !markersGroupRef.current || !routesGroupRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Clear old layers
    try {
      markersGroupRef.current.clearLayers();
      routesGroupRef.current.clearLayers();
    } catch (e) {
      console.warn("Leaflet clearLayers error suppressed:", e);
    }

    const map = mapInstanceRef.current;
    const riderCoords = getRiderGeoCoords(selectedRider);

    // Custom Icon for Central CD Base
    const baseIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white shadow-lg border-2 border-white overflow-hidden p-0.5">
          <img src="${activeHub?.logoUrl || vinimapLogo}" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null;this.src='${vinimapLogo}';" />
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    
    // Custom Icon for Rider
    const riderIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white shadow-xl border-2 border-white relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-4v11"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
          <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white"></span>
        </div>
      `,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    // Plot Base CD
    const cdCoords: [number, number] = getBaseCdCoords(); // Rua Cerro Corá 385, Vila Romana (-23.5385556, -46.70118)
    L.marker(cdCoords, { icon: baseIcon }).addTo(markersGroupRef.current)
      .bindPopup(`<strong class="text-xs">${activeHub ? activeHub.name : 'Sede Ativa Vinimap Principal'}</strong><p class="text-[10px] text-slate-500 m-0">Início e fim de turno operacional.</p>`);

    // Plot Rider
    L.marker(riderCoords, { 
      icon: riderIcon,
      title: `${selectedRider.name} (${selectedRider.vehicle})`
    })
      .addTo(markersGroupRef.current)
      .bindTooltip(`
        <div class="px-2 py-1 font-sans text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>${selectedRider.name}</span>
          <span class="text-[10px] text-slate-500 font-semibold">(${selectedRider.vehicle})</span>
        </div>
      `, { direction: 'top', offset: [0, -18], opacity: 0.98 })
      .bindPopup(`<strong class="text-xs">Condutor: ${selectedRider.name}</strong><p class="text-[10px] text-slate-500 m-0">Veículo: ${selectedRider.vehicle} • Bateria: ${selectedRider.batteryPercent}%</p>`);

    // Plot Orders along sequence originating from Base Central (HUB)
    const polylineCoords: [number, number][] = [cdCoords];
    const sequenceToUse = showOptimized ? calculateOptimizedSequenceIds() : getOriginalSequenceIds();

    sequenceToUse.forEach((orderId, index) => {
      const order = riderPendingOrders.find(o => o.id === orderId);
      if (!order) return;

      const orderCoords = getOrderGeoCoords(order);
      polylineCoords.push(orderCoords);

      // Unique sequence marker
      const markerColor = showOptimized ? 'bg-emerald-600' : 'bg-slate-700';
      const orderIcon = L.divIcon({
        html: `
          <div class="flex flex-col items-center justify-center w-7 h-7 rounded-full ${markerColor} text-white shadow-md border-2 border-white relative font-extrabold text-[11px]">
            ${index + 1}
          </div>
        `,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      L.marker(orderCoords, { icon: orderIcon }).addTo(markersGroupRef.current)
        .bindPopup(`
          <div class="text-xs p-1">
            <div class="font-bold text-slate-800 text-[11px] mb-0.5">Parada #${index + 1} • ${resolveOrderDisplayName(order.clientName)}</div>
            <div class="text-[10px] text-slate-500 mb-1">${order.address}</div>
            <div class="flex items-center gap-1">
              <span class="px-1.5 py-0.5 text-[9px] bg-slate-150 rounded text-slate-700">${order.region}</span>
            </div>
          </div>
        `);
    });

    // Draw route line
    if (polylineCoords.length > 1) {
      const routeColor = showOptimized ? '#059669' : '#475569';
      const routeLine = L.polyline(polylineCoords, {
        color: routeColor,
        weight: 4.5,
        opacity: 0.85,
        lineJoin: 'round',
        dashArray: showOptimized ? '10, 5' : ''
      }).addTo(routesGroupRef.current);

      // Draw arrowheads along polyline for direction
      if ((L as any).polylineDecorator && showOptimized) {
        // polylineDecorator plugin is optional, we fallback to clean polylines
      }
    }

  }, [selectedRiderId, showOptimized, orders]);

  // Request AI route analysis insights from backend Gemini API
  const handleFetchAiInsights = async () => {
    if (!selectedRider || riderPendingOrders.length === 0) return;
    
    setIsLoadingInsights(true);
    setAiInsights(null);

    const activeSeq = showOptimized ? calculateOptimizedSequenceIds() : getOriginalSequenceIds();
    const orderedPendingList = activeSeq.map(id => riderPendingOrders.find(o => o.id === id)).filter(Boolean);

    try {
      const response = await fetch('/api/routing/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderName: selectedRider.name,
          vehicle: selectedRider.vehicle,
          batteryPercent: selectedRider.batteryPercent,
          orders: orderedPendingList,
          metrics: showOptimized ? optimizedMetrics : originalMetrics,
          savingsPercent: distanceSavingsPercent,
          isOptimized: showOptimized
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI insights from server');
      }

      const data = await response.json();
      setAiInsights(data);
    } catch (e) {
      console.warn('AI Insights error, running local fallback logic:', e);
      // Fallback rule-based Portuguese generation
      setTimeout(() => {
        const fallback: AIInsightResponse = {
          summary: `Análise preditiva para o condutor ${selectedRider.name} em rota de entrega no ${riderPendingOrders[0]?.region || 'Centro'}. A rota otimizada reorganizou as entregas visando mitigar pontos de congestionamento comuns no tráfego urbano de São Paulo e aproximar sequencialmente paradas na mesma vizinhança.`,
          tips: [
            {
              title: "Economia Hidráulica/Bateria",
              description: `A rota sequencial atual economiza aproximadamente R$ ${(originalMetrics.fuelCost - optimizedMetrics.fuelCost).toFixed(2)} de recursos operacionais diretos e poupa ${distanceSavingsPercent}% de desgaste mecânico do veículo (${selectedRider.vehicle}).`,
              type: "battery"
            },
            {
              title: "Condições de Trânsito",
              description: `Previsão de lentidão nas vias coletoras da região ${riderPendingOrders[0]?.region || 'Centro'}. Recomenda-se evitar cruzamentos em grandes avenidas e dar preferência para vias secundárias indicadas pelo GPS.`,
              type: "traffic"
            },
            {
              title: "Alerta de Segurança Operacional",
              description: "Mantenha o aplicativo do entregador ativo em segundo plano para o correto registro das confirmações digitais por foto na entrega.",
              type: "safety"
            }
          ],
          efficiencyScore: 100 - (optimizedMetrics.distance / (originalMetrics.distance || 1)) * 40
        };
        setAiInsights(fallback);
      }, 1000);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // Auto-fetch insights when selected rider changes
  useEffect(() => {
    if (selectedRiderId && riderPendingOrders.length > 0) {
      handleFetchAiInsights();
    }
  }, [selectedRiderId, showOptimized]);

  // Execute sequence optimization animation simulation
  const handleOptimizeAction = () => {
    setIsOptimizing(true);
    setOptimizationLogs([]);

    const steps = [
      "Consultando mapa regional e banco de dados operacional...",
      "Identificando posição GPS em tempo real do condutor...",
      "Processando coordenadas georreferenciadas das paradas...",
      "Executando Heurística TSP (Nearest Neighbor Optimization)...",
      "Calculando matriz de distâncias e trajetórias ótimas...",
      "Otimização finalizada com IA! Nova sequência estabelecida."
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setOptimizationLogs(prev => [...prev, step]);
        if (index === steps.length - 1) {
          setIsOptimizing(false);
          setShowOptimized(true);
          
          // Generate success log
          const newLog: ActivityLog = {
            id: `log-opt-${Date.now()}`,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            type: 'success',
            message: `Otimizador IA recalculou sequência de entregas para ${selectedRider?.name || 'condutor'}. Redução de ${distanceSavingsPercent}% de quilometragem.`,
          };
          onSaveLogs([newLog]);
        }
      }, (index + 1) * 450);
    });
  };

  // Commit and apply the optimized sequence to the active delivery system
  const handleApplySequence = () => {
    if (!selectedRider) return;

    const optimizedIds = calculateOptimizedSequenceIds();
    
    // Save to State and LocalStorage
    const newSequences = {
      ...customOrderSequences,
      [selectedRiderId]: optimizedIds
    };
    
    setCustomOrderSequences(newSequences);
    localStorage.setItem('vinimap_custom_order_sequences', JSON.stringify(newSequences));

    // Dispatch custom event to trigger updates elsewhere in UI
    window.dispatchEvent(new CustomEvent('vinimap_sequence_updated', {
      detail: { riderId: selectedRiderId, sequence: optimizedIds }
    }));

    // Generate log entry
    const newLog: ActivityLog = {
      id: `log-apply-${Date.now()}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type: 'info',
      message: `Sequência de rota otimizada por IA foi aplicada para o condutor ${selectedRider.name}. Despacho e rastreador atualizados.`,
    };
    onSaveLogs([newLog]);

    // Show a beautiful temporary success highlight alert
    alert(`Sucesso! A rota otimizada foi aplicada para ${selectedRider.name}. O condutor receberá a nova sequência imediatamente no aplicativo.`);
  };

  return (
    <div className="space-y-6" id="intelligent-route-optimizer-container">
      {/* HEADER CARD */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Sparkles size={18} className="animate-pulse" />
            </span>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight font-sans">
              Otimizador de Rotas Inteligente (IA)
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Heurística matemática de menor caminho combinada com modelos inteligentes Gemini para ordenação sequencial de faturamento e entrega rápida. Reduza custos, tempo de entrega e emissões de carbono com um clique.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleFetchAiInsights}
            className="p-2 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center justify-center"
            title="Recarregar Insights Inteligentes"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={handleOptimizeAction}
            disabled={isOptimizing || riderPendingOrders.length <= 1}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Zap size={14} className="animate-bounce" />
            <span>Executar Otimização</span>
          </button>
        </div>
      </div>

      {/* CORE OPERATIONAL HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CONTROLS & SEQUENCE LIST (5/12 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SELECTOR CARD */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Condutor em Foco</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Selecione o entregador para inspecionar, ordenar e aplicar rotas.</p>
            </div>

            <div className="space-y-3">
              <select
                value={selectedRiderId}
                onChange={(e) => {
                  setSelectedRiderId(e.target.value);
                  setAiInsights(null);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                {riders.map(r => {
                  const pendingCount = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.vehicle}) — {pendingCount} entregas pendentes
                    </option>
                  );
                })}
              </select>

              {selectedRider && (
                <div className="p-3.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={selectedRider.avatar} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{selectedRider.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-600 font-bold uppercase text-[9px]">{selectedRider.vehicle}</span>
                        <span>•</span>
                        <span className={selectedRider.status === 'Disponível' ? 'text-emerald-600 font-bold' : 'text-blue-600 font-bold'}>
                          {selectedRider.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-medium">Bateria do GPS</div>
                    <div className={`text-xs font-mono font-bold mt-0.5 ${selectedRider.batteryPercent <= 20 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                      {selectedRider.batteryPercent}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE QUEUE SEQUENCE CARD */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Sequência Operacional</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Visualização e manipulação do fluxo ordenado de faturamento.</p>
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                <button
                  onClick={() => setShowOptimized(false)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    !showOptimized 
                      ? 'bg-white text-slate-800 shadow-xs' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Fila Original
                </button>
                <button
                  onClick={() => setShowOptimized(true)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    showOptimized 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Fila Otimizada
                </button>
              </div>
            </div>

            {/* Simulated Animation Panel */}
            <AnimatePresence>
              {isOptimizing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin text-emerald-600" />
                    <span className="text-[10px] font-bold text-emerald-700">Calculando Solução Menor Caminho (IA)...</span>
                  </div>
                  <div className="font-mono text-[9px] text-emerald-600/80 space-y-0.5 max-h-[100px] overflow-y-auto">
                    {optimizationLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-emerald-400">✓</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* HUB ORIGIN BADGE */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-[11px]">
                <MapPin size={13} className="text-emerald-600" />
                <span>Origem: {activeHub ? activeHub.name : 'Base ViniMap (Sede)'}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Ponto 0.0 km</span>
            </div>

            {/* ORDERS TIMELINE SEQUENCE */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {riderPendingOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Não há pedidos pendentes atribuídos a este condutor para otimização.
                </div>
              ) : (
                (() => {
                  const hubCoord = getBaseCdCoords();
                  let prevCoord = hubCoord;

                  return currentSequenceIds.map((orderId, idx) => {
                    const order = riderPendingOrders.find(o => o.id === orderId);
                    if (!order) return null;

                    const orderCoord = getOrderGeoCoords(order);
                    const distFromPrev = calculateDistance(prevCoord, orderCoord);
                    const distFromHub = calculateDistance(hubCoord, orderCoord);
                    prevCoord = orderCoord;

                    return (
                      <OrderQuickViewTooltip key={order.id} order={order} rider={selectedRider} className="w-full">
                        <div 
                          className={`flex gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            showOptimized 
                              ? 'bg-emerald-50/20 border-emerald-100/50 hover:bg-emerald-50/45' 
                              : 'bg-slate-50/40 border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col items-center shrink-0">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] ${
                              showOptimized ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
                            }`}>
                              {idx + 1}
                            </span>
                            {idx < currentSequenceIds.length - 1 && (
                              <div className={`w-0.5 h-10 border-l ${showOptimized ? 'border-emerald-300' : 'border-slate-300'} border-dashed mt-1`} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px] truncate">{resolveOrderDisplayName(order.clientName)}</span>
                              <span className="font-mono text-[10px] text-slate-400">{order.id}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{order.address}</p>
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">{order.region}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  order.priority === 'Alta' 
                                    ? 'bg-rose-50 text-rose-600' 
                                    : order.priority === 'Média' 
                                    ? 'bg-amber-50 text-amber-600' 
                                    : 'bg-slate-100 text-slate-500'
                                }`}>{order.priority}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 shrink-0">
                                <span className="text-emerald-700 font-bold" title="Distância até este ponto">+ {distFromPrev.toFixed(1)} km</span>
                                <span className="text-slate-300">•</span>
                                <span title="Distância direta da Base ViniMap">Base ViniMap: {distFromHub.toFixed(1)} km</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </OrderQuickViewTooltip>
                    );
                  });
                })()
              )}
            </div>

            {/* APPLY ACTION */}
            {riderPendingOrders.length > 0 && (
              <button
                onClick={handleApplySequence}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle size={14} />
                <span>Aplicar Sequência Otimizada</span>
              </button>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: MAP & METRICS & CO-PILOT (7/12 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* COMPARISON METRICS PANEL */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm font-sans">Métricas Comparativas de Eficiência</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Indicadores projetados de redução de percurso e custos logísticos operacionais.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* DISTANCE */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1 relative overflow-hidden border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Distância Total</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-slate-800 font-mono">
                    {showOptimized ? optimizedMetrics.distance : originalMetrics.distance} km
                  </span>
                  {!showOptimized && optimizedMetrics.distance < originalMetrics.distance && (
                    <span className="text-[9px] text-emerald-600 font-extrabold">-{distanceSavingsPercent}% IA</span>
                  )}
                </div>
                {showOptimized && distanceSavingsPercent > 0 && (
                  <span className="text-[9px] text-emerald-600 font-extrabold flex items-center gap-0.5">
                    <TrendingUp size={10} /> Economia: {distanceSavingsPercent}%
                  </span>
                )}
              </div>

              {/* TIME */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1 relative overflow-hidden border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tempo Estimado</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-slate-800 font-mono">
                    {showOptimized ? optimizedMetrics.time : originalMetrics.time} min
                  </span>
                  {!showOptimized && optimizedMetrics.time < originalMetrics.time && (
                    <span className="text-[9px] text-emerald-600 font-extrabold">-{timeSavingsPercent}% IA</span>
                  )}
                </div>
                {showOptimized && timeSavingsPercent > 0 && (
                  <span className="text-[9px] text-emerald-600 font-extrabold flex items-center gap-0.5">
                    <TrendingUp size={10} /> Redução: {timeSavingsPercent}%
                  </span>
                )}
              </div>

              {/* FUEL COST */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Custo Operacional</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono block">
                  R$ {showOptimized ? optimizedMetrics.fuelCost.toFixed(2) : originalMetrics.fuelCost.toFixed(2)}
                </span>
                {showOptimized && originalMetrics.fuelCost > optimizedMetrics.fuelCost && (
                  <span className="text-[9px] text-emerald-600 font-bold block">
                    Poupa R$ {(originalMetrics.fuelCost - optimizedMetrics.fuelCost).toFixed(2)}
                  </span>
                )}
              </div>

              {/* CARBON CO2 */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1 border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pegada CO₂</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono block">
                  {showOptimized ? optimizedMetrics.co2.toFixed(2) : originalMetrics.co2.toFixed(2)} kg
                </span>
                {showOptimized && originalMetrics.co2 > optimizedMetrics.co2 && (
                  <span className="text-[9px] text-emerald-600 font-bold block">
                    Carbono: -{distanceSavingsPercent}%
                  </span>
                )}
              </div>

            </div>
          </div>

          {/* LEAFLET MAP CONTAINER */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col relative h-[380px]" id="map-section-container">
            
            {/* Map Header Overlay */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2" id="map-header-overlay">
              <div className="bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl px-3.5 py-1.5 shadow-md flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  {showOptimized ? 'Rota Otimizada por IA' : 'Rota Logística Atual'}
                </span>
              </div>
            </div>

            {/* Leaflet instance element */}
            <div className="w-full h-full bg-slate-100" ref={mapContainerRef} />
          </div>

          {/* AI ROUTE INSIGHTS AND ADVICES */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h4 className="font-bold text-xs">Análise Inteligente de Rota (Gemini IA)</h4>
                  <p className="text-[10px] text-slate-400">Modelos generativos analisando tráfego, clima e topografia.</p>
                </div>
              </div>

              {isLoadingInsights && (
                <RefreshCw size={14} className="animate-spin text-slate-400" />
              )}
            </div>

            {isLoadingInsights ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2.5">
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-slate-400 font-mono">Consolidando insights e tráfego municipal...</span>
              </div>
            ) : aiInsights ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {aiInsights.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {aiInsights.tips.map((tip, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase">
                        {tip.type === 'traffic' && <span>🚦 Tráfego</span>}
                        {tip.type === 'battery' && <span>🔋 Autonomia</span>}
                        {tip.type === 'safety' && <span>🛡️ Operação</span>}
                        <span>{tip.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                        {tip.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400 text-xs">
                Inicie ou redefina o condutor para carregar o co-piloto operacional por IA.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
