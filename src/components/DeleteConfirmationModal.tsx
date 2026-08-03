/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, X, CheckSquare, Square } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemDetails?: {
    id?: string;
    clientName?: string;
    address?: string;
  };
  count?: number;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Exclusão',
  description = 'Esta ação é irreversível e apagará permanentemente o registro do banco de dados.',
  itemDetails,
  count = 1
}: DeleteConfirmationModalProps) {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Reset states when open/close changes
  useEffect(() => {
    if (isOpen) {
      setHasAcceptedTerms(false);
      setConfirmText('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!hasAcceptedTerms) return;
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" id="delete-confirmation-modal-container">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            id="delete-confirmation-backdrop"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-md bg-white border border-slate-100 rounded-2xl shadow-2xl p-6 overflow-hidden z-10"
            id="delete-confirmation-card"
          >
            {/* Red accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-500 animate-pulse">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight" id="delete-modal-title">
                    {title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Confirmação de segurança obrigatória</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                id="btn-close-delete-modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Warning Message */}
            <div className="bg-rose-50/40 border border-rose-100/40 rounded-xl p-3.5 mb-5">
              <p className="text-xs font-semibold text-rose-800 leading-relaxed mb-2">
                Atenção: Você está prestes a realizar uma exclusão definitiva.
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {description}
              </p>
            </div>

            {/* Context Details */}
            {count > 1 ? (
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 mb-5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Resumo da exclusão em lote</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">{count} Pedidos Selecionados</span>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">LOTE</span>
                </div>
              </div>
            ) : itemDetails ? (
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 mb-5 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados do Pedido</div>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  <span className="text-slate-400 font-medium">Código:</span>
                  <span className="col-span-2 font-bold text-slate-800">{itemDetails.id}</span>

                  <span className="text-slate-400 font-medium">Cliente:</span>
                  <span className="col-span-2 font-semibold text-slate-700 truncate">{itemDetails.clientName || 'N/A'}</span>

                  <span className="text-slate-400 font-medium">Endereço:</span>
                  <span className="col-span-2 text-slate-500 truncate">{itemDetails.address || 'N/A'}</span>
                </div>
              </div>
            ) : null}

            {/* Extra safety steps */}
            <div className="space-y-4 mb-6">
              {/* Mandatory acceptance checkbox */}
              <button
                type="button"
                onClick={() => setHasAcceptedTerms(!hasAcceptedTerms)}
                className="flex items-start gap-2.5 text-left w-full cursor-pointer focus:outline-none"
                id="btn-accept-delete-terms"
              >
                <div className={`mt-0.5 text-rose-500 transition-colors flex-shrink-0`}>
                  {hasAcceptedTerms ? (
                    <CheckSquare size={16} className="fill-rose-50" />
                  ) : (
                    <Square size={16} className="text-slate-300" />
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-600 select-none leading-normal">
                  Entendo que esta ação é permanente e os dados não podem ser recuperados.
                </span>
              </button>

              {/* Text validation input (only activated when checkbox is checked to keep the flow smooth but secure) */}
              <div className={`space-y-1.5 transition-all duration-200 ${hasAcceptedTerms ? 'opacity-100 scale-100' : 'opacity-40 pointer-events-none scale-98'}`}>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Para confirmar, digite <span className="text-rose-600 select-all">CONFIRMAR</span> abaixo:
                </label>
                <input
                  type="text"
                  placeholder="CONFIRMAR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={!hasAcceptedTerms}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 uppercase bg-slate-50/50"
                  id="input-delete-confirm-text"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                id="btn-cancel-delete"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hasAcceptedTerms || confirmText.trim().toUpperCase() !== 'CONFIRMAR'}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-100 flex items-center justify-center gap-1.5 transition-all cursor-pointer font-extrabold"
                id="btn-confirm-delete-action"
              >
                <Trash2 size={13} />
                <span>Excluir Permanentemente</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
