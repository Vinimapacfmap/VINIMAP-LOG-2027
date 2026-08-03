import React, { useMemo, useState } from 'react';
import { Order, ClientPartner, isMatchingClientCode } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Store, TrendingUp, DollarSign, Package, Award, ArrowUpDown, Filter } from 'lucide-react';

interface RevenueByPartnerChartProps {
  orders: Order[];
  clientPartners: ClientPartner[];
}

type SortOption = 'revenue' | 'orders' | 'avgTicket';

const BAR_COLORS = [
  '#2563eb', // blue-600
  '#0d9488', // teal-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#d97706', // amber-600
  '#059669', // emerald-600
  '#4f46e5', // indigo-600
  '#0284c7', // sky-600
];

export const RevenueByPartnerChart: React.FC<RevenueByPartnerChartProps> = ({
  orders,
  clientPartners
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('revenue');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed'>('all');
  const [topLimit, setTopLimit] = useState<number>(10);

  // Helper to resolve partner display name
  const getPartnerName = (orderPartner: string): string => {
    if (!orderPartner) return 'Parceiro Geral';
    if (clientPartners && clientPartners.length > 0) {
      const matched = clientPartners.find(cp => 
        isMatchingClientCode(orderPartner, cp.id, cp.codigoCliente) ||
        cp.name?.toLowerCase() === orderPartner.toLowerCase() ||
        cp.codigoCliente?.toLowerCase() === orderPartner.toLowerCase()
      );
      if (matched && matched.name) {
        return matched.name;
      }
    }
    return orderPartner;
  };

  // Group and compute metrics per partner
  const { chartData, totalRevenueAll, topPartner, totalPartnersCount } = useMemo(() => {
    const map = new Map<string, {
      partnerName: string;
      totalRevenue: number;
      completedRevenue: number;
      orderCount: number;
      completedCount: number;
      adminRetention: number;
      riderPayout: number;
    }>();

    const filtered = statusFilter === 'completed' 
      ? orders.filter(o => o.status === 'Concluído')
      : orders;

    filtered.forEach(o => {
      const displayName = getPartnerName(o.partnerName);
      const val = o.value || 0;
      const isAdmin = val * 0.15;
      const isRider = val * 0.85;

      const existing = map.get(displayName) || {
        partnerName: displayName,
        totalRevenue: 0,
        completedRevenue: 0,
        orderCount: 0,
        completedCount: 0,
        adminRetention: 0,
        riderPayout: 0
      };

      existing.totalRevenue += val;
      existing.orderCount += 1;
      existing.adminRetention += isAdmin;
      existing.riderPayout += isRider;

      if (o.status === 'Concluído') {
        existing.completedRevenue += val;
        existing.completedCount += 1;
      }

      map.set(displayName, existing);
    });

    const list = Array.from(map.values()).map(item => ({
      ...item,
      avgTicket: item.orderCount > 0 ? item.totalRevenue / item.orderCount : 0,
      formattedRevenue: item.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      formattedAvgTicket: (item.orderCount > 0 ? item.totalRevenue / item.orderCount : 0)
        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    }));

    // Sort list based on user preference
    list.sort((a, b) => {
      if (sortBy === 'revenue') return b.totalRevenue - a.totalRevenue;
      if (sortBy === 'orders') return b.orderCount - a.orderCount;
      if (sortBy === 'avgTicket') return b.avgTicket - a.avgTicket;
      return 0;
    });

    const totalRev = list.reduce((acc, curr) => acc + curr.totalRevenue, 0);
    const top = list[0] || null;

    return {
      chartData: list.slice(0, topLimit),
      totalRevenueAll: totalRev,
      topPartner: top,
      totalPartnersCount: list.length
    };
  }, [orders, clientPartners, sortBy, statusFilter, topLimit]);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-6 animate-fade-in" id="grafico-faturamento-parceiros">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Store size={18} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-base">Faturamento por Parceiro / Cliente</h4>
              <p className="text-xs text-slate-400">Análise de receita bruta e volume de entregas por estabelecimento parceiro</p>
            </div>
          </div>
        </div>

        {/* Control bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos Pedidos
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Apenas Concluídos
            </button>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
            <ArrowUpDown size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="revenue">Faturamento (R$)</option>
              <option value="orders">Volume Pedidos</option>
              <option value="avgTicket">Ticket Médio</option>
            </select>
          </div>

          {/* Top Limit */}
          <select
            value={topLimit}
            onChange={(e) => setTopLimit(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl focus:outline-none cursor-pointer"
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Todos os Parceiros</option>
          </select>
        </div>
      </div>

      {/* Mini KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0">
            <DollarSign size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Mapeado</span>
            <span className="text-sm font-extrabold text-slate-800">
              {totalRevenueAll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
            <Award size={16} />
          </div>
          <div className="truncate">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Maior Faturamento</span>
            <span className="text-sm font-extrabold text-slate-800 truncate block">
              {topPartner ? `${topPartner.partnerName} (${topPartner.formattedRevenue})` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 text-violet-700 rounded-xl shrink-0">
            <Store size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Parceiros Ativos</span>
            <span className="text-sm font-extrabold text-slate-800">
              {totalPartnersCount} estabelecimentos
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      {chartData.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs font-medium bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
          Nenhum registro de pedido disponível para gerar o gráfico de parceiros.
        </div>
      ) : (
        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="partnerName" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} 
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                angle={-25}
                textAnchor="end"
                interval={0}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }} 
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                tickFormatter={(val) => `R$ ${val}`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
                        <p className="font-extrabold text-blue-400 border-b border-slate-800 pb-1">{data.partnerName}</p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-400">Faturamento Total:</span>
                          <span className="font-bold text-emerald-400">{data.formattedRevenue}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-400">Volume de Pedidos:</span>
                          <span className="font-bold text-slate-200">{data.orderCount} entregas</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-400">Ticket Médio:</span>
                          <span className="font-bold text-amber-300">{data.formattedAvgTicket}</span>
                        </p>
                        <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                          <span>Retenção (15%): R$ {data.adminRetention.toFixed(2)}</span>
                          <span>Repasse (85%): R$ {data.riderPayout.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                align="right"
                wrapperStyle={{ paddingBottom: '15px', fontSize: '11px', fontWeight: 600 }}
              />
              <Bar 
                dataKey="totalRevenue" 
                name="Faturamento Total (R$)" 
                radius={[6, 6, 0, 0]}
                barSize={32}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
