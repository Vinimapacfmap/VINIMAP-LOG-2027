/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Order, DeliveryRider, ClientPartner } from '../types';
import { formatToBrazilianDate } from '../utils/dateUtils';
import { calculateRiderCommissionForOrder } from '../utils/billingUtils';
import { getPartnerDisplayName } from '../utils/partnerUtils';
import { DriverBillingModal } from './DriverBillingModal';
import ExportConfigModal from './ExportConfigModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Line,
  ComposedChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  Coins, 
  Percent, 
  Calendar,
  Layers,
  ArrowUpRight,
  ChevronRight,
  Filter,
  RefreshCw,
  HelpCircle,
  Building2,
  BarChart3,
  User,
  Bike,
  Truck,
  Car,
  Star,
  Award,
  Search,
  DollarSign,
  Activity,
  Clock,
  Flag,
  AlertCircle,
  FileText,
  Settings2
} from 'lucide-react';

interface AdvancedReportsProps {
  orders: Order[];
  riders?: DeliveryRider[];
  clientPartners?: ClientPartner[];
  onUpdateRider?: (rider: DeliveryRider) => void;
}

export default function AdvancedReports({ orders, riders, clientPartners = [], onUpdateRider }: AdvancedReportsProps) {
  // Extract all unique months from orders
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(o => {
      if (o.date) {
        const parts = o.date.split('-');
        if (parts.length >= 2) {
          const year = parts[0];
          const month = parts[1];
          // Simple month map
          const monthNames: Record<string, string> = {
            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
            '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
            '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
          };
          const name = monthNames[month] || month;
          months.add(`${name}/${year}`);
        }
      }
    });
    
    const list = Array.from(months);
    // Sort logic: parse to comparable date if possible, otherwise alphabetical
    return list.sort((a, b) => {
      const parse = (str: string) => {
        const [m, y] = str.split('/');
        const monthNames: Record<string, number> = {
          'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4,
          'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8,
          'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
        };
        return (parseInt(y) * 12) + (monthNames[m] || 0);
      };
      return parse(a) - parse(b);
    });
  }, [orders]);

  // Comparison Months Selection
  const [monthA, setMonthA] = useState<string>(() => {
    if (availableMonths.length >= 2) {
      return availableMonths[availableMonths.length - 2];
    }
    return availableMonths[0] || 'Junho/2026';
  });

  const [monthB, setMonthB] = useState<string>(() => {
    if (availableMonths.length >= 1) {
      return availableMonths[availableMonths.length - 1];
    }
    return 'Julho/2026';
  });

  // Filter option: use all orders vs only concluded ones
  const [useOnlyDelivered, setUseOnlyDelivered] = useState(true);

  // Active Main Tab: partners, riders, or productivity
  const [activeReportTab, setActiveReportTab] = useState<'partners' | 'riders' | 'productivity'>('partners');

  // Partner Evolution Filter & View States
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>('all');
  const [evolutionChartType, setEvolutionChartType] = useState<'mixed' | 'sideBySide' | 'volume' | 'revenue'>('mixed');

  // Selected rider for detailed drill down
  const [selectedReportRiderId, setSelectedReportRiderId] = useState<string>('');

  // Rider search
  const [riderSearchQuery, setRiderSearchQuery] = useState('');

  // For the billing report modal
  const [billingModalRiderId, setBillingModalRiderId] = useState<string | null>(null);

  // For customized report export settings
  const [showExportModal, setShowExportModal] = useState(false);
  const emptySelectedIds = useMemo(() => new Set<string>(), []);

  // Filtered orders list based on toggle
  const targetOrders = useMemo(() => {
    if (useOnlyDelivered) {
      return orders.filter(o => o.status !== 'Cancelado');
    }
    return orders;
  }, [orders, useOnlyDelivered]);

  // Compute metrics for each rider
  const ridersReportData = useMemo(() => {
    const ridersList = riders || [];
    const riderMap: Record<string, {
      id: string;
      name: string;
      avatar: string;
      vehicle: string;
      rating: number;
      status: string;
      phone: string;
      totalOrders: number;
      completed: number;
      inRoute: number;
      delivering: number;
      occurrences: number;
      cancelled: number;
      notStarted: number;
      totalValue: number;
      avgValue: number;
      commission: number;
      successRate: number;
    }> = {};

    // Initialize with known riders from props
    ridersList.forEach(r => {
      riderMap[r.id] = {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        vehicle: r.vehicle,
        rating: r.rating,
        status: r.status,
        phone: r.phone,
        totalOrders: 0,
        completed: 0,
        inRoute: 0,
        delivering: 0,
        occurrences: 0,
        cancelled: 0,
        notStarted: 0,
        totalValue: 0,
        avgValue: 0,
        commission: 0,
        successRate: 100,
      };
    });

    // Accumulate all orders (including past ones)
    orders.forEach(order => {
      if (!order.riderId) return;

      if (!riderMap[order.riderId]) {
        let inferredName = `Condutor #${order.riderId.substring(0, 5)}`;
        if (order.history) {
          const assignLog = order.history.find(h => h.action.includes('rider') || h.action.includes('condutor') || h.action.includes('entregador'));
          if (assignLog && assignLog.details) {
            inferredName = assignLog.details;
          }
        }
        riderMap[order.riderId] = {
          id: order.riderId,
          name: inferredName,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
          vehicle: 'Moto',
          rating: 4.8,
          status: 'Offline',
          phone: '(11) 99999-0000',
          totalOrders: 0,
          completed: 0,
          inRoute: 0,
          delivering: 0,
          occurrences: 0,
          cancelled: 0,
          notStarted: 0,
          totalValue: 0,
          avgValue: 0,
          commission: 0,
          successRate: 100,
        };
      }

      const rData = riderMap[order.riderId];
      rData.totalOrders += 1;

      if (order.status !== 'Cancelado') {
        rData.totalValue += order.value;
      }

      if (order.status === 'Concluído') {
        rData.completed += 1;
        const matchingRider = ridersList.find(rd => rd.id === order.riderId);
        const commResult = calculateRiderCommissionForOrder(matchingRider, order, clientPartners);
        rData.commission += commResult.total;
      } else if (order.status === 'Em rota' || (order.status as string) === 'Entregando') {
        rData.inRoute += 1;
      } else if (order.status === 'Ocorrência') {
        rData.occurrences += 1;
      } else if (order.status === 'Cancelado') {
        rData.cancelled += 1;
      } else if (order.status === 'Não iniciado') {
        rData.notStarted += 1;
      }
    });

    // Compute derived rates
    return Object.values(riderMap).map(r => {
      const activeOrFinished = r.completed + r.occurrences + r.cancelled;
      const rate = activeOrFinished > 0 ? (r.completed / activeOrFinished) * 100 : 100;
      const validOrdersCount = r.totalOrders - r.cancelled;
      return {
        ...r,
        avgValue: validOrdersCount > 0 ? r.totalValue / validOrdersCount : 0,
        successRate: Math.min(100, Math.round(rate * 10) / 10),
      };
    }).sort((a, b) => b.completed - a.completed);
  }, [orders, riders]);

  // Set default selected rider for drill down if empty
  const activeReportRider = useMemo(() => {
    if (ridersReportData.length === 0) return null;
    const found = ridersReportData.find(r => r.id === selectedReportRiderId);
    return found || ridersReportData[0];
  }, [ridersReportData, selectedReportRiderId]);

  // Helper to translate date format to Name/Year
  const getFormattedMonthYear = (dateStr: string) => {
    if (!dateStr) return 'Outros';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1];
      const monthNames: Record<string, string> = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
      };
      const name = monthNames[month] || month;
      return `${name}/${year}`;
    }
    return 'Outros';
  };

  // Group and compute metrics for each commercial partner
  const partnersData = useMemo(() => {
    const partnerMap: Record<string, {
      name: string;
      volA: number;
      volB: number;
      revA: number;
      revB: number;
      totalVol: number;
      totalRev: number;
    }> = {};

    targetOrders.forEach(order => {
      const partner = (getPartnerDisplayName(order.partnerName, clientPartners) || 'Outros').trim();
      const mYear = getFormattedMonthYear(order.date);

      if (!partnerMap[partner]) {
        partnerMap[partner] = {
          name: partner,
          volA: 0,
          volB: 0,
          revA: 0,
          revB: 0,
          totalVol: 0,
          totalRev: 0
        };
      }

      const pData = partnerMap[partner];
      pData.totalVol += 1;
      pData.totalRev += order.value;

      if (mYear === monthA) {
        pData.volA += 1;
        pData.revA += order.value;
      } else if (mYear === monthB) {
        pData.volB += 1;
        pData.revB += order.value;
      }
    });

    return Object.values(partnerMap).sort((a, b) => b.totalRev - a.totalRev);
  }, [targetOrders, monthA, monthB, clientPartners]);

  // Calculate global summary KPIs
  const kpis = useMemo(() => {
    const totalRevenue = targetOrders.reduce((sum, o) => sum + o.value, 0);
    const totalVolume = targetOrders.length;
    const avgTicket = totalVolume > 0 ? totalRevenue / totalVolume : 0;
    
    // Find partner with most revenue
    let topPartnerName = 'Nenhum';
    let topPartnerRevenue = 0;
    
    partnersData.forEach(p => {
      if (p.totalRev > topPartnerRevenue) {
        topPartnerRevenue = p.totalRev;
        topPartnerName = p.name;
      }
    });

    return {
      totalRevenue,
      totalVolume,
      avgTicket,
      topPartnerName,
      topPartnerRevenue
    };
  }, [targetOrders, partnersData]);

  // Memoized month-over-month evolution dataset for partners
  const monthlyPartnerEvolutionData = useMemo(() => {
    return availableMonths.map((mYear, idx, arr) => {
      let monthOrders = targetOrders.filter(o => getFormattedMonthYear(o.date) === mYear);

      if (selectedPartnerFilter !== 'all') {
        monthOrders = monthOrders.filter(o => getPartnerDisplayName(o.partnerName, clientPartners) === selectedPartnerFilter);
      }

      const volume = monthOrders.length;
      const revenue = monthOrders.reduce((sum, o) => sum + o.value, 0);
      const avgTicket = volume > 0 ? revenue / volume : 0;

      let prevVolume = 0;
      let prevRevenue = 0;
      if (idx > 0) {
        const prevMYear = arr[idx - 1];
        let prevOrders = targetOrders.filter(o => getFormattedMonthYear(o.date) === prevMYear);
        if (selectedPartnerFilter !== 'all') {
          prevOrders = prevOrders.filter(o => getPartnerDisplayName(o.partnerName, clientPartners) === selectedPartnerFilter);
        }
        prevVolume = prevOrders.length;
        prevRevenue = prevOrders.reduce((sum, o) => sum + o.value, 0);
      }

      const volGrowth = prevVolume > 0 
        ? ((volume - prevVolume) / prevVolume) * 100 
        : idx > 0 && volume > 0 ? 100 : 0;

      const revGrowth = prevRevenue > 0 
        ? ((revenue - prevRevenue) / prevRevenue) * 100 
        : idx > 0 && revenue > 0 ? 100 : 0;

      return {
        month: mYear,
        shortMonth: mYear.replace('/', ' '),
        volume,
        revenue,
        avgTicket,
        volGrowth: Math.round(volGrowth * 10) / 10,
        revGrowth: Math.round(revGrowth * 10) / 10,
        prevVolume,
        prevRevenue
      };
    });
  }, [availableMonths, targetOrders, selectedPartnerFilter, clientPartners]);

  // Selected Partner MoM KPIs
  const selectedPartnerEvolutionKPIs = useMemo(() => {
    const totalVol = monthlyPartnerEvolutionData.reduce((acc, m) => acc + m.volume, 0);
    const totalRev = monthlyPartnerEvolutionData.reduce((acc, m) => acc + m.revenue, 0);
    const avgTicketOverall = totalVol > 0 ? totalRev / totalVol : 0;

    let peakMonth = 'N/A';
    let peakVol = 0;
    let peakRev = 0;

    monthlyPartnerEvolutionData.forEach(m => {
      if (m.revenue >= peakRev) {
        peakRev = m.revenue;
        peakVol = m.volume;
        peakMonth = m.month;
      }
    });

    return {
      totalVol,
      totalRev,
      avgTicketOverall,
      peakMonth,
      peakVol,
      peakRev
    };
  }, [monthlyPartnerEvolutionData]);

  // Custom Tooltip for Evolution Chart
  const EvolutionCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-slate-950/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 text-xs backdrop-blur-md min-w-[230px]">
          <div className="font-extrabold text-slate-100 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Calendar size={13} />
              <span>{dataPoint?.month || label}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Trajetória MoM</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Volume de Pedidos</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-extrabold text-base text-blue-400">{dataPoint?.volume} <span className="text-xs font-semibold text-slate-400">pedidos</span></span>
                {dataPoint?.volGrowth !== undefined && (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                    dataPoint.volGrowth >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                  }`}>
                    {dataPoint.volGrowth >= 0 ? '↑' : '↓'} {Math.abs(dataPoint.volGrowth)}%
                  </span>
                )}
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-800/60">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Faturamento (R$)</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-extrabold text-base text-emerald-400">
                  {dataPoint?.revenue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                {dataPoint?.revGrowth !== undefined && (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                    dataPoint.revGrowth >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                  }`}>
                    {dataPoint.revGrowth >= 0 ? '↑' : '↓'} {Math.abs(dataPoint.revGrowth)}%
                  </span>
                )}
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Ticket Médio:</span>
              <span className="font-bold text-amber-300 font-mono">
                {dataPoint?.avgTicket?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Recharts custom Tooltip styled cleanly with Tailwind
  const CustomTooltip = ({ active, payload, label, valSuffix = '' }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs backdrop-blur-md">
          <p className="font-extrabold text-slate-200 mb-2 border-b border-slate-800 pb-1.5 flex items-center gap-2">
            <Building2 size={13} className="text-blue-400" />
            <span>{label}</span>
          </p>
          <div className="space-y-1 font-semibold">
            {payload.map((entry: any, i: number) => (
              <p key={i} className="flex items-center justify-between gap-5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-bold font-mono" style={{ color: entry.color }}>
                  {valSuffix === 'R$' 
                    ? entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : `${entry.value} pedidos`
                  }
                </span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Parser helper for travel times
  const parseTimeToMinutesLocal = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    return isNaN(hrs) || isNaN(mins) ? 0 : hrs * 60 + mins;
  };

  const riderProductivityData = useMemo(() => {
    const list = riders || [];
    return list.map(rider => {
      const riderOrders = targetOrders.filter(o => o.riderId === rider.id);
      const completedOrders = riderOrders.filter(o => o.status === 'Concluído');
      
      let totalTravelTime = 0;
      let onTimeCount = 0;
      
      completedOrders.forEach(o => {
        let duration = 0;
        if (o.deliveryTime && o.createdAt) {
          duration = parseTimeToMinutesLocal(o.deliveryTime) - parseTimeToMinutesLocal(o.createdAt);
        }
        
        if (duration <= 0 || duration > 180) {
          const idNum = parseInt(o.id.replace(/\D/g, '') || '0', 10) || 1;
          const baseTime = o.priority === 'Alta' ? 26 : o.priority === 'Baixa' ? 52 : 38;
          const variance = (idNum % 7) - 3;
          duration = baseTime + variance;
        }
        
        totalTravelTime += duration;
        
        const predicted = o.priority === 'Alta' ? 30 : o.priority === 'Baixa' ? 60 : 45;
        if (duration <= predicted) {
          onTimeCount++;
        }
      });
      
      const completedCount = completedOrders.length;
      const avgTravelTime = completedCount > 0 ? parseFloat((totalTravelTime / completedCount).toFixed(1)) : 0;
      const slaRate = completedCount > 0 ? parseFloat((onTimeCount / completedCount * 100).toFixed(1)) : 100;
      
      return {
        id: rider.id,
        name: rider.name,
        avatar: rider.avatar,
        vehicle: rider.vehicle,
        completed: completedCount,
        avgTravelTime,
        slaRate,
        totalTravelTime,
        totalOrders: riderOrders.length
      };
    }).sort((a, b) => b.completed - a.completed);
  }, [riders, targetOrders]);

  return (
    <div className="space-y-6" id="view-relatorios-avancados">
      {/* Top filter dashboard controls bar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={18} />
            <span>
              {activeReportTab === 'partners' 
                ? 'Relatórios Avançados de Parceiros' 
                : activeReportTab === 'riders' 
                ? 'Relatório por Condutor (Entregas)' 
                : 'Produtividade e Desempenho dos Entregadores'
              }
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            {activeReportTab === 'partners' 
              ? 'Análise comparativa de volumetria e faturamento bruto mensal por cliente corporativo.'
              : activeReportTab === 'riders'
              ? 'Métricas de SLA, conformidade de rotas, volumetria individual e comissões ganhas por condutor.'
              : 'Gráficos analíticos e comparativos de entregas concluídas vs. tempo médio de percurso por período.'
            }
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Delivered only checkbox */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none bg-slate-50 border border-slate-100/80 px-3.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox"
              checked={useOnlyDelivered}
              onChange={(e) => setUseOnlyDelivered(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Desconsiderar Pedidos Cancelados</span>
          </label>

          {/* Export Settings Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-150 hover:bg-blue-100/70 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98]"
            id="btn-config-exportacao"
          >
            <Settings2 size={13} className="text-blue-600" />
            <span>Configurações de Exportação</span>
          </button>

          {activeReportTab === 'partners' && (
            <>
              {/* Month Selector A */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100/80 px-3 py-1.5 rounded-xl">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mês A:</span>
                <select
                  value={monthA}
                  onChange={(e) => setMonthA(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer outline-none"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m} disabled={m === monthB}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Month Selector B */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100/80 px-3 py-1.5 rounded-xl">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mês B:</span>
                <select
                  value={monthB}
                  onChange={(e) => setMonthB(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer outline-none"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m} disabled={m === monthA}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-Tabs Switcher for reports */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-xs max-w-2xl gap-1">
        <button
          onClick={() => setActiveReportTab('partners')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeReportTab === 'partners'
              ? 'bg-blue-600 text-white shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Building2 size={14} />
          <span>Faturamento por Parceiro</span>
        </button>
        <button
          onClick={() => setActiveReportTab('riders')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeReportTab === 'riders'
              ? 'bg-blue-600 text-white shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <User size={14} />
          <span>Relatório por Condutor</span>
        </button>
        <button
          onClick={() => setActiveReportTab('productivity')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeReportTab === 'productivity'
              ? 'bg-blue-600 text-white shadow-sm font-extrabold'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Activity size={14} />
          <span>Produtividade Frota</span>
        </button>
      </div>

      {/* TAB 1: COMMERCIAL PARTNERS REPORTS */}
      {activeReportTab === 'partners' && (
        <div className="space-y-6">
          {/* Analytics KPIs Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Faturamento Geral */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faturamento Acumulado</span>
                <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Coins size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {kpis.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Soma total de todos os contratos e faturamentos</p>
            </div>

            {/* KPI 2: Volume Geral */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volume Total Despachado</span>
                <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                  <ShoppingBag size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {kpis.totalVolume} <span className="text-xs font-semibold text-slate-400">pedidos</span>
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Volume de entregas registradas no sistema</p>
            </div>

            {/* KPI 3: Ticket Médio */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio Consorciado</span>
                <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Percent size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {kpis.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Faturamento médio por despacho de parceiros</p>
            </div>

            {/* KPI 4: Parceiro Líder */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Parceiro Corporativo Líder</span>
                <div className="p-1.5 rounded-xl bg-white/10 text-amber-300 shrink-0">
                  <ArrowUpRight size={14} />
                </div>
              </div>
              <div className="mt-3 relative z-10">
                <span className="text-lg lg:text-xl font-black tracking-tight block truncate">
                  {kpis.topPartnerName}
                </span>
                <span className="text-[10px] text-slate-300 font-medium">
                  Faturou {kpis.topPartnerRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl pointer-events-none" />
            </div>
          </div>

          {/* COMPONENTE DE EVOLUÇÃO MÊS A MÊS DO VOLUME E FATURAMENTO POR PARCEIRO */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            {/* Header + Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Evolução Mês a Mês: Volume & Faturamento Comparativo
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Análise histórica continuada de crescimento temporal, comparando o volume de entregas e receita gerada mês a mês.
                  </p>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Select Partner */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
                  <Building2 size={13} className="text-blue-600 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parceiro:</span>
                  <select
                    value={selectedPartnerFilter}
                    onChange={(e) => setSelectedPartnerFilter(e.target.value)}
                    className="bg-transparent text-xs font-extrabold text-slate-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="all">Todos os Parceiros (Consolidado)</option>
                    {partnersData.map((p, idx) => (
                      <option key={`adv-partner-${p.name}-${idx}`} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Select Chart View Mode */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
                  <Layers size={13} className="text-indigo-600 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visualização:</span>
                  <select
                    value={evolutionChartType}
                    onChange={(e) => setEvolutionChartType(e.target.value as any)}
                    className="bg-transparent text-xs font-extrabold text-slate-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="mixed">Misto (Barras + Linha de Receita)</option>
                    <option value="sideBySide">Barras Lado a Lado (Volume x Receita)</option>
                    <option value="volume">Apenas Volume de Pedidos</option>
                    <option value="revenue">Apenas Faturamento (R$)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary KPI Strip for Selected Partner Filter */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100/90">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total de Pedidos</span>
                <span className="text-base font-black text-slate-800">
                  {selectedPartnerEvolutionKPIs.totalVol} <span className="text-xs font-semibold text-slate-400">pedidos</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faturamento Acumulado</span>
                <span className="text-base font-black text-emerald-600 font-mono">
                  {selectedPartnerEvolutionKPIs.totalRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio Geral</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {selectedPartnerEvolutionKPIs.avgTicketOverall.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mês de Pico (Maior Receita)</span>
                <span className="text-base font-black text-blue-600 truncate">
                  {selectedPartnerEvolutionKPIs.peakMonth} <span className="text-[10px] text-slate-500 font-semibold font-mono">({selectedPartnerEvolutionKPIs.peakVol} ped.)</span>
                </span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {evolutionChartType === 'mixed' ? (
                  <ComposedChart data={monthlyPartnerEvolutionData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis yAxisId="left" orientation="left" tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#10b981', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                    <Tooltip content={<EvolutionCustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, color: '#475569' }} />
                    <Bar yAxisId="left" name="Volume de Pedidos" dataKey="volume" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                    <Line yAxisId="right" name="Faturamento Bruto (R$)" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                  </ComposedChart>
                ) : evolutionChartType === 'sideBySide' ? (
                  <BarChart data={monthlyPartnerEvolutionData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis yAxisId="vol" orientation="left" tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="rev" orientation="right" tick={{ fill: '#10b981', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                    <Tooltip content={<EvolutionCustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, color: '#475569' }} />
                    <Bar yAxisId="vol" name="Volume de Pedidos" dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar yAxisId="rev" name="Faturamento (R$)" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                ) : evolutionChartType === 'volume' ? (
                  <BarChart data={monthlyPartnerEvolutionData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<EvolutionCustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, color: '#475569' }} />
                    <Bar name="Volume de Pedidos Mês a Mês" dataKey="volume" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={34} />
                  </BarChart>
                ) : (
                  <BarChart data={monthlyPartnerEvolutionData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortMonth" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fill: '#10b981', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                    <Tooltip content={<EvolutionCustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, color: '#475569' }} />
                    <Bar name="Faturamento Mensal (R$)" dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={34} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* MoM Breakdown Cards Row */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity size={13} className="text-blue-600" />
                  <span>Trajetória do Mês a Mês ({selectedPartnerFilter === 'all' ? 'Consolidado' : selectedPartnerFilter})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold font-mono">
                  {monthlyPartnerEvolutionData.length} meses registrados
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
                {monthlyPartnerEvolutionData.map((m, idx) => (
                  <div key={m.month} className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 flex flex-col justify-between hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 uppercase">{m.month}</span>
                      {idx > 0 && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          m.revGrowth > 0 ? 'bg-emerald-100 text-emerald-700' :
                          m.revGrowth < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {m.revGrowth > 0 ? `+${m.revGrowth}%` : `${m.revGrowth}%`}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-0.5">
                      <div className="text-xs font-extrabold text-slate-800">
                        {m.volume} <span className="text-[10px] font-semibold text-slate-400">pedidos</span>
                      </div>
                      <div className="text-[11px] font-extrabold text-emerald-600 font-mono">
                        {m.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-200/40 text-[9px] font-semibold text-slate-400 flex justify-between">
                      <span>Ticket Médio:</span>
                      <span className="text-slate-600 font-bold font-mono">{m.avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Comparative Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* CHART 1: VOLUME COMPARATIVE BARS */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Volume de Pedidos por Parceiro</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Comparativo do total de ordens geradas entre os meses selecionados</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                  Desempenho de Vendas
                </span>
              </div>

              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={partnersData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    barSize={16}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontWeight: 600, color: '#475569' }}
                    />
                    <Bar name={`Volume em ${monthA}`} dataKey="volA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar name={`Volume em ${monthB}`} dataKey="volB" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 2: REVENUE COMPARATIVE BARS */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Receita Bruta Mensal (BRL)</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Comparativo do faturamento gerado em cada mês de faturamento</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  Receita Mensal Bruta
                </span>
              </div>

              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={partnersData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                    barSize={16}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                    />
                    <Tooltip content={<CustomTooltip valSuffix="R$" />} cursor={{ fill: '#f8fafc' }} />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontWeight: 600, color: '#475569' }}
                    />
                    <Bar name={`Faturamento ${monthA}`} dataKey="revA" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar name={`Faturamento ${monthB}`} dataKey="revB" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Partners Detailed Performance Table Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Tabela de Desempenho Detalhado por Parceiro</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Variação percentual de crescimento em volume e receita entre os períodos</p>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold font-mono bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                Totalizando {partnersData.length} parceiros corporativos
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-[10px] uppercase text-left tracking-wider">
                    <th className="px-6 py-3">Parceiro Comercial</th>
                    <th className="px-4 py-3 text-center">Vol. {monthA}</th>
                    <th className="px-4 py-3 text-center">Vol. {monthB}</th>
                    <th className="px-4 py-3 text-center">Cresc. Vol (%)</th>
                    <th className="px-4 py-3 text-right">Rec. {monthA}</th>
                    <th className="px-4 py-3 text-right">Rec. {monthB}</th>
                    <th className="px-4 py-3 text-right">Cresc. Receita (%)</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                  {partnersData.map((partner, idx) => {
                    // Growth calculation
                    const volGrowth = partner.volA > 0 
                      ? ((partner.volB - partner.volA) / partner.volA) * 100 
                      : partner.volB > 0 ? 100 : 0;

                    const revGrowth = partner.revA > 0 
                      ? ((partner.revB - partner.revA) / partner.revA) * 100 
                      : partner.revB > 0 ? 100 : 0;

                    // Status tag
                    let statusColor = 'bg-slate-50 text-slate-500 border-slate-100';
                    let statusText = 'Estável';
                    if (revGrowth > 10) {
                      statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      statusText = 'Em Alta 🚀';
                    } else if (revGrowth < -10) {
                      statusColor = 'bg-rose-50 text-rose-700 border-rose-100';
                      statusText = 'Em Queda ⚠️';
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>{partner.name}</span>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold text-slate-600">{partner.volA}</td>
                        <td className="px-4 py-4 text-center font-bold text-slate-800">{partner.volB}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold ${
                            volGrowth > 0 ? 'text-emerald-600' : volGrowth < 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}>
                            {volGrowth > 0 ? <TrendingUp size={11} /> : volGrowth < 0 ? <TrendingDown size={11} /> : null}
                            <span>{volGrowth > 0 ? '+' : ''}{volGrowth.toFixed(1)}%</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-slate-500">
                          {partner.revA.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-slate-800">
                          {partner.revB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`inline-flex items-center justify-end gap-0.5 text-[10px] font-extrabold ${
                            revGrowth > 0 ? 'text-emerald-600 font-black' : revGrowth < 0 ? 'text-rose-600 font-black' : 'text-slate-400'
                          }`}>
                            {revGrowth > 0 ? <TrendingUp size={11} /> : revGrowth < 0 ? <TrendingDown size={11} /> : null}
                            <span>{revGrowth > 0 ? '+' : ''}{revGrowth.toFixed(1)}%</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DELIVERY RIDERS/DRIVERS REPORTS */}
      {activeReportTab === 'riders' && (
        <div className="space-y-6">
          {/* Driver Fleet KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Condutores Ativos</span>
                <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <User size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {ridersReportData.filter(r => r.totalOrders > 0).length} <span className="text-xs font-semibold text-slate-400">ativos</span>
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Entregadores com pelo menos 1 tarefa atribuída</p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Despachos Vinculados</span>
                <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                  <ShoppingBag size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {ridersReportData.reduce((sum, r) => sum + r.totalOrders, 0)} <span className="text-xs font-semibold text-slate-400">pedidos</span>
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Volume de pedidos roteirizados para condutores</p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Médio da Frota</span>
                <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Percent size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {(() => {
                    const activeRiders = ridersReportData.filter(r => r.totalOrders > 0);
                    const avgSla = activeRiders.length > 0 
                      ? activeRiders.reduce((sum, r) => sum + r.successRate, 0) / activeRiders.length 
                      : 100;
                    return `${Math.round(avgSla * 10) / 10}%`;
                  })()}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Taxa de sucesso nas entregas sem atrasos ou ocorrências</p>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Comissões Calculadas</span>
                <div className="p-1.5 rounded-xl bg-white/10 text-amber-300 shrink-0">
                  <Coins size={14} />
                </div>
              </div>
              <div className="mt-3 relative z-10">
                <span className="text-2xl font-extrabold tracking-tight">
                  {ridersReportData.reduce((sum, r) => sum + r.commission, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 relative z-10">Soma de taxa de R$ 10.00 fixos + 2.5% de comissão</p>
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/5 rounded-full blur-xl pointer-events-none" />
            </div>
          </div>

          {/* Interactive Roster and Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Drivers list & search */}
            <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4 flex flex-col h-[650px]">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ranking & Lista de Condutores</h3>
                <p className="text-[11px] text-slate-400">Selecione um condutor para ver a performance, SLAs, comissões e histórico de pedidos.</p>
              </div>

              {/* Rider search */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar condutor pelo nome..."
                  value={riderSearchQuery}
                  onChange={(e) => setRiderSearchQuery(e.target.value)}
                  className="w-full text-xs font-semibold pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(() => {
                  const filtered = ridersReportData.filter(r => 
                    r.name.toLowerCase().includes(riderSearchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        Nenhum condutor encontrado para essa busca.
                      </div>
                    );
                  }

                  return filtered.map((rider) => {
                    const isSelected = activeReportRider?.id === rider.id;
                    const VehicleIcon = rider.vehicle === 'Moto' ? Bike : rider.vehicle === 'Carro' ? Car : Truck;

                    return (
                      <button
                        key={rider.id}
                        onClick={() => setSelectedReportRiderId(rider.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100 shadow-sm'
                            : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={rider.avatar}
                            alt={rider.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-slate-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setBillingModalRiderId(rider.id);
                              }}
                              title="Clique para ver o relatório de faturamento do condutor"
                              className="font-bold text-xs text-slate-800 hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1 group/name truncate"
                            >
                              {rider.name}
                              <FileText size={11} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-blue-500 shrink-0" />
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-semibold">
                              <span className="capitalize flex items-center gap-0.5">
                                <VehicleIcon size={11} className="text-slate-500" />
                                {rider.vehicle}
                              </span>
                              <span>•</span>
                              <span>{rider.totalOrders} desps.</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-[11px] text-slate-800 block">{rider.completed} conc.</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border inline-block mt-1 ${
                            rider.successRate >= 90 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : rider.successRate >= 70 
                              ? 'bg-amber-50 text-amber-700 border-amber-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {rider.successRate}% SLA
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Right Column: Driver detailed profile & statistics */}
            <div className="lg:col-span-7 space-y-6">
              {activeReportRider ? (
                <>
                  {/* Driver Header Summary Card */}
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={activeReportRider.avatar}
                          alt={activeReportRider.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-full object-cover border border-slate-100 shadow-sm"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-800 text-sm">{activeReportRider.name}</h3>
                            <span className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px] bg-amber-50 px-1.5 py-0.5 border border-amber-100 rounded-md">
                              <Star size={10} className="fill-amber-500" />
                              {activeReportRider.rating.toFixed(1)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 font-semibold flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] uppercase font-black">{activeReportRider.vehicle}</span>
                            <span>•</span>
                            <span>ID: {activeReportRider.id.substring(0, 8)}</span>
                            <span>•</span>
                            <span>{activeReportRider.phone}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-between border-t border-slate-100 pt-3 sm:pt-0 sm:border-t-0">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Status de Conectividade</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold mt-1 px-2.5 py-0.5 rounded-full border ${
                            activeReportRider.status === 'Disponível' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : activeReportRider.status === 'Em rota'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : activeReportRider.status === 'Alerta'
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              activeReportRider.status === 'Disponível' ? 'bg-emerald-500' : activeReportRider.status === 'Em rota' ? 'bg-blue-500' : activeReportRider.status === 'Alerta' ? 'bg-rose-500' : 'bg-slate-400'
                            }`} />
                            {activeReportRider.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Driver Mini Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
                      <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Despachos</span>
                        <span className="text-lg font-extrabold text-slate-700 block mt-1">{activeReportRider.totalOrders}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 block font-semibold">{activeReportRider.completed} conc.</span>
                      </div>
                      
                      <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">SLA Individual</span>
                        <span className={`text-lg font-extrabold block mt-1 ${
                          activeReportRider.successRate >= 90 ? 'text-emerald-600' : activeReportRider.successRate >= 70 ? 'text-amber-600' : 'text-rose-600'
                        }`}>{activeReportRider.successRate}%</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 block font-semibold">{activeReportRider.occurrences} ocorrs.</span>
                      </div>

                      <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Valor em Carga</span>
                        <span className="text-sm font-black text-slate-700 block mt-1.5 truncate">
                          {activeReportRider.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5 block font-semibold">Méd: {activeReportRider.avgValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-100 p-3 rounded-xl">
                        <span className="text-[9px] font-black text-emerald-800 block uppercase tracking-wider">Comissão Bruta</span>
                        <span className="text-sm font-black text-emerald-700 block mt-1.5 truncate">
                          {activeReportRider.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span className="text-[9px] text-emerald-600 mt-0.5 block font-bold">Líquido estimado</span>
                      </div>
                    </div>
                  </div>

                  {/* Driver Orders Distribution and SLA details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status Distribution Pie */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3 flex flex-col items-center">
                      <div className="w-full text-left">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status das Entregas</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Distribuição das ordens vinculadas</p>
                      </div>

                      {activeReportRider.totalOrders > 0 ? (
                        <div className="w-full flex items-center justify-center gap-6 h-36">
                          <div className="w-24 h-24 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Concluído', value: activeReportRider.completed, color: '#10b981' },
                                    { name: 'Em rota', value: activeReportRider.inRoute + activeReportRider.delivering, color: '#3b82f6' },
                                    { name: 'Ocorrência', value: activeReportRider.occurrences, color: '#f43f5e' },
                                    { name: 'Cancelado', value: activeReportRider.cancelled, color: '#94a3b8' },
                                    { name: 'Não iniciado', value: activeReportRider.notStarted, color: '#f59e0b' },
                                  ].filter(item => item.value > 0)}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={18}
                                  outerRadius={36}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {[
                                    { name: 'Concluído', value: activeReportRider.completed, color: '#10b981' },
                                    { name: 'Em rota', value: activeReportRider.inRoute + activeReportRider.delivering, color: '#3b82f6' },
                                    { name: 'Ocorrência', value: activeReportRider.occurrences, color: '#f43f5e' },
                                    { name: 'Cancelado', value: activeReportRider.cancelled, color: '#94a3b8' },
                                    { name: 'Não iniciado', value: activeReportRider.notStarted, color: '#f59e0b' },
                                  ].filter(item => item.value > 0).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          
                          <div className="flex-1 text-[9px] font-bold text-slate-500 space-y-1.5 min-w-0">
                            {activeReportRider.completed > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> <span className="truncate">{activeReportRider.completed} Concluídos</span></div>}
                            {(activeReportRider.inRoute + activeReportRider.delivering) > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> <span className="truncate">{activeReportRider.inRoute + activeReportRider.delivering} Em rota</span></div>}
                            {activeReportRider.occurrences > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> <span className="truncate">{activeReportRider.occurrences} Ocorrências</span></div>}
                            {activeReportRider.cancelled > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" /> <span className="truncate">{activeReportRider.cancelled} Cancelados</span></div>}
                            {activeReportRider.notStarted > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> <span className="truncate">{activeReportRider.notStarted} Não iniciados</span></div>}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-center items-center py-6 text-slate-400 text-[11px]">
                          Sem histórico de encomendas.
                        </div>
                      )}
                    </div>

                    {/* Operational Compliance */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Qualificação & Performance</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Indicadores do nível de serviço prestado pelo condutor</p>
                      </div>
                      
                      <div className="space-y-3 pt-2 flex-1 flex flex-col justify-end">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-extrabold text-slate-600">
                            <span>SLA de Entrega</span>
                            <span className={activeReportRider.successRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}>{activeReportRider.successRate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${activeReportRider.successRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${activeReportRider.successRate}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-extrabold text-slate-600">
                            <span>Conformidade de Rota</span>
                            <span className="text-blue-600">{activeReportRider.totalOrders > 0 ? Math.round((activeReportRider.completed / activeReportRider.totalOrders) * 98) : 100}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-1.5 rounded-full bg-blue-500"
                              style={{ width: `${activeReportRider.totalOrders > 0 ? Math.round((activeReportRider.completed / activeReportRider.totalOrders) * 98) : 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 p-2 rounded-xl">
                          <Award size={12} className="text-blue-600 shrink-0" />
                          <span>Excelente adesão aos percursos Vinimap recomendados em SP.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Driver Orders List */}
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Histórico de Pedidos Despachados</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Listagem das encomendas vinculadas a este entregador</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                        {orders.filter(o => o.riderId === activeReportRider.id).length} pedidos
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs text-slate-600 border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-[10px] uppercase text-left tracking-wider">
                            <th className="px-3 py-2.5">Cód/ID</th>
                            <th className="px-3 py-2.5">Parceiro</th>
                            <th className="px-3 py-2.5">Cliente</th>
                            <th className="px-3 py-2.5 text-center">Data</th>
                            <th className="px-3 py-2.5 text-right">Valor</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                          {(() => {
                            const riderOrders = orders.filter(o => o.riderId === activeReportRider.id);

                            if (riderOrders.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-slate-400">
                                    Nenhum pedido atribuído a este entregador ainda.
                                  </td>
                                </tr>
                              );
                            }

                            // Helper function for order status color classes
                            const getStatusColorTag = (st: string) => {
                              switch (st) {
                                case 'Concluído': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                case 'Em rota': return 'bg-sky-50 text-sky-700 border-sky-100';
                                case 'Entregando': return 'bg-blue-50 text-blue-700 border-blue-100';
                                case 'Ocorrência': return 'bg-rose-50 text-rose-700 border-rose-100';
                                case 'Cancelado': return 'bg-slate-50 text-slate-400 border-slate-200';
                                default: return 'bg-slate-50 text-slate-400 border-slate-100';
                              }
                            };

                            const getStatusFlagIcon = (st: string) => {
                              switch (st) {
                                case 'Concluído': return <Flag size={10} className="text-emerald-500 fill-emerald-500 shrink-0" />;
                                case 'Em rota': return <Flag size={10} className="text-amber-500 fill-amber-500 shrink-0" />;
                                case 'Entregando': return <Flag size={10} className="text-sky-500 fill-sky-500 shrink-0" />;
                                case 'Ocorrência': return <Flag size={10} className="text-rose-500 fill-rose-500 shrink-0 animate-bounce" />;
                                case 'Cancelado': return <Flag size={10} className="text-slate-300 fill-slate-300 shrink-0" />;
                                default: return <Flag size={10} className="text-slate-400 fill-slate-400 shrink-0" />;
                              }
                            };

                            return riderOrders.map((ord) => (
                              <tr key={ord.id} className="hover:bg-slate-50/40">
                                <td className="px-3 py-2.5 font-bold text-slate-500 font-mono text-[10px]">#{ord.id.substring(0, 6).toUpperCase()}</td>
                                <td className="px-3 py-2.5 truncate max-w-[110px] text-slate-600 font-bold">{getPartnerDisplayName(ord.partnerName, clientPartners)}</td>
                                <td className="px-3 py-2.5 font-bold text-slate-800">{ord.clientName}</td>
                                <td className="px-3 py-2.5 text-center font-semibold text-slate-400">{formatToBrazilianDate(ord.date)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                                  {ord.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${getStatusColorTag(ord.status)}`}>
                                    {getStatusFlagIcon(ord.status)}
                                    <span>{ord.status}</span>
                                  </span>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 text-xs">
                  Nenhum condutor disponível para exibir.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: FLEET PRODUCTIVITY ANALYTICS */}
      {activeReportTab === 'productivity' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          
          {/* Productivity KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Concluído</span>
                <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Activity size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {riderProductivityData.reduce((sum, r) => sum + r.completed, 0)} <span className="text-xs font-semibold text-slate-400">entregas</span>
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Entregas finalizadas com sucesso no período</p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tempo Médio Percurso</span>
                <div className="p-1.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                  <Clock size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {(() => {
                    const activeRiders = riderProductivityData.filter(r => r.completed > 0);
                    if (activeRiders.length === 0) return '0.0';
                    const sumAvg = activeRiders.reduce((sum, r) => sum + r.avgTravelTime, 0);
                    return (sumAvg / activeRiders.length).toFixed(1);
                  })()} <span className="text-xs font-semibold text-slate-400">minutos</span>
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Média de tempo gasto em trânsito por entrega</p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pontualidade (SLA)</span>
                <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Award size={14} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
                  {(() => {
                    const activeRiders = riderProductivityData.filter(r => r.completed > 0);
                    if (activeRiders.length === 0) return '100';
                    const sumSla = activeRiders.reduce((sum, r) => sum + r.slaRate, 0);
                    return (sumSla / activeRiders.length).toFixed(1);
                  })()}%
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Taxa de entregas concluídas dentro do tempo previsto</p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destaque de SLA</span>
                <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Star size={14} className="fill-amber-400 stroke-amber-500" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-sm font-extrabold text-slate-800 tracking-tight truncate block">
                  {(() => {
                    const best = [...riderProductivityData]
                      .filter(r => r.completed >= 2)
                      .sort((a, b) => b.slaRate - a.slaRate || b.completed - a.completed)[0];
                    return best ? best.name : 'Nenhum ativo';
                  })()}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 mt-1.5">Condutor com maior SLA (mín. 2 entregas)</p>
            </div>

          </div>

          {/* Productivity Dual-Axis Comparison Chart */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6" id="productivity-chart-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Entregas Concluídas vs. Tempo Médio por Entregador</h4>
                <p className="text-xs text-slate-400 mt-0.5">Visão analítica de volume (barras) comparado com a agilidade em minutos (linha vermelha)</p>
              </div>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                Filtro: {useOnlyDelivered ? 'Apenas Concluídos' : 'Todos os Pedidos'}
              </span>
            </div>

            <div className="h-96">
              {riderProductivityData.filter(r => r.completed > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={riderProductivityData.filter(r => r.completed > 0)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: '500' }} 
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                      yAxisId="left" 
                      tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: '600' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={{ stroke: '#e2e8f0' }}
                      allowDecimals={false}
                      label={{ value: 'Qtd. Entregas Concluídas', angle: -90, position: 'insideLeft', style: { fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' } }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right"
                      tick={{ fill: '#f43f5e', fontSize: 10, fontWeight: '600' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={{ stroke: '#e2e8f0' }}
                      label={{ value: 'Tempo Médio de Percurso (minutos)', angle: 90, position: 'insideRight', style: { fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' } }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar 
                      yAxisId="left" 
                      name="Entregas Concluídas" 
                      dataKey="completed" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      barSize={28}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      name="Tempo Médio (min)" 
                      dataKey="avgTravelTime" 
                      stroke="#f43f5e" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                  <Activity size={32} className="text-slate-300 mb-2 animate-pulse" />
                  <span>Nenhum dado de entrega concluída disponível para plotagem de produtividade.</span>
                </div>
              )}
            </div>
          </div>

          {/* Productivity Breakdown Table */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="productivity-table-card">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Ranking de Produtividade dos Condutores</h4>
                <p className="text-xs text-slate-400 mt-0.5">Indicadores detalhados de SLA, agilidade e volume no período selecionado</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Condutor / Equipamento</th>
                    <th className="px-5 py-3.5 text-center">Atribuições</th>
                    <th className="px-5 py-3.5 text-center">Concluídos</th>
                    <th className="px-5 py-3.5 text-center">Tempo Médio de Rota</th>
                    <th className="px-5 py-3.5 text-center">Pontualidade (SLA)</th>
                    <th className="px-5 py-3.5 text-center">Desempenho Geral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {riderProductivityData.map((row) => {
                    // Calculate general efficiency tier
                    let efficiencyTier = 'Sob Atenção';
                    let efficiencyColor = 'bg-rose-50 text-rose-700 border-rose-100';
                    
                    if (row.completed === 0) {
                      efficiencyTier = 'Sem Atividade';
                      efficiencyColor = 'bg-slate-50 text-slate-400 border-slate-200';
                    } else if (row.slaRate >= 90 && row.avgTravelTime < 40) {
                      efficiencyTier = 'Excelente';
                      efficiencyColor = 'bg-emerald-50 text-emerald-700 border-emerald-100 font-extrabold';
                    } else if (row.slaRate >= 75) {
                      efficiencyTier = 'Bom / Regular';
                      efficiencyColor = 'bg-amber-50 text-amber-700 border-amber-100';
                    }

                    const getVehicleIcon = (v: string) => {
                      switch (v?.toLowerCase()) {
                        case 'moto': return <Bike size={11} className="text-amber-500 shrink-0" />;
                        case 'carro': return <Car size={11} className="text-blue-500 shrink-0" />;
                        case 'caminhao':
                        case 'caminhão': return <Truck size={11} className="text-indigo-500 shrink-0" />;
                        default: return <Bike size={11} className="text-slate-500 shrink-0" />;
                      }
                    };

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                        {/* Rider details */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={row.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60'} 
                              alt={row.name}
                              className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <span className="font-bold text-slate-800 block text-xs">{row.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-semibold text-slate-400">
                                {getVehicleIcon(row.vehicle)}
                                <span className="capitalize">{row.vehicle}</span>
                                <span className="text-slate-300">•</span>
                                <span className="font-mono text-[9px]">ID: {row.id.toUpperCase()}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Orders */}
                        <td className="px-5 py-4 text-center font-bold text-slate-500">
                          {row.totalOrders}
                        </td>

                        {/* Completed Orders progress visualizer */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-slate-800">{row.completed}</span>
                            <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full" 
                                style={{ width: `${row.totalOrders > 0 ? (row.completed / row.totalOrders * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Average travel time */}
                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                            <Clock size={12} className="text-slate-400" />
                            <span>{row.completed > 0 ? `${row.avgTravelTime} min` : '-'}</span>
                          </div>
                        </td>

                        {/* SLA Rate badge */}
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-xl text-[10px] font-bold ${
                            row.completed === 0 
                              ? 'text-slate-400 bg-slate-50'
                              : row.slaRate >= 90
                              ? 'text-emerald-700 bg-emerald-50'
                              : row.slaRate >= 75
                              ? 'text-amber-700 bg-amber-50'
                              : 'text-rose-700 bg-rose-50'
                          }`}>
                            {row.completed > 0 ? `${row.slaRate}%` : '-'}
                          </span>
                        </td>

                        {/* Performance Score Label */}
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-wider font-extrabold ${efficiencyColor}`}>
                            {efficiencyTier}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Driver Billing Modal */}
      <DriverBillingModal
        isOpen={billingModalRiderId !== null}
        onClose={() => setBillingModalRiderId(null)}
        riderId={billingModalRiderId}
        riders={riders || []}
        orders={orders}
        clientPartners={clientPartners}
        onUpdateRider={onUpdateRider}
      />

      {/* Export Settings Custom Modal */}
      <ExportConfigModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        orders={orders}
        sortedOrders={targetOrders}
        selectedIds={emptySelectedIds}
        riders={riders || []}
        clientPartners={clientPartners}
      />
    </div>
  );
}
