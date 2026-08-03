import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings2, 
  FileSpreadsheet, 
  FileText, 
  Check, 
  Search, 
  CheckSquare, 
  Square, 
  RefreshCw, 
  DownloadCloud, 
  ArrowRight,
  ArrowLeft,
  Database,
  Filter,
  Layers,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ListOrdered
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, DeliveryRider, ClientPartner, isMatchingClientCode } from '../types';
import { getSaoPauloDateTimeShort, formatToBrazilianDate } from '../utils/dateUtils';
import { getPartnerDisplayName } from '../utils/partnerUtils';

interface ExportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  sortedOrders: Order[];
  selectedIds: Set<string>;
  riders: DeliveryRider[];
  clientPartners: ClientPartner[];
}

interface ExportColumnDefinition {
  key: string;
  label: string;
  category: 'main' | 'financial' | 'logistics' | 'fiscal_extra';
  getValue: (order: Order, index: number, riders: DeliveryRider[], clientPartners: ClientPartner[]) => string | number;
}

const EXPORT_COLUMNS: ExportColumnDefinition[] = [
  // MAIN CAMPS
  { key: 'id', label: 'Código do Pedido', category: 'main', getValue: (o) => o.id },
  { key: 'clientName', label: 'Nome do Cliente', category: 'main', getValue: (o) => o.clientName },
  { key: 'phone', label: 'Telefone', category: 'main', getValue: (o) => o.phone || '' },
  { key: 'address', label: 'Endereço Completo', category: 'main', getValue: (o) => o.address },
  { key: 'cep', label: 'CEP', category: 'main', getValue: (o) => o.cep || '' },
  { key: 'region', label: 'Região / Zona', category: 'main', getValue: (o) => o.region },
  { key: 'status', label: 'Status do Pedido', category: 'main', getValue: (o) => o.status },
  { key: 'partnerName', label: 'Parceiro / Unidade', category: 'main', getValue: (o, idx, riders, clientPartners) => {
      return getPartnerDisplayName(o.partnerName, clientPartners);
    }
  },
  { key: 'createdAt', label: 'Data de Criação', category: 'main', getValue: (o) => o.createdAt },

  // FINANCIAL & VALUES
  { key: 'value', label: 'Valor do Frete (R$)', category: 'financial', getValue: (o) => o.value },
  { key: 'driverValue', label: 'Valor do Condutor (R$)', category: 'financial', getValue: (o) => o.driverValue !== undefined ? o.driverValue : '' },
  { key: 'ValorNotaFiscal', label: 'Valor Nota Fiscal', category: 'financial', getValue: (o) => o.rawData?.ValorNotaFiscal || o.rawData?.valornotafiscal || '' },
  { key: 'ValorReceber', label: 'Valor a Receber', category: 'financial', getValue: (o) => o.rawData?.ValorReceber || o.rawData?.valorreceber || '' },

  // LOGISTICS & TIMING
  { key: 'riderId', label: 'Entregador', category: 'logistics', getValue: (o, idx, riders) => riders.find(r => r.id === o.riderId)?.name || 'Não vinculado' },
  { key: 'TipoEntrega', label: 'Tipo de Entrega', category: 'logistics', getValue: (o) => o.rawData?.TipoEntrega || o.rawData?.tipoentrega || '' },
  { key: 'HorarioInicio', label: 'Horário de Início', category: 'logistics', getValue: (o) => o.rawData?.HorarioInicio || o.rawData?.horarioinicio || '' },
  { key: 'HorarioFinal', label: 'Horário Final', category: 'logistics', getValue: (o) => o.rawData?.HorarioFinal || o.rawData?.horariofinal || '' },
  { key: 'DataLimite', label: 'Data Limite', category: 'logistics', getValue: (o) => o.date || o.rawData?.DataLimite || o.rawData?.datalimite || '' },
  { key: 'DataSolicitacao', label: 'Data de Solicitação', category: 'logistics', getValue: (o) => o.date || o.rawData?.DataSolicitacao || o.rawData?.datasolicitacao || '' },
  { key: 'DataAgendamento', label: 'Data de Agendamento', category: 'logistics', getValue: (o) => o.rawData?.DataAgendamento || o.rawData?.dataagendamento || '' },

  // FISCAL & OTHER
  { key: 'DANFE', label: 'Chave DANFE', category: 'fiscal_extra', getValue: (o) => o.rawData?.DANFE || o.rawData?.danfe || '' },
  { key: 'Chamado', label: 'Nº Chamado', category: 'fiscal_extra', getValue: (o) => o.rawData?.Chamado || o.rawData?.chamado || '' },
  { key: 'Email', label: 'E-mail', category: 'fiscal_extra', getValue: (o) => o.rawData?.Email || o.rawData?.email || '' },
  { key: 'DocumentoEmpresa', label: 'Documento Empresa', category: 'fiscal_extra', getValue: (o) => o.rawData?.DocumentoEmpresa || o.rawData?.documentoempresa || '' },
  { key: 'NomeFantasia', label: 'Nome Fantasia', category: 'fiscal_extra', getValue: (o, idx, riders, clientPartners) => {
      const val = o.rawData?.NomeFantasia || o.rawData?.nomefantasia;
      if (val && val !== o.partnerName) return val;
      return getPartnerDisplayName(o.partnerName, clientPartners);
    }
  },
  { key: 'CidadeMunicipio', label: 'Cidade/Município', category: 'fiscal_extra', getValue: (o) => o.rawData?.CidadeMunicipio || o.rawData?.cidademunicipio || 'São Paulo' },
  { key: 'Estado', label: 'Estado (UF)', category: 'fiscal_extra', getValue: (o) => o.rawData?.Estado || o.rawData?.estado || 'SP' },
  { key: 'Detalhe', label: 'Detalhes/Observações', category: 'fiscal_extra', getValue: (o) => o.rawData?.Detalhe || o.rawData?.detalhe || '' },
  { key: 'DestinatarioCnpjCpf', label: 'CNPJ/CPF Destinatário', category: 'fiscal_extra', getValue: (o) => o.rawData?.DestinatarioCnpjCpf || o.rawData?.destinatariocnpjcpf || '' },
  { key: 'Complemento', label: 'Complemento Endereço', category: 'fiscal_extra', getValue: (o) => o.rawData?.Complemento || o.rawData?.complemento || '' },
  { key: 'Sequencia', label: 'Sequência', category: 'fiscal_extra', getValue: (o, idx) => idx },
  { key: 'ProcurarPor', label: 'Procurar Por', category: 'fiscal_extra', getValue: (o) => o.clientName },
  { key: 'DispositivoCondutor', label: 'Dispositivo Condutor', category: 'fiscal_extra', getValue: (o, idx, riders) => riders.find(r => r.id === o.riderId)?.name || 'Não vinculado' },
  { key: 'Latitude', label: 'Latitude', category: 'fiscal_extra', getValue: (o) => o.rawData?.Latitude || o.rawData?.latitude || '' },
  { key: 'Longitude', label: 'Longitude', category: 'fiscal_extra', getValue: (o) => o.rawData?.Longitude || o.rawData?.longitude || '' },
];

