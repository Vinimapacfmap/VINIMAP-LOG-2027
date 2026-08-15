/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Order, 
  DeliveryRider, 
  ClientPartner 
} from '../types';
import { 
  getSaoPauloISODate, 
  formatToBrazilianDate, 
  getSaoPauloDate 
} from '../utils/dateUtils';
import { calculateRiderCommissionForOrder, extractOrderCep, formatCepDisplay } from '../utils/billingUtils';
import { getPartnerDisplayName } from '../utils/partnerUtils';
import { 
  Calendar, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Search, 
  Filter, 
  Coins, 
  Bike, 
  Truck, 
  Car, 
  Eye, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  HelpCircle,
  ArrowRight,
  MapPin,
  Building2,
  Receipt,
  User,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface FinancialRepassesSummaryPanelProps {
  orders: Order[];
  riders: DeliveryRider[];
  clientPartners?: ClientPartner[];
  onOpenRiderBilling?: (riderId: string) => void;
  className?: string;
}

export const FinancialRepassesSummaryPanel: React.FC<FinancialRepassesSummaryPanelProps> = ({
  orders,
  riders,
  clientPartners = [],
  onOpenRiderBilling,
  className = ''
}) => {
  // 1. Single Unified Date Filter Card: Default to today's date (data atual)
  const todayIso = useMemo(() => getSaoPauloISODate(), []);
  const [startDate, setStartDate] = useState<string>(todayIso);
  const [endDate, setEndDate] = useState<string>(todayIso);

  // Search and view filters
  const [searchRider, setSearchRider] = useState<string>('');
  const [showOnlyActiveWithOrders, setShowOnlyActiveWithOrders] = useState<boolean>(false);
  const [selectedCellDetail, setSelectedCellDetail] = useState<{
    rider: DeliveryRider;
    date: string;
    completedOrders: Order[];
    totalEarnings: number;
  } | null>(null);
  const [modalSearchFilter, setModalSearchFilter] = useState<string>('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Quick preset helper strictly inside the single unified date card
  const handleQuickPreset = (preset: 'today' | 'currentMonth' | 'last7days' | 'previousMonth' | 'all') => {
    const today = getSaoPauloISODate();
    const todayParts = today.split('-');
    const currentYear = parseInt(todayParts[0], 10);
    const currentMonth = parseInt(todayParts[1], 10);

    switch (preset) {
      case 'today':
        setStartDate(today);
        setEndDate(today);
        break;

      case 'currentMonth': {
        const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        // Last day of current month
        const lastDayObj = new Date(currentYear, currentMonth, 0);
        const lastDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        setStartDate(firstDay);
        setEndDate(lastDayStr);
        break;
      }

      case 'last7days': {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const pastIso = getSaoPauloISODate(d);
        setStartDate(pastIso);
        setEndDate(today);
        break;
      }

      case 'previousMonth': {
        let prevYear = currentYear;
        let prevMonth = currentMonth - 1;
        if (prevMonth === 0) {
          prevMonth = 12;
          prevYear -= 1;
        }
        const firstDay = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const lastDayObj = new Date(prevYear, prevMonth, 0);
        const lastDayStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        setStartDate(firstDay);
        setEndDate(lastDayStr);
        break;
      }

      case 'all': {
        // Encontrar menor e maior data dos pedidos ou ano corrente
        let minDate = today;
        let maxDate = today;
        orders.forEach(o => {
          const d = (o.status === 'Ocorrência' && o.occurrenceDate) ? o.occurrenceDate : o.date;
          if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            if (d < minDate) minDate = d;
            if (d > maxDate) maxDate = d;
          }
        });
        setStartDate(minDate);
        setEndDate(maxDate);
        break;
      }
    }
  };

  // Generate continuous list of dates in selected range (YYYY-MM-DD)
  const dateColumns = useMemo(() => {
    if (!startDate || !endDate) return [];
    const dates: string[] = [];

    // Ensure startDate <= endDate
    let current = startDate <= endDate ? startDate : endDate;
    const finalDate = startDate <= endDate ? endDate : startDate;

    // Safety guard max 62 days to avoid freezing browser on enormous ranges
    let safetyCounter = 0;
    while (current <= finalDate && safetyCounter < 95) {
      dates.push(current);
      const parts = current.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);

      const nextDay = new Date(y, m, d + 1, 12, 0, 0);
      const nextY = nextDay.getFullYear();
      const nextM = String(nextDay.getMonth() + 1).padStart(2, '0');
      const nextD = String(nextDay.getDate()).padStart(2, '0');
      current = `${nextY}-${nextM}-${nextD}`;
      safetyCounter++;
    }

    return dates;
  }, [startDate, endDate]);

  // Format date column header label with day of week (e.g., '15/08 Sáb')
  const formatDateHeader = (isoDate: string): { dayMonth: string; weekDay: string; isWeekend: boolean; isToday: boolean } => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) {
      return {
        dayMonth: isoDate,
        weekDay: '',
        isWeekend: false,
        isToday: isoDate === todayIso
      };
    }
    const day = parts[2];
    const month = parts[1];
    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekDay = weekDays[dateObj.getDay()];
    return {
      dayMonth: `${day}/${month}`,
      weekDay,
      isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      isToday: isoDate === todayIso
    };
  };

  // Filter orders by the selected date range
  const rangeOrders = useMemo(() => {
    return orders.filter(o => {
      const effectiveDate = (o.status === 'Ocorrência' && o.occurrenceDate) ? o.occurrenceDate : o.date;
      if (!effectiveDate) return false;
      return effectiveDate >= startDate && effectiveDate <= endDate;
    });
  }, [orders, startDate, endDate]);

  // Filtered and sorted riders list
  const filteredRiders = useMemo(() => {
    return riders.filter(r => {
      if (searchRider.trim() !== '') {
        const query = searchRider.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesVehicle = r.vehicle?.toLowerCase().includes(query) || (r.vehiclePlate && r.vehiclePlate.toLowerCase().includes(query));
        const matchesPhone = r.phone?.toLowerCase().includes(query);
        if (!matchesName && !matchesVehicle && !matchesPhone) return false;
      }

      if (showOnlyActiveWithOrders) {
        const hasOrders = rangeOrders.some(o => o.riderId === r.id && o.status === 'Concluído');
        if (!hasOrders) return false;
      }

      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [riders, searchRider, showOnlyActiveWithOrders, rangeOrders]);

  // Map of completed orders by Rider ID and Date: { [riderId]: { [date]: Order[] } }
  const riderDateOrdersMap = useMemo(() => {
    const map: Record<string, Record<string, Order[]>> = {};

    rangeOrders.forEach(o => {
      if (!o.riderId || o.status !== 'Concluído') return;
      const effectiveDate = o.date || (o.createdAt ? o.createdAt.substring(0, 10) : '');
      if (!effectiveDate) return;

      if (!map[o.riderId]) {
        map[o.riderId] = {};
      }
      if (!map[o.riderId][effectiveDate]) {
        map[o.riderId][effectiveDate] = [];
      }
      map[o.riderId][effectiveDate].push(o);
    });

    return map;
  }, [rangeOrders]);

  // Rider overall summary calculations in the selected period
  const riderSummaries = useMemo(() => {
    const summaries: Record<string, {
      rider: DeliveryRider;
      completedCount: number;
      totalValueReceivable: number;
      totalFreightGross: number;
      dailyCounts: Record<string, { count: number; earnings: number; orders: Order[] }>;
    }> = {};

    riders.forEach(r => {
      const riderOrders = rangeOrders.filter(o => o.riderId === r.id && o.status === 'Concluído');
      let totalValueReceivable = 0;
      let totalFreightGross = 0;
      const dailyCounts: Record<string, { count: number; earnings: number; orders: Order[] }> = {};

      // Initialize all dates with 0
      dateColumns.forEach(d => {
        dailyCounts[d] = { count: 0, earnings: 0, orders: [] };
      });

      riderOrders.forEach(o => {
        const commission = calculateRiderCommissionForOrder(r, o, clientPartners);
        const orderFreight = o.value || 0;
        totalValueReceivable += commission.total;
        totalFreightGross += orderFreight;

        const effectiveDate = o.date || (o.createdAt ? o.createdAt.substring(0, 10) : '');
        if (effectiveDate && dailyCounts[effectiveDate]) {
          dailyCounts[effectiveDate].count += 1;
          dailyCounts[effectiveDate].earnings += commission.total;
          dailyCounts[effectiveDate].orders.push(o);
        }
      });

      summaries[r.id] = {
        rider: r,
        completedCount: riderOrders.length,
        totalValueReceivable,
        totalFreightGross,
        dailyCounts
      };
    });

    return summaries;
  }, [riders, rangeOrders, dateColumns, clientPartners]);

  // General Grand Totals across all riders in the selected range
  const grandTotals = useMemo(() => {
    let totalCompletedOrders = 0;
    let totalRepassesToRiders = 0;
    let totalGrossFreight = 0;
    let activeRidersCount = 0;

    const dailyGrandTotals: Record<string, { ordersCount: number; repassesValue: number }> = {};
    dateColumns.forEach(d => {
      dailyGrandTotals[d] = { ordersCount: 0, repassesValue: 0 };
    });

    Object.values(riderSummaries).forEach(summary => {
      if (summary.completedCount > 0) {
        activeRidersCount += 1;
      }
      totalCompletedOrders += summary.completedCount;
      totalRepassesToRiders += summary.totalValueReceivable;
      totalGrossFreight += summary.totalFreightGross;

      dateColumns.forEach(d => {
        const dayData = summary.dailyCounts[d];
        if (dayData) {
          dailyGrandTotals[d].ordersCount += dayData.count;
          dailyGrandTotals[d].repassesValue += dayData.earnings;
        }
      });
    });

    const retentionAdmin = Math.max(0, totalGrossFreight - totalRepassesToRiders);
    const avgRepassPerOrder = totalCompletedOrders > 0 ? totalRepassesToRiders / totalCompletedOrders : 0;

    return {
      totalCompletedOrders,
      totalRepassesToRiders,
      totalGrossFreight,
      retentionAdmin,
      activeRidersCount,
      avgRepassPerOrder,
      dailyGrandTotals
    };
  }, [riderSummaries, dateColumns]);

  // Model helper badge
  const getBillingModelLabel = (rider: DeliveryRider) => {
    const model = rider.billingModel || 'misto';
    switch (model) {
      case 'fixo':
        return `Fixo R$ ${(rider.billingFixedFee ?? 10).toFixed(2)}`;
      case 'variavel':
        return `Variável ${rider.billingVariablePercent ?? 2.5}%`;
      case 'frete':
        return `Frete ${rider.billingFreightPercent ?? 80}%`;
      case 'fracionado':
        return `Fracionado R$ ${(rider.billingFractionalValue ?? 12.5).toFixed(2)}`;
      case 'misto':
      default:
        return `Misto (R$ ${(rider.billingFixedFee ?? 10).toFixed(2)} + ${rider.billingVariablePercent ?? 2.5}%)`;
    }
  };

  // Export to Excel (.xlsx) Spreadsheet
  const handleExportExcel = () => {
    const headerRow: string[] = ['ID Condutor', 'Nome do Condutor', 'Veículo / Placa', 'Modelo de Repasse'];
    dateColumns.forEach(d => {
      headerRow.push(formatToBrazilianDate(d));
    });
    headerRow.push('Total Pedidos Concluídos', 'Total a Receber (R$)');

    const dataRows: any[] = [];

    filteredRiders.forEach(r => {
      const summary = riderSummaries[r.id];
      const row: any[] = [
        r.id,
        r.name,
        `${r.vehicle || ''} ${r.vehiclePlate ? `(${r.vehiclePlate})` : ''}`.trim(),
        getBillingModelLabel(r)
      ];

      dateColumns.forEach(d => {
        const count = summary?.dailyCounts[d]?.count || 0;
        row.push(count);
      });

      row.push(summary?.completedCount || 0);
      row.push(summary?.totalValueReceivable || 0);
      dataRows.push(row);
    });

    // Add Grand Total Row
    const totalRow: any[] = ['TOTAL', 'TOTAL GERAL DE TODA A FROTA', '-', '-'];
    dateColumns.forEach(d => {
      totalRow.push(grandTotals.dailyGrandTotals[d]?.ordersCount || 0);
    });
    totalRow.push(grandTotals.totalCompletedOrders);
    totalRow.push(grandTotals.totalRepassesToRiders);
    dataRows.push(totalRow);

    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumo_Repasses');

    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 20 },
      { wch: 24 },
      ...dateColumns.map(() => ({ wch: 10 })),
      { wch: 18 },
      { wch: 18 }
    ];

    const filename = `Resumo_Repasses_${startDate}_a_${endDate}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('VINIMAP LOGISTICS - RESUMO FINANCEIRO DE REPASSES', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Período Selecionado: ${formatToBrazilianDate(startDate)} a ${formatToBrazilianDate(endDate)} | Total Concluído: ${grandTotals.totalCompletedOrders} pedidos | Total Repasse: ${grandTotals.totalRepassesToRiders.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      14,
      21
    );

    const headCols = ['Condutor', 'Modelo'];
    // For PDF readability, if dates > 15, we show abbreviated date
    dateColumns.forEach(d => {
      const parts = d.split('-');
      headCols.push(`${parts[2]}/${parts[1]}`);
    });
    headCols.push('Total Ped.', 'Valor a Receber');

    const bodyRows: any[] = [];

    filteredRiders.forEach(r => {
      const summary = riderSummaries[r.id];
      const row: any[] = [
        r.name,
        r.billingModel ? r.billingModel.toUpperCase() : 'MISTO'
      ];

      dateColumns.forEach(d => {
        const count = summary?.dailyCounts[d]?.count || 0;
        row.push(count > 0 ? String(count) : '-');
      });

      row.push(String(summary?.completedCount || 0));
      row.push((summary?.totalValueReceivable || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
      bodyRows.push(row);
    });

    // Grand total row
    const totalRow = ['TOTAL GERAL', '-'];
    dateColumns.forEach(d => {
      totalRow.push(String(grandTotals.dailyGrandTotals[d]?.ordersCount || 0));
    });
    totalRow.push(String(grandTotals.totalCompletedOrders));
    totalRow.push(grandTotals.totalRepassesToRiders.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    bodyRows.push(totalRow);

    autoTable(doc, {
      startY: 25,
      head: [headCols],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'center' }
      },
      didParseCell: function (data) {
        if (data.row.index === bodyRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`Resumo_Repasses_Condutores_${startDate}_${endDate}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 ${className}`} id="financial-repasses-summary-panel">
      
      {/* 1. SINGLE UNIFIED PERIOD FILTER CARD (Único Card de Datas - Padrão Data Atual & Escolha Livre de Início e Fim) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4" id="unified-date-picker-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                  Painel de Resumo Financeiro & Repasses aos Condutores
                </h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Período Pré-Selecionado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle de repasses por condutor e grade diária de pedidos concluídos.
              </p>
            </div>
          </div>

          {/* Export and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Exportar planilha Excel completa"
            >
              <FileSpreadsheet size={14} />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Gerar relatório em PDF"
            >
              <FileText size={14} />
              <span>Exportar PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-200 hidden sm:flex items-center justify-center"
              title="Imprimir Matriz de Repasses"
            >
              <Printer size={15} />
            </button>
          </div>
        </div>

        {/* Unified Date Range Controls inside the Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 px-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 font-bold text-xs rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                id="repasses-start-date-input"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 px-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 font-bold text-xs rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                id="repasses-end-date-input"
              />
            </div>

            <div className="text-xs text-slate-500 font-semibold px-1">
              <span className="text-blue-600 font-bold">{dateColumns.length}</span> {dateColumns.length === 1 ? 'dia apurado' : 'dias apurados'}
              {startDate === todayIso && endDate === todayIso && (
                <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black">
                  HOJE
                </span>
              )}
            </div>
          </div>

          {/* Quick Presets integrated within the same card */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickPreset('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                startDate === todayIso && endDate === todayIso
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => handleQuickPreset('last7days')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Últimos 7 Dias
            </button>

            <button
              type="button"
              onClick={() => handleQuickPreset('currentMonth')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Mês Atual
            </button>

            <button
              type="button"
              onClick={() => handleQuickPreset('previousMonth')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer hidden sm:block"
            >
              Mês Anterior
            </button>

            <button
              type="button"
              onClick={() => handleQuickPreset('all')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Todos
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOP METRIC SUMMARY CARDS (Calculados para o Período Selecionado) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total a Repassar */}
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-100">
              Total Repasses aos Condutores
            </span>
            <div className="p-1.5 rounded-xl bg-white/10 text-white">
              <Coins size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              {grandTotals.totalRepassesToRiders.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-violet-100 font-semibold border-t border-white/10 pt-2">
            <span>{grandTotals.activeRidersCount} condutores c/ entregas</span>
            <span>Média {grandTotals.avgRepassPerOrder.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/ped</span>
          </div>
        </div>

        {/* Pedidos Concluídos */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Entregas Concluídas
            </span>
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">
              {grandTotals.totalCompletedOrders}
            </span>
            <span className="text-xs text-slate-400 font-bold ml-1.5">pedidos</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold border-t border-slate-100 pt-2">
            <CheckCircle2 size={12} />
            <span>100% Baixadas e Liquidadas</span>
          </div>
        </div>

        {/* Faturamento Bruto de Frete */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Faturamento Bruto Fretes
            </span>
            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-blue-600 tracking-tight">
              {grandTotals.totalGrossFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-2">
            <span>Retenção Sede:</span>
            <span className="font-bold text-slate-700">
              {grandTotals.retentionAdmin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        {/* Condutores Cadastrados e Ativos */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Frota de Condutores
            </span>
            <div className="p-1.5 rounded-xl bg-slate-50 text-slate-600">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">
              {grandTotals.activeRidersCount}
            </span>
            <span className="text-xs text-slate-400 font-bold ml-1.5">de {riders.length} cadastrados</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-2">
            <span>Período:</span>
            <span className="font-mono font-bold text-blue-600">
              {formatToBrazilianDate(startDate)} a {formatToBrazilianDate(endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. SPREADSHEET MATRIX TABLE (Tabela Tipo Planilha: Colunas de Datas x Nomes dos Condutores) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden space-y-3">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Filtrar por condutor ou veículo..."
                value={searchRider}
                onChange={(e) => setSearchRider(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyActiveWithOrders}
                onChange={(e) => setShowOnlyActiveWithOrders(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="hidden md:inline">Apenas condutores com entregas</span>
              <span className="md:hidden">Apenas ativos</span>
            </label>
          </div>

          <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-2 self-end sm:self-center">
            <span>Exibindo {filteredRiders.length} condutores</span>
            <span>•</span>
            <span>{dateColumns.length} colunas de data</span>
          </div>
        </div>

        {/* Matrix Spreadsheet Grid with horizontal scrolling */}
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="min-w-full text-xs border-collapse text-slate-700">
            {/* Table Header */}
            <thead className="sticky top-0 z-20 bg-slate-900 text-white shadow-xs">
              <tr>
                {/* Fixed Rider Column */}
                <th className="sticky left-0 z-30 bg-slate-900 px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider min-w-[220px] max-w-[260px] border-r border-slate-800">
                  Condutor & Cadastro
                </th>

                {/* Dynamic Date Columns */}
                {dateColumns.map(d => {
                  const info = formatDateHeader(d);
                  return (
                    <th
                      key={d}
                      className={`px-2.5 py-2 text-center text-[10px] font-bold border-r border-slate-800 min-w-[58px] transition-colors ${
                        info.isToday 
                          ? 'bg-blue-800 text-white ring-1 ring-blue-400' 
                          : info.isWeekend 
                          ? 'bg-slate-950 text-slate-300' 
                          : 'bg-slate-900 text-slate-200'
                      }`}
                    >
                      <span className="block text-[9px] uppercase font-bold text-slate-400">{info.weekDay}</span>
                      <strong className="block text-[11px] font-mono mt-0.5">{info.dayMonth}</strong>
                    </th>
                  );
                })}

                {/* Total Orders Column */}
                <th className="px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider min-w-[110px] bg-slate-950 border-r border-slate-800 text-emerald-300">
                  Total Pedidos
                </th>

                {/* Total Value Column */}
                <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider min-w-[130px] bg-slate-950 border-r border-slate-800 text-violet-300">
                  Valor a Receber
                </th>

                {/* Action Column */}
                <th className="px-3 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider min-w-[80px] bg-slate-900">
                  Extrato
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={dateColumns.length + 4} className="px-6 py-12 text-center text-slate-400 font-semibold bg-slate-50/50">
                    Nenhum condutor encontrado para os filtros ou período selecionados.
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider, index) => {
                  const summary = riderSummaries[rider.id];
                  const completedCount = summary?.completedCount || 0;
                  const totalValue = summary?.totalValueReceivable || 0;
                  const isEven = index % 2 === 0;

                  return (
                    <tr 
                      key={rider.id} 
                      className={`hover:bg-blue-50/40 transition-colors group ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      {/* Fixed Left Column: Rider Information & Remuneration Model */}
                      <td className="sticky left-0 z-10 bg-inherit group-hover:bg-blue-50/80 px-4 py-3 border-r border-slate-200/80 min-w-[220px] max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          {rider.avatar ? (
                            <img 
                              src={rider.avatar} 
                              alt={rider.name} 
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {rider.name.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 text-xs block truncate" title={rider.name}>
                              {rider.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                              <span>{rider.vehicle || 'Condutor'}</span>
                              {rider.vehiclePlate && <span className="font-mono">({rider.vehiclePlate})</span>}
                            </div>
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded-md truncate max-w-[190px]">
                              {getBillingModelLabel(rider)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date Cells: Number of Completed Orders per Day */}
                      {dateColumns.map(d => {
                        const dayData = summary?.dailyCounts[d];
                        const count = dayData?.count || 0;
                        const earnings = dayData?.earnings || 0;
                        const hasOrders = count > 0;

                        return (
                          <td
                            key={d}
                            onClick={() => {
                              if (hasOrders) {
                                setSelectedCellDetail({
                                  rider,
                                  date: d,
                                  completedOrders: dayData.orders,
                                  totalEarnings: earnings
                                });
                              }
                            }}
                            className={`px-2 py-2.5 text-center border-r border-slate-100 text-xs transition-colors ${
                              hasOrders 
                                ? 'bg-emerald-50/50 hover:bg-emerald-100/70 font-extrabold text-emerald-800 cursor-pointer' 
                                : 'text-slate-300 font-normal'
                            }`}
                            title={hasOrders ? `${rider.name} em ${formatToBrazilianDate(d)}:\n${count} pedidos concluídos\nRepasse: ${earnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : `Sem entregas em ${formatToBrazilianDate(d)}`}
                          >
                            {hasOrders ? (
                              <div className="flex flex-col items-center justify-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shadow-2xs">
                                  {count}
                                </span>
                              </div>
                            ) : (
                              <span className="opacity-40">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Completed Orders Column */}
                      <td className="px-4 py-3 text-center font-extrabold text-xs font-mono text-emerald-700 bg-emerald-50/30 border-r border-slate-200/80">
                        <span className={`px-2 py-1 rounded-lg ${completedCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'}`}>
                          {completedCount}
                        </span>
                      </td>

                      {/* Total Value Receivable Column */}
                      <td className="px-4 py-3 text-right font-extrabold text-xs font-mono text-violet-700 bg-violet-50/30 border-r border-slate-200/80">
                        {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      {/* Action Button: Open Driver Billing Details */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenRiderBilling && onOpenRiderBilling(rider.id)}
                          className="p-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                          title={`Ver Extrato Completo de ${rider.name}`}
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Grand Totals Row */}
            <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white font-extrabold border-t-2 border-slate-700 shadow-lg">
              <tr>
                {/* Fixed Grand Total Label */}
                <td className="sticky left-0 z-30 bg-slate-900 px-4 py-3.5 text-left text-xs uppercase tracking-wider border-r border-slate-800 text-white font-extrabold">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-400" />
                    <span>TOTAL GERAL</span>
                  </div>
                </td>

                {/* Daily Total Counts */}
                {dateColumns.map(d => {
                  const dailyTotal = grandTotals.dailyGrandTotals[d]?.ordersCount || 0;
                  const dayRepasses = grandTotals.dailyGrandTotals[d]?.repassesValue || 0;
                  const dayAllOrders = rangeOrders.filter(o => {
                    const effectiveDate = o.date || (o.createdAt ? o.createdAt.substring(0, 10) : '');
                    return effectiveDate === d && o.status === 'Concluído';
                  });
                  return (
                    <td 
                      key={d} 
                      onClick={() => {
                        if (dailyTotal > 0 && dayAllOrders.length > 0) {
                          setSelectedCellDetail({
                            rider: {
                              id: 'all',
                              name: 'Todos os Condutores',
                              avatar: '',
                              vehicle: 'Moto',
                              vehiclePlate: '',
                              phone: '',
                              status: 'Disponível',
                              rating: 5,
                              lat: 0,
                              lng: 0,
                              completedDeliveries: dailyTotal,
                              batteryPercent: 100,
                              billingModel: 'frete'
                            },
                            date: d,
                            completedOrders: dayAllOrders,
                            totalEarnings: dayRepasses
                          });
                        }
                      }}
                      className={`px-2 py-3.5 text-center text-xs font-mono border-r border-slate-800 text-emerald-400 ${
                        dailyTotal > 0 ? 'cursor-pointer hover:bg-slate-800 hover:text-emerald-300 transition-colors font-extrabold' : 'text-slate-600'
                      }`}
                      title={dailyTotal > 0 ? `Clique para ver todos os ${dailyTotal} pedidos de ${formatToBrazilianDate(d)}` : undefined}
                    >
                      {dailyTotal > 0 ? (
                        <span>{dailyTotal}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  );
                })}

                {/* Grand Total Completed Orders */}
                <td className="px-4 py-3.5 text-center text-sm font-extrabold font-mono text-emerald-300 bg-slate-950 border-r border-slate-800">
                  {grandTotals.totalCompletedOrders}
                </td>

                {/* Grand Total Repasses Value */}
                <td className="px-4 py-3.5 text-right text-sm font-extrabold font-mono text-violet-300 bg-slate-950 border-r border-slate-800">
                  {grandTotals.totalRepassesToRiders.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>

                {/* Empty cell for action column */}
                <td className="px-3 py-3.5 bg-slate-900"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. MODAL DETALHE DO DIA DO CONDUTOR (Ao clicar em uma célula de entregas) */}
      {selectedCellDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  {selectedCellDetail.rider.avatar ? (
                    <img 
                      src={selectedCellDetail.rider.avatar} 
                      alt={selectedCellDetail.rider.name} 
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    selectedCellDetail.rider.name.charAt(0)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-slate-900 text-base">
                      {selectedCellDetail.rider.name}
                    </h4>
                    {selectedCellDetail.rider.vehiclePlate && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                        {selectedCellDetail.rider.vehiclePlate}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-blue-500" />
                      <strong>{formatToBrazilianDate(selectedCellDetail.date)}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">
                      {selectedCellDetail.completedOrders.length} {selectedCellDetail.completedOrders.length === 1 ? 'pedido concluído' : 'pedidos concluídos'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCellDetail(null);
                  setModalSearchFilter('');
                }}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Filter / Search Bar inside modal */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={modalSearchFilter}
                  onChange={(e) => setModalSearchFilter(e.target.value)}
                  placeholder="Filtrar por CEP, endereço, cliente ou ID do pedido..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              {modalSearchFilter && (
                <button
                  type="button"
                  onClick={() => setModalSearchFilter('')}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* List of Orders with Full Address and Prominently Highlighted CEP */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1 max-h-[55vh]">
              {(() => {
                const filteredOrders = selectedCellDetail.completedOrders.filter((o) => {
                  if (!modalSearchFilter) return true;
                  const q = modalSearchFilter.toLowerCase();
                  const rawCep = extractOrderCep(o);
                  const formattedCep = formatCepDisplay(rawCep);
                  return (
                    o.id.toLowerCase().includes(q) ||
                    (o.clientName && o.clientName.toLowerCase().includes(q)) ||
                    (o.address && o.address.toLowerCase().includes(q)) ||
                    (o.region && o.region.toLowerCase().includes(q)) ||
                    (o.city && o.city.toLowerCase().includes(q)) ||
                    rawCep.includes(q.replace(/\D/g, '')) ||
                    formattedCep.toLowerCase().includes(q) ||
                    (o.partnerName && o.partnerName.toLowerCase().includes(q))
                  );
                });

                if (filteredOrders.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400">
                      <Search size={32} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">Nenhum pedido encontrado para "{modalSearchFilter}"</p>
                    </div>
                  );
                }

                return filteredOrders.map((o) => {
                  // Find specific rider if "all" was selected
                  const effectiveRider = selectedCellDetail.rider.id === 'all' 
                    ? (riders.find(r => r.id === o.riderId) || selectedCellDetail.rider)
                    : selectedCellDetail.rider;

                  const commission = calculateRiderCommissionForOrder(effectiveRider, o, clientPartners);
                  const cleanCep = extractOrderCep(o);
                  const formattedCep = cleanCep ? formatCepDisplay(cleanCep) : (o.cep || '');
                  const partnerDisplay = getPartnerDisplayName(o.partnerName, clientPartners);

                  // Assemble full address
                  const addressParts: string[] = [];
                  if (o.address) addressParts.push(o.address);
                  if (o.number && !o.address.includes(o.number)) addressParts.push(`Nº ${o.number}`);
                  if (o.complement) addressParts.push(o.complement);
                  if (o.region && !o.address.toLowerCase().includes(o.region.toLowerCase())) addressParts.push(`Bairro: ${o.region}`);
                  if (o.city && !o.address.toLowerCase().includes(o.city.toLowerCase())) addressParts.push(o.city);
                  if (o.state && !o.address.toLowerCase().includes(o.state.toLowerCase())) addressParts.push(o.state);
                  const fullAddressText = addressParts.filter(Boolean).join(' • ');

                  return (
                    <div
                      key={o.id}
                      className="p-3.5 bg-slate-50/90 hover:bg-blue-50/40 border border-slate-200/90 hover:border-blue-300 rounded-xl transition-all shadow-2xs space-y-2.5"
                    >
                      {/* Order Top Meta */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md">
                            #{o.id.replace('ped-', '')}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {o.clientName || 'Cliente'}
                          </span>
                          {partnerDisplay && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md">
                              {partnerDisplay}
                            </span>
                          )}
                          {selectedCellDetail.rider.id === 'all' && (
                            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.2 rounded-md">
                              Condutor: {effectiveRider.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {o.deliveryTime && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock size={11} /> {o.deliveryTime}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                            Concluído
                          </span>
                        </div>
                      </div>

                      {/* Full Address & Prominently Highlighted CEP */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                          <div className="text-xs text-slate-700 leading-relaxed break-words">
                            <strong className="text-slate-900">Endereço Completo: </strong>
                            <span>{fullAddressText || 'Endereço não cadastrado'}</span>
                          </div>
                        </div>

                        {/* PROMINENT CEP BADGE */}
                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                          <div 
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono font-extrabold text-xs shadow-2xs ${
                              cleanCep 
                                ? 'bg-amber-50 text-amber-950 border-amber-300 ring-1 ring-amber-400/20' 
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                            title={cleanCep ? `CEP do Pedido: ${formattedCep}` : 'CEP não informado no pedido'}
                          >
                            <MapPin size={13} className={cleanCep ? 'text-amber-600' : 'text-slate-400'} />
                            <span>{cleanCep ? `CEP ${formattedCep}` : 'Sem CEP'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const textToCopy = cleanCep ? formattedCep : fullAddressText;
                              navigator.clipboard?.writeText(textToCopy);
                              setCopiedOrderId(o.id);
                              setTimeout(() => setCopiedOrderId(null), 2000);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Copiar CEP / Endereço"
                          >
                            {copiedOrderId === o.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Financial Repasse Value & Calculation Breakdown */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Receipt size={13} className="text-slate-400" />
                          <span>Regra de Cálculo:</span>
                          <strong className="text-slate-700 font-semibold">
                            {commission.sourceDescription || 'Tabela de CEP (Repasse Condutor)'}
                          </strong>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 mr-1.5">Repasse Condutor:</span>
                          <strong className="font-extrabold text-emerald-700 font-mono text-sm">
                            {commission.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer Total & Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Repasses do Dia</span>
                <strong className="text-lg font-extrabold text-emerald-700 font-mono">
                  {selectedCellDetail.totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                {selectedCellDetail.rider.id !== 'all' && onOpenRiderBilling && (
                  <button
                    type="button"
                    onClick={() => {
                      const rId = selectedCellDetail.rider.id;
                      setSelectedCellDetail(null);
                      onOpenRiderBilling(rId);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    Abrir Extrato Completo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCellDetail(null);
                    setModalSearchFilter('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
