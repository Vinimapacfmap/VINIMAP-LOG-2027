/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DeliveryRider, Order } from '../types';
import { 
  Search, 
  ChevronDown, 
  Check, 
  Navigation, 
  MapPin, 
  Battery, 
  User, 
  Activity, 
  X,
  Bike,
  Car,
  Circle
} from 'lucide-react';
import { getHaversineDistance } from '../utils/locationUtils';

interface RiderSelectDropdownProps {
  riders: DeliveryRider[];
  selectedRiderId: string | null;
  onSelectRider: (riderId: string | null) => void;
  referenceCoords?: [number, number] | null; // e.g. Hub location or current order location for calculating nearest driver
  referenceLabel?: string;
  orders?: Order[];
  variant?: 'dark' | 'light';
  placeholder?: string;
  className?: string;
  id?: string;
  showDistance?: boolean;
}

export const RiderSelectDropdown: React.FC<RiderSelectDropdownProps> = ({
  riders,
  selectedRiderId,
  onSelectRider,
  referenceCoords = null,
  referenceLabel = 'HUB Central',
  orders = [],
  variant = 'dark',
  placeholder = 'Selecione um condutor...',
  className = '',
  id = 'vinimap-rider-dropdown',
  showDistance = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'AVAILABLE' | 'EN_ROUTE' | 'OFFLINE'>('ALL');
  const [sortBy, setSortBy] = useState<'NEAREST' | 'NAME' | 'STATUS'>('NEAREST');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Find currently selected rider
  const selectedRider = useMemo(() => {
    return riders.find(r => r.id === selectedRiderId) || null;
  }, [riders, selectedRiderId]);

  // Helper to extract effective coordinates for each rider
  const getCoords = (rider: DeliveryRider): [number, number] => {
    if (rider.realGeoLat !== undefined && rider.realGeoLng !== undefined && rider.realGeoLat < -10) {
      return [rider.realGeoLat, rider.realGeoLng];
    }
    if (rider.lat < -10) {
      return [rider.lat, rider.lng];
    }
    return [-23.55052, -46.633308];
  };

  // Calculate distances and process riders
  const processedRiders = useMemo(() => {
    return riders.map(rider => {
      const coords = getCoords(rider);
      let distanceKm: number | null = null;

      if (referenceCoords && referenceCoords[0] && referenceCoords[1]) {
        distanceKm = getHaversineDistance(referenceCoords, coords);
      }

      const pendingOrdersCount = orders.filter(o => o.riderId === rider.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
      const isOnline = rider.status !== 'Offline';

      return {
        ...rider,
        coords,
        distanceKm,
        pendingOrdersCount,
        isOnline
      };
    });
  }, [riders, referenceCoords, orders]);

  // Filter and Sort Riders
  const filteredAndSortedRiders = useMemo(() => {
    let list = processedRiders.filter(rider => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        rider.name.toLowerCase().includes(q) ||
        rider.vehicle.toLowerCase().includes(q) ||
        rider.status.toLowerCase().includes(q) ||
        (rider.phone && rider.phone.includes(q))
      );

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'ONLINE') return rider.isOnline;
      if (statusFilter === 'AVAILABLE') return rider.status === 'Disponível';
      if (statusFilter === 'EN_ROUTE') return rider.status === 'Em rota';
      if (statusFilter === 'OFFLINE') return rider.status === 'Offline';

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'NEAREST') {
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
      }

      if (sortBy === 'STATUS') {
        const orderMap: Record<string, number> = {
          'Disponível': 1,
          'Em rota': 2,
          'Alerta': 3,
          'Offline': 4
        };
        return (orderMap[a.status] || 5) - (orderMap[b.status] || 5);
      }

      return a.name.localeCompare(b.name);
    });

    return list;
  }, [processedRiders, searchQuery, statusFilter, sortBy]);

  const onlineCount = useMemo(() => {
    return riders.filter(r => r.status !== 'Offline').length;
  }, [riders]);

  const isDark = variant === 'dark';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} id={id}>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
          isDark 
            ? 'bg-slate-900 border-slate-700 hover:border-sky-500 text-white focus:ring-2 focus:ring-sky-500/30' 
            : 'bg-white border-slate-200 hover:border-sky-500 text-slate-900 focus:ring-2 focus:ring-sky-500/20'
        }`}
        id={`${id}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedRider ? (
            <>
              {/* Selected Rider Avatar */}
              <div className="relative shrink-0 w-6 h-6 rounded-full overflow-hidden border border-slate-600 shadow-sm">
                <img 
                  src={selectedRider.avatar} 
                  alt={selectedRider.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
                <span 
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                    selectedRider.status === 'Disponível' ? 'bg-emerald-500' :
                    selectedRider.status === 'Em rota' ? 'bg-sky-500' :
                    selectedRider.status === 'Alerta' ? 'bg-rose-500' : 'bg-slate-500'
                  }`} 
                />
              </div>

              {/* Selected Rider Name & Status Info */}
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="font-bold truncate text-xs">
                  {selectedRider.name}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase shrink-0 border ${
                  selectedRider.status === 'Disponível' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  selectedRider.status === 'Em rota' ? 'bg-sky-500/15 text-sky-400 border-sky-500/30' :
                  selectedRider.status === 'Alerta' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                  'bg-slate-500/15 text-slate-400 border-slate-500/30'
                }`}>
                  {selectedRider.status === 'Offline' ? '🔴 Offline' : `🟢 ${selectedRider.status}`}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800 text-sky-400' : 'bg-slate-100 text-sky-600'}`}>
                <User size={13} />
              </div>
              <span className={`truncate text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                🌍 Toda a Frota ({onlineCount}/{riders.length} Online)
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedRider && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelectRider(null);
              }}
              className="p-0.5 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Limpar seleção (Ver todos)"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-sky-400' : ''}`} />
        </div>
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div 
          className={`absolute left-0 top-full mt-1.5 w-80 sm:w-96 rounded-2xl shadow-2xl border z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 ${
            isDark 
              ? 'bg-slate-950/98 border-slate-800 text-slate-100 backdrop-blur-xl' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}
          style={{ maxHeight: '420px' }}
        >
          {/* SEARCH & FILTERS HEADER */}
          <div className={`p-2.5 border-b shrink-0 space-y-2 ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            
            {/* Quick Search Bar */}
            <div className="relative">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por nome, veículo, status..."
                className={`w-full pl-8.5 pr-8 py-1.5 rounded-xl text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  isDark 
                    ? 'bg-slate-950 border border-slate-750 text-white placeholder-slate-500' 
                    : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
                id={`${id}-search-input`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Filter Tabs + Sort */}
            <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px] font-bold">
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2 py-0.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Todos ({riders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ONLINE')}
                  className={`px-2 py-0.5 rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'ONLINE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'bg-slate-800 text-emerald-400 hover:text-white' : 'bg-slate-200 text-emerald-700'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Online ({onlineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('AVAILABLE')}
                  className={`px-2 py-0.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === 'AVAILABLE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Disponíveis
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('EN_ROUTE')}
                  className={`px-2 py-0.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === 'EN_ROUTE'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  Em Rota
                </button>
              </div>

              {/* Sort by Nearest/Name */}
              {referenceCoords && (
                <button
                  type="button"
                  onClick={() => setSortBy(sortBy === 'NEAREST' ? 'NAME' : 'NEAREST')}
                  className={`px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 cursor-pointer border ${
                    sortBy === 'NEAREST'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title={sortBy === 'NEAREST' ? 'Ordenado por proximidade' : 'Ordenar por proximidade'}
                >
                  <Navigation size={10} className={sortBy === 'NEAREST' ? 'text-sky-400 rotate-45' : ''} />
                  <span>{sortBy === 'NEAREST' ? 'Mais próximos' : 'A-Z'}</span>
                </button>
              )}
            </div>
          </div>

          {/* RIDERS LIST CONTAINER */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar" style={{ maxHeight: '280px' }}>
            
            {/* "Select All / Fleet View" Option */}
            <button
              type="button"
              onClick={() => {
                onSelectRider(null);
                setIsOpen(false);
              }}
              className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                selectedRiderId === null
                  ? isDark ? 'bg-sky-500/20 border border-sky-500/40 text-white' : 'bg-sky-50 border border-sky-200 text-sky-900'
                  : isDark ? 'hover:bg-slate-900/80 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800 text-sky-400' : 'bg-slate-200 text-sky-600'}`}>
                  🌍
                </div>
                <div>
                  <div className="font-extrabold text-xs">Todos os Condutores (Frota Completa)</div>
                  <div className="text-[10px] text-slate-400">Exibir todos os entregadores e rotas no mapa</div>
                </div>
              </div>
              {selectedRiderId === null && <Check size={14} className="text-sky-400 shrink-0" />}
            </button>

            {/* Individual Rider Items */}
            {filteredAndSortedRiders.map((rider, index) => {
              const isSelected = rider.id === selectedRiderId;
              const isNearest = index === 0 && sortBy === 'NEAREST' && rider.distanceKm !== null && rider.isOnline;

              return (
                <button
                  key={rider.id}
                  type="button"
                  onClick={() => {
                    onSelectRider(rider.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                    isSelected
                      ? isDark 
                        ? 'bg-sky-950/60 border-sky-500 text-white shadow-md ring-1 ring-sky-500/50' 
                        : 'bg-sky-50 border-sky-400 text-sky-950 shadow-sm ring-1 ring-sky-300'
                      : isDark 
                        ? 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700 text-slate-200' 
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-800'
                  }`}
                  id={`${id}-item-${rider.id}`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img
                        src={rider.avatar}
                        alt={rider.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-700 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      {/* Status indicator dot */}
                      <span 
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${isDark ? 'border-slate-950' : 'border-white'} ${
                          rider.status === 'Disponível' ? 'bg-emerald-500 animate-pulse' :
                          rider.status === 'Em rota' ? 'bg-sky-500' :
                          rider.status === 'Alerta' ? 'bg-rose-500' : 'bg-slate-500'
                        }`} 
                        title={`Status: ${rider.status}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate">{rider.name}</span>
                        {isNearest && (
                          <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[8.5px] font-black uppercase shrink-0">
                            Mais Próximo
                          </span>
                        )}
                      </div>

                      {/* Subtitle Details: Distance, Vehicle, Orders */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-medium flex-wrap">
                        <span className="flex items-center gap-1 text-slate-300 font-semibold">
                          {rider.vehicle === 'Moto' ? '🏍️ Moto' : rider.vehicle === 'Bicicleta' ? '🚲 Bike' : '🚗 Carro'}
                        </span>

                        {showDistance && rider.distanceKm !== null && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-sky-400 font-mono font-bold">
                              <MapPin size={10} className="shrink-0" />
                              {rider.distanceKm < 1 ? `${(rider.distanceKm * 1000).toFixed(0)}m` : `${rider.distanceKm.toFixed(1)}km`}
                            </span>
                          </>
                        )}

                        <span>•</span>
                        <span className="text-slate-400">
                          {rider.pendingOrdersCount > 0 ? `${rider.pendingOrdersCount} pedidos` : 'Livre'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status badge & Check */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                        rider.status === 'Disponível' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                        rider.status === 'Em rota' ? 'bg-sky-500/15 text-sky-400 border-sky-500/30' :
                        rider.status === 'Alerta' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                        'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      }`}>
                        {rider.status}
                      </span>
                      
                      <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                        <Battery size={10} className={rider.batteryPercent <= 20 ? 'text-rose-400' : 'text-slate-400'} />
                        <span>{rider.batteryPercent}%</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredAndSortedRiders.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold">Nenhum condutor encontrado</p>
                <p className="text-[10px]">Tente ajustar a busca ou os filtros de status.</p>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className={`p-2 border-t text-[10px] flex items-center justify-between shrink-0 ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <strong>{onlineCount}</strong> online de <strong>{riders.length}</strong>
            </span>
            {referenceCoords && (
              <span className="text-[9.5px] truncate max-w-[170px] text-slate-400">
                Ref: {referenceLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderSelectDropdown;