const DEFAULT_KEYS = ['id', 'clientName', 'address', 'cep', 'region', 'status', 'riderId', 'partnerName'];

const CATEGORY_DETAILS = {
  main: { title: 'Campos Principais', color: 'text-blue-600 bg-blue-50 border-blue-100' },
  financial: { title: 'Financeiro & Valores', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  logistics: { title: 'Logística & Status', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  fiscal_extra: { title: 'Fiscais & Adicionais', color: 'text-amber-600 bg-amber-50 border-amber-100' }
};

export default function ExportConfigModal({
  isOpen,
  onClose,
  orders,
  sortedOrders,
  selectedIds,
  riders,
  clientPartners
}: ExportConfigModalProps) {
  const [orderedKeys, setOrderedKeys] = useState<string[]>([...DEFAULT_KEYS]);
  const [targetType, setTargetType] = useState<'filtered' | 'selected'>(
    selectedIds.size > 0 ? 'selected' : 'filtered'
  );
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'both'>('excel');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Sync target type when selectedIds changes or modal reopens
  React.useEffect(() => {
    if (isOpen) {
      setTargetType(selectedIds.size > 0 ? 'selected' : 'filtered');
    }
  }, [isOpen, selectedIds.size]);

  // Compute actual target list
  const targetOrders = useMemo(() => {
    if (targetType === 'selected') {
      return orders.filter(o => selectedIds.has(o.id));
    }
    return sortedOrders;
  }, [targetType, orders, sortedOrders, selectedIds]);

  const selectedSet = useMemo(() => new Set(orderedKeys), [orderedKeys]);

  // Handle individual column toggle
  const toggleKey = (key: string) => {
    if (selectedSet.has(key)) {
      if (orderedKeys.length > 1) { // prevent empty export
        setOrderedKeys(orderedKeys.filter(k => k !== key));
      }
    } else {
      setOrderedKeys([...orderedKeys, key]);
    }
  };

  // Column reordering handlers
  const handleMoveColumn = (index: number, delta: number) => {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= orderedKeys.length) return;
    const next = [...orderedKeys];
    const item = next[index];
    next.splice(index, 1);
    next.splice(newIndex, 0, item);
    setOrderedKeys(next);
  };

  const handleSetColumnPosition = (index: number, newPosIndex: number) => {
    if (newPosIndex < 0 || newPosIndex >= orderedKeys.length || index === newPosIndex) return;
    const next = [...orderedKeys];
    const item = next[index];
    next.splice(index, 1);
    next.splice(newPosIndex, 0, item);
    setOrderedKeys(next);
  };

  // Actions
  const handleSelectAll = () => {
    const existingSet = new Set(orderedKeys);
    const newKeys = [...orderedKeys];
    EXPORT_COLUMNS.forEach(c => {
      if (!existingSet.has(c.key)) {
        newKeys.push(c.key);
      }
    });
    setOrderedKeys(newKeys);
  };

  const handleClearAll = () => {
    // Keep at least the ID
    setOrderedKeys(['id']);
  };

  const handleRestoreDefaults = () => {
    setOrderedKeys([...DEFAULT_KEYS]);
  };

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return EXPORT_COLUMNS;
    const query = searchQuery.toLowerCase();
    return EXPORT_COLUMNS.filter(c => 
      c.label.toLowerCase().includes(query) || 
      c.key.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Organize filtered columns by category
  const columnsByCategory = useMemo(() => {
    const grouped = {
      main: [] as ExportColumnDefinition[],
      financial: [] as ExportColumnDefinition[],
      logistics: [] as ExportColumnDefinition[],
      fiscal_extra: [] as ExportColumnDefinition[]
    };
    filteredColumns.forEach(c => {
      grouped[c.category].push(c);
    });
    return grouped;
  }, [filteredColumns]);

  // Ordered definition list for export
  const columnsToExport = useMemo(() => {
    return orderedKeys
      .map(key => EXPORT_COLUMNS.find(c => c.key === key))
      .filter((c): c is ExportColumnDefinition => c !== undefined);
  }, [orderedKeys]);

  // Core execution
  const handleExport = async () => {
    if (targetOrders.length === 0) {
      alert('Nenhum pedido disponível para exportar.');
      return;
    }

    if (orderedKeys.length === 0) {
      alert('Por favor, selecione ao menos uma coluna para exportar.');
      return;
    }

    setIsExporting(true);

    // Small delay for UI response/loading spinner elegance
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // 1. Export Excel if selected
      if (exportFormat === 'excel' || exportFormat === 'both') {
        const excelData = targetOrders.map((order, idx) => {
          const rowObj: Record<string, string | number> = {};
          columnsToExport.forEach(col => {
            let val = col.getValue(order, idx + 1, riders, clientPartners);
            if (col.key.toLowerCase().includes('data') || col.key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val))) {
              val = formatToBrazilianDate(String(val));
            }
            rowObj[col.label] = val;
          });
          return rowObj;
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `relatorio_pedidos_personalizado_${dateStr}.xlsx`);
      }

      // 2. Export PDF if selected
      if (exportFormat === 'pdf' || exportFormat === 'both') {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });

        // Add headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('Relatório Personalizado de Pedidos - Vinimap Logistics OS', 14, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139); // slate-500
        const timestamp = getSaoPauloDateTimeShort();
        doc.text(`Gerado em: ${timestamp} | Origem: ${targetType === 'selected' ? 'Pedidos Selecionados' : 'Lista Filtrada'} | Total de Registros: ${targetOrders.length}`, 14, 21);

        const pdfHeaders = [columnsToExport.map(c => c.label)];
        const pdfBody = targetOrders.map((order, idx) => {
          return columnsToExport.map(col => {
            let val = col.getValue(order, idx + 1, riders, clientPartners);
            if (col.key.toLowerCase().includes('data') || col.key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val))) {
              val = formatToBrazilianDate(String(val));
            }
            return String(val);
          });
        });

        autoTable(doc, {
          head: pdfHeaders,
          body: pdfBody,
          startY: 25,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 7 }, // blue-600
          styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: {
            // Auto layout helps wrap text correctly
          }
        });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`relatorio_pedidos_personalizado_${dateStr}.pdf`);
      }

      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error('Erro na exportação personalizada:', err);
      alert('Ocorreu um erro ao gerar o relatório. Verifique os dados e tente novamente.');
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="relative bg-white rounded-none shadow-2xl border-0 w-full h-full max-w-full max-h-screen flex flex-col overflow-hidden z-10"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Settings2 size={20} className="animate-spin-slow" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                    Exportar Relatório Customizado
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Premium
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Escolha as colunas, defina a ordem de exibição no cabeçalho e faça o download em Excel ou PDF.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content - Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Top Configuration Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 shrink-0">
                
                {/* Configuration 1: Data Source */}
                <div className="bg-slate-50/75 border border-slate-100 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Database size={15} className="text-blue-500" />
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">1. Origem dos Pedidos</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetType('filtered')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        targetType === 'filtered' 
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${targetType === 'filtered' ? 'text-blue-600' : 'text-slate-400'}`}>
                        Lista Filtrada
                      </span>
                      <span className="text-lg font-black text-slate-800 mt-1">{sortedOrders.length}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Pedidos na tabela atual</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedIds.size === 0}
                      onClick={() => setTargetType('selected')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        selectedIds.size === 0 
                          ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200' 
                          : targetType === 'selected' 
                            ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10 cursor-pointer' 
                            : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${targetType === 'selected' ? 'text-blue-600' : 'text-slate-400'}`}>
                        Selecionados
                      </span>
                      <span className="text-lg font-black text-slate-800 mt-1">{selectedIds.size}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Checkboxes marcados</span>
                    </button>
                  </div>
                </div>

                {/* Configuration 2: Format Choice */}
                <div className="bg-slate-50/75 border border-slate-100 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-blue-500" />
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">2. Formato de Saída</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat('excel')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        exportFormat === 'excel'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 ring-2 ring-emerald-500/10'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <FileSpreadsheet size={20} className={exportFormat === 'excel' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span className="text-[10px] font-extrabold">Planilha Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('pdf')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        exportFormat === 'pdf'
                          ? 'bg-rose-50 border-rose-200 text-rose-800 ring-2 ring-rose-500/10'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <FileText size={20} className={exportFormat === 'pdf' ? 'text-rose-600' : 'text-slate-400'} />
                      <span className="text-[10px] font-extrabold">Relatório PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('both')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        exportFormat === 'both'
                          ? 'bg-blue-50 border-blue-200 text-blue-800 ring-2 ring-blue-500/10'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex gap-0.5">
                        <FileSpreadsheet size={14} className="text-emerald-500" />
                        <FileText size={14} className="text-rose-500" />
                      </div>
                      <span className="text-[10px] font-extrabold">Ambos (.xlsx & .pdf)</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Column Reordering & Position Manager */}
              <div className="border border-blue-100 bg-blue-50/20 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/60 pb-3">
                  <div className="flex items-center gap-2">
                    <ListOrdered size={18} className="text-blue-600" />
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        3. Posição e Ordem das Colunas no Cabeçalho ({orderedKeys.length} ativas)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Altere a posição de qualquer coluna selecionando o número da posição desejada ou usando as setas para mover para a esquerda/direita.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reorderable Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {columnsToExport.map((col, idx) => {
                    const posNumber = idx + 1;
                    return (
                      <div
                        key={col.key}
                        className="bg-white border border-slate-200 shadow-xs hover:border-blue-300 rounded-2xl p-2.5 flex items-center justify-between gap-2 transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Position Selector Dropdown */}
                          <div className="relative shrink-0">
                            <select
                              value={idx}
                              onChange={(e) => handleSetColumnPosition(idx, Number(e.target.value))}
                              title={`Alterar posição da coluna ${col.label}`}
                              className="appearance-none bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold font-mono text-[11px] px-2 py-1 pr-4 rounded-xl border border-blue-200 outline-none cursor-pointer text-center"
                            >
                              {columnsToExport.map((_, pIdx) => (
                                <option key={pIdx} value={pIdx}>
                                  #{pIdx + 1}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-800 block truncate leading-snug">
                              {col.label}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono block truncate">
                              {col.key}
                            </span>
                          </div>
                        </div>

                        {/* Move Left / Move Right Buttons & Remove */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveColumn(idx, -1)}
                            title="Mover para Esquerda / Cima"
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 rounded-lg transition-all cursor-pointer"
                          >
                            <ArrowLeft size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === columnsToExport.length - 1}
                            onClick={() => handleMoveColumn(idx, 1)}
                            title="Mover para Direita / Baixo"
                            className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 rounded-lg transition-all cursor-pointer"
                          >
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={columnsToExport.length <= 1}
                            onClick={() => toggleKey(col.key)}
                            title="Remover coluna"
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer ml-1"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column Selection Card */}
              <div className="border border-slate-100 rounded-3xl p-5 space-y-4 bg-white shadow-xs">
                
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-2">
                    <Filter size={15} className="text-slate-400" />
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">4. Selecionar ou Ocultar Colunas Disponíveis ({selectedSet.size}/{EXPORT_COLUMNS.length})</h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Field */}
                    <div className="relative w-full sm:w-52">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input
                        type="text"
                        placeholder="Filtrar colunas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-xs font-bold rounded-xl outline-none transition-all placeholder:text-slate-400 text-slate-700"
                      />
                    </div>

                    <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

                    {/* Quick Select Buttons */}
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1.5 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200 text-[10px] font-extrabold text-slate-600 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare size={12} />
                      <span>Todas</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2.5 py-1.5 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200 text-[10px] font-extrabold text-slate-600 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Square size={12} />
                      <span>Limpar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreDefaults}
                      className="px-2.5 py-1.5 hover:bg-blue-50 border border-blue-100 text-[10px] font-extrabold text-blue-600 hover:text-blue-700 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={11} />
                      <span>Padrão</span>
                    </button>
                  </div>
                </div>

                {/* Categorized Columns Grid */}
                <div className="space-y-6">
                  {(Object.keys(columnsByCategory) as Array<keyof typeof columnsByCategory>).map((category) => {
                    const cols = columnsByCategory[category];
                    if (cols.length === 0) return null;
                    const catInfo = CATEGORY_DETAILS[category];
                    
                    return (
                      <div key={category} className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${catInfo.color}`}>
                            {catInfo.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">({cols.length} disponíveis)</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {cols.map((col) => {
                            const isSelected = selectedSet.has(col.key);
                            const activePosIndex = orderedKeys.indexOf(col.key);

                            return (
                              <button
                                key={col.key}
                                type="button"
                                onClick={() => toggleKey(col.key)}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                                  isSelected 
                                    ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50' 
                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
                                }`}
                              >
                                <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                  isSelected 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                                    : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check size={11} strokeWidth={3} />}
                                </div>
                                <div className="space-y-0.5 overflow-hidden flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-[11px] font-bold truncate leading-tight ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                                      {col.label}
                                    </span>
                                    {isSelected && activePosIndex !== -1 && (
                                      <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.2 rounded-md font-mono shrink-0">
                                        #{activePosIndex + 1}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-mono block tracking-tight truncate">
                                    {col.key}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Live Layout Preview */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white space-y-3 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Sequência Final de Colunas no Relatório</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold font-mono">Excel & PDF</span>
                </div>
                
                {/* Horizontal scroll of selected headers */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 max-h-[100px] overflow-y-auto no-scrollbar">
                  {columnsToExport.map((col, idx, arr) => (
                    <React.Fragment key={col.key}>
                      <div className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <span className="font-mono text-[9px] text-blue-400 font-extrabold">#{idx + 1}</span>
                        <span className="text-[10px] font-bold text-slate-200">{col.label}</span>
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight size={10} className="text-slate-600 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                  {orderedKeys.length === 0 && (
                    <span className="text-xs text-rose-400 font-bold">Nenhuma coluna selecionada! Marque as opções acima para construir o relatório.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 hover:bg-slate-200/80 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || orderedKeys.length === 0}
                className={`px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                  isExporting || orderedKeys.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Gerando Relatório...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud size={14} />
                    <span>Baixar Relatório ({targetOrders.length} {targetOrders.length === 1 ? 'pedido' : 'pedidos'})</span>
                  </>
                )}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

