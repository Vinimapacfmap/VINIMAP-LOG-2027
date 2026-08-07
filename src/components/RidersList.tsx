/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { DeliveryRider, Order } from '../types';
import { useCalculatedRiders } from '../hooks/useRiderCompletedDeliveries';
import { 
  Search, 
  Star, 
  Battery, 
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

interface RidersListProps {
  riders: DeliveryRider[];
  selectedRiderId: string | null;
  setSelectedRiderId: (id: string | null) => void;
  orders?: Order[];
}

interface RiderItemProps {
  rider: DeliveryRider;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const RiderItem = memo(function RiderItem({ rider, isSelected, onSelect }: RiderItemProps) {
  const batteryLow = rider.batteryPercent <= 20 && rider.status !== 'Offline';

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'Disponível':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Em rota':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Alerta':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Disponível': return 'bg-emerald-500';
      case 'Em rota': return 'bg-blue-500';
      case 'Alerta': return 'bg-rose-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <button
      onClick={() => onSelect(rider.id)}
      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer group ${
        isSelected 
          ? 'border-blue-500 bg-blue-50/20 shadow-md ring-2 ring-blue-50' 
          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
      }`}
      id={`riders-list-item-${rider.id}`}
    >
      {/* Left Details */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <img
            src={rider.avatar}
            alt={rider.name}
            className="w-9 h-9 rounded-full object-cover border border-slate-200"
            referrerPolicy="no-referrer"
          />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${getStatusDot(rider.status)}`} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-slate-800 truncate group-hover:text-blue-600 transition-colors">
              {rider.name}
            </span>
            {batteryLow && (
              <span title="Bateria Crítica!">
                <ShieldAlert size={12} className="text-rose-500 animate-pulse shrink-0" />
              </span>
            )}
          </div>
          
          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
            <span>{rider.vehicle}</span>
            <span>•</span>
            <span className="flex items-center gap-0.5 text-amber-500">
              <Star size={10} className="fill-amber-500 stroke-amber-500 shrink-0" />
              <strong>{rider.rating.toFixed(1)}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-extrabold flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100/80">
              <CheckCircle2 size={10} className="shrink-0 text-emerald-600" />
              {rider.completedDeliveries} {rider.completedDeliveries === 1 ? 'concluída' : 'concluídas'}
            </span>
          </p>
        </div>
      </div>

      {/* Right Details / Status Badge */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`px-2 py-0.5 text-[9px] font-extrabold border rounded-full uppercase tracking-wider ${getStatusClasses(rider.status)}`}>
          {rider.status}
        </span>
        <span className="text-[9px] text-slate-400 font-mono font-bold flex items-center gap-1">
          <Battery size={10} className={batteryLow ? 'text-rose-500' : 'text-slate-400'} />
          {rider.batteryPercent}%
        </span>
      </div>
    </button>
  );
});

function RidersList({ riders, selectedRiderId, setSelectedRiderId, orders = [] }: RidersListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Automatically recalculate completed deliveries in real time based strictly on orders with status 'Concluído'
  const calculatedRiders = useCalculatedRiders(riders, orders);

  // Total completed across all riders dynamically
  const totalCompletedInTurn = useMemo(() => {
    return calculatedRiders.reduce((acc, r) => acc + (r.completedDeliveries || 0), 0);
  }, [calculatedRiders]);

  // Filter riders based on search name or vehicle type with useMemo
  const filteredRiders = useMemo(() => {
    return (calculatedRiders || []).filter(r => {
      if (!r) return false;
      const query = (searchTerm || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const vehicle = (r.vehicle || '').toLowerCase();
      const status = (r.status || '').toLowerCase();
      return (
        name.includes(query) ||
        vehicle.includes(query) ||
        status.includes(query)
      );
    });
  }, [calculatedRiders, searchTerm]);

  const handleSelect = useCallback((id: string) => {
    setSelectedRiderId(selectedRiderId === id ? null : id);
  }, [selectedRiderId, setSelectedRiderId]);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col justify-between h-[500px]" id="riders-list-container">
      
      {/* Header and Search */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Entregadores Ativos</h3>
            <p className="text-xs text-slate-400 mt-0.5">Controle de frota e rastreamento de parceiros</p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
            {riders.length} Cadastrados
          </span>
        </div>

        {/* Small in-card filter search bar */}
        <div className="relative group" id="riders-search-box">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Filtrar por nome, veículo, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Riders List Viewport */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1" id="riders-scroll-area">
        {filteredRiders.map((rider) => (
          <RiderItem
            key={rider.id}
            rider={rider}
            isSelected={selectedRiderId === rider.id}
            onSelect={handleSelect}
          />
        ))}

        {filteredRiders.length === 0 && (
          <div className="text-center py-12 text-[11px] font-semibold text-slate-400">
            Nenhum entregador corresponde ao filtro.
          </div>
        )}
      </div>

      {/* Quick Action Footer */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px]" id="riders-footer">
        <span className="text-slate-400 font-bold uppercase tracking-wider">Desempenho no Turno</span>
        <span className="font-extrabold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
          <CheckCircle2 size={12} className="text-emerald-600" />
          {totalCompletedInTurn} {totalCompletedInTurn === 1 ? 'Entrega Concluída' : 'Entregas Concluídas'}
        </span>
      </div>

    </div>
  );
}

export default memo(RidersList);
