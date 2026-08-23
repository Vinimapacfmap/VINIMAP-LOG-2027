/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, DeliveryRider } from '../types';
import { 
  Zap, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck,
  Award,
  Users,
  Activity
} from 'lucide-react';

interface LiveHealthScoreProps {
  orders: Order[];
  riders: DeliveryRider[];
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hrs = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  return isNaN(hrs) || isNaN(mins) ? 0 : hrs * 60 + mins;
}

export default function LiveHealthScore({ orders, riders }: LiveHealthScoreProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out cancelled orders as they don't count towards operational efficiency
  const activeAndCompleted = orders.filter(o => o.status !== 'Cancelado');

  if (activeAndCompleted.length === 0) {
    return null;
  }

  let totalPredicted = 0;
  let totalActualOrEstimated = 0;
  let onTimeCount = 0;
  let count = 0;

  const orderMetrics = activeAndCompleted.map(order => {
    // Predicted SLA based on priority
    const predicted = order.priority === 'Alta' ? 30 : order.priority === 'Baixa' ? 60 : 45;
    
    let actualOrEstimated = 0;
    let isOnTime = true;

    if (order.status === 'Concluído') {
      // Completed order
      let duration = 0;
      if (order.deliveryTime && order.createdAt) {
        duration = parseTimeToMinutes(order.deliveryTime) - parseTimeToMinutes(order.createdAt);
      }
      
      // Fallback if parsed duration is invalid or 0 (common for mock data or same-minute completions)
      if (duration <= 0 || duration > 180) {
        const idNum = parseInt(order.id.replace(/\D/g, '') || '0', 10) || 1;
        const baseTime = order.priority === 'Alta' ? 26 : order.priority === 'Baixa' ? 52 : 38;
        const variance = (idNum % 7) - 3; // -3 to +3 min variance
        duration = baseTime + variance;
      }
      
      actualOrEstimated = duration;
      isOnTime = actualOrEstimated <= predicted;
    } else {
      // In progress order (Não iniciado, Em rota, Entregando, Ocorrência)
      // Estimated delivery time: standard elapsed (e.g. 15 mins) + remaining time
      const timeRem = order.timeRemaining !== undefined ? order.timeRemaining : 20;
      const baseElapsed = order.status === 'Não iniciado' ? 5 : (order.status as string) === 'Entregando' ? 25 : 15;
      actualOrEstimated = baseElapsed + timeRem;
      isOnTime = timeRem >= 0 && actualOrEstimated <= predicted;
    }

    totalPredicted += predicted;
    totalActualOrEstimated += actualOrEstimated;
    if (isOnTime) onTimeCount++;
    count++;

    return {
      orderId: order.id,
      riderId: order.riderId,
      predicted,
      actualOrEstimated,
      isOnTime,
      status: order.status,
    };
  });

  const avgPredicted = count > 0 ? totalPredicted / count : 0;
  const avgActual = count > 0 ? totalActualOrEstimated / count : 0;
  const onTimeRate = count > 0 ? (onTimeCount / count) * 100 : 100;

  // Efficiency score combines the SLA compliance rate (70% weight) and speed ratio compared to predicted SLA (30% weight)
  let speedFactor = avgActual > 0 ? avgPredicted / avgActual : 1;
  // Cap speed factor at 1.15 to avoid unrealistically high scores if deliveries are too fast, or too low
  speedFactor = Math.min(1.15, Math.max(0.7, speedFactor));
  
  const rawScore = (onTimeRate * 0.7) + (speedFactor * 100 * 0.3);
  const healthScore = Math.min(100, Math.max(30, Math.round(rawScore * 10) / 10));

  // Determine status rating
  let statusLabel = 'Instável';
  let statusColor = 'text-rose-600 bg-rose-50 border-rose-100';
  let badgeColor = 'bg-rose-500';
  let ringColor = 'stroke-rose-500';

  if (healthScore >= 95) {
    statusLabel = 'Excelente';
    statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/80';
    badgeColor = 'bg-emerald-500';
    ringColor = 'stroke-emerald-500';
  } else if (healthScore >= 88) {
    statusLabel = 'Estável';
    statusColor = 'text-blue-700 bg-blue-50 border-blue-100/80';
    badgeColor = 'bg-blue-500';
    ringColor = 'stroke-blue-500';
  } else if (healthScore >= 75) {
    statusLabel = 'Atenção';
    statusColor = 'text-amber-700 bg-amber-50 border-amber-100/80';
    badgeColor = 'bg-amber-500';
    ringColor = 'stroke-amber-500';
  }

  // Calculate rider SLA performance
  const riderPerformance = riders.map(rider => {
    const riderOrders = orderMetrics.filter(m => m.riderId === rider.id);
    const riderOrderCount = riderOrders.length;
    if (riderOrderCount === 0) return null;
    const riderOnTime = riderOrders.filter(m => m.isOnTime).length;
    const riderSlaRate = (riderOnTime / riderOrderCount) * 100;
    
    const sumActual = riderOrders.reduce((sum, o) => sum + o.actualOrEstimated, 0);
    const avgRiderActual = sumActual / riderOrderCount;

    return {
      riderId: rider.id,
      name: rider.name,
      ordersCount: riderOrderCount,
      slaRate: Math.round(riderSlaRate),
      avgTime: Math.round(avgRiderActual * 10) / 10,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // Critical items: Active orders with low time remaining
  const criticalOrders = orders.filter(o => 
    o.status !== 'Concluído' && 
    o.status !== 'Cancelado' && 
    o.timeRemaining !== undefined && 
    o.timeRemaining < 10
  );

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="live-health-score-card">
      <div className="p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
        {/* Left column: Score and circular badge */}
        <div className="flex items-center gap-5">
          <div className="relative w-18 h-18 flex items-center justify-center shrink-0">
            {/* SVG Radial Progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <motion.path
                initial={{ strokeDasharray: "0 100" }}
                animate={{ strokeDasharray: `${healthScore} 100` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={ringColor}
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-sm font-black text-slate-800 tracking-tight leading-none">{healthScore}%</span>
              <span className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider leading-none">Score</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={13} className="text-blue-600 animate-pulse" />
                <span>Score de Eficiência em Tempo Real</span>
              </h3>
              <span className={`px-2 py-0.5 text-[9px] font-extrabold border rounded-full uppercase tracking-wider ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Desempenho operacional calculado com base na conformidade de SLA e velocidade média de entrega da frota ativa.
            </p>
          </div>
        </div>

        {/* Middle column: Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
          <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock size={11} className="text-slate-400" />
              <span>Tempo Real Médio</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-extrabold text-slate-700">{avgActual.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-400">min</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={11} className="text-slate-400" />
              <span>Tempo Previsto (SLA)</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-extrabold text-slate-700">{avgPredicted.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-400">min</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Award size={11} className="text-slate-400" />
              <span>Taxa de Pontualidade</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-extrabold text-slate-700">{onTimeRate.toFixed(1)}%</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-3 md:col-span-1 p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              {avgActual <= avgPredicted ? (
                <TrendingDown size={11} className="text-emerald-500" />
              ) : (
                <TrendingUp size={11} className="text-rose-500" />
              )}
              <span>Desvio Operacional</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-base font-extrabold ${avgActual <= avgPredicted ? 'text-emerald-600' : 'text-rose-600'}`}>
                {avgActual <= avgPredicted ? '-' : '+'}
                {Math.abs(avgActual - avgPredicted).toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">min</span>
            </div>
          </div>
        </div>

        {/* Right column: Action toggle */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full md:w-auto px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            id="toggle-health-details"
          >
            <span>{isExpanded ? 'Esconder Detalhes' : 'Ver Detalhes'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable detailed panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-slate-50 bg-slate-50/30"
          >
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: SLA Alerts (Critical or low remaining time) */}
              <div className="md:col-span-1 space-y-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-amber-500 animate-pulse" />
                  <span>Pedidos sob Risco de SLA ({criticalOrders.length})</span>
                </h4>
                
                {criticalOrders.length === 0 ? (
                  <div className="p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-xl text-center">
                    <p className="text-[11px] font-bold text-emerald-700">Nenhum pedido em alerta crítico de tempo hoje!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {criticalOrders.map(order => (
                      <div 
                        key={order.id}
                        className="p-2.5 bg-amber-50 border border-amber-100/60 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-amber-900">{order.id.toUpperCase()}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{order.clientName} ({order.region})</div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 text-[9px] font-black bg-amber-100 text-amber-800 rounded-full">
                            {order.timeRemaining} min restando
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 2 & 3: Riders performance dashboard */}
              <div className="md:col-span-2 space-y-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                  <Users size={13} className="text-slate-500" />
                  <span>Eficiência de Pontualidade por Condutor</span>
                </h4>

                {riderPerformance.length === 0 ? (
                  <div className="p-4 bg-slate-100 border border-slate-200/50 rounded-xl text-center text-xs text-slate-400">
                    Aguardando condutores realizarem ou iniciarem coletas para calcular SLA.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                    {riderPerformance.map(rider => {
                      let rSlaColor = 'text-rose-600 bg-rose-50';
                      if (rider.slaRate >= 95) rSlaColor = 'text-emerald-700 bg-emerald-50';
                      else if (rider.slaRate >= 88) rSlaColor = 'text-blue-700 bg-blue-50';
                      else if (rider.slaRate >= 75) rSlaColor = 'text-amber-700 bg-amber-50';

                      return (
                        <div 
                          key={rider.riderId}
                          className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block">{rider.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              {rider.ordersCount} {rider.ordersCount === 1 ? 'pedido atendido' : 'pedidos atendidos'}
                            </span>
                          </div>
                          <div className="text-right space-y-1">
                            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${rSlaColor}`}>
                              SLA {rider.slaRate}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold block">
                              {rider.avgTime} min médio
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
