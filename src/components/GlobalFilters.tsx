/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { DeliveryRider, OrderStatus, ClientPartner, Order } from '../types';
import { formatToBrazilianDate, getSaoPauloISODate, isOrderInDatePeriod } from '../utils/dateUtils';
import { getPartnerDisplayName, isOrderMatchingPartner, isOrderMatchingRider } from '../utils/partnerUtils';
import { 
  Filter, 
  Calendar, 
  User, 
  MapPin, 
  Activity, 
  X, 
  Store,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Bike
} from 'lucide-react';

interface GlobalFiltersProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (val: string) => void;
  filterDateTo: string;
  setFilterDateTo: (val: string) => void;
  filterPartner: string;
  setFilterPartner: (val: string) => void;
  filterRiderId: string;
  setFilterRiderId: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterCep: string;
  setFilterCep: (val: string) => void;
  riders: DeliveryRider[];
  clientPartners?: ClientPartner[];
  orders?: Order[];
  onClearFilters: () => void;
  onSelectPartner?: (val: string) => void;
  onSelectRider?: (val: string) => void;
  totalFilteredOrdersCount?: number;
  onNavigateToOrders?: () => void;
}

export default function GlobalFilters({
  searchQuery = '',
  setSearchQuery,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  filterPartner,
  setFilterPartner,
  filterRiderId,
  setFilterRiderId,
  filterStatus,
  setFilterStatus,
  filterCep,
  setFilterCep,
  riders,
  clientPartners,
  orders,
  onClearFilters,
  onSelectPartner,
  onSelectRider,
  totalFilteredOrdersCount,
  onNavigateToOrders
}: GlobalFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Build a distinct list of partner entries from clientPartners, orders and mock data
  const partnerOptions = useMemo(() => {
    const list: { value: string; label: string; name: string; code?: string }[] = [];
    const seenValues = new Set<string>();

    const addOption = (val: string | undefined | null, name: string, code?: string, label?: string) => {
      const cleanVal = (val || name || '').trim();
      if (!cleanVal) return;
      const normalizedKey = cleanVal.toLowerCase();
      if (seenValues.has(normalizedKey)) return;
      seenValues.add(normalizedKey);

      const finalName = name?.trim() || cleanVal;
      const finalLabel = label || `${finalName}${code ? ` (${code})` : ''}`;
      list.push({
        value: cleanVal,
        name: finalName,
        code,
        label: finalLabel
      });
    };

    // 1. Registered ClientPartners
    if (clientPartners && clientPartners.length > 0) {
      clientPartners.forEach(cp => {
        const pName = cp.name?.trim() || cp.razaoSocial?.trim() || 'Parceiro';
        addOption(cp.name || pName, pName, cp.codigoCliente);
      });
    }

    // 2. Extra partners present in orders
    if (orders && orders.length > 0) {
      orders.forEach(o => {
        const rawP = o.partnerName?.trim();
        if (rawP) {
          const displayName = getPartnerDisplayName(rawP, clientPartners);
          addOption(displayName, displayName);
        }
      });
    }

    // 3. Fallback well-known mock partners if not seen
    const defaultPartners = ['Burger King', 'Droga Raia', 'McDonalds', 'Pizzaria Bella', 'Supermercado Extra', 'Lojas Americanas', 'Zé Delivery'];
    defaultPartners.forEach(dp => {
      addOption(dp, dp);
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [clientPartners, orders]);

  // Order counts in the active date range per partner
  const countsByPartner = useMemo(() => {
    if (!orders || orders.length === 0) return {};
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (isOrderInDatePeriod(o, filterDateFrom, filterDateTo)) {
        partnerOptions.forEach(po => {
          if (isOrderMatchingPartner(o, po.value, clientPartners)) {
            map[po.value] = (map[po.value] || 0) + 1;
          }
        });
      }
    });
    return map;
  }, [orders, filterDateFrom, filterDateTo, partnerOptions, clientPartners]);

  // Order counts in the active date range per rider
  const countsByRider = useMemo(() => {
    if (!orders || orders.length === 0) return {};
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (isOrderInDatePeriod(o, filterDateFrom, filterDateTo)) {
        if (o.riderId) {
          map[o.riderId] = (map[o.riderId] || 0) + 1;
        }
      }
    });
    return map;
  }, [orders, filterDateFrom, filterDateTo]);

  // Alphabetically/Lexicographically sorted riders list
  const sortedRiders = useMemo(() => {
    return [...riders].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [riders]);

  // List of possible order statuses
  const statuses: { value: OrderStatus; label: string }[] = [
    { value: 'Não iniciado', label: 'Não iniciado' },
    { value: 'Em rota', label: 'Em Rota' },
    { value: 'Entregando', label: 'Entregando' },
    { value: 'Concluído', label: 'Concluído' },
    { value: 'Ocorrência', label: 'Ocorrência' },
    { value: 'Cancelado', label: 'Cancelado' }
  ];

  // Handlers for instant selection and status independence
  const handlePartnerChange = (val: string) => {
    if (onSelectPartner) {
      onSelectPartner(val);
    } else {
      setFilterPartner(val);
      if (val && filterStatus) {
        setFilterStatus('');
      }
    }
  };

  const handleRiderChange = (val: string) => {
    if (onSelectRider) {
      onSelectRider(val);
    } else {
      setFilterRiderId(val);
      if (val && filterStatus) {
        setFilterStatus('');
      }
    }
  };

  // Selected names for pills display
  const selectedPartnerObj = partnerOptions.find(p => p.value === filterPartner || p.name === filterPartner);
  const selectedPartnerLabel = selectedPartnerObj ? selectedPartnerObj.label : filterPartner;
  const selectedPartnerCount = filterPartner ? (countsByPartner[filterPartner] ?? 0) : 0;

  const selectedRiderObj = riders.find(r => r.id === filterRiderId);
  const selectedRiderLabel = selectedRiderObj ? `${selectedRiderObj.name} (${selectedRiderObj.vehicle})` : filterRiderId;
  const selectedRiderCount = filterRiderId ? (countsByRider[filterRiderId] ?? 0) : 0;

  // Count active filters
  const activeCount = [
    searchQuery,
    filterDateFrom,
    filterDateTo,
    filterPartner,
    filterRiderId,
    filterStatus,
    filterCep
  ].filter(Boolean).length;

  const todayIso = getSaoPauloISODate();
  const isTodayOnly = filterDateFrom === todayIso && filterDateTo === todayIso;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs transition-all overflow-hidden" id="global-filters-panel">
      {/* Header Bar */}
      <div 
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors bg-slate-50/80 border-b border-slate-100"
        onClick={() => setIsOpen(!isOpen)}
        id="filters-header-trigger"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
            <Filter size={14} className="font-bold" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-xs">Filtros Operacionais & Busca Global</h3>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              {isTodayOnly ? 'Exibindo pedidos de Hoje (Padrão)' : `Período: ${formatToBrazilianDate(filterDateFrom)} até ${formatToBrazilianDate(filterDateTo)}`}
              {filterPartner ? ` • Parceiro: ${selectedPartnerLabel}` : ''}
              {filterRiderId ? ` • Condutor: ${selectedRiderObj?.name || filterRiderId}` : ''}
            </p>
          </div>
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-700 text-[10px] font-black text-white shadow-xs">
              {activeCount} {activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
          )}
          {typeof totalFilteredOrdersCount === 'number' && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
              {totalFilteredOrdersCount} {totalFilteredOrdersCount === 1 ? 'pedido listado' : 'pedidos listados'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {activeCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (setSearchQuery) setSearchQuery('');
                onClearFilters();
              }}
              className="px-2.5 py-1 text-[11px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
              id="clear-filters-btn"
            >
              <X size={12} />
              <span>Limpar Filtros</span>
            </button>
          )}
          <span className="text-slate-600 p-1 hover:bg-slate-200/60 rounded-lg transition-colors">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {/* Inputs Form Section */}
      {isOpen && (
        <div className="p-3 sm:p-4 border-t border-slate-100 space-y-3" id="filters-form-container">
          
          {/* Main Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5" id="filters-form-grid">
            
            {/* 1. BUSCA GLOBAL (Nº Pedido, Cliente, Destinatário, CEP, DANFE) */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center justify-between select-none">
                <span className="flex items-center gap-1 text-blue-700 font-extrabold">
                  <Search size={11} className="text-blue-600" />
                  Busca Global de Pedidos
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery && setSearchQuery('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    limpar
                  </button>
                )}
              </label>
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  id="vinimap_global_order_search_filter"
                  name="vinimap_global_order_search_filter"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="Nº Pedido, Cliente, Destinatário, CEP, DANFE..."
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setSearchQuery) setSearchQuery(val);
                    if (val.trim().length > 0 && onNavigateToOrders) {
                      onNavigateToOrders();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && onNavigateToOrders) {
                      onNavigateToOrders();
                    }
                  }}
                  className="w-full pl-8 pr-7 py-1.5 bg-blue-50/40 border border-blue-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery && setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-200/50"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Data Inicial Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center justify-between select-none">
                <span className="flex items-center gap-1">
                  <Calendar size={11} className="text-slate-600" />
                  Data Inicial
                </span>
                {filterDateFrom && (
                  <span className="text-[10px] text-blue-700 font-black lowercase">
                    ({formatToBrazilianDate(filterDateFrom)})
                  </span>
                )}
              </label>
              <input
                type="date"
                id="filter_date_from_input"
                name="filter_date_from_input"
                autoComplete="off"
                value={filterDateFrom}
                max={filterDateTo || undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterDateFrom(val);
                  if (val && filterDateTo && val > filterDateTo) {
                    setFilterDateTo(val);
                  } else if (val && !filterDateTo) {
                    setFilterDateTo(val);
                  }
                }}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              />
            </div>

            {/* 3. Data Final Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center justify-between select-none">
                <span className="flex items-center gap-1">
                  <Calendar size={11} className="text-slate-600" />
                  Data Final
                </span>
                {filterDateTo && (
                  <span className="text-[10px] text-blue-700 font-black lowercase">
                    ({formatToBrazilianDate(filterDateTo)})
                  </span>
                )}
              </label>
              <input
                type="date"
                id="filter_date_to_input"
                name="filter_date_to_input"
                autoComplete="off"
                value={filterDateTo}
                min={filterDateFrom || undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && filterDateFrom && val < filterDateFrom) {
                    setFilterDateFrom(val);
                  }
                  setFilterDateTo(val);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              />
            </div>

            {/* 4. Partner Client Filter (Instant Selection & Switch) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center justify-between">
                <span className="flex items-center gap-1 text-purple-700 font-black">
                  <Store size={11} className="text-purple-600" />
                  Cliente Parceiro
                </span>
                {filterPartner && (
                  <button
                    type="button"
                    onClick={() => handlePartnerChange('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    limpar
                  </button>
                )}
              </label>
              <div className="relative">
                <select
                  value={filterPartner}
                  onChange={(e) => handlePartnerChange(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer appearance-none pr-7 ${
                    filterPartner 
                      ? 'bg-purple-50 border-2 border-purple-500 text-purple-950 font-black shadow-xs ring-2 ring-purple-100' 
                      : 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white'
                  }`}
                  id="filter-partner-select"
                >
                  <option value="">Todos os Clientes</option>
                  {partnerOptions.map((p, idx) => {
                    const count = countsByPartner[p.value] ?? 0;
                    return (
                      <option key={`partner-opt-${p.value}-${idx}`} value={p.value}>
                        {p.label} {count > 0 ? `(${count} no período)` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 5. Conductor/Rider Filter (Instant Selection & Switch) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-700 font-black">
                  <User size={11} className="text-emerald-600" />
                  Condutor
                </span>
                {filterRiderId && (
                  <button
                    type="button"
                    onClick={() => handleRiderChange('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    limpar
                  </button>
                )}
              </label>
              <div className="relative">
                <select
                  value={filterRiderId}
                  onChange={(e) => handleRiderChange(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer appearance-none pr-7 ${
                    filterRiderId 
                      ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-100' 
                      : 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white'
                  }`}
                  id="filter-rider-select"
                >
                  <option value="">Todos os Condutores</option>
                  {sortedRiders.map((r, idx) => {
                    const count = countsByRider[r.id] ?? 0;
                    return (
                      <option key={`rider-opt-${r.id}-${idx}`} value={r.id}>
                        {r.name} ({r.vehicle}) {count > 0 ? `(${count} no período)` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 6. Status Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center gap-1">
                <Activity size={11} className="text-slate-600" />
                Status
              </label>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer appearance-none pr-7 ${
                    filterStatus 
                      ? 'bg-blue-50 border-2 border-blue-500 text-blue-950 font-black shadow-xs' 
                      : 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white'
                  }`}
                  id="filter-status-select"
                >
                  <option value="">Todos os Status</option>
                  {statuses.map((s, idx) => (
                    <option key={`status-opt-${s.value}-${idx}`} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

          </div>

          {/* Quick Date Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Calendar size={11} className="text-slate-400" />
              Atalhos de Data:
            </span>
            <button
              type="button"
              onClick={() => {
                const today = getSaoPauloISODate();
                setFilterDateFrom(today);
                setFilterDateTo(today);
              }}
              className={`px-2.5 py-1 rounded-lg font-extrabold transition-all cursor-pointer border ${
                filterDateFrom === todayIso && filterDateTo === todayIso
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const yesterday = getSaoPauloISODate(d);
                setFilterDateFrom(yesterday);
                setFilterDateTo(yesterday);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                filterDateFrom && filterDateTo && filterDateFrom === filterDateTo && filterDateFrom !== todayIso
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                const past7 = getSaoPauloISODate(d);
                setFilterDateFrom(past7);
                setFilterDateTo(todayIso);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                filterDateFrom && filterDateTo === todayIso && filterDateFrom !== todayIso
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                !filterDateFrom && !filterDateTo
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              Todos os Períodos
            </button>
          </div>

          {/* Quick Active Filter Badges & Instant Feedback Strip */}
          {(filterPartner || filterRiderId || filterStatus || !isTodayOnly) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Sparkles size={12} className="text-blue-500" />
                Filtro Rápido Ativo:
              </span>

              {/* Partner Active Pill */}
              {filterPartner && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 border border-purple-300 text-purple-900 font-extrabold rounded-lg shadow-2xs animate-fadeIn">
                  <Store size={12} className="text-purple-700" />
                  <span>Parceiro: <strong>{selectedPartnerLabel}</strong></span>
                  {selectedPartnerCount > 0 && (
                    <span className="bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-md text-[10px]">
                      {selectedPartnerCount} {selectedPartnerCount === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePartnerChange('')}
                    className="ml-1 p-0.5 hover:bg-purple-200 rounded text-purple-700 hover:text-purple-950 cursor-pointer"
                    title="Remover filtro de parceiro"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Rider Active Pill */}
              {filterRiderId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold rounded-lg shadow-2xs animate-fadeIn">
                  <Bike size={12} className="text-emerald-700" />
                  <span>Condutor: <strong>{selectedRiderLabel}</strong></span>
                  {selectedRiderCount > 0 && (
                    <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-md text-[10px]">
                      {selectedRiderCount} {selectedRiderCount === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRiderChange('')}
                    className="ml-1 p-0.5 hover:bg-emerald-200 rounded text-emerald-700 hover:text-emerald-950 cursor-pointer"
                    title="Remover filtro de condutor"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Status Active Pill */}
              {filterStatus && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 border border-blue-300 text-blue-900 font-bold rounded-lg shadow-2xs">
                  <Activity size={12} className="text-blue-700" />
                  <span>Status: <strong>{filterStatus}</strong></span>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('')}
                    className="ml-1 p-0.5 hover:bg-blue-200 rounded text-blue-700 hover:text-blue-950 cursor-pointer"
                    title="Mostrar todos os status"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Period Pill (if not today) */}
              {!isTodayOnly && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-lg shadow-2xs">
                  <Calendar size={12} className="text-slate-600" />
                  <span>Período: <strong>{formatToBrazilianDate(filterDateFrom)} até {formatToBrazilianDate(filterDateTo)}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      const today = getSaoPauloISODate();
                      setFilterDateFrom(today);
                      setFilterDateTo(today);
                    }}
                    className="ml-1 text-[10px] text-blue-600 hover:underline cursor-pointer"
                    title="Redefinir para hoje"
                  >
                    (Voltar p/ Hoje)
                  </button>
                </span>
              )}

              {/* Reset all button */}
              <button
                type="button"
                onClick={onClearFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer ml-auto"
              >
                Limpar todos os filtros
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

