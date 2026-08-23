/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, ClientPartner, OrderPriority, OrderStatus, DeliveryRider } from '../types';
import { getSaoPauloISODate } from '../utils/dateUtils';
import { X, Save, Edit2, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Order>) => void;
  selectedCount: number;
  clientPartners: ClientPartner[];
  riders: DeliveryRider[];
}

export default function BulkEditModal({ 
  isOpen, 
  onClose, 
  onSave, 
  selectedCount, 
  clientPartners,
  riders
}: BulkEditModalProps) {
  // Toggle states for fields (whether to update them or not)
  const [updatePartner, setUpdatePartner] = useState(false);
  const [updateRegion, setUpdateRegion] = useState(false);
  const [updateDate, setUpdateDate] = useState(false);
  const [updateValue, setUpdateValue] = useState(false);
  const [updatePriority, setUpdatePriority] = useState(false);
  const [updateItemsCount, setUpdateItemsCount] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(false);
  const [updateRider, setUpdateRider] = useState(false);

  // Field values
  const [partnerName, setPartnerName] = useState('');
  const [region, setRegion] = useState('Centro');
  const [date, setDate] = useState(getSaoPauloISODate());
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('Média');
  const [itemsCount, setItemsCount] = useState('1');
  const [status, setStatus] = useState<OrderStatus>('Não iniciado');
  const [riderId, setRiderId] = useState('');

  // Set default field values when modal opens
  useEffect(() => {
    if (isOpen) {
      setUpdatePartner(false);
      setUpdateRegion(false);
      setUpdateDate(false);
      setUpdateValue(false);
      setUpdatePriority(false);
      setUpdateItemsCount(false);
      setUpdateStatus(false);
      setUpdateRider(false);

      setPartnerName(clientPartners?.[0]?.id || 'Outro');
      setRegion('Centro');
      setDate(getSaoPauloISODate());
      setValue('');
      setPriority('Média');
      setItemsCount('1');
      setStatus('Não iniciado');
      setRiderId(riders?.[0]?.id || '');
    }
  }, [isOpen, clientPartners, riders]);

  const handleApply = () => {
    const updates: Partial<Order> = {};
    let hasAnyUpdate = false;

    if (updatePartner) {
      updates.partnerName = partnerName;
      hasAnyUpdate = true;
    }
    if (updateRegion) {
      updates.region = region;
      hasAnyUpdate = true;
    }
    if (updateDate) {
      updates.date = date;
      hasAnyUpdate = true;
    }
    if (updateValue) {
      const orderValue = parseFloat(value.replace(',', '.')) || 0;
      updates.value = orderValue;
      hasAnyUpdate = true;
    }
    if (updatePriority) {
      updates.priority = priority;
      hasAnyUpdate = true;
    }
    if (updateItemsCount) {
      updates.itemsCount = parseInt(itemsCount) || 1;
      hasAnyUpdate = true;
    }
    if (updateStatus) {
      updates.status = status;
      hasAnyUpdate = true;
    }
    if (updateRider) {
      updates.riderId = riderId || undefined;
      hasAnyUpdate = true;
    }

    if (!hasAnyUpdate) {
      alert('Selecione pelo menos um campo para atualizar.');
      return;
    }

    onSave(updates);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="bulk-edit-modal">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-visible modal-content-visible flex flex-col max-h-[90vh] relative z-[100]"
            style={{ overflow: 'visible', zIndex: 100 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Edição em Lote ({selectedCount} itens)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Selecione e altere campos comuns para todos os pedidos selecionados</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Field list form */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* FIELD 1: Client Partner */}
              <div className={`p-3 rounded-2xl border transition-colors ${updatePartner ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updatePartner}
                    onChange={(e) => setUpdatePartner(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Parceiro Estabelecimento</span>
                </label>
                {updatePartner && (
                  <select
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    {clientPartners.map((cp, idx) => (
                      <option key={`be-cp-${cp.id}-${idx}`} value={cp.id}>{cp.name} ({cp.codigoCliente})</option>
                    ))}
                    <option value="Outro">Outro</option>
                  </select>
                )}
              </div>

              {/* FIELD 2: Region */}
              <div className={`p-3 rounded-2xl border transition-colors ${updateRegion ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updateRegion}
                    onChange={(e) => setUpdateRegion(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Região Logística</span>
                </label>
                {updateRegion && (
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="Centro">Centro</option>
                    <option value="Zona Sul">Zona Sul</option>
                    <option value="Zona Oeste">Zona Oeste</option>
                    <option value="Zona Norte">Zona Norte</option>
                  </select>
                )}
              </div>

              {/* FIELD 3: Date */}
              <div className={`p-3 rounded-2xl border transition-colors ${updateDate ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updateDate}
                    onChange={(e) => setUpdateDate(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Data do Pedido</span>
                </label>
                {updateDate && (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* FIELD 4: Value */}
              <div className={`p-3 rounded-2xl border transition-colors ${updateValue ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updateValue}
                    onChange={(e) => setUpdateValue(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Valor do Pedido (R$)</span>
                </label>
                {updateValue && (
                  <input
                    type="text"
                    value={value}
                    placeholder="29.90"
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* FIELD 5: Priority */}
              <div className={`p-3 rounded-2xl border transition-colors ${updatePriority ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updatePriority}
                    onChange={(e) => setUpdatePriority(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Prioridade</span>
                </label>
                {updatePriority && (
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as OrderPriority)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                    <option value="expresso">⚡ Expresso</option>
                  </select>
                )}
              </div>

              {/* FIELD 6: Items Count */}
              <div className={`p-3 rounded-2xl border transition-colors ${updateItemsCount ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updateItemsCount}
                    onChange={(e) => setUpdateItemsCount(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Quantidade de Itens</span>
                </label>
                {updateItemsCount && (
                  <input
                    type="number"
                    min="1"
                    value={itemsCount}
                    onChange={(e) => setItemsCount(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* FIELD 7: Status */}
              <div className={`p-3 rounded-2xl border transition-colors ${updateStatus ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar Status</span>
                </label>
                {updateStatus && (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="Não iniciado">Não iniciado</option>
                    <option value="Em rota">Em rota</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Ocorrência">Ocorrência</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                )}
              </div>

              {/* FIELD 8: Rider */}
              <div className={`p-3 rounded-2xl border transition-colors modal-dropdown relative z-[9999] ${updateRider ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-100'}`} style={{ overflow: 'visible', zIndex: 9999 }}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={updateRider}
                    onChange={(e) => setUpdateRider(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Alocar Entregador</span>
                </label>
                {updateRider && (
                  <select
                    value={riderId}
                    onChange={(e) => setRiderId(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 bg-white modal-rider-select relative z-[9999]"
                    style={{ overflow: 'visible', zIndex: 9999 }}
                  >
                    <option value="">Desalocar entregador (Vazio)</option>
                    {riders.map((r, idx) => (
                      <option key={`be-rider-${r.id}-${idx}`} value={r.id}>{r.name} ({r.vehicle})</option>
                    ))}
                  </select>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-indigo-200 cursor-pointer transition-colors"
              >
                <Save size={14} />
                <span>Aplicar a {selectedCount} Pedidos</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
