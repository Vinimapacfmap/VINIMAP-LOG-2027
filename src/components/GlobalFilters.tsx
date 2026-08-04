/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { DeliveryRider, OrderStatus, ClientPartner } from '../types';
import { formatToBrazilianDate } from '../utils/dateUtils';
import { 
  Filter, 
  Calendar, 
  User, 
  MapPin, 
  Activity, 
  X, 
  Store,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface GlobalFiltersProps {
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
    filterDateFrom,
    filterDateTo,
    filterPartner,
    filterRiderId,
    filterStatus,
    filterCep
  ].filter(Boolean).length;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm transition-all overflow-hidden" id="global-filters-panel">
      {/* Header Bar */}
      <div 
        className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        id="filters-header-trigger"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <Filter size={15} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-xs">Filtros Avançados do Sistema</h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Filtrar faturamento, mapas, KPIs e tabelas</p>
          </div>
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm shadow-blue-200">
              {activeCount} {activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearFilters();
              }}
              className="px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-lg border border-rose-100/50 transition-all flex items-center gap-1 cursor-pointer"
              id="clear-filters-btn"
            >
              <X size={10} />
              <span>Limpar Filtros</span>
            </button>
          )}
          <span className="text-slate-400">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {/* Inputs Form Section */}
      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4" id="filters-form-grid">
          {/* 1. Data Inicial Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between select-none">
              <span className="flex items-center gap-1">
                <Calendar size={10} className="text-slate-400" />
                Data Inicial
              </span>
              {filterDateFrom && (
                <span className="text-[10px] text-blue-600 font-bold lowercase">
                  ({formatToBrazilianDate(filterDateFrom)})
                </span>
              )}
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => {
                const val = e.target.value;
                setFilterDateFrom(val);
                if (val) setFilterDateTo(val);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            />
          </div>

          {/* 2. Data Final Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between select-none">
              <span className="flex items-center gap-1">
                <Calendar size={10} className="text-slate-400" />
                Data Final
              </span>
              {filterDateTo && (
                <span className="text-[10px] text-blue-600 font-bold lowercase">
                  ({formatToBrazilianDate(filterDateTo)})
                </span>
              )}
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            />
          </div>

          {/* 3. Partner Client Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <Store size={10} className="text-slate-400" />
              Cliente Parceiro
            </label>
            <select
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Todos</option>
              {partners.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 4. Conductor/Rider Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <User size={10} className="text-slate-400" />
              Condutor
            </label>
            <select
              value={filterRiderId}
              onChange={(e) => setFilterRiderId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Todos</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.vehicle})</option>
              ))}
            </select>
          </div>

          {/* 5. Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <Activity size={10} className="text-slate-400" />
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">Todos</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* 6. CEP Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <MapPin size={10} className="text-slate-400" />
              CEP
            </label>
            <input
              type="text"
              placeholder="Ex: 01310-100"
              value={filterCep}
              onChange={(e) => setFilterCep(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}
