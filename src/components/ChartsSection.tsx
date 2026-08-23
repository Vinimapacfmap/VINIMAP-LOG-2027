import { useState } from 'react';
import { ChartDataPoint, RegionDistribution, Order, OrderStatus } from '../types';
import { getPartnerDisplayName } from '../utils/partnerUtils';
import { 
  Award, 
  MapPin, 
  Search, 
  X, 
  CheckCircle2, 
  Truck, 
  Clock, 
  AlertCircle, 
  XCircle, 
  ShoppingBag, 
  ExternalLink, 
  ChevronRight,
  ChevronDown,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChartsSectionProps {
  chartData: ChartDataPoint[];
  regions: RegionDistribution[];
  orders?: Order[];
  filterDateFrom?: string;
  filterDateTo?: string;
  onNavigateToOrdersWithSearch?: (searchQuery: string) => void;
}

export default function ChartsSection({ 
  regions, 
  orders = [],
  filterDateFrom,
  filterDateTo,
  onNavigateToOrdersWithSearch
}: ChartsSectionProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [inlineSearchQuery, setInlineSearchQuery] = useState<string>('');
  const [inlineStatusFilter, setInlineStatusFilter] = useState<'Todos' | OrderStatus>('Todos');

  // Format date for display (e.g., 2026-07-29 -> 29/07/2026)
  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const formattedFrom = formatDateDisplay(filterDateFrom);
  const formattedTo = formatDateDisplay(filterDateTo);
  const periodText = formattedFrom && formattedTo
    ? (formattedFrom === formattedTo ? `${formattedFrom}` : `${formattedFrom} até ${formattedTo}`)
    : 'Período Selecionado';

  // Selected region orders
  const regionOrders = selectedRegion
    ? orders.filter(o => o.region?.toLowerCase() === selectedRegion.toLowerCase())
    : [];

  // Filtered orders inside inline section based on search & status
  const filteredRegionOrders = regionOrders.filter(o => {
    const matchesStatus = inlineStatusFilter === 'Todos' || o.status === inlineStatusFilter;
    const q = inlineSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      o.id.toLowerCase().includes(q) ||
      o.clientName?.toLowerCase().includes(q) ||
      o.partnerName?.toLowerCase().includes(q) ||
      o.address?.toLowerCase().includes(q) ||
      o.cep?.toLowerCase().includes(q) ||
      (o.protocolNumber && o.protocolNumber.toLowerCase().includes(q))
    );
    return matchesStatus && matchesSearch;
  });

  // Regional metrics for selected region
  const totalRegionOrders = regionOrders.length;
  const totalRegionValue = regionOrders.reduce((sum, o) => sum + (o.status !== 'Cancelado' ? o.value : 0), 0);
  const completedCount = regionOrders.filter(o => o.status === 'Concluído').length;
  const inRouteCount = regionOrders.filter(o => o.status === 'Em rota').length;
  const occurrenceCount = regionOrders.filter(o => o.status === 'Ocorrência').length;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Concluído':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={11}/> Concluído</span>;
      case 'Em rota':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200"><Truck size={11}/> Em Rota</span>;
      case 'Não iniciado':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock size={11}/> Não Iniciado</span>;
      case 'Ocorrência':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle size={11}/> Ocorrência</span>;
      case 'Cancelado':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><XCircle size={11}/> Cancelado</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const handleSelectRegion = (regionName: string | null) => {
    setSelectedRegion(regionName);
    setInlineSearchQuery('');
    setInlineStatusFilter('Todos');
  };

  return (
    <div className="w-full space-y-4" id="charts-and-regions-container">
      {/* Region Distribution Main Container */}
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-5" id="regions-distribution-card">
        {/* Header with Title and Quick Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 text-sm">Distribuição Regional de Pedidos</h3>
              <span className="text-[10px] font-extrabold bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100/80">
                {periodText}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Clique em qualquer card regional ou use o seletor para visualizar e alternar os pedidos na própria tela.
            </p>
          </div>

          {/* Region Dropdown Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={selectedRegion || ''}
                onChange={(e) => handleSelectRegion(e.target.value || null)}
                className="pl-8 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all appearance-none"
              >
                <option value="">Selecione uma Região...</option>
                {regions.map(r => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.count} ped. - {r.percent}%)
                  </option>
                ))}
              </select>
              <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {selectedRegion && (
              <button
                onClick={() => handleSelectRegion(null)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Fechar detalhes da região"
              >
                <X size={13} />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Perfectly Aligned Region Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5" id="regions-bars-list">
          {regions.map((region, idx) => {
            const isSelected = selectedRegion === region.name;

            // Custom progress bar colors based on index
            const colorClass = 
              idx === 0 ? 'bg-blue-600' :
              idx === 1 ? 'bg-blue-500' :
              idx === 2 ? 'bg-sky-400' :
              idx === 3 ? 'bg-indigo-400' :
              'bg-indigo-300';

            return (
              <button
                key={region.name} 
                type="button"
                onClick={() => handleSelectRegion(isSelected ? null : region.name)}
                className={`text-left space-y-2.5 p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-2xs ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/30 shadow-md'
                    : 'bg-slate-50/60 hover:bg-blue-50/30 border-slate-200/80 hover:border-blue-300'
                }`}
              >
                {/* Active Selection Glow bar */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
                )}

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-blue-500'} transition-colors`} />
                    <span className={`font-extrabold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800 group-hover:text-blue-700'}`}>
                      {region.name}
                    </span>
                  </div>

                  <span className={`font-black text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                    isSelected 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {region.percent}%
                  </span>
                </div>

                {/* Progress bar track */}
                <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden w-full relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${region.percent}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.08 }}
                    className={`h-full ${colorClass} rounded-full`}
                  />
                </div>

                <div className="flex items-center justify-between pt-0.5 text-[11px]">
                  <span className={`font-bold font-mono ${isSelected ? 'text-blue-800' : 'text-slate-600'}`}>
                    {region.count} {region.count === 1 ? 'pedido' : 'pedidos'}
                  </span>
                  <span className={`text-[10px] font-extrabold transition-transform flex items-center gap-0.5 ${
                    isSelected ? 'text-blue-700' : 'text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5'
                  }`}>
                    {isSelected ? 'Ativo' : 'Ver'}
                    <ChevronRight size={11} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* INLINE EXPANDABLE REGIONAL ORDERS PANEL (NO MODAL) */}
        <AnimatePresence>
          {selectedRegion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-slate-200 pt-5 mt-2"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl space-y-4">
                {/* Inline Header Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-black text-white">
                          Pedidos da Região: <span className="text-blue-400">{selectedRegion}</span>
                        </h4>
                        <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold rounded-full font-mono">
                          {totalRegionOrders} {totalRegionOrders === 1 ? 'registro' : 'registros'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Filtro ativo do período: <strong className="text-white">{periodText}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Quick Region Switcher Dropdown + Close Button */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => handleSelectRegion(e.target.value)}
                        className="pl-8 pr-8 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer focus:outline-hidden focus:border-blue-400 transition-all appearance-none"
                      >
                        {regions.map(r => (
                          <option key={r.name} value={r.name} className="bg-slate-900 text-white">
                            Alternar para {r.name} ({r.count} ped.)
                          </option>
                        ))}
                      </select>
                      <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <button
                      onClick={() => handleSelectRegion(null)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                      title="Fechar visão detalhada"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Inline Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Volume Total</span>
                    <div className="text-base font-black text-white mt-0.5">{totalRegionOrders} pedidos</div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faturamento Regional</span>
                    <div className="text-base font-black text-emerald-400 mt-0.5">
                      {totalRegionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Entregues / Concluídos</span>
                    <div className="text-base font-black text-emerald-400 mt-0.5">
                      {completedCount} <span className="text-xs text-slate-400 font-normal">({totalRegionOrders ? Math.round((completedCount/totalRegionOrders)*100) : 0}%)</span>
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Em Rota / A Caminho</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-base font-black text-sky-400">{inRouteCount}</span>
                      {occurrenceCount > 0 && (
                        <span className="text-[10px] font-black text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                          {occurrenceCount} ocorr.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search Bar & Status Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  {/* Inline Search Input */}
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={inlineSearchQuery}
                      onChange={(e) => setInlineSearchQuery(e.target.value)}
                      placeholder={`Pesquisar nos pedidos da ${selectedRegion} (código, cliente, parceiro, CEP, endereço)...`}
                      className="w-full pl-9 pr-8 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-hidden focus:border-blue-400 transition-all"
                    />
                    {inlineSearchQuery && (
                      <button
                        onClick={() => setInlineSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Status Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
                    <Filter size={13} className="text-slate-400 mr-1 hidden lg:block" />
                    {(['Todos', 'Não iniciado', 'Em rota', 'Concluído', 'Ocorrência', 'Cancelado'] as const).map(status => {
                      const isActive = inlineStatusFilter === status;
                      return (
                        <button
                          key={status}
                          onClick={() => setInlineStatusFilter(status)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inline Orders Table */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                  {filteredRegionOrders.length === 0 ? (
                    <div className="py-10 text-center p-4 space-y-2">
                      <ShoppingBag size={32} className="mx-auto text-slate-600" />
                      <p className="text-xs font-bold text-slate-300">Nenhum pedido localizado na {selectedRegion}</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Não existem lançamentos correspondentes à busca ou status no período selecionado.
                      </p>
                      {(inlineSearchQuery || inlineStatusFilter !== 'Todos') && (
                        <button
                          onClick={() => {
                            setInlineSearchQuery('');
                            setInlineStatusFilter('Todos');
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 border border-blue-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Limpar Filtros de Pesquisa
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider sticky top-0 z-10">
                            <th className="px-4 py-2.5">Código / Data</th>
                            <th className="px-4 py-2.5">Cliente / Parceiro</th>
                            <th className="px-4 py-2.5">Endereço de Entrega</th>
                            <th className="px-4 py-2.5 text-center">Status</th>
                            <th className="px-4 py-2.5 text-right">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 font-medium">
                          {filteredRegionOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="font-mono font-bold text-blue-400">{order.id}</div>
                                {order.protocolNumber && (
                                  <div className="text-[10px] text-slate-400 font-mono">Prot: {order.protocolNumber}</div>
                                )}
                                <div className="text-[10px] text-slate-400">{order.date || 'Data N/D'}</div>
                              </td>

                              <td className="px-4 py-2.5">
                                <div className="font-bold text-white">{order.clientName}</div>
                                <div className="text-[10px] text-slate-400 font-semibold">{getPartnerDisplayName(order.partnerName)}</div>
                              </td>

                              <td className="px-4 py-2.5 max-w-[220px]">
                                <div className="text-slate-300 truncate" title={order.address}>{order.address}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                  {order.cep && <span className="font-mono bg-slate-800 text-slate-300 px-1 py-0.2 rounded text-[9px]">{order.cep}</span>}
                                  <span className="font-extrabold text-blue-400">{order.region}</span>
                                </div>
                              </td>

                              <td className="px-4 py-2.5 text-center">
                                {getStatusBadge(order.status)}
                              </td>

                              <td className="px-4 py-2.5 text-right">
                                <div className="font-mono font-extrabold text-emerald-400">
                                  {order.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                                {order.deliveryValue !== undefined && order.deliveryValue > 0 && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Frete: {order.deliveryValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Inline Footer Actions */}
                <div className="flex items-center justify-between gap-3 pt-2 text-xs">
                  <span className="text-slate-400 text-[11px] font-medium">
                    Exibindo <strong className="text-white">{filteredRegionOrders.length}</strong> de <strong className="text-white">{totalRegionOrders}</strong> pedidos na {selectedRegion}
                  </span>

                  <div className="flex items-center gap-2">
                    {onNavigateToOrdersWithSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          const query = selectedRegion;
                          onNavigateToOrdersWithSearch(query);
                        }}
                        className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>Abrir na Central de Pedidos</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelectRegion(null)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Recolher
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Regional highlight stat footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
              <Award size={16} />
            </div>
            <div className="text-xs">
              <span className="text-slate-500 block font-semibold leading-normal">Destaque de Logística Regional</span>
              <span className="font-extrabold text-slate-800 leading-none">
                Selecione qualquer região para alternar e visualizar instantaneamente a lista de entregas do período na mesma tela.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
