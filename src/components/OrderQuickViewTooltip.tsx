/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * OrderQuickViewTooltip
 * Provides an elegant hover-on quick-view summary card for order cards and rows,
 * highlighting item count, customer contact info, delivery address, assigned driver,
 * and real-time estimated arrival time (ETA).
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Phone,
  Mail,
  MapPin,
  Clock,
  User,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  DollarSign
} from 'lucide-react';
import { Order, DeliveryRider } from '../types';
import { getOrderContactInfo, generateWhatsappUrl } from '../utils/notificationUtils';

interface OrderQuickViewTooltipProps {
  order: Order;
  rider?: DeliveryRider;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  align?: 'auto' | 'top' | 'bottom' | 'right' | 'left';
}

export const OrderQuickViewTooltip: React.FC<OrderQuickViewTooltipProps> = ({
  order,
  rider,
  children,
  className = '',
  disabled = false,
  align = 'auto'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    placement: 'bottom'
  });
  const [copiedAddress, setCopiedAddress] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<any>(null);

  const contact = getOrderContactInfo(order);

  // Compute Estimated Arrival Time (ETA)
  const computeETA = () => {
    if (order.status === 'Concluído') {
      return {
        label: 'Entregue / Concluído',
        timeText: order.date ? `${formatDateBr(order.date)}` : 'Hoje',
        statusType: 'success' as const,
        description: order.protocolNumber ? `Protocolo: #${order.protocolNumber}` : 'Entrega confirmada'
      };
    }
    if (order.status === 'Cancelado') {
      return {
        label: 'Pedido Cancelado',
        timeText: 'Cancelado',
        statusType: 'danger' as const,
        description: 'Entrega cancelada'
      };
    }
    if (order.status === 'Ocorrência') {
      return {
        label: 'Ocorrência Operacional',
        timeText: 'Pendente',
        statusType: 'warning' as const,
        description: 'Verifique os detalhes da ocorrência'
      };
    }

    const minutesRemaining = order.timeRemaining !== undefined && order.timeRemaining > 0 
      ? order.timeRemaining 
      : order.status === 'Em rota' ? 25 : order.status === 'Entregando' ? 10 : 45;

    const now = new Date();
    const etaDate = new Date(now.getTime() + minutesRemaining * 60000);
    const etaFormatted = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (order.status === 'Entregando') {
      return {
        label: 'Chegada Iminente',
        timeText: `~${minutesRemaining} min (Previsão: ${etaFormatted})`,
        statusType: 'urgent' as const,
        description: 'Entregador no local ou nas imediações'
      };
    }

    if (order.status === 'Em rota') {
      return {
        label: 'Previsão de Chegada (ETA)',
        timeText: `~${minutesRemaining} min (${etaFormatted})`,
        statusType: 'info' as const,
        description: 'Em deslocamento para o destino'
      };
    }

    return {
      label: 'Tempo Estimado de Rota',
      timeText: `~${minutesRemaining} min pós-despacho`,
      statusType: 'neutral' as const,
      description: 'Aguardando início do trajeto'
    };
  };

  const eta = computeETA();

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipWidth = 340;
        const tooltipHeight = 280;
        const padding = 12;

        let placement: 'top' | 'bottom' = 'bottom';
        let top = rect.bottom + 8;

        // Check if there is enough space below
        if (align === 'top' || (align === 'auto' && window.innerHeight - rect.bottom < tooltipHeight && rect.top > tooltipHeight)) {
          placement = 'top';
          top = rect.top - tooltipHeight - 8;
        }

        // Horizontal positioning: align center with fallback
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        if (left < padding) left = padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
          left = window.innerWidth - tooltipWidth - padding;
        }

        setCoords({ top, left, placement });
        setIsVisible(true);
      }
    }, 180);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText = `${order.address}, CEP ${order.cep || ''} - ${order.region || ''}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    });
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block ${className}`}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <div className="fixed z-9999 pointer-events-auto" style={{ top: `${coords.top}px`, left: `${coords.left}px` }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: coords.placement === 'bottom' ? -6 : 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-[340px] bg-slate-900/95 text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md p-4 text-xs font-sans overflow-hidden"
              onMouseEnter={() => setIsVisible(true)}
              onMouseLeave={() => setIsVisible(false)}
            >
              {/* Header: ID, Priority & Status */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-black text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-lg border border-blue-800 text-[11px] shrink-0">
                    #{order.id.replace('ped-', '')}
                  </span>
                  {order.partnerName && (
                    <span className="text-[10px] text-amber-300 font-bold truncate flex items-center gap-1">
                      <Building2 size={11} className="shrink-0" />
                      <span className="truncate">{order.partnerName}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {order.priority && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                      order.priority.toLowerCase() === 'alta' || order.priority.toLowerCase() === 'expresso'
                        ? 'bg-red-950/80 text-red-300 border-red-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {order.priority}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex items-center gap-1 ${
                    order.status === 'Concluído'
                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                      : order.status === 'Em rota'
                      ? 'bg-blue-950/90 text-blue-300 border-blue-700'
                      : order.status === 'Entregando'
                      ? 'bg-purple-950/90 text-purple-300 border-purple-700'
                      : order.status === 'Ocorrência'
                      ? 'bg-amber-950/90 text-amber-300 border-amber-700'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {order.status === 'Concluído' && <CheckCircle2 size={10} />}
                    {order.status === 'Ocorrência' && <AlertTriangle size={10} />}
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Grid 1: Items Count & Monetary Value */}
              <div className="grid grid-cols-2 gap-2 my-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Package size={14} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Volumes / Itens</span>
                    <span className="font-extrabold text-slate-100 text-xs">
                      {order.itemsCount || 1} {order.itemsCount === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <DollarSign size={14} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Valor do Pedido</span>
                    <span className="font-extrabold text-emerald-400 text-xs">
                      {order.value ? formatCurrency(order.value) : 'R$ 0,00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ETA / Arrival Time Section */}
              <div className={`p-2.5 rounded-xl border mb-2.5 flex items-start gap-2.5 ${
                eta.statusType === 'urgent'
                  ? 'bg-purple-950/50 border-purple-800/80 text-purple-200'
                  : eta.statusType === 'success'
                  ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-200'
                  : eta.statusType === 'warning'
                  ? 'bg-amber-950/50 border-amber-800/80 text-amber-200'
                  : 'bg-blue-950/50 border-blue-800/80 text-blue-200'
              }`}>
                <div className="mt-0.5 shrink-0">
                  <Clock size={15} className={
                    eta.statusType === 'urgent' ? 'text-purple-400 animate-pulse' :
                    eta.statusType === 'success' ? 'text-emerald-400' :
                    eta.statusType === 'warning' ? 'text-amber-400' : 'text-blue-400'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">{eta.label}</span>
                    <span className="font-black text-[11px] tracking-tight">{eta.timeText}</span>
                  </div>
                  <p className="text-[10px] opacity-75 leading-tight mt-0.5 truncate">{eta.description}</p>
                </div>
              </div>

              {/* Customer Contact Details */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="font-extrabold text-slate-100 text-xs truncate">
                      {order.clientName || 'Cliente Consumidor'}
                    </span>
                  </div>

                  {/* Direct Contact Actions (WhatsApp / Phone) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {contact.hasPhone && (
                      <>
                        <a
                          href={generateWhatsappUrl(contact.cleanPhoneDigits, `Olá ${order.clientName}, referente à entrega do seu pedido #${order.id}:`)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all"
                          title="Abrir WhatsApp com cliente"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageSquare size={12} />
                        </a>
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-1 rounded bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white transition-all"
                          title="Ligar para cliente"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone size={12} />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Phone & Email text */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
                  {contact.phone ? (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone size={10} className="text-slate-500" />
                      {contact.phone}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic text-[10px]">Sem telefone informado</span>
                  )}

                  {contact.email && (
                    <span className="flex items-center gap-1 truncate max-w-[170px]" title={contact.email}>
                      <Mail size={10} className="text-slate-500 shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </span>
                  )}
                </div>

                {/* Address & Copy helper */}
                <div className="flex items-start gap-1.5 text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <MapPin size={12} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-semibold line-clamp-2 leading-tight">
                      {order.address}
                    </p>
                    <div className="flex items-center justify-between gap-1 mt-1 text-slate-500">
                      <span>{order.cep ? `CEP: ${order.cep}` : ''} {order.region ? `• ${order.region}` : ''}</span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="hover:text-blue-400 inline-flex items-center gap-1 font-bold transition-colors cursor-pointer text-[9px]"
                      >
                        {copiedAddress ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                        <span>{copiedAddress ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Assigned Driver row if present */}
                {rider && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <img src={rider.avatar} alt={rider.name} className="w-4 h-4 rounded-full object-cover border border-slate-600" />
                      <span className="text-slate-300 font-bold truncate">Condutor: {rider.name}</span>
                    </div>
                    <span className="text-slate-500 font-medium shrink-0">{rider.vehicle}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDateBr(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default OrderQuickViewTooltip;
