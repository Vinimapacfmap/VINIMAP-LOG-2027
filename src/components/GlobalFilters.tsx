/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formatToBrazilianDate, isOrderInDatePeriod, getSaoPauloISODate } from '../utils/dateUtils';
import { isOrderMatchingPartner, isOrderMatchingRider } from '../utils/partnerUtils';
import { isOrderMatchingGlobalSearch } from '../utils/searchUtils';
import { isMockClientPartner, isMockRider, isMockOrder } from '../utils/orderConsistency';
import { Order, DeliveryRider, ClientPartner, OrderStatus } from '../types';
import { 
  Calendar, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  UserCheck, 
  Building2, 
  Activity, 
  RotateCcw,
  Sparkles,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  XCircle,
  Layers,
  ArrowRight
} from 'lucide-react';

interface GlobalFiltersProps {
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (val: string) => void;
  filterDateTo: string;
  setFilterDateTo: (val: string) => void;
  filterPartner?: string;
  setFilterPartner?: (val: string) => void;
  filterRiderId?: string;
  setFilterRiderId?: (val: string) => void;
  filterStatus?: string;
  setFilterStatus?: (val: string) => void;
  filterCep?: string;
  setFilterCep?: (val: string) => void;
  riders?: DeliveryRider[];
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
  filterPartner = '',
  setFilterPartner,
  filterRiderId = '',
  setFilterRiderId,
  filterStatus = '',
  setFilterStatus,
  filterCep = '',
  setFilterCep,
  riders = [],
  clientPartners = [],
  orders = [],
  onClearFilters,
  totalFilteredOrdersCount,
  onNavigateToOrders
}: GlobalFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllDates = !filterDateFrom && !filterDateTo;

  // Active filters count
  const activeFiltersCount = [
    searchQuery.trim(),
    !isAllDates ? (filterDateFrom || filterDateTo) : '',
    filterPartner,
    filterRiderId,
    filterStatus,
    filterCep.trim()
  ].filter(Boolean).length;

  // Sincronização 1: Base de pedidos filtrados pelo período e busca para alimentar as opções dos seletores
  const ordersMatchingPeriodAndSearch = useMemo(() => {
    return orders.filter(order => {
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) {
        return false;
      }
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) {
        return false;
      }
      return true;
    });
  }, [orders, filterDateFrom, filterDateTo, searchQuery, riders, clientPartners]);

  // Sincronização 2: Opções de Parceiros com contagem dinâmica respeitando período, condutor, status e busca
  const partnerOptions = useMemo(() => {
    const relevantOrders = orders.filter(order => {
      if (isMockOrder(order)) return false;
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) return false;
      if (filterRiderId && !isOrderMatchingRider(order, filterRiderId, riders)) return false;
      if (filterStatus && order.status !== filterStatus) return false;
      return true;
    });

    const countsMap = new Map<string, { id: string; name: string; count: number }>();

    clientPartners
      .filter(cp => !isMockClientPartner(cp))
      .forEach(cp => {
        countsMap.set(cp.id, { id: cp.id, name: cp.name, count: 0 });
      });

    relevantOrders.forEach(o => {
      const pName = o.partnerName || o.clientName || '';
      if (!pName) return;
      if (isMockClientPartner({ id: pName, name: pName })) return;

      const matchedCp = clientPartners.find(cp => isOrderMatchingPartner(o, cp.id, clientPartners));
      if (matchedCp && !isMockClientPartner(matchedCp)) {
        const item = countsMap.get(matchedCp.id) || { id: matchedCp.id, name: matchedCp.name, count: 0 };
        item.count += 1;
        countsMap.set(matchedCp.id, item);
      } else if (!isMockClientPartner({ id: pName, name: pName })) {
        const key = pName.trim();
        const item = countsMap.get(key) || { id: key, name: key, count: 0 };
        item.count += 1;
        countsMap.set(key, item);
      }
    });

    return Array.from(countsMap.values())
      .filter(item => (item.count > 0 || clientPartners.some(cp => cp.id === item.id && !isMockClientPartner(cp))) && !isMockClientPartner({ id: item.id, name: item.name }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [orders, filterDateFrom, filterDateTo, searchQuery, filterRiderId, filterStatus, clientPartners, riders]);

  // Sincronização 3: Opções de Condutores com contagem dinâmica respeitando período, parceiro, status e busca
  const riderOptions = useMemo(() => {
    const relevantOrders = orders.filter(order => {
      if (isMockOrder(order)) return false;
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) return false;
      if (filterPartner && !isOrderMatchingPartner(order, filterPartner, clientPartners)) return false;
      if (filterStatus && order.status !== filterStatus) return false;
      return true;
    });

    const riderCounts = new Map<string, number>();
    let unassignedCount = 0;

    relevantOrders.forEach(o => {
      if (o.status === 'Cancelado') return;
      const rawRiderId = o.riderId ? String(o.riderId).trim() : '';
      if (!rawRiderId || rawRiderId === 'unassigned' || rawRiderId === 'sem condutor') {
        unassignedCount += 1;
      } else {
        const matchedRider = riders.find(r => isOrderMatchingRider(o, r.id, riders));
        if (matchedRider && !isMockRider(matchedRider)) {
          riderCounts.set(matchedRider.id, (riderCounts.get(matchedRider.id) || 0) + 1);
        } else if (!isMockRider({ id: rawRiderId, name: rawRiderId })) {
          riderCounts.set(rawRiderId, (riderCounts.get(rawRiderId) || 0) + 1);
        }
      }
    });

    const list = riders
      .filter(r => !isMockRider(r))
      .map(r => ({
        id: r.id,
        name: r.name,
        vehicle: r.vehicle,
        count: riderCounts.get(r.id) || 0
      }));

    return {
      riders: list.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'pt-BR');
      }),
      unassignedCount
    };
  }, [orders, filterDateFrom, filterDateTo, searchQuery, filterPartner, filterStatus, riders, clientPartners]);

  // Sincronização 4: Opções de Status com contagem dinâmica respeitando período, parceiro, condutor e busca
  const statusCounts = useMemo(() => {
    const relevantOrders = orders.filter(order => {
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) return false;
      if (filterPartner && !isOrderMatchingPartner(order, filterPartner, clientPartners)) return false;
      if (filterRiderId && !isOrderMatchingRider(order, filterRiderId, riders)) return false;
      return true;
    });

    const counts: Record<string, number> = {
      'Todos': relevantOrders.length,
      'Não iniciado': 0,
      'Em rota': 0,
      'Concluído': 0,
      'Ocorrência': 0,
      'Cancelado': 0
    };

    relevantOrders.forEach(o => {
      const st = o.status;
      if (st === 'Não iniciado') counts['Não iniciado'] += 1;
      else if (st === 'Em rota' || (st as string) === 'Entregando' || (st as string) === 'Em Trânsito') counts['Em rota'] += 1;
      else if (st === 'Concluído' || (st as string) === 'Entregue') counts['Concluído'] += 1;
      else if (st === 'Ocorrência' || (st as string) === 'Falha na Entrega' || (st as string) === 'Devolvido') counts['Ocorrência'] += 1;
      else if (st === 'Cancelado') counts['Cancelado'] += 1;
    });

    return counts;
  }, [orders, filterDateFrom, filterDateTo, searchQuery, filterPartner, filterRiderId, riders, clientPartners]);

  // Status definitions with colors & icons
  const statusList = [
    { key: '', label: 'Todos os Status', shortLabel: 'Todos', count: statusCounts['Todos'], color: 'blue', dot: 'bg-blue-500', icon: Layers },
    { key: 'Não iniciado', label: 'Não Iniciados (Pendentes)', shortLabel: 'Não Iniciados', count: statusCounts['Não iniciado'], color: 'amber', dot: 'bg-amber-500', icon: Clock },
    { key: 'Em rota', label: 'Em Rota (Em Trânsito)', shortLabel: 'Em Rota', count: statusCounts['Em rota'], color: 'sky', dot: 'bg-sky-500', icon: Truck },
    { key: 'Concluído', label: 'Concluídos (Entregues)', shortLabel: 'Concluídos', count: statusCounts['Concluído'], color: 'emerald', dot: 'bg-emerald-500', icon: CheckCircle2 },
    { key: 'Ocorrência', label: 'Ocorrências (Pendências)', shortLabel: 'Ocorrências', count: statusCounts['Ocorrência'], color: 'rose', dot: 'bg-rose-500', icon: AlertCircle },
    { key: 'Cancelado', label: 'Cancelados', shortLabel: 'Cancelados', count: statusCounts['Cancelado'], color: 'slate', dot: 'bg-slate-400', icon: XCircle },
  ];

  const currentStatusObj = statusList.find(s => s.key === filterStatus) || statusList[0];

  // Helper date presets
  const handleSetToday = () => {
    const today = getSaoPauloISODate();
    setFilterDateFrom(today);
    setFilterDateTo(today);
    if (onNavigateToOrders) onNavigateToOrders();
  };

  const handleSetAllDates = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    if (onNavigateToOrders) onNavigateToOrders();
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs transition-all overflow-hidden" id="global-filters-panel">
      {/* Header Bar */}
      <div 
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors bg-gradient-to-r from-slate-50 via-slate-50 to-blue-50/30 border-b border-slate-200/80"
        onClick={() => setIsOpen(!isOpen)}
        id="filters-header-trigger"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
            <Filter size={14} className="font-bold" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
              <span>Painel de Filtros Sincronizados</span>
              {activeFiltersCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-[10px] font-black text-white shadow-2xs">
                  {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                  Exibindo todos
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold truncate max-w-xl">
              {isAllDates 
                ? 'Todos os Períodos' 
                : `Período: ${formatToBrazilianDate(filterDateFrom)} até ${formatToBrazilianDate(filterDateTo)}`}
              {filterPartner ? ` • Parceiro selecionado` : ''}
              {filterRiderId ? ` • Condutor selecionado` : ''}
              {filterStatus ? ` • Status: ${currentStatusObj.shortLabel}` : ''}
              {searchQuery ? ` • Busca: "${searchQuery}"` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (setSearchQuery) setSearchQuery('');
                if (setFilterPartner) setFilterPartner('');
                if (setFilterRiderId) setFilterRiderId('');
                if (setFilterStatus) setFilterStatus('');
                if (setFilterCep) setFilterCep('');
                onClearFilters();
              }}
              className="px-2.5 py-1 text-[11px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
              id="clear-filters-btn"
            >
              <RotateCcw size={12} />
              <span>Limpar Filtros</span>
            </button>
          )}
          <span className="text-slate-500 p-1 hover:bg-slate-200/60 rounded-xl transition-colors">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {/* Form Controls Section */}
      {isOpen && (
        <div className="p-3 sm:p-4 space-y-3.5" id="filters-form-container">
          
          {/* Main Cards Row: Search, Period, Partner, Rider, Status Dropdown Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3" id="filters-form-grid">
            
            {/* 1. CARD: BUSCA INTELIGENTE */}
            <div className="sm:col-span-2 lg:col-span-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-between shadow-3xs hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Search size={12} className="text-blue-600" />
                  <span>Pesquisa Geral</span>
                </label>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery && setSearchQuery('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    limpar
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  id="vinimap_global_order_search_filter"
                  name="vinimap_global_order_search_filter"
                  autoComplete="off"
                  placeholder="Nome, Nº Pedido, CEP, Endereço..."
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
                  className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery && setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-100"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* 2. CARD: PERÍODO OPERACIONAL (Data Inicial & Final) */}
            <div className="sm:col-span-2 lg:col-span-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-between shadow-3xs hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Calendar size={12} className="text-blue-600" />
                  <span>Período</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSetToday}
                    className="text-[9.5px] font-black text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={handleSetAllDates}
                    className="text-[9.5px] font-bold text-slate-500 hover:text-slate-800 bg-slate-200/70 hover:bg-slate-200 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <input
                    type="date"
                    id="filter_date_from_input"
                    name="filter_date_from_input"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                    title="Data Inicial"
                  />
                </div>
                <div className="relative">
                  <input
                    type="date"
                    id="filter_date_to_input"
                    name="filter_date_to_input"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                    title="Data Final"
                  />
                </div>
              </div>
            </div>

            {/* 3. CARD: PARCEIRO / CLIENTE */}
            <div className="sm:col-span-1 lg:col-span-2 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-between shadow-3xs hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Building2 size={12} className="text-blue-600" />
                  <span>Parceiro</span>
                </label>
                {filterPartner && (
                  <button
                    type="button"
                    onClick={() => setFilterPartner && setFilterPartner('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    todos
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  id="filter_partner_selector"
                  name="filter_partner_selector"
                  value={filterPartner}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setFilterPartner) setFilterPartner(val);
                    if (onNavigateToOrders) onNavigateToOrders();
                  }}
                  className={`w-full px-2.5 py-2 bg-white border rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer truncate ${
                    filterPartner ? 'border-blue-500 bg-blue-50/30 text-blue-950 font-extrabold' : 'border-slate-200'
                  }`}
                >
                  <option value="">Todos Parceiros ({ordersMatchingPeriodAndSearch.length})</option>
                  {partnerOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. CARD: CONDUTOR / MOTORISTA */}
            <div className="sm:col-span-1 lg:col-span-2 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-between shadow-3xs hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <UserCheck size={12} className="text-blue-600" />
                  <span>Condutor</span>
                </label>
                {filterRiderId && (
                  <button
                    type="button"
                    onClick={() => setFilterRiderId && setFilterRiderId('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    todos
                  </button>
                )}
              </div>
              <div className="relative">
                <select
                  id="filter_rider_selector"
                  name="filter_rider_selector"
                  value={filterRiderId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setFilterRiderId) setFilterRiderId(val);
                    if (onNavigateToOrders) onNavigateToOrders();
                  }}
                  className={`w-full px-2.5 py-2 bg-white border rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer truncate ${
                    filterRiderId ? 'border-blue-500 bg-blue-50/30 text-blue-950 font-extrabold' : 'border-slate-200'
                  }`}
                >
                  <option value="">Todos Condutores</option>
                  {riderOptions.unassignedCount > 0 && (
                    <option value="unassigned" className="text-amber-700 font-bold">
                      ⚠️ Sem Condutor ({riderOptions.unassignedCount})
                    </option>
                  )}
                  {riderOptions.riders.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. CARD: STATUS DO PEDIDO (DROP DOWN CARD ELEGANTE) */}
            <div 
              ref={statusDropdownRef}
              className="sm:col-span-2 lg:col-span-2 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-between shadow-3xs relative hover:border-blue-300 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Activity size={12} className="text-blue-600" />
                  <span>Filtrar por Status</span>
                </label>
                {filterStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      if (setFilterStatus) setFilterStatus('');
                      if (onNavigateToOrders) onNavigateToOrders();
                    }}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    todos
                  </button>
                )}
              </div>

              {/* Status Selector Dropdown Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  id="status-dropdown-trigger"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className={`w-full px-2.5 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 border transition-all cursor-pointer ${
                    filterStatus 
                      ? 'bg-blue-50/80 text-blue-950 border-blue-400 shadow-2xs' 
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentStatusObj.dot}`} />
                    <span className="truncate">{currentStatusObj.shortLabel}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black bg-slate-100 text-slate-700">
                      {currentStatusObj.count}
                    </span>
                    <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isStatusDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-1.5 text-[9.5px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>Selecionar Status</span>
                      <span>{statusCounts['Todos']} pedidos total</span>
                    </div>

                    <div className="space-y-0.5 px-1.5 max-h-64 overflow-y-auto">
                      {statusList.map(st => {
                        const isSelected = filterStatus === st.key;
                        const Icon = st.icon;
                        return (
                          <button
                            key={st.key || 'all'}
                            type="button"
                            onClick={() => {
                              if (setFilterStatus) setFilterStatus(st.key);
                              setIsStatusDropdownOpen(false);
                              if (onNavigateToOrders) onNavigateToOrders();
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
                              <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                              <span>{st.label}</span>
                            </div>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                              isSelected 
                                ? 'bg-white/20 text-white' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {st.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Secondary Row: Quick Status Filter Pills (Horizontal Soft Ribbon) */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Activity size={11} className="text-blue-600" />
                Atalho Rápido de Status:
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                {statusList.map(st => {
                  const isSelected = filterStatus === st.key;
                  return (
                    <button
                      key={st.key || 'all'}
                      type="button"
                      onClick={() => {
                        if (setFilterStatus) setFilterStatus(st.key);
                        if (onNavigateToOrders) onNavigateToOrders();
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1.5 shadow-3xs ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs scale-[1.02]'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                      <span>{st.shortLabel}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                        isSelected 
                          ? 'bg-white/20 text-white' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {st.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear Filters Action */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (setSearchQuery) setSearchQuery('');
                  if (setFilterPartner) setFilterPartner('');
                  if (setFilterRiderId) setFilterRiderId('');
                  if (setFilterStatus) setFilterStatus('');
                  if (setFilterCep) setFilterCep('');
                  onClearFilters();
                }}
                className="text-[11px] font-extrabold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1 ml-auto"
              >
                <X size={12} />
                <span>Limpar todos os filtros ({activeFiltersCount})</span>
              </button>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
