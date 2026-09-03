/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, ClientPartner, OrderStatus, DeliveryRider } from '../types';
import { formatToBrazilianDate, getSaoPauloISODate } from '../utils/dateUtils';
import { getOrderFreightValue } from '../utils/billingUtils';
import { resolveOrderDisplayName } from '../utils/partnerUtils';
import { compareOrdersByCep } from '../utils/addressUtils';
import { 
  X, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Flag, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  Search,
  Wallet,
  CalendarDays,
  FileSpreadsheet,
  Download,
  MapPin,
  User,
  ArrowUpDown
} from 'lucide-react';

interface ClientBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
  clientPartners: ClientPartner[];
  orders: Order[];
  riders: DeliveryRider[];
}

export const ClientBillingModal: React.FC<ClientBillingModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientPartners,
  orders,
  riders
}) => {
  // Find selected client/partner
  const client = useMemo(() => {
    return clientPartners.find(c => c.id === clientId) || null;
  }, [clientPartners, clientId]);

  // Set default period: all of June and July 2026 (or custom range)
  const [startDate, setStartDate] = useState<string>('2026-06-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Sorting state
  const [sortField, setSortField] = useState<'id' | 'date' | 'client' | 'address' | 'cep' | 'value' | 'freight'>('cep');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Setup presets helper
  const handlePreset = (preset: 'today' | 'week' | 'july26' | 'june26' | 'all') => {
    const today = getSaoPauloISODate(); // Simulated current date of the application
    switch (preset) {
      case 'today':
        setStartDate(today);
        setEndDate(today);
        break;
      case 'week':
        setStartDate('2026-06-29');
        setEndDate(today);
        break;
      case 'july26':
        setStartDate('2026-07-01');
        setEndDate('2026-07-31');
        break;
      case 'june26':
        setStartDate('2026-06-01');
        setEndDate('2026-06-30');
        break;
      case 'all':
        setStartDate('2026-06-01');
        setEndDate('2026-07-31');
        break;
    }
  };

  // Filtered orders for this client in the selected period
  const filteredOrders = useMemo(() => {
    if (!client) return [];
    return orders.filter(o => {
      // Match by partnerName / clientId / codigoCliente
      const isClientMatch = o.partnerName === client.name || 
                            o.partnerName === client.id || 
                            (client.codigoCliente && o.partnerName === client.codigoCliente);
      if (!isClientMatch) return false;
      const effectiveDate = (o.status === 'Ocorrência' && o.occurrenceDate) ? o.occurrenceDate : o.date;
      if (!effectiveDate) return false;
      
      const inDateRange = effectiveDate >= startDate && effectiveDate <= endDate;
      if (!inDateRange) return false;

      // Filter by search query (Client name, Rider name, Region, ID, or Address)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesClient = o.clientName?.toLowerCase().includes(query);
        const matchesRegion = o.region?.toLowerCase().includes(query);
        const matchesId = o.id?.toLowerCase().includes(query) || o.protocolNumber?.toLowerCase().includes(query);
        const matchesAddress = o.address?.toLowerCase().includes(query);
        
        // Find rider if assigned to match query
        let matchesRider = false;
        if (o.riderId) {
          const r = riders.find(rider => rider.id === o.riderId);
          matchesRider = r ? r.name.toLowerCase().includes(query) : false;
        }

        return matchesClient || matchesRegion || matchesId || matchesAddress || matchesRider;
      }

      return true;
    }).sort(compareOrdersByCep);
  }, [orders, client, startDate, endDate, searchQuery, riders]);

  // Sorted orders for table display
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (sortField === 'value') {
        return sortDirection === 'asc' ? (a.value || 0) - (b.value || 0) : (b.value || 0) - (a.value || 0);
      } else if (sortField === 'freight') {
        const freightA = getOrderFreightValue(a, clientPartners);
        const freightB = getOrderFreightValue(b, clientPartners);
        return sortDirection === 'asc' ? freightA - freightB : freightB - freightA;
      } else if (sortField === 'date') {
        const dtA = a.date || '';
        const dtB = b.date || '';
        const res = dtA.localeCompare(dtB);
        return sortDirection === 'asc' ? res : -res;
      } else if (sortField === 'cep') {
        const res = compareOrdersByCep(a, b);
        return sortDirection === 'asc' ? res : -res;
      }
      
      let valA = '';
      let valB = '';
      if (sortField === 'id') {
        valA = String(a.id || '').replace('ped-', '');
        valB = String(b.id || '').replace('ped-', '');
      } else if (sortField === 'client') {
        valA = String(a.clientName || '');
        valB = String(b.clientName || '');
      } else if (sortField === 'address') {
        valA = String(a.address || '');
        valB = String(b.address || '');
      }
      const res = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? res : -res;
    });
  }, [filteredOrders, sortField, sortDirection, clientPartners]);

  // Calculations for billing metrics
  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const completed = filteredOrders.filter(o => o.status === 'Concluído');
    const inRoute = filteredOrders.filter(o => o.status === 'Em rota' || (o.status as string) === 'Entregando');
    const occurrences = filteredOrders.filter(o => o.status === 'Ocorrência');
    const pending = filteredOrders.filter(o => o.status === 'Não iniciado');
    const cancelled = filteredOrders.filter(o => o.status === 'Cancelado');

    // Financial calculations on completed orders
    const completedCount = completed.length;
    const completedValue = completed.reduce((sum, o) => sum + o.value, 0);
    
    let totalFreight = 0;
    completed.forEach(o => {
      totalFreight += getOrderFreightValue(o, clientPartners);
    });

    return {
      total,
      completedCount,
      inRouteCount: inRoute.length,
      occurrencesCount: occurrences.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      completedValue,
      totalFreight
    };
  }, [filteredOrders, clientPartners]);

  if (!isOpen || !client) return null;

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case 'Concluído':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Em rota':
        return 'bg-blue-50 text-blue-700 border-blue-150';
      case 'Ocorrência':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'Cancelado':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-150';
    }
  };

  const handleExportExcel = () => {
    try {
      const formattedData = filteredOrders.map(order => {
        const isConcluded = order.status === 'Concluído';
        const orderFreight = isConcluded ? getOrderFreightValue(order, clientPartners) : 0;
        
        // Find rider name
        const r = order.riderId ? riders.find(rider => rider.id === order.riderId) : null;
        
        return {
          'Nº do Pedido': order.id.replace('ped-', '') || order.id,
          'Data': formatToBrazilianDate(order.date),
          'Cliente': resolveOrderDisplayName(order.clientName, clientPartners, order.clientName),
          'Endereço': order.address,
          'CEP': order.cep || 'N/A',
          'Valor Pedido (R$)': order.value,
          'Status': order.status,
          'Frete Cobrado (R$)': orderFreight
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato de Faturamento');
      
      // Auto-fit column widths dynamically
      if (formattedData.length > 0) {
        const maxLens = Object.keys(formattedData[0]).map(key => {
          let maxVal = key.length;
          formattedData.forEach(row => {
            const cellVal = String((row as any)[key] || '');
            if (cellVal.length > maxVal) maxVal = cellVal.length;
          });
          return { wch: Math.min(maxVal + 3, 50) };
        });
        worksheet['!cols'] = maxLens;
      }

      XLSX.writeFile(workbook, `faturamento_parceiro_${client.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Erro ao exportar planilha Excel.');
    }
  };

  const handleExportPdf = () => {
    try {
      if (filteredOrders.length === 0) {
        alert('Não há entregas cadastradas para exportar.');
        return;
      }
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const timestamp = new Date().toLocaleString('pt-BR');
      
      // Header Info
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("Relatório de Faturamento - Extrato do Parceiro", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Parceiro/Estabelecimento: ${client.name}`, 14, 27);
      doc.text(`ID/Código: ${client.codigoCliente || client.id} | Região: ${client.region}`, 14, 32);
      doc.text(`Período: ${formatToBrazilianDate(startDate)} até ${formatToBrazilianDate(endDate)}`, 14, 37);
      doc.text(`Exportado em: ${timestamp}`, 14, 42);
      doc.text(`Total de Frete Consolidado: ${stats.totalFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 47);

      // Table headers & body
      const pdfHeaders = [['Nº Pedido', 'Data', 'Cliente', 'Endereço', 'CEP', 'Frete']];
      const pdfBody = filteredOrders.map(order => {
        const isConcluded = order.status === 'Concluído';
        const orderFreight = isConcluded ? getOrderFreightValue(order, clientPartners) : 0;

        return [
          order.id.replace('ped-', '') || order.id,
          formatToBrazilianDate(order.date),
          resolveOrderDisplayName(order.clientName, clientPartners, order.clientName),
          order.address,
          order.cep || 'N/A',
          orderFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ];
      });

      // Add a total row at the end of the body
      pdfBody.push([
        'TOTAL CONSOLIDADO',
        '',
        '',
        `${stats.completedCount} / ${stats.total} Entregas`,
        '',
        stats.totalFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);
      
      autoTable(doc, {
        startY: 53,
        head: pdfHeaders,
        body: pdfBody,
        theme: 'striped',
        headStyles: {
          fillColor: [124, 58, 237], // violet-600
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85] // slate-700
        },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', cellWidth: 20 },
          1: { halign: 'left', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'left', cellWidth: 35 },
          4: { halign: 'left', cellWidth: 60 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
        },
        margin: { top: 53, left: 14, right: 14 },
        didParseCell: function(cellData) {
          // Style the last row specifically
          if (cellData.row.index === pdfBody.length - 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fillColor = [241, 245, 249]; // slate-100
            cellData.cell.styles.textColor = [15, 23, 42]; // slate-900
          }
        }
      });
      
      doc.save(`faturamento_parceiro_${client.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Erro ao exportar PDF.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        
        {/* Backdrop overlay trigger close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Core Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative bg-white border-0 shadow-2xl w-full h-full max-w-full max-h-screen flex flex-col overflow-hidden z-10 rounded-none"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 bg-gradient-to-r from-slate-50 to-slate-100/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl shadow-xs border border-violet-100/30">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Faturamento e Conciliação do Parceiro</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Emissão de faturamento consolidado de frete e custos por cliente parceiro</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Client Profile Block */}
            <div className="bg-slate-50 border border-slate-150/80 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center border-2 border-white shadow-md font-bold text-lg shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-800">{client.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-400">
                      <span className="text-violet-600 bg-violet-50 border border-violet-100/50 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px]">
                        {client.type}
                      </span>
                      <span>•</span>
                      <span>ID: {client.codigoCliente || client.id}</span>
                      <span>•</span>
                      {client.cnpj && (
                        <>
                          <span>CNPJ: {client.cnpj}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>Tel: {client.tel}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400" />
                        {client.region}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Período de Faturamento:</span>
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-slate-600 font-bold shadow-xs">
                    <CalendarDays size={13} className="text-slate-400" />
                    <span>{formatToBrazilianDate(startDate)}</span>
                    <span className="text-slate-300 mx-1">até</span>
                    <span>{formatToBrazilianDate(endDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Filters Controls */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-violet-500" />
                  <span className="text-xs font-bold text-slate-700">Ajustar Filtro Temporal de Entregas</span>
                </div>
                
                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handlePreset('today')}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer bg-white"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => handlePreset('week')}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer bg-white"
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    onClick={() => handlePreset('july26')}
                    className="px-2.5 py-1 text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100/70 transition-all cursor-pointer"
                  >
                    Julho/2026
                  </button>
                  <button
                    onClick={() => handlePreset('june26')}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer bg-white"
                  >
                    Junho/2026
                  </button>
                  <button
                    onClick={() => handlePreset('all')}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer bg-white"
                  >
                    Todo Período
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Início</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      max={endDate || undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStartDate(val);
                        if (val && endDate && val > endDate) {
                          setEndDate(val);
                        } else if (val && !endDate) {
                          setEndDate(val);
                        }
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Fim</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && startDate && val < startDate) {
                          setStartDate(val);
                        }
                        setEndDate(val);
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Busca Textual</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por cliente, entregador, endereço..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Deliveries Status Breakdowns Card */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">Volumetria de Viagens</span>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Concluídas
                    </span>
                    <span>{stats.completedCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> Em Rota
                    </span>
                    <span>{stats.inRouteCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Pendentes
                    </span>
                    <span>{stats.pendingCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> Ocorrências
                    </span>
                    <span className={stats.occurrencesCount > 0 ? "text-rose-600" : ""}>{stats.occurrencesCount}</span>
                  </div>
                </div>
              </div>

              {/* Total Deliveries */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total de Pedidos</span>
                  <div className="p-1.5 rounded-lg bg-slate-50 text-slate-500">
                    <TrendingUp size={13} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-extrabold text-slate-800 block">
                    {stats.total} <span className="text-[10px] font-bold text-slate-400">pedidos</span>
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 mt-1 block">
                    SLA: {stats.total > 0 ? Math.round((stats.completedCount / stats.total) * 100) : 100}% de Conclusão
                  </span>
                </div>
              </div>

              {/* Gross delivered Value */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Valor das Mercadorias (Concluído)</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <DollarSign size={13} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-extrabold text-slate-800 block">
                    {stats.completedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 mt-1 block">
                    Somente entregas efetivadas (Concluídas)
                  </span>
                </div>
              </div>

              {/* Total Client Freight Bill */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-violet-100">Faturamento Consolidado de Frete</span>
                  <div className="p-1.5 rounded-lg bg-white/10 text-white">
                    <Coins size={13} />
                  </div>
                </div>
                <div className="mt-3 relative z-10">
                  <span className="text-xl font-black block tracking-tight">
                    {stats.totalFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-[9px] text-violet-100/95 font-semibold mt-1 block leading-tight">
                    Custo total de frete acumulado no período
                  </span>
                </div>
                <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/5 rounded-full blur-md" />
              </div>

            </div>

            {/* Invoicing Breakdown Details */}
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-xs text-violet-800">
              <h5 className="font-bold mb-1.5 flex items-center gap-1.5">
                <Wallet size={13} className="text-violet-600" />
                <span>Regras de Cálculo de Frete do Parceiro</span>
              </h5>
              <p className="font-medium text-[11px] leading-relaxed">
                Para efeito de faturamento, considera-se estritamente o <strong>Frete Cobrado do Parceiro</strong> sobre as entregas com status <strong>Concluído</strong> (calculado com base na tabela de faixas de CEP do parceiro ou taxa pré-configurada). Por padrão, o <strong>Valor da Mercadoria</strong> só é inserido e contabilizado caso o valor da Nota Fiscal esteja formalmente imputado.
              </p>
            </div>

            {/* Deliveries Table */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" />
                  Listagem Detalhada de Entregas Realizadas
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sort Selector Filter */}
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                    <ArrowUpDown size={12} className="text-slate-400 shrink-0" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ordem:</span>
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as any)}
                      className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
                    >
                      <option value="cep">CEP / Rota</option>
                      <option value="id">Nº Pedido</option>
                      <option value="date">Data</option>
                      <option value="client">Cliente</option>
                      <option value="address">Endereço</option>
                      <option value="value">Valor Mercadoria</option>
                      <option value="freight">Frete Cobrado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-0.5 text-violet-600 hover:bg-violet-100 rounded font-extrabold text-[10px] cursor-pointer"
                      title={sortDirection === 'asc' ? "Ordem Crescente" : "Ordem Decrescente"}
                    >
                      {sortDirection === 'asc' ? '▲ ASC' : '▼ DESC'}
                    </button>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {filteredOrders.length} resultados encontrados
                  </span>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <table className="min-w-full text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-left text-[10px] uppercase select-none">
                      <th 
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'id') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('id'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center gap-1">
                          Nº Pedido
                          {sortField === 'id' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                      <th 
                        className="px-4 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'date') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('date'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center justify-center gap-1">
                          Data
                          {sortField === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                      <th 
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'client') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('client'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center gap-1">
                          Cliente
                          {sortField === 'client' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                      <th 
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'address') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('address'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center gap-1">
                          Endereço
                          {sortField === 'address' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                      <th 
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'cep') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('cep'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center gap-1">
                          CEP
                          {sortField === 'cep' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                      <th 
                        className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'value') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('value'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Valor Mercadoria
                          {sortField === 'value' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                      <th 
                        className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'freight') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortField('freight'); setSortDirection('asc'); }
                        }}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Frete Cobrado
                          {sortField === 'freight' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                    {sortedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Nenhuma entrega registrada para este parceiro neste período.
                        </td>
                      </tr>
                    ) : (
                      sortedOrders.map((order) => {
                        const isConcluded = order.status === 'Concluído';
                        const orderFreight = getOrderFreightValue(order, clientPartners);
                        
                        return (
                           <tr key={order.id} className="hover:bg-slate-50/40">
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500 font-bold">
                              {order.id.replace('ped-', '') || order.id}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-slate-500 font-semibold">
                              {formatToBrazilianDate(order.date)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-semibold truncate max-w-[180px]">
                              {resolveOrderDisplayName(order.clientName, clientPartners, order.clientName)}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium truncate max-w-[320px]" title={order.address}>
                              {order.address}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-600 font-bold whitespace-nowrap">
                              {order.cep || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700">
                              {order.value > 0 ? (
                                order.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              ) : (
                                <span className="text-slate-400 font-normal text-[11px]" title="Sem valor de Nota Fiscal imputado">
                                  R$ 0,00 <span className="text-[9px] text-slate-400">(Sem NF)</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-slate-800">
                              {isConcluded ? (
                                <span className="text-violet-600">
                                  {orderFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-semibold text-[10px]">
                                  R$ 0,00
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  
                  {filteredOrders.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                        <td colSpan={3} className="px-4 py-3 text-right">TOTAL CONSOLIDADO:</td>
                        <td className="px-4 py-3 text-center text-slate-500 text-[10px]">
                          {stats.completedCount} / {stats.total} Entregas
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]"></td>
                        <td className="px-4 py-3 text-right font-extrabold">
                          {filteredOrders.reduce((sum, o) => sum + o.value, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-violet-700 text-sm">
                          {stats.totalFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <span className="text-[10px] font-bold text-slate-400">
              Gerado automaticamente pelo LogiHub Admin v1.8.4
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer bg-white"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-100 cursor-pointer"
              >
                <FileSpreadsheet size={14} />
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-rose-100 cursor-pointer"
              >
                <Download size={14} />
                Exportar PDF
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
