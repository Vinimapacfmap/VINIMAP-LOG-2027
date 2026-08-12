/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { DeliveryRider, OrderStatus, ClientPartner } from '../types';
import { formatToBrazilianDate, getSaoPauloISODate } from '../utils/dateUtils';
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
  Search
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
  onClearFilters: () => void;
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
  onClearFilters,
}: GlobalFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  // List of known partners from mock data & clientPartners
  const partners = Array.from(new Set([
    ...(clientPartners?.map(cp => cp.name) || []),
    'Burger King',
    'Droga Raia',
    'McDonalds',
    'Pizzaria Bella',
    'Supermercado Extra',
    'Lojas Americanas',
    'Zé Delivery'
  ])).sort();

  // List of possible order statuses
  const statuses: { value: OrderStatus; label: string }[] = [
    { value: 'Não iniciado', label: 'Não iniciado' },
    { value: 'Em rota', label: 'Em Rota' },
    { value: 'Entregando', label: 'Entregando' },
    { value: 'Concluído', label: 'Concluído' },
    { value: 'Ocorrência', label: 'Ocorrência' },
    { value: 'Cancelado', label: 'Cancelado' }
  ];

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
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Filtrar por código, cliente, condutor, datas, CEP e status</p>
          </div>
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-700 text-[10px] font-black text-white shadow-xs">
              {activeCount} {activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}
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
        <div className="p-3 sm:p-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5" id="filters-form-grid">
          
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
                placeholder="Nº Pedido, Cliente, Destinatário, CEP, DANFE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
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

          {/* 4. Partner Client Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center gap-1">
              <Store size={11} className="text-slate-600" />
              Cliente Parceiro
            </label>
            <select
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Todos os Clientes</option>
              {partners.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 5. Conductor/Rider Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center gap-1">
              <User size={11} className="text-slate-600" />
              Condutor
            </label>
            <select
              value={filterRiderId}
              onChange={(e) => setFilterRiderId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Todos os Condutores</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.vehicle})</option>
              ))}
            </select>
          </div>

          {/* 6. Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-800 uppercase tracking-wider block flex items-center gap-1">
              <Activity size={11} className="text-slate-600" />
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Todos os Status</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

        </div>
      )}
    </div>
  );
}
