/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Order, ClientPartner, OrderPriority } from '../types';
import { getSaoPauloISODate } from '../utils/dateUtils';
import { X, Plus, Trash2, Save, Sparkles, Clipboard, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newOrders: Omit<Order, 'id' | 'status' | 'createdAt'>[]) => void;
  clientPartners: ClientPartner[];
}

interface TempOrderRow {
  key: string; // unique react key
  clientName: string;
  phone: string;
  address: string;
  region: string;
  priority: OrderPriority;
  value: string;
  itemsCount: string;
  date: string;
  cep: string;
  partnerName: string;
}

export default function BulkCreateModal({ isOpen, onClose, onSubmit, clientPartners }: BulkCreateModalProps) {
  const [rows, setRows] = useState<TempOrderRow[]>([]);
  const [pasteArea, setPasteArea] = useState('');
  const [showPasteForm, setShowPasteForm] = useState(false);
  const [quickFillColumn, setQuickFillColumn] = useState<string>('partnerName');
  const [quickFillValue, setQuickFillValue] = useState<string>('');

  // Reset/Initialize with 3 empty rows when opened
  useEffect(() => {
    if (isOpen) {
      const defaultPartner = clientPartners?.[0]?.id || 'Outro';
      const initialRows: TempOrderRow[] = Array.from({ length: 3 }).map((_, i) => ({
        key: `row-${Date.now()}-${i}`,
        clientName: '',
        phone: '(11) 99999-9999',
        address: '',
        region: 'Centro',
        priority: 'Média',
        value: '',
        itemsCount: '1',
        date: getSaoPauloISODate(),
        cep: '01310-100',
        partnerName: defaultPartner,
      }));
      setRows(initialRows);
      setPasteArea('');
      setShowPasteForm(false);
    }
  }, [isOpen, clientPartners]);

  // Sync quickFillValue default if column changes
  useEffect(() => {
    if (quickFillColumn === 'partnerName') {
      setQuickFillValue(clientPartners?.[0]?.id || 'Outro');
    } else if (quickFillColumn === 'region') {
      setQuickFillValue('Centro');
    } else if (quickFillColumn === 'priority') {
      setQuickFillValue('Média');
    } else if (quickFillColumn === 'date') {
      setQuickFillValue(getSaoPauloISODate());
    } else {
      setQuickFillValue('');
    }
  }, [quickFillColumn, clientPartners]);

  const addRow = () => {
    const defaultPartner = clientPartners?.[0]?.id || 'Outro';
    const newRow: TempOrderRow = {
      key: `row-${Date.now()}-${Math.random()}`,
      clientName: '',
      phone: '(11) 99999-9999',
      address: '',
      region: 'Centro',
      priority: 'Média',
      value: '',
      itemsCount: '1',
      date: getSaoPauloISODate(),
      cep: '01310-100',
      partnerName: defaultPartner,
    };
    setRows([...rows, newRow]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      alert('É necessário manter pelo menos uma linha para criação.');
      return;
    }
    const copy = [...rows];
    copy.splice(index, 1);
    setRows(copy);
  };

  const updateRowField = (index: number, field: keyof TempOrderRow, val: string) => {
    const copy = [...rows];
    copy[index] = {
      ...copy[index],
      [field]: val
    };
    setRows(copy);
  };

  // Bulk quick-fill column
  const handleQuickFill = () => {
    if (!quickFillValue.trim()) {
      alert('Por favor, informe um valor para o preenchimento rápido.');
      return;
    }

    const updated = rows.map(r => ({
      ...r,
      [quickFillColumn]: quickFillValue
    }));
    setRows(updated);
  };

  // CSV/TSV Text Area parser
  const handleImportText = () => {
    if (!pasteArea.trim()) {
      alert('Cole o texto antes de clicar em importar.');
      return;
    }

    // Split into lines
    const lines = pasteArea.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedRows: TempOrderRow[] = [];
    const defaultPartner = clientPartners?.[0]?.id || 'Outro';

    lines.forEach((line, idx) => {
      // Split by Tab, Comma or Semicolon
      let parts = line.split('\t');
      if (parts.length === 1) parts = line.split(';');
      if (parts.length === 1) parts = line.split(',');

      // Map columns: Client Name, Address, Value, CEP, Partner, Region, Phone, Items, Date
      const clientName = parts[0]?.trim() || `Cliente Importado ${idx + 1}`;
      const address = parts[1]?.trim() || '';
      const valueStr = parts[2]?.trim() || '';
      const cep = parts[3]?.trim() || '01310-100';
      const partnerName = parts[4]?.trim() || defaultPartner;
      const region = parts[5]?.trim() || 'Centro';
      const phone = parts[6]?.trim() || '(11) 99999-9999';
      const itemsCount = parts[7]?.trim() || '1';
      const date = parts[8]?.trim() || getSaoPauloISODate();

      parsedRows.push({
        key: `row-paste-${Date.now()}-${idx}-${Math.random()}`,
        clientName,
        phone,
        address,
        region: ['Centro', 'Zona Sul', 'Zona Oeste', 'Zona Norte'].includes(region) ? region : 'Centro',
        priority: 'Média',
        value: valueStr,
        itemsCount,
        date,
        cep,
        partnerName: clientPartners.some(cp => cp.id === partnerName || cp.codigoCliente === partnerName) ? partnerName : defaultPartner
      });
    });

    if (parsedRows.length > 0) {
      setRows([...rows, ...parsedRows]);
      setPasteArea('');
      setShowPasteForm(false);
    }
  };

  const handleSave = () => {
    // Validate rows
    const invalidRows = rows.filter(r => !r.clientName.trim() || !r.address.trim() || !r.value.trim());
    if (invalidRows.length > 0) {
      alert('Por favor, preencha o Nome do Cliente, Endereço e Valor para todas as linhas.');
      return;
    }

    const payload = rows.map(r => {
      const orderValue = parseFloat(r.value.replace(',', '.')) || 0;
      const count = parseInt(r.itemsCount) || 1;
      return {
        clientName: r.clientName.trim(),
        phone: r.phone.trim() || '(11) 99999-9999',
        address: r.address.trim(),
        region: r.region,
        priority: r.priority,
        value: orderValue,
        itemsCount: count,
        date: r.date || getSaoPauloISODate(),
        cep: r.cep.trim() || '01310-100',
        partnerName: r.partnerName,
      };
    });

    onSubmit(payload);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" id="bulk-create-modal">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Inclusão em Lote (Cadastro em Massa)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cadastre múltiplos pedidos de uma só vez na grade interativa abaixo</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Tools Accordion */}
            <div className="bg-slate-50/50 border-b border-slate-100 p-4 px-6 flex flex-wrap items-center justify-between gap-4">
              {/* Quick Fill Tool */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-500 flex items-center gap-1">
                  <Sparkles size={14} className="text-blue-500" />
                  Preenchimento Rápido em Lote:
                </span>
                <select
                  value={quickFillColumn}
                  onChange={(e) => setQuickFillColumn(e.target.value)}
                  className="rounded-lg border-slate-200 text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                >
                  <option value="partnerName">Parceiro Estabelecimento</option>
                  <option value="region">Região</option>
                  <option value="priority">Prioridade</option>
                  <option value="date">Data do Pedido</option>
                  <option value="cep">CEP de Destino</option>
                  <option value="itemsCount">Qtd de Itens</option>
                </select>

                {quickFillColumn === 'partnerName' && (
                  <select
                    value={quickFillValue}
                    onChange={(e) => setQuickFillValue(e.target.value)}
                    className="rounded-lg border-slate-200 text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                  >
                    {clientPartners.map((cp, idx) => (
                      <option key={`bulk-create-cp-${cp.id}-${idx}`} value={cp.id}>{cp.name}</option>
                    ))}
                    <option value="Outro">Outro</option>
                  </select>
                )}

                {quickFillColumn === 'region' && (
                  <select
                    value={quickFillValue}
                    onChange={(e) => setQuickFillValue(e.target.value)}
                    className="rounded-lg border-slate-200 text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Centro">Centro</option>
                    <option value="Zona Sul">Zona Sul</option>
                    <option value="Zona Oeste">Zona Oeste</option>
                    <option value="Zona Norte">Zona Norte</option>
                  </select>
                )}

                {quickFillColumn === 'priority' && (
                  <select
                    value={quickFillValue}
                    onChange={(e) => setQuickFillValue(e.target.value)}
                    className="rounded-lg border-slate-200 text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                )}

                {quickFillColumn === 'date' && (
                  <input
                    type="date"
                    value={quickFillValue}
                    onChange={(e) => setQuickFillValue(e.target.value)}
                    className="rounded-lg border-slate-200 text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                  />
                )}

                {!['partnerName', 'region', 'priority', 'date'].includes(quickFillColumn) && (
                  <input
                    type="text"
                    value={quickFillValue}
                    placeholder="Valor para aplicar..."
                    onChange={(e) => setQuickFillValue(e.target.value)}
                    className="rounded-lg border-slate-200 text-xs py-1 px-2 focus:ring-blue-500 bg-white w-32"
                  />
                )}

                <button
                  type="button"
                  onClick={handleQuickFill}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                >
                  Aplicar a Todos
                </button>
              </div>

              {/* Paste Import trigger */}
              <div>
                <button
                  onClick={() => setShowPasteForm(!showPasteForm)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 cursor-pointer underline decoration-dotted"
                >
                  <Clipboard size={14} />
                  {showPasteForm ? "Ocultar Importador de Texto" : "Colar Lista de Texto (Excel/CSV)"}
                </button>
              </div>
            </div>

            {/* Paste Form Overlay panel */}
            {showPasteForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-slate-100 border-b border-slate-200 p-4 px-6 space-y-3"
              >
                <div className="flex items-start gap-2.5 text-xs text-slate-500">
                  <AlertCircle size={15} className="text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700">Como funciona:</span> Cole linhas contendo informações de pedidos tabuladas ou separadas por vírgula.
                    <br /> Formato sugerido: <code className="bg-slate-200/60 px-1 rounded font-mono text-[10px]">Nome do Cliente | Endereço | Valor | CEP | Código Parceiro | Região</code>
                  </div>
                </div>
                <textarea
                  value={pasteArea}
                  onChange={(e) => setPasteArea(e.target.value)}
                  rows={4}
                  placeholder="Exemplo de colagem:&#10;João Silva, Rua Augusta 1200, 45.90, 01305-000, CL1-002, Centro&#10;Maria Santos, Av Paulista 1500, 29.90, 01311-200, CL1-001, Centro"
                  className="w-full rounded-xl border-slate-200 text-xs p-3 font-mono focus:ring-blue-500 bg-white focus:border-blue-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowPasteForm(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImportText}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Inserir Linhas Parsadas
                  </button>
                </div>
              </motion.div>
            )}

            {/* Main grid / form rows */}
            <div className="flex-1 overflow-auto p-6">
              <table className="min-w-full text-xs text-slate-600 border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="w-10 text-center py-2">#</th>
                    <th className="w-44 px-2 py-2 text-left">Cliente*</th>
                    <th className="w-44 px-2 py-2 text-left">Parceiro*</th>
                    <th className="w-56 px-2 py-2 text-left">Endereço*</th>
                    <th className="w-32 px-2 py-2 text-left">CEP</th>
                    <th className="w-32 px-2 py-2 text-left">Região</th>
                    <th className="w-24 px-2 py-2 text-left">Valor (R$)*</th>
                    <th className="w-20 px-2 py-2 text-left">Itens</th>
                    <th className="w-32 px-2 py-2 text-left">Telefone</th>
                    <th className="w-28 px-2 py-2 text-left">Data</th>
                    <th className="w-12 text-center py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={row.key} className="hover:bg-slate-50/50">
                      <td className="text-center font-bold text-slate-400 py-2">{index + 1}</td>
                      <td className="px-1 py-1.5">
                        <input
                          type="text"
                          value={row.clientName}
                          onChange={(e) => updateRowField(index, 'clientName', e.target.value)}
                          placeholder="Nome do cliente"
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          value={row.partnerName}
                          onChange={(e) => updateRowField(index, 'partnerName', e.target.value)}
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                        >
                          {clientPartners.map((cp, idx) => (
                            <option key={`bulk-row-cp-${cp.id}-${idx}`} value={cp.id}>{cp.name}</option>
                          ))}
                          <option value="Outro">Outro</option>
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="text"
                          value={row.address}
                          onChange={(e) => updateRowField(index, 'address', e.target.value)}
                          placeholder="Rua, Número, Bairro"
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="text"
                          value={row.cep}
                          onChange={(e) => updateRowField(index, 'cep', e.target.value)}
                          placeholder="00000-000"
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          value={row.region}
                          onChange={(e) => updateRowField(index, 'region', e.target.value)}
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="Centro">Centro</option>
                          <option value="Zona Sul">Zona Sul</option>
                          <option value="Zona Oeste">Zona Oeste</option>
                          <option value="Zona Norte">Zona Norte</option>
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => updateRowField(index, 'value', e.target.value)}
                          placeholder="29.90"
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="number"
                          min="1"
                          value={row.itemsCount}
                          onChange={(e) => updateRowField(index, 'itemsCount', e.target.value)}
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="text"
                          value={row.phone}
                          onChange={(e) => updateRowField(index, 'phone', e.target.value)}
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRowField(index, 'date', e.target.value)}
                          className="w-full border-slate-200 rounded-lg text-xs py-1 px-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="text-center py-1.5">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add line button */}
              <button
                type="button"
                onClick={addRow}
                className="mt-4 px-4 py-2 border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50/50 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus size={14} />
                <span>Adicionar Nova Linha</span>
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-500">
                Total de Pedidos na Grade: {rows.length}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-200 cursor-pointer transition-colors"
                >
                  <Save size={14} />
                  <span>Salvar {rows.length} Pedidos</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
