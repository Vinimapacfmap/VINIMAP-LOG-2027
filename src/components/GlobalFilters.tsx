/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { formatToBrazilianDate, isOrderInDatePeriod } from '../utils/dateUtils';
import { isOrderMatchingPartner, isOrderMatchingRider } from '../utils/partnerUtils';
import { isOrderMatchingGlobalSearch } from '../utils/searchUtils';
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
  Filter
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
      // 1. Data
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) {
        return false;
      }
      // 2. Busca por texto (se houver)
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) {
        return false;
      }
      return true;
    });
  }, [orders, filterDateFrom, filterDateTo, searchQuery, riders, clientPartners]);

  // Sincronização 2: Opções de Parceiros com contagem dinâmica respeitando período, condutor, status e busca
  const partnerOptions = useMemo(() => {
    // Pedidos que atendem os outros filtros ativos (período, condutor, status, busca)
    const relevantOrders = orders.filter(order => {
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) return false;
      if (filterRiderId && !isOrderMatchingRider(order, filterRiderId, riders)) return false;
      if (filterStatus && order.status !== filterStatus) return false;
      return true;
    });

    // Mapear contagens por parceiro
    const countsMap = new Map<string, { id: string; name: string; count: number }>();

    // Inicializar com parceiros cadastrados
    clientPartners.forEach(cp => {
      countsMap.set(cp.id, { id: cp.id, name: cp.name, count: 0 });
    });

    // Contabilizar pedidos
    relevantOrders.forEach(o => {
      const pName = o.partnerName || o.clientName || '';
      if (!pName) return;

      const matchedCp = clientPartners.find(cp => isOrderMatchingPartner(o, cp.id, clientPartners));
      if (matchedCp) {
        const item = countsMap.get(matchedCp.id) || { id: matchedCp.id, name: matchedCp.name, count: 0 };
        item.count += 1;
        countsMap.set(matchedCp.id, item);
      } else {
        const key = pName.trim();
        const item = countsMap.get(key) || { id: key, name: key, count: 0 };
        item.count += 1;
        countsMap.set(key, item);
      }
    });

    return Array.from(countsMap.values())
      .filter(item => item.count > 0 || clientPartners.some(cp => cp.id === item.id))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [orders, filterDateFrom, filterDateTo, searchQuery, filterRiderId, filterStatus, clientPartners, riders]);

  // Sincronização 3: Opções de Condutores com contagem dinâmica respeitando período, parceiro, status e busca
  const riderOptions = useMemo(() => {
    const relevantOrders = orders.filter(order => {
      if (!isOrderInDatePeriod(order, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim() && !isOrderMatchingGlobalSearch(order, searchQuery, riders, clientPartners)) return false;
      if (filterPartner && !isOrderMatchingPartner(order, filterPartner, clientPartners)) return false;
      if (filterStatus && order.status !== filterStatus) return false;
      return true;
    });

    const riderCounts = new Map<string, number>();
    let unassignedCount = 0;

    relevantOrders.forEach(o => {
      const rawRiderId = o.riderId ? String(o.riderId).trim() : '';
      if (!rawRiderId || rawRiderId === 'unassigned' || rawRiderId === 'sem condutor') {
        unassignedCount += 1;
      } else {
        const matchedRider = riders.find(r => isOrderMatchingRider(o, r.id, riders));
        if (matchedRider) {
          riderCounts.set(matchedRider.id, (riderCounts.get(matchedRider.id) || 0) + 1);
        } else {
          riderCounts.set(rawRiderId, (riderCounts.get(rawRiderId) || 0) + 1);
        }
      }
    });

    const list = riders.map(r => ({
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

  // Obter nome legível do parceiro selecionado
  const selectedPartnerName = useMemo(() => {
    if (!filterPartner) return '';
    const cp = clientPartners.find(c => c.id === filterPartner || c.name === filterPartner);
    return cp ? cp.name : filterPartner;
  }, [filterPartner, clientPartners]);

  // Obter nome legível do condutor selecionado
  const selectedRiderName = useMemo(() => {
    if (!filterRiderId) return '';
    if (filterRiderId === 'unassigned') return 'Sem Condutor (Não Alocado)';
    const r = riders.find(item => item.id === filterRiderId || item.name === filterRiderId);
    return r ? r.name : filterRiderId;
  }, [filterRiderId, riders]);

  // Obter rótulo do status selecionado
  const getStatusLabel = (key: string) => {
    switch (key) {
      case 'Não iniciado': return 'Não Iniciados';
      case 'Em rota': return 'Em Rota';
      case 'Concluído': return 'Concluídos';
      case 'Ocorrência': return 'Ocorrências';
      case 'Cancelado': return 'Cancelados';
      default: return key;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs transition-all overflow-hidden" id="global-filters-panel">
      {/* Header Bar */}
      <div 
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors bg-slate-50/90 border-b border-slate-200/80"
        onClick={() => setIsOpen(!isOpen)}
        id="filters-header-trigger"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
            <Filter size={14} className="font-bold" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
              <span>Filtros Sincronizados de Pesquisa & Período</span>
            </h3>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              {isAllDates 
                ? 'Todos os Períodos (Sem Bloqueio de Data)' 
                : `Período: ${formatToBrazilianDate(filterDateFrom)} até ${formatToBrazilianDate(filterDateTo)}`}
              {selectedPartnerName ? ` • Parceiro: ${selectedPartnerName}` : ''}
              {selectedRiderName ? ` • Condutor: ${selectedRiderName}` : ''}
              {filterStatus ? ` • Status: ${getStatusLabel(filterStatus)}` : ''}
              {searchQuery ? ` • Termo: "${searchQuery}"` : ''}
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-700 text-[10px] font-black text-white shadow-xs">
              {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
          )}
          {typeof totalFilteredOrdersCount === 'number' && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
              {totalFilteredOrdersCount} {totalFilteredOrdersCount === 1 ? 'pedido sincronizado' : 'pedidos sincronizados'}
            </span>
          )}
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
              className="px-2.5 py-1 text-[11px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
              id="clear-filters-btn"
            >
              <RotateCcw size={12} />
              <span>Limpar Todos</span>
            </button>
          )}
          <span className="text-slate-600 p-1 hover:bg-slate-200/60 rounded-lg transition-colors">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {/* Form Controls Section */}
      {isOpen && (
        <div className="p-3 sm:p-4 border-t border-slate-100 space-y-3" id="filters-form-container">
          
          {/* Main Grid: Pesquisa, Datas (Inicial e Final), Parceiro, Condutor, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3" id="filters-form-grid">
            
            {/* 1. BUSCA GLOBAL INTELIGENTE (Condutor, Destinatário, Nº Pedido, Endereço, CEP, DANFE) */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center justify-between select-none">
                <span className="flex items-center gap-1 text-blue-700 font-extrabold">
                  <Search size={11} className="text-blue-600" />
                  Pesquisa (Condutor, Nome, Nº Pedido, CEP)
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
                <Search size={13} className="absolute left-2.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  id="vinimap_global_order_search_filter"
                  name="vinimap_global_order_search_filter"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  placeholder="Ex: Carlos, 1045, Av. Paulista, 01310-100..."
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
                  className="w-full pl-8 pr-7 py-2 bg-blue-50/30 border border-blue-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
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

            {/* 2. DATA INICIAL (Sem bloqueio) */}
            <div className="space-y-1 sm:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center justify-between select-none">
                <span className="flex items-center gap-1 text-slate-700">
                  <Calendar size={11} className="text-slate-600" />
                  Data Inicial
                </span>
                {filterDateFrom && (
                  <span className="text-[10px] text-blue-700 font-black">
                    {formatToBrazilianDate(filterDateFrom)}
                  </span>
                )}
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  id="filter_date_from_input"
                  name="filter_date_from_input"
                  autoComplete="off"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                />
                {filterDateFrom && (
                  <button
                    type="button"
                    onClick={() => setFilterDateFrom('')}
                    className="absolute right-6 text-slate-400 hover:text-rose-600 p-0.5"
                    title="Limpar Data Inicial"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* 3. DATA FINAL (Sem bloqueio) */}
            <div className="space-y-1 sm:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center justify-between select-none">
                <span className="flex items-center gap-1 text-slate-700">
                  <Calendar size={11} className="text-slate-600" />
                  Data Final
                </span>
                {filterDateTo && (
                  <span className="text-[10px] text-blue-700 font-black">
                    {formatToBrazilianDate(filterDateTo)}
                  </span>
                )}
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  id="filter_date_to_input"
                  name="filter_date_to_input"
                  autoComplete="off"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                />
                {filterDateTo && (
                  <button
                    type="button"
                    onClick={() => setFilterDateTo('')}
                    className="absolute right-6 text-slate-400 hover:text-rose-600 p-0.5"
                    title="Limpar Data Final"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* 4. SELETOR POR PARCEIRO (Sincronizado) */}
            <div className="space-y-1 sm:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center justify-between select-none">
                <span className="flex items-center gap-1 text-slate-700">
                  <Building2 size={11} className="text-slate-600" />
                  Parceiro / Cliente
                </span>
                {filterPartner && (
                  <button
                    type="button"
                    onClick={() => setFilterPartner && setFilterPartner('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    todos
                  </button>
                )}
              </label>
              <div className="relative flex items-center">
                <select
                  id="filter_partner_selector"
                  name="filter_partner_selector"
                  value={filterPartner}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setFilterPartner) setFilterPartner(val);
                    if (onNavigateToOrders) onNavigateToOrders();
                  }}
                  className={`w-full px-2.5 py-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer truncate ${
                    filterPartner ? 'border-blue-500 bg-blue-50/20 text-blue-950' : 'border-slate-300'
                  }`}
                >
                  <option value="">Todos os Parceiros ({ordersMatchingPeriodAndSearch.length})</option>
                  {partnerOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. SELETOR POR CONDUTOR (Sincronizado) */}
            <div className="space-y-1 sm:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center justify-between select-none">
                <span className="flex items-center gap-1 text-slate-700">
                  <UserCheck size={11} className="text-slate-600" />
                  Condutor / Motorista
                </span>
                {filterRiderId && (
                  <button
                    type="button"
                    onClick={() => setFilterRiderId && setFilterRiderId('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                  >
                    todos
                  </button>
                )}
              </label>
              <div className="relative flex items-center">
                <select
                  id="filter_rider_selector"
                  name="filter_rider_selector"
                  value={filterRiderId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setFilterRiderId) setFilterRiderId(val);
                    if (onNavigateToOrders) onNavigateToOrders();
                  }}
                  className={`w-full px-2.5 py-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer truncate ${
                    filterRiderId ? 'border-blue-500 bg-blue-50/20 text-blue-950' : 'border-slate-300'
                  }`}
                >
                  <option value="">Todos os Condutores</option>
                  {riderOptions.unassignedCount > 0 && (
                    <option value="unassigned" className="text-amber-700 font-bold">
                      ⚠️ Sem Condutor / Pendente ({riderOptions.unassignedCount})
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

          </div>

          {/* Secondary Row: Status Selector Buttons + Clear All */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Activity size={11} className="text-blue-600" />
                Filtrar Status:
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: '', label: 'Todos', count: statusCounts['Todos'] },
                  { key: 'Não iniciado', label: 'Não Iniciados', count: statusCounts['Não iniciado'] },
                  { key: 'Em rota', label: 'Em Rota', count: statusCounts['Em rota'] },
                  { key: 'Concluído', label: 'Concluídos', count: statusCounts['Concluído'] },
                  { key: 'Ocorrência', label: 'Ocorrências', count: statusCounts['Ocorrência'] },
                  { key: 'Cancelado', label: 'Cancelados', count: statusCounts['Cancelado'] }
                ].map(st => {
                  const isSelected = filterStatus === st.key;
                  return (
                    <button
                      key={st.key || 'all'}
                      type="button"
                      onClick={() => {
                        if (setFilterStatus) setFilterStatus(st.key);
                        if (onNavigateToOrders) onNavigateToOrders();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{st.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected 
                          ? 'bg-white/20 text-white' 
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {st.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clear All action */}
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

          {/* Active Badges Strip */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Sparkles size={11} className="text-blue-500" />
                Filtros ativos sincronizados:
              </span>

              {/* Search Query Pill */}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-900 font-extrabold rounded-lg text-xs">
                  <Search size={10} className="text-blue-700" />
                  <span>Busca: <strong>"{searchQuery}"</strong></span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery && setSearchQuery('')}
                    className="ml-1 p-0.5 hover:bg-blue-200 rounded text-blue-700 hover:text-blue-950 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              {/* Period Pill */}
              {!isAllDates && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-lg text-xs">
                  <Calendar size={10} className="text-slate-600" />
                  <span>
                    Período: <strong>
                      {filterDateFrom ? formatToBrazilianDate(filterDateFrom) : 'Início'} até {filterDateTo ? formatToBrazilianDate(filterDateTo) : 'Fim'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDateFrom('');
                      setFilterDateTo('');
                    }}
                    className="ml-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              {/* Partner Pill */}
              {filterPartner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 border border-purple-300 text-purple-900 font-extrabold rounded-lg text-xs">
                  <Building2 size={10} className="text-purple-700" />
                  <span>Parceiro: <strong>{selectedPartnerName}</strong></span>
                  <button
                    type="button"
                    onClick={() => setFilterPartner && setFilterPartner('')}
                    className="ml-1 text-purple-700 hover:text-purple-950 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              {/* Rider Pill */}
              {filterRiderId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 font-extrabold rounded-lg text-xs">
                  <UserCheck size={10} className="text-amber-700" />
                  <span>Condutor: <strong>{selectedRiderName}</strong></span>
                  <button
                    type="button"
                    onClick={() => setFilterRiderId && setFilterRiderId('')}
                    className="ml-1 text-amber-700 hover:text-amber-950 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              {/* Status Pill */}
              {filterStatus && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold rounded-lg text-xs">
                  <Activity size={10} className="text-emerald-700" />
                  <span>Status: <strong>{getStatusLabel(filterStatus)}</strong></span>
                  <button
                    type="button"
                    onClick={() => setFilterStatus && setFilterStatus('')}
                    className="ml-1 text-emerald-700 hover:text-emerald-950 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
