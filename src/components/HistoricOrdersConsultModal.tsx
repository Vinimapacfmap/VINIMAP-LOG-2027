/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  Database, 
  Filter, 
  RotateCcw, 
  FileSpreadsheet, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Ban, 
  Truck, 
  ShieldCheck, 
  Building2, 
  UserCheck, 
  ExternalLink,
  MapPin,
  RefreshCw,
  FileCheck2,
  FileSignature,
  Image as ImageIcon,
  Info
} from 'lucide-react';
import { Order, OrderStatus, ClientPartner, DeliveryRider } from '../types';
import { sbQueryHistoricOrders, QueryHistoricOrdersResult } from '../lib/supabaseService';
import { isSupabaseConfigured } from '../supabase';
import { formatToBrazilianDate, getSaoPauloISODate, extractISODateFromTimestamp } from '../utils/dateUtils';
import { getPartnerDisplayName } from '../utils/partnerUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoricOrdersConsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientPartners: ClientPartner[];
  riders: DeliveryRider[];
  initialSearchQuery?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export default function HistoricOrdersConsultModal({
  isOpen,
  onClose,
  clientPartners,
  riders,
  initialSearchQuery = '',
  initialDateFrom = '',
  initialDateTo = ''
}: HistoricOrdersConsultModalProps) {
  const todayStr = getSaoPauloISODate();

  // Filters
  const [dateFrom, setDateFrom] = useState<string>(initialDateFrom);
  const [dateTo, setDateTo] = useState<string>(initialDateTo);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riderFilter, setRiderFilter] = useState<string>('');
  const [partnerFilter, setPartnerFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Query state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<QueryHistoricOrdersResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Selected order detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Execute query against Supabase
  const handleExecuteQuery = useCallback(async (newPage = 1) => {
    if (!isSupabaseConfigured) {
      setErrorMsg('O Supabase não está configurado. Configure as credenciais no painel Supabase.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await sbQueryHistoricOrders({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        searchTerm: searchTerm || undefined,
        status: statusFilter || undefined,
        riderId: riderFilter || undefined,
        partnerName: partnerFilter || undefined,
        page: newPage,
        pageSize
      });
      setResult(res);
      setPage(newPage);
      setHasSearched(true);
    } catch (err: any) {
      console.error('[HistoricConsultModal] Query failed:', err);
      setErrorMsg(err.message || 'Falha ao consultar pedidos no banco Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, searchTerm, statusFilter, riderFilter, partnerFilter, pageSize]);

  // Execute automatically when modal opens if not searched yet
  useEffect(() => {
    if (isOpen && !hasSearched) {
      handleExecuteQuery(1);
    }
  }, [isOpen, hasSearched, handleExecuteQuery]);

  if (!isOpen) return null;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={11} className="text-emerald-600" />
            Concluído
          </span>
        );
      case 'Em rota':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 text-sky-800 border border-sky-300">
            <Truck size={11} className="text-sky-600" />
            Em rota
          </span>
        );
      case 'Ocorrência':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle size={11} className="text-amber-600" />
            Ocorrência
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
            <Ban size={11} className="text-rose-600" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-800 border border-slate-300">
            <Clock size={11} className="text-slate-500" />
            Não iniciado
          </span>
        );
    }
  };

  // Export results to Excel
  const handleExportExcel = () => {
    if (!result || result.orders.length === 0) return;
    const rows = result.orders.map(o => ({
      'ID Pedido': `#${o.id}`,
      'Data': formatToBrazilianDate(o.date),
      'Status': o.status,
      'Cliente': o.clientName,
      'Telefone': o.phone || '',
      'Endereço': o.address,
      'Região': o.region || '',
      'CEP': o.cep || '',
      'Parceiro': o.partnerName || '',
      'Condutor': riders.find(r => r.id === o.riderId)?.name || (o.riderId ? `ID: ${o.riderId}` : 'Sem Condutor'),
      'Valor Pedido (R$)': o.value.toFixed(2),
      'Taxa Entrega (R$)': (o.deliveryValue ?? 0).toFixed(2),
      'Repasse Condutor (R$)': (o.driverValue ?? 0).toFixed(2),
      'Protocolo': o.protocolNumber || '',
      'Recebedor': o.recipientName || '',
      'Documento': o.recipientDoc || '',
      'Data Conclusão': o.dataConclusao || o.deliveryDate || '',
      'Horário Conclusão': o.deliveryTime || o.horarioFinal || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consulta Supabase');
    XLSX.writeFile(wb, `consulta_pedidos_supabase_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export results to PDF
  const handleExportPDF = () => {
    if (!result || result.orders.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Relatório de Consulta de Pedidos Anteriores (Banco Supabase)', 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Total de registros: ${result.totalCount}`, 14, 22);

    const headers = [['# ID', 'Data', 'Status', 'Cliente', 'Endereço / CEP', 'Parceiro', 'Condutor', 'Valor', 'Protocolo']];
    const body = result.orders.map(o => [
      `#${o.id}`,
      formatToBrazilianDate(o.date),
      o.status,
      o.clientName,
      `${o.address} ${o.cep ? `(${o.cep})` : ''}`,
      o.partnerName || '-',
      riders.find(r => r.id === o.riderId)?.name || (o.riderId ? `ID: ${o.riderId}` : 'Pendente'),
      `R$ ${o.value.toFixed(2)}`,
      o.protocolNumber || '-'
    ]);

    autoTable(doc, {
      head: headers,
      body,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });

    doc.save(`consulta_pedidos_supabase_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Database size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                  <span>Consulta de Pedidos Anteriores</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 uppercase">
                    Banco Supabase (PostgreSQL)
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-400" />
                <span>Modo de Leitura Isolada • Não consome cota diária do Firebase Firestore</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal (ESC)"
          >
            <X size={20} />
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            
            {/* 1. Termo de Pesquisa */}
            <div className="lg:col-span-4 space-y-1">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Search size={11} className="text-blue-600" />
                Termo / Nº Pedido / Cliente / CEP / Protocolo
              </label>
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleExecuteQuery(1); }}
                  placeholder="Ex: 1045, João, Av. Paulista, 01310-100..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                />
                {searchTerm && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Data Inicial */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} className="text-emerald-600" />
                Data Inicial
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              />
            </div>

            {/* 3. Data Final */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} className="text-emerald-600" />
                Data Final
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              />
            </div>

            {/* 4. Status */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Filter size={11} className="text-purple-600" />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer truncate"
              >
                <option value="">Todos os Status</option>
                <option value="Não iniciado">Não iniciado</option>
                <option value="Em rota">Em rota</option>
                <option value="Concluído">Concluído</option>
                <option value="Ocorrência">Ocorrência</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            {/* 5. Ações (Consultar / Limpar) */}
            <div className="lg:col-span-2 flex items-end gap-2">
              <button
                type="button"
                onClick={() => handleExecuteQuery(1)}
                disabled={isLoading}
                className="flex-1 h-9.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                <span>{isLoading ? 'Buscando...' : 'Consultar'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setSearchTerm('');
                  setStatusFilter('');
                  setRiderFilter('');
                  setPartnerFilter('');
                  setPage(1);
                  setTimeout(() => handleExecuteQuery(1), 50);
                }}
                className="h-9.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                title="Limpar todos os filtros"
              >
                <RotateCcw size={13} />
              </button>
            </div>

          </div>

          {/* Secondary Filter Row: Presets de Data Rápidos */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1 border-t border-slate-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1">Atalhos de Período:</span>
              
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const today = d.toISOString().slice(0, 10);
                  setDateFrom(today);
                  setDateTo(today);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const ont = d.toISOString().slice(0, 10);
                  setDateFrom(ont);
                  setDateTo(ont);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Ontem
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setDateFrom(d.toISOString().slice(0, 10));
                  setDateTo(new Date().toISOString().slice(0, 10));
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Últimos 7 dias
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setDateFrom(d.toISOString().slice(0, 10));
                  setDateTo(new Date().toISOString().slice(0, 10));
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Últimos 30 dias
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
                  setDateFrom(firstDay);
                  setDateTo(d.toISOString().slice(0, 10));
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Este Mês
              </button>

              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-black text-[11px] cursor-pointer"
              >
                Todo o Histórico
              </button>
            </div>

            {/* Export Buttons */}
            {result && result.orders.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-black text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet size={13} className="text-emerald-700" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg font-black text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText size={13} className="text-rose-700" />
                  <span>PDF (.pdf)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ERROR NOTIFICATION */}
        {errorMsg && (
          <div className="mx-5 my-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-900 text-xs">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <div className="flex-1">
              <span className="font-black">Erro na Consulta:</span> {errorMsg}
            </div>
            <button 
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-800 p-1 font-bold"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* RESULTS TABLE AREA */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 bg-white">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw size={32} className="animate-spin text-emerald-600" />
              <p className="font-extrabold text-sm text-slate-800">Consultando banco PostgreSQL no Supabase...</p>
              <p className="text-xs text-slate-400">Esta leitura não utiliza as cotas diárias do Firebase Firestore.</p>
            </div>
          ) : !result || result.orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Database size={40} className="mx-auto text-slate-300" />
              <p className="text-base font-black text-slate-700">Nenhum pedido encontrado para os filtros selecionados.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Tente ampliar o intervalo de datas, selecionar "Todo o Histórico" ou remover termos específicos de busca.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Summary Stats Strip */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span>
                    Exibindo <strong className="text-slate-900">{result.orders.length}</strong> de <strong className="text-slate-900">{result.totalCount}</strong> pedidos encontrados
                  </span>
                  {result.totalPages > 1 && (
                    <span className="text-slate-400">• Página {result.page} de {result.totalPages}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-extrabold">
                  <ShieldCheck size={13} />
                  <span>Leitura direta do Supabase</span>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3"># ID</th>
                      <th className="py-3 px-3">Data</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Cliente / Destinatário</th>
                      <th className="py-3 px-3">Endereço / CEP</th>
                      <th className="py-3 px-3">Parceiro</th>
                      <th className="py-3 px-3">Condutor</th>
                      <th className="py-3 px-3 text-right">Valor</th>
                      <th className="py-3 px-3 text-center">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    {result.orders.map((o) => {
                      const assignedRider = riders.find(r => r.id === o.riderId);
                      return (
                        <tr 
                          key={o.id} 
                          className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedOrder(o)}
                        >
                          <td className="py-2.5 px-3 font-mono font-black text-blue-700">
                            #{o.id}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {formatToBrazilianDate(o.date)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getStatusBadge(o.status)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{o.clientName}</div>
                            {o.phone && <div className="text-[10px] text-slate-400">{o.phone}</div>}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate">
                            <div className="truncate font-medium">{o.address}</div>
                            {o.cep && <div className="text-[10px] text-slate-400 font-mono">CEP: {o.cep}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {o.partnerName || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {assignedRider ? (
                              <span className="font-bold text-slate-900">{assignedRider.name}</span>
                            ) : o.riderId ? (
                              <span className="text-slate-600">ID: {o.riderId}</span>
                            ) : (
                              <span className="text-amber-700 text-[11px] font-bold">Sem Condutor</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-800 whitespace-nowrap">
                            R$ {o.value.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(o);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded-lg text-slate-600 transition-colors"
                              title="Visualizar Detalhes do Pedido"
                            >
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLS */}
              {result.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <div className="text-slate-500 font-bold">
                    Página {result.page} de {result.totalPages} ({result.totalCount} registros no total)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExecuteQuery(page - 1)}
                      disabled={page <= 1 || isLoading}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft size={14} />
                      <span>Anterior</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteQuery(page + 1)}
                      disabled={page >= result.totalPages || isLoading}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer shadow-2xs"
                    >
                      <span>Próxima</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>Esta janela opera exclusivamente como ferramenta de auditoria e consulta direta no banco Supabase.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl cursor-pointer shadow-2xs"
          >
            Fechar Consulta
          </button>
        </div>

      </div>

      {/* SUB-MODAL: ORDER DETAIL VIEW */}
      {selectedOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 size={18} className="text-emerald-400" />
                <h4 className="font-black text-sm">Detalhes do Pedido #{selectedOrder.id}</h4>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Status and values */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Data Operacional</span>
                  <div className="font-bold text-slate-800 mt-1">{formatToBrazilianDate(selectedOrder.date)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Valor da Entrega</span>
                  <div className="font-mono font-black text-emerald-700 mt-1">R$ {selectedOrder.value.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Protocolo</span>
                  <div className="font-mono font-bold text-slate-800 mt-1">{selectedOrder.protocolNumber || 'N/A'}</div>
                </div>
              </div>

              {/* Client and Destination */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h5 className="font-black text-xs text-slate-900">Destinatário & Endereço</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400">Cliente:</span> <strong>{selectedOrder.clientName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Telefone:</span> <strong>{selectedOrder.phone || 'Não informado'}</strong>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Endereço:</span> <strong>{selectedOrder.address}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">CEP:</span> <strong>{selectedOrder.cep || 'Não informado'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Região:</span> <strong>{selectedOrder.region || 'Não informada'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Parceiro:</span> <strong>{selectedOrder.partnerName || 'Geral'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Condutor:</span> <strong>{riders.find(r => r.id === selectedOrder.riderId)?.name || selectedOrder.riderId || 'Sem Condutor'}</strong>
                  </div>
                </div>
              </div>

              {/* Delivery Signatures and Confirmation Info */}
              {(selectedOrder.recipientName || selectedOrder.signatureUrl || selectedOrder.deliveryPhotoUrl) && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <h5 className="font-black text-xs text-slate-900">Comprovante de Conclusão / Baixa</h5>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 mb-2">
                    {selectedOrder.recipientName && (
                      <div><span className="text-slate-400">Recebedor:</span> <strong>{selectedOrder.recipientName}</strong></div>
                    )}
                    {selectedOrder.recipientDoc && (
                      <div><span className="text-slate-400">Documento:</span> <strong>{selectedOrder.recipientDoc}</strong></div>
                    )}
                    {selectedOrder.deliveryTime && (
                      <div><span className="text-slate-400">Horário:</span> <strong>{selectedOrder.deliveryTime}</strong></div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedOrder.signatureUrl && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                          <FileSignature size={11} /> Assinatura Digital
                        </span>
                        <img 
                          src={selectedOrder.signatureUrl} 
                          alt="Assinatura" 
                          className="h-28 w-full object-contain bg-white rounded-lg border border-slate-200" 
                        />
                      </div>
                    )}

                    {selectedOrder.deliveryPhotoUrl && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                          <ImageIcon size={11} /> Foto do Comprovante
                        </span>
                        <img 
                          src={selectedOrder.deliveryPhotoUrl} 
                          alt="Comprovante" 
                          className="h-28 w-full object-cover bg-white rounded-lg border border-slate-200" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Voltar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
