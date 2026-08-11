/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, DeliveryRider, OrderStatus, ClientPartner, BillingModelType } from '../types';
import { formatToBrazilianDate, getSaoPauloISODate } from '../utils/dateUtils';
import { calculateRiderCommissionForOrder } from '../utils/billingUtils';
import { getPartnerDisplayName } from '../utils/partnerUtils';
import { matchesAddressQuery } from '../utils/addressUtils';
import { 
  X, 
  Calendar, 
  FileText, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Flag, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  Truck, 
  Bike, 
  Car, 
  Search,
  Wallet,
  CalendarDays,
  FileSpreadsheet,
  Settings,
  Sliders,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Download
} from 'lucide-react';

interface DriverBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  riderId: string | null;
  riders: DeliveryRider[];
  orders: Order[];
  clientPartners?: ClientPartner[];
  onUpdateRider?: (rider: DeliveryRider) => void;
}

export const DriverBillingModal: React.FC<DriverBillingModalProps> = ({
  isOpen,
  onClose,
  riderId,
  riders,
  orders,
  clientPartners = [],
  onUpdateRider
}) => {
  // Find selected rider
  const rider = useMemo(() => {
    return riders.find(r => r.id === riderId) || null;
  }, [riders, riderId]);

  // Set default period: all of June and July 2026 (or custom range)
  const [startDate, setStartDate] = useState<string>('2026-06-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Customizable billing model interactive local states (simulated/real-time)
  const [editingModel, setEditingModel] = useState<BillingModelType>('misto');
  const [editingFixedFee, setEditingFixedFee] = useState<string>('10.00');
  const [editingVariablePercent, setEditingVariablePercent] = useState<string>('2.5');
  const [editingFreightPercent, setEditingFreightPercent] = useState<string>('80');
  const [editingFractionalValue, setEditingFractionalValue] = useState<string>('12.50');

  const [isConfigExpanded, setIsConfigExpanded] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Initialize and synchronize editing states when rider changes
  useEffect(() => {
    if (rider) {
      setEditingModel(rider.billingModel || 'misto');
      setEditingFixedFee((rider.billingFixedFee !== undefined ? rider.billingFixedFee : 10).toFixed(2));
      setEditingVariablePercent((rider.billingVariablePercent !== undefined ? rider.billingVariablePercent : 2.5).toString());
      setEditingFreightPercent((rider.billingFreightPercent !== undefined ? rider.billingFreightPercent : 80).toString());
      setEditingFractionalValue((rider.billingFractionalValue !== undefined ? rider.billingFractionalValue : 12.50).toFixed(2));
    }
  }, [rider]);

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

  // Filtered orders for this rider in the selected period
  const filteredOrders = useMemo(() => {
    if (!riderId) return [];
    return orders.filter(o => {
      if (o.riderId !== riderId) return false;
      const effectiveDate = (o.status === 'Ocorrência' && o.occurrenceDate) ? o.occurrenceDate : o.date;
      if (!effectiveDate) return false;
      
      const inDateRange = effectiveDate >= startDate && effectiveDate <= endDate;
      if (!inDateRange) return false;

      // Filter by search query (Client, Merchant, Region, Address, or ID)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesClient = o.clientName?.toLowerCase().includes(query);
        const matchesPartner = o.partnerName?.toLowerCase().includes(query);
        const matchesRegion = o.region?.toLowerCase().includes(query);
        const matchesAddress = matchesAddressQuery(o.address, searchQuery);
        const matchesId = o.id?.toLowerCase().includes(query) || o.protocolNumber?.toLowerCase().includes(query);
        return matchesClient || matchesPartner || matchesRegion || matchesAddress || matchesId;
      }

      return true;
    });
  }, [orders, riderId, startDate, endDate, searchQuery]);

  // Build simulated rider reflecting unsaved local settings to provide real-time calculation playground!
  const simulatedRider = useMemo(() => {
    if (!rider) return null;
    return {
      ...rider,
      billingModel: editingModel,
      billingFixedFee: parseFloat(editingFixedFee) || 0,
      billingVariablePercent: parseFloat(editingVariablePercent) || 0,
      billingFreightPercent: parseFloat(editingFreightPercent) || 0,
      billingFractionalValue: parseFloat(editingFractionalValue) || 0,
    };
  }, [rider, editingModel, editingFixedFee, editingVariablePercent, editingFreightPercent, editingFractionalValue]);

  // Calculations for billing metrics based on simulated/active rider parameters
  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const completed = filteredOrders.filter(o => o.status === 'Concluído');
    const inRoute = filteredOrders.filter(o => o.status === 'Em rota' || o.status === 'Entregando');
    const occurrences = filteredOrders.filter(o => o.status === 'Ocorrência');
    const pending = filteredOrders.filter(o => o.status === 'Não iniciado');
    const cancelled = filteredOrders.filter(o => o.status === 'Cancelado');

    // Financial calculations on completed orders
    const completedCount = completed.length;
    const completedValue = completed.reduce((sum, o) => sum + o.value, 0);
    
    let fixedCommission = 0;
    let variableCommission = 0;
    let freightCommission = 0;
    let totalCommission = 0;

    completed.forEach(o => {
      if (simulatedRider) {
        const res = calculateRiderCommissionForOrder(simulatedRider, o, clientPartners);
        fixedCommission += res.fixed;
        variableCommission += res.variable;
        freightCommission += res.freight;
        totalCommission += res.total;
      }
    });

    // Total gross value of ALL active orders in range (excluding Cancelled)
    const activeOrdersValue = filteredOrders
      .filter(o => o.status !== 'Cancelado')
      .reduce((sum, o) => sum + o.value, 0);

    return {
      total,
      completedCount,
      inRouteCount: inRoute.length,
      occurrencesCount: occurrences.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      completedValue,
      activeOrdersValue,
      fixedCommission,
      variableCommission,
      freightCommission,
      totalCommission
    };
  }, [filteredOrders, simulatedRider, clientPartners]);

  if (!isOpen || !rider) return null;

  const VehicleIcon = rider.vehicle === 'Moto' ? Bike : rider.vehicle === 'Carro' ? Car : Truck;

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case 'Concluído':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Em rota':
      case 'Entregando':
        return 'bg-blue-50 text-blue-700 border-blue-150';
      case 'Ocorrência':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'Cancelado':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-150';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    try {
      const formattedData = filteredOrders.map(order => {
        const isConcluded = order.status === 'Concluído';
        const commResult = calculateRiderCommissionForOrder(simulatedRider || undefined, order, clientPartners);
        const orderCommission = isConcluded ? commResult.total : 0;
        
        return {
          'Nº do Pedido': order.id.replace('ped-', '') || order.id,
          'Data': formatToBrazilianDate(order.date),
          'Estabelecimento': getPartnerDisplayName(order.partnerName, clientPartners),
          'Cliente': order.clientName,
          'Endereço': order.address,
          'CEP': order.cep || (order.rawData && (order.rawData.CEP || order.rawData.cep)) || 'N/D',
          'Status': order.status,
          'Frete (R$)': orderCommission
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato de Viagens');
      
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

      XLSX.writeFile(workbook, `extrato_condutor_${rider.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Erro ao exportar planilha Excel.');
    }
  };

  const handleExportPdf = () => {
    try {
      if (filteredOrders.length === 0) {
        alert('Não há viagens cadastradas para exportar.');
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
      doc.text("Relatório de Faturamento - Extrato de Viagens", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Condutor: ${rider.name}`, 14, 27);
      doc.text(`Veículo: ${rider.vehicle} | ID: ${rider.id}`, 14, 32);
      doc.text(`Período: ${formatToBrazilianDate(startDate)} até ${formatToBrazilianDate(endDate)}`, 14, 37);
      doc.text(`Modelo: ${getModelLabel(simulatedRider?.billingModel || 'misto')}`, 14, 42);
      doc.text(`Exportado em: ${timestamp}`, 14, 47);
      doc.text(`Total de Repasse Acumulado: ${stats.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 52);

      // Table headers & body (excluding "Valor do Pedido", changing "Comissão" to "Frete")
      const pdfHeaders = [['Nº Pedido', 'Data', 'Estabelecimento', 'Cliente', 'Endereço', 'CEP', 'Status', 'Frete']];
      const pdfBody = filteredOrders.map(order => {
        const isConcluded = order.status === 'Concluído';
        const commResult = calculateRiderCommissionForOrder(simulatedRider || undefined, order, clientPartners);
        const orderCommission = isConcluded ? commResult.total : 0;

        return [
          order.id.replace('ped-', '') || order.id,
          formatToBrazilianDate(order.date),
          getPartnerDisplayName(order.partnerName, clientPartners),
          order.clientName,
          order.address,
          order.cep || (order.rawData && (order.rawData.CEP || order.rawData.cep)) || '-',
          order.status,
          orderCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ];
      });

      // Add a total row at the end of the body
      pdfBody.push([
        'TOTAL CONSOLIDADO',
        '',
        '',
        '',
        '',
        '',
        `${stats.completedCount} / ${stats.total} Entregas`,
        stats.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);
      
      autoTable(doc, {
        startY: 58,
        head: pdfHeaders,
        body: pdfBody,
        theme: 'striped',
        headStyles: {
          fillColor: [37, 99, 235], // blue-600
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85] // slate-700
        },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', cellWidth: 18 },
          1: { halign: 'left', cellWidth: 18 },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'left', cellWidth: 25 },
          4: { halign: 'left', cellWidth: 25 },
          5: { halign: 'left', cellWidth: 38 },
          6: { halign: 'center', cellWidth: 18 },
          7: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
        },
        margin: { top: 58, left: 14, right: 14 },
        didParseCell: function(cellData) {
          // Style the last row (TOTAL CONSOLIDADO) specifically
          if (cellData.row.index === pdfBody.length - 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fillColor = [241, 245, 249]; // slate-100
            cellData.cell.styles.textColor = [15, 23, 42]; // slate-900
          }
        }
      });
      
      doc.save(`extrato_condutor_${rider.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Erro ao exportar PDF.');
    }
  };

  const handleSaveBillingConfig = () => {
    if (!onUpdateRider || !rider) return;

    const updatedRider: DeliveryRider = {
      ...rider,
      billingModel: editingModel,
      billingFixedFee: parseFloat(editingFixedFee) || 0,
      billingVariablePercent: parseFloat(editingVariablePercent) || 0,
      billingFreightPercent: parseFloat(editingFreightPercent) || 0,
      billingFractionalValue: parseFloat(editingFractionalValue) || 0,
    };

    onUpdateRider(updatedRider);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Human-readable active model name
  const getModelLabel = (model: BillingModelType) => {
    switch (model) {
      case 'fixo':
        return 'Apenas Taxa Fixa';
      case 'variavel':
        return 'Apenas Percentual do Pedido';
      case 'frete':
        return 'Repasse de Frete (Tabela CEP)';
      case 'fracionado':
        return 'Formato Fracionado (Inclusão Manual)';
      case 'misto':
      default:
        return 'Modelo Misto (Fixo + Percentual)';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        
        {/* Print Styles Injection */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            /* Hide entire page except the printed container */
            body > *:not(#print-billing-modal-wrapper) {
              display: none !important;
            }
            #print-billing-modal-wrapper {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
            }
            .no-print {
              display: none !important;
            }
            .print-border {
              border: 1px solid #cbd5e1 !important;
            }
            .print-table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            .print-table th, .print-table td {
              border: 1px solid #e2e8f0 !important;
              padding: 8px !important;
            }
            .print-kpi {
              border: 1px solid #cbd5e1 !important;
              background: #f8fafc !important;
            }
          }
        `}} />

        {/* Backdrop overlay trigger close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 no-print"
        />

        {/* Modal Core Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', duration: 0.3 }}
          id="print-billing-modal-wrapper"
          className="relative bg-white border-0 shadow-2xl w-full h-full max-w-full max-h-screen flex flex-col overflow-hidden z-10 rounded-none print:max-h-none print:shadow-none print:border-0 print:rounded-none"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between no-print bg-slate-50/50 bg-gradient-to-r from-slate-50 to-slate-100/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl shadow-xs border border-blue-100/30">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Faturamento e Conciliação de Entregas</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Emissão de faturamento consolidado e regras de comissão</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* PRINT-ONLY HEADER */}
          <div className="hidden print:block border-b-2 border-slate-800 pb-5 mb-6 text-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black tracking-tight uppercase">LOGI-HUB TRANSPORTE</h1>
                <p className="text-xs font-bold text-slate-500">Sistema Integrado de Logística de Última Milha</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-slate-800">RELATÓRIO DE FATURAMENTO</h2>
                <p className="text-xs text-slate-500 font-semibold">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 print:overflow-visible print:p-0">
            
            {/* Driver Profile Block */}
            <div className="bg-slate-50 border border-slate-150/80 rounded-2xl p-5 print:p-4 print:bg-slate-50 print:border-slate-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={rider.avatar}
                    alt={rider.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md shrink-0 print:border print:shadow-none"
                  />
                  <div>
                    <h4 className="text-base font-extrabold text-slate-800">{rider.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-400">
                      <span className="flex items-center gap-1 bg-white border border-slate-200/50 px-2 py-0.5 rounded-md print:border-slate-300">
                        <VehicleIcon size={12} className="text-slate-500" />
                        {rider.vehicle}
                      </span>
                      <span>•</span>
                      <span>ID: {rider.id}</span>
                      <span>•</span>
                      <span>Tel: {rider.phone}</span>
                      <span>•</span>
                      <span className="text-blue-600 bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px] print:border-slate-300">
                        {getModelLabel(simulatedRider?.billingModel || 'misto')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs no-print">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Período de Faturamento:</span>
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-slate-600 font-bold shadow-xs">
                    <CalendarDays size={13} className="text-slate-400" />
                    <span>{formatToBrazilianDate(startDate)}</span>
                    <span className="text-slate-300 mx-1">até</span>
                    <span>{formatToBrazilianDate(endDate)}</span>
                  </div>
                </div>

                {/* Print Version of Date Range */}
                <div className="hidden print:block text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Período Selecionado</span>
                  <span className="text-sm font-bold text-slate-700">
                    {formatToBrazilianDate(startDate)} a {formatToBrazilianDate(endDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* INTERACTIVE BILLING MODEL CONFIGURATION PANEL (no-print) */}
            {onUpdateRider && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs no-print">
                <button
                  type="button"
                  onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                  className="w-full px-5 py-4 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-100 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Settings size={15} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Configurar Modelo de Faturamento</span>
                      <span className="text-[10px] text-slate-400 font-medium">Ajuste as comissões e repasses aplicados a este condutor</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {getModelLabel(editingModel)}
                    </span>
                    {isConfigExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isConfigExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 border-t border-slate-50 space-y-4 bg-slate-50/10">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          
                          {/* Selector */}
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Modelo de Faturamento</label>
                            <select
                              value={editingModel}
                              onChange={(e) => setEditingModel(e.target.value as BillingModelType)}
                              className="w-full text-xs font-bold text-slate-700 px-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                              <option value="misto">Modelo Misto (Fixo + Percentual)</option>
                              <option value="fixo">Apenas Taxa Fixa por Viagem</option>
                              <option value="variavel">Apenas Percentual do Pedido</option>
                              <option value="frete">Repasse de Frete (Tabela CEP do Cliente)</option>
                              <option value="fracionado">Formato Fracionado (Inclusão Manual do Valor Cobrado)</option>
                            </select>
                          </div>

                          {/* Fixed Fee Input */}
                          {(editingModel === 'misto' || editingModel === 'fixo') && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Prêmio Fixo (R$)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                <input
                                  type="number"
                                  step="0.50"
                                  min="0"
                                  value={editingFixedFee}
                                  onChange={(e) => setEditingFixedFee(e.target.value)}
                                  className="w-full text-xs font-bold text-slate-700 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {/* Variable Percent Input */}
                          {(editingModel === 'misto' || editingModel === 'variavel') && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Percentual do Pedido (%)</label>
                              <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={editingVariablePercent}
                                  onChange={(e) => setEditingVariablePercent(e.target.value)}
                                  className="w-full text-xs font-bold text-slate-700 pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {/* Freight Percent Input */}
                          {editingModel === 'frete' && (
                            <div className="space-y-1.5 col-span-2">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Percentual do Repasse do Frete (%)</label>
                              <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">% do frete CEP</span>
                                <input
                                  type="number"
                                  step="5"
                                  min="0"
                                  max="100"
                                  value={editingFreightPercent}
                                  onChange={(e) => setEditingFreightPercent(e.target.value)}
                                  className="w-full text-xs font-bold text-slate-700 pl-3 pr-24 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {/* Fractional / Manual Input */}
                          {editingModel === 'fracionado' && (
                            <div className="space-y-1.5 col-span-2">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Valor Fracionado Padrão / Inclusão Manual (R$)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                <input
                                  type="number"
                                  step="0.50"
                                  min="0"
                                  value={editingFractionalValue}
                                  onChange={(e) => setEditingFractionalValue(e.target.value)}
                                  className="w-full text-xs font-bold text-slate-700 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="12.50"
                                />
                              </div>
                            </div>
                          )}

                        </div>

                        {/* Description & Action */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold max-w-xl flex items-center gap-1.5">
                            <HelpCircle size={12} className="text-blue-500" />
                            <span>
                              {editingModel === 'misto' && `Simulador Ativo: R$ ${parseFloat(editingFixedFee || '0').toFixed(2)} por entrega + ${editingVariablePercent}% do valor da mercadoria.`}
                              {editingModel === 'fixo' && `Simulador Ativo: R$ ${parseFloat(editingFixedFee || '0').toFixed(2)} por entrega. Nenhum repasse sobre valor dos itens.`}
                              {editingModel === 'variavel' && `Simulador Ativo: ${editingVariablePercent}% do valor total do pedido concluído. Sem prêmio fixo.`}
                              {editingModel === 'frete' && `Simulador Ativo: Repassa ao condutor ${editingFreightPercent}% da taxa de frete cobrada do cliente parceiro por faixa de CEP.`}
                              {editingModel === 'fracionado' && `Simulador Ativo: Formato Fracionado com inclusão manual do valor cobrado por entrega (Base padrão: R$ ${parseFloat(editingFractionalValue || '0').toFixed(2)} ou valor do pedido).`}
                            </span>
                          </p>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={handleSaveBillingConfig}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-100/50 cursor-pointer"
                            >
                              <Save size={13} />
                              Salvar para {rider.name}
                            </button>
                          </div>
                        </div>

                        {/* Save Success Alert */}
                        {saveSuccess && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold rounded-xl flex items-center gap-1.5"
                          >
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>Parâmetros de faturamento do condutor {rider.name} salvos com sucesso e persistidos em nuvem!</span>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Date Filters Controls (no-print) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 no-print shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500" />
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
                    className="px-2.5 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100/70 transition-all cursor-pointer"
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
                      onChange={(e) => {
                        const val = e.target.value;
                        setStartDate(val);
                        if (val) setEndDate(val);
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data de Fim</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Busca Textual</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por cliente, pedido..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Deliveries Status Breakdowns Card */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm print-kpi">
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
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between print-kpi">
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
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between print-kpi">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Valor Roteado (Bruto)</span>
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

              {/* Total Driver Commission Gained */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden print:from-slate-100 print:to-slate-100 print:text-slate-800 print:border print:border-slate-300 print:shadow-none">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-100 print:text-slate-500">Comissão de Repasse</span>
                  <div className="p-1.5 rounded-lg bg-white/10 text-white print:bg-slate-200 print:text-slate-700">
                    <Coins size={13} />
                  </div>
                </div>
                <div className="mt-3 relative z-10">
                  <span className="text-xl font-black block tracking-tight print:text-slate-900">
                    {stats.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <div className="text-[9px] text-blue-100/95 font-medium mt-1 leading-tight print:text-slate-500">
                    <span>
                      {editingModel === 'misto' && `${stats.completedCount} viag. x R$ ${parseFloat(editingFixedFee).toFixed(2)} + ${editingVariablePercent}%`}
                      {editingModel === 'fixo' && `${stats.completedCount} viag. x R$ ${parseFloat(editingFixedFee).toFixed(2)}`}
                      {editingModel === 'variavel' && `${stats.completedCount} viag. x ${editingVariablePercent}% do valor`}
                      {editingModel === 'frete' && `${stats.completedCount} viag. x ${editingFreightPercent}% do frete CEP`}
                    </span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/5 rounded-full blur-md print:hidden" />
              </div>

            </div>

            {/* Invoicing Breakdown Details */}
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 print:bg-slate-50 print:border-slate-300 print:text-slate-700">
              <h5 className="font-bold mb-1.5 flex items-center gap-1.5">
                <Wallet size={13} className="text-amber-600 print:text-slate-500" />
                <span>Regra de Repasse de Comissão Ativa (Simulado)</span>
              </h5>
              <p className="font-medium text-[11px] leading-relaxed">
                As comissões são calculadas estritamente sobre entregas com status <strong className="font-extrabold text-amber-900 print:text-slate-900">Concluído</strong>. 
                {editingModel === 'misto' && ` O repasse baseia-se em um prêmio fixo de R$ ${parseFloat(editingFixedFee).toFixed(2)} por corrida finalizada acrescido de uma parcela variável de ${editingVariablePercent}% do valor total dos produtos.`}
                {editingModel === 'fixo' && ` O repasse baseia-se exclusivamente em um prêmio fixo de R$ ${parseFloat(editingFixedFee).toFixed(2)} por corrida finalizada.`}
                {editingModel === 'variavel' && ` O repasse baseia-se exclusivamente em uma parcela variável de ${editingVariablePercent}% do valor total dos produtos das entregas finalizadas.`}
                {editingModel === 'frete' && ` O repasse baseia-se no valor de frete por faixa de CEP configurado na tabela do cliente parceiro, repassando ${editingFreightPercent}% do frete cobrado ao condutor.`}
                &nbsp;Entregas em andamento e com incidentes não geram créditos de comissão no período até que sejam liquidadas.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-4 text-[10px] font-bold text-amber-900/80 print:text-slate-600">
                {(editingModel === 'misto' || editingModel === 'fixo') && (
                  <span>Prêmio Fixo Acumulado: {stats.fixedCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                )}
                {(editingModel === 'misto' || editingModel === 'variavel') && (
                  <span>Prêmio Variável Acumulado: {stats.variableCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                )}
                {editingModel === 'frete' && (
                  <span>Repasse Frete Acumulado: {stats.freightCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                )}
                <span className="hidden sm:inline">•</span>
                <span>Subtotal Faturamento: {stats.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>

            {/* Deliveries Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between no-print">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" />
                  Listagem Detalhada de Viagens
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {filteredOrders.length} resultados encontrados
                </span>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm print:border-slate-300 print:shadow-none">
                <table className="min-w-full text-xs text-slate-600 border-collapse print-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-left text-[10px] uppercase print:bg-slate-100 print:border-slate-300">
                      <th className="px-4 py-3">Nº Pedido</th>
                      <th className="px-4 py-3 text-center">Data</th>
                      <th className="px-4 py-3">Estabelecimento</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Endereço</th>
                      <th className="px-4 py-3">CEP</th>
                      <th className="px-4 py-3 text-right print:hidden">Valor Pedido</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">
                        <span className="print:hidden">Comissão</span>
                        <span className="hidden print:inline">Frete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700 print:divide-slate-300">
                    {filteredOrders.length === 0 ? (
                       <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          Nenhum pedido registrado para este condutor neste período.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isConcluded = order.status === 'Concluído';
                        const commResult = calculateRiderCommissionForOrder(simulatedRider || undefined, order, clientPartners);
                        const orderCommission = commResult.total;
                        const orderCep = order.cep || (order.rawData && (order.rawData.CEP || order.rawData.cep)) || '-';
                        
                        return (
                           <tr key={order.id} className="hover:bg-slate-50/40 print:hover:bg-transparent">
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-800 font-bold">
                              {order.id.replace('ped-', '') || order.id}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-slate-500 font-semibold">
                              {formatToBrazilianDate(order.date)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-semibold truncate max-w-[120px]">
                              {getPartnerDisplayName(order.partnerName, clientPartners)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-semibold truncate max-w-[120px]">
                              {order.clientName}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium truncate max-w-[150px]" title={order.address}>
                              {order.address}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px] font-semibold whitespace-nowrap">
                              {orderCep}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700 print:hidden">
                              {order.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStatusBadgeStyle(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-slate-800">
                              {isConcluded ? (
                                <span className="text-emerald-600">
                                  {orderCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  
                  {/* Print total summary row */}
                  {filteredOrders.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200 print:bg-slate-100 print:border-slate-300">
                        <td colSpan={6} className="px-4 py-3 text-right">TOTAL CONSOLIDADO:</td>
                        <td className="px-4 py-3 text-right font-extrabold print:hidden">
                          {filteredOrders.reduce((sum, o) => sum + o.value, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 text-[10px]">
                          {stats.completedCount} / {stats.total} Entregas
                        </td>
                        <td className="px-4 py-3 text-right font-black text-blue-700 print:text-slate-900 text-sm">
                          {stats.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* PRINT-ONLY SIGNATURE SECTION */}
            <div className="hidden print:block pt-16 mt-12 border-t border-slate-200 text-slate-800">
              <div className="grid grid-cols-2 gap-12 text-center text-xs">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-4/5 mx-auto h-5" />
                  <p className="font-bold">{rider.name}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Assinatura do Condutor / Recebedor</p>
                </div>
                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-4/5 mx-auto h-5" />
                  <p className="font-bold">LOGI-HUB ADMINISTRATIVO</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Carimbo e Assinatura do Responsável</p>
                </div>
              </div>
            </div>

          </div>

          {/* Footer - print action buttons */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between no-print bg-slate-50/50 shrink-0">
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
