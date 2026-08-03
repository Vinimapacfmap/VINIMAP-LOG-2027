/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, Upload, Search, Plus, Trash2, Pencil, Check, 
  AlertCircle, MapPin, Calculator, History, Download, FileText, 
  Calendar, Layers, Sparkles, RefreshCw, ChevronRight, UserCheck,
  Building2, DollarSign, Filter, ArrowRight, Eye, RotateCcw, X, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CepRange, ClientPartner, CepTableHistoryItem, Order } from '../types';
import { getSaoPauloDateTimeShort } from '../utils/dateUtils';
import { isMatchingClientCode } from '../types';

export interface FreightTableImportManagerProps {
  clientPartners: ClientPartner[];
  orders?: Order[];
  onSaveClientCepRanges: (clientId: string, ranges: CepRange[], history?: CepTableHistoryItem[]) => void;
  onBulkSaveClientCepRanges?: (clientRangesMap: Record<string, { ranges: CepRange[]; history?: CepTableHistoryItem[] }>) => void;
  onRecalculateOrdersFreight?: (clientId: string, ranges: CepRange[]) => void;
  initialSelectedClientId?: string;
  isModalView?: boolean;
  onCloseModal?: () => void;
}

interface ParsedPreviewRow {
  id: string;
  clientIdentifier?: string; // for multi-client import
  matchedClientId?: string;
  matchedClientName?: string;
  rawStart: string;
  rawEnd: string;
  cleanStart: string;
  cleanEnd: string;
  formattedStart: string;
  formattedEnd: string;
  value: number;
  expressValue?: number;
  driverRepass?: number;
  description?: string;
  effectiveFrom?: string;
  status: 'valid' | 'price_updated' | 'invalid_cep' | 'invalid_price' | 'duplicate';
  statusMessage: string;
}

export default function FreightTableImportManager({
  clientPartners,
  orders = [],
  onSaveClientCepRanges,
  onBulkSaveClientCepRanges,
  onRecalculateOrdersFreight,
  initialSelectedClientId,
  isModalView = false,
  onCloseModal
}: FreightTableImportManagerProps) {
  // Active Client Selection
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    if (initialSelectedClientId && clientPartners.some(c => c.id === initialSelectedClientId)) {
      return initialSelectedClientId;
    }
    return clientPartners.length > 0 ? clientPartners[0].id : '';
  });

  const [clientSearchQuery, setClientSearchQuery] = useState('');
  
  // Get active client object
  const activeClient = useMemo(() => {
    return clientPartners.find(c => c.id === selectedClientId) || clientPartners[0] || null;
  }, [clientPartners, selectedClientId]);

  // Keep track of active client's ranges and history
  const [activeRanges, setActiveRanges] = useState<CepRange[]>([]);
  const [historyList, setHistoryList] = useState<CepTableHistoryItem[]>([]);
  const [prevClientId, setPrevClientId] = useState<string | null>(null);

  // Sync state when active client changes
  useEffect(() => {
    if (activeClient) {
      setActiveRanges(activeClient.cepRanges || []);
      const initialHist = (activeClient.cepRangesHistory && activeClient.cepRangesHistory.length > 0)
        ? activeClient.cepRangesHistory
        : (activeClient.cepRanges && activeClient.cepRanges.length > 0 ? [{
            id: `hist-init-${activeClient.id}`,
            importedAt: getSaoPauloDateTimeShort(),
            filename: 'Tabela Padrão Ativa',
            rangesCount: activeClient.cepRanges.length,
            cepRanges: activeClient.cepRanges,
            note: 'Tabela de frete ativa em uso'
          }] : []);
      setHistoryList(initialHist);
      setPrevClientId(activeClient.id);
    }
  }, [activeClient]);

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'tabela_ativa' | 'importar' | 'lote_multiplos' | 'historico' | 'simulador'>('tabela_ativa');

  // Effective Date Settings
  const [useEffectiveDate, setUseEffectiveDate] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    try {
      const tzDate = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const d = new Date(tzDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  });

  // Manual Input State
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualExpressValue, setManualExpressValue] = useState('');
  const [manualDriverRepass, setManualDriverRepass] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  // Table Search Filter
  const [filterQuery, setFilterQuery] = useState('');

  // Direct Inline Edit State
  const [editingRangeId, setEditingRangeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingExpressValue, setEditingExpressValue] = useState<string>('');
  const [editingDriverRepass, setEditingDriverRepass] = useState<string>('');
  const [editingEffectiveFrom, setEditingEffectiveFrom] = useState<string>('');

  // Import State (Single Client)
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('replace');
  const [parsedPreviewRows, setParsedPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Multi-Client Master Import State
  const [multiClientImportText, setMultiClientImportText] = useState('');
  const [multiClientPreview, setMultiClientPreview] = useState<Record<string, {
    client: ClientPartner;
    rows: ParsedPreviewRow[];
    validCount: number;
    errorCount: number;
  }>>({});
  const [multiClientError, setMultiClientError] = useState<string | null>(null);
  const [multiClientSuccessMsg, setMultiClientSuccessMsg] = useState<string | null>(null);

  // Simulator State
  const [queryCep, setQueryCep] = useState('');
  const [queryResult, setQueryResult] = useState<{
    matched: boolean;
    range?: CepRange;
    message: string;
  } | null>(null);

  // Historical Preview Modal
  const [previewHistoryItem, setPreviewHistoryItem] = useState<CepTableHistoryItem | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // CEP Cleaners
  const cleanCep = (val: string) => val ? val.replace(/\D/g, '') : '';
  const formatCep = (val: string) => {
    const cleaned = cleanCep(val);
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 5)}-${cleaned.substring(5)}`;
    }
    return val;
  };

  // Filtered Client Partners
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientPartners;
    const q = clientSearchQuery.toLowerCase();
    return clientPartners.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q) ||
      (c.codigoCliente && c.codigoCliente.toLowerCase().includes(q)) ||
      (c.cnpj && c.cnpj.includes(q))
    );
  }, [clientPartners, clientSearchQuery]);

  // Client Key Statistics
  const clientStats = useMemo(() => {
    if (!activeRanges || activeRanges.length === 0) {
      return {
        totalRanges: 0,
        avgFreight: 0,
        avgRepass: 0,
        minCep: '-',
        maxCep: '-',
        effectiveDate: '-'
      };
    }

    const totalRanges = activeRanges.length;
    const sumFreight = activeRanges.reduce((acc, r) => acc + r.value, 0);
    const avgFreight = sumFreight / totalRanges;

    const repassRanges = activeRanges.filter(r => r.driverRepass !== undefined);
    const sumRepass = repassRanges.reduce((acc, r) => acc + (r.driverRepass || 0), 0);
    const avgRepass = repassRanges.length > 0 ? sumRepass / repassRanges.length : 0;

    const sortedCeps = [...activeRanges].sort((a, b) => cleanCep(a.cepStart).localeCompare(cleanCep(b.cepStart)));
    const minCep = sortedCeps[0]?.cepStart || '-';
    const maxCep = sortedCeps[sortedCeps.length - 1]?.cepEnd || '-';
    
    const dates = activeRanges.map(r => r.effectiveFrom).filter(Boolean);
    const effectiveDate = dates.length > 0 ? dates[0] : 'Sempre Ativa';

    return {
      totalRanges,
      avgFreight,
      avgRepass,
      minCep,
      maxCep,
      effectiveDate
    };
  }, [activeRanges]);

  // Central function to save changes with history
  const saveRangesWithHistory = (
    clientId: string,
    newRanges: CepRange[],
    sourceName: string = 'Tabela de Frete',
    note?: string
  ) => {
    const timestamp = getSaoPauloDateTimeShort();
    const newHistItem: CepTableHistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      importedAt: timestamp,
      filename: sourceName,
      rangesCount: newRanges.length,
      cepRanges: newRanges,
      note: note || `Tabela com ${newRanges.length} faixas de CEP`
    };

    const updatedHistory = [newHistItem, ...historyList];
    setActiveRanges(newRanges);
    setHistoryList(updatedHistory);

    onSaveClientCepRanges(clientId, newRanges, updatedHistory);

    if (onRecalculateOrdersFreight) {
      onRecalculateOrdersFreight(clientId, newRanges);
    }
  };

  // Add a single manual range
  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;

    let startClean = cleanCep(manualStart);
    let endClean = cleanCep(manualEnd);

    if (startClean.length > 0 && startClean.length < 8) startClean = startClean.padStart(8, '0');
    if (endClean.length > 0 && endClean.length < 8) endClean = endClean.padStart(8, '0');

    if (startClean.length !== 8 || endClean.length !== 8) {
      alert('Por favor, insira CEPs válidos com 8 dígitos (ex: 01310-100).');
      return;
    }

    if (parseInt(startClean, 10) > parseInt(endClean, 10)) {
      alert('O CEP inicial não pode ser maior que o CEP final.');
      return;
    }

    const valueParsed = parseFloat(manualValue.replace(',', '.'));
    if (isNaN(valueParsed) || valueParsed < 0) {
      alert('Por favor, insira um valor de frete válido.');
      return;
    }

    const expressValueParsed = manualExpressValue ? parseFloat(manualExpressValue.replace(',', '.')) : undefined;
    const driverRepassParsed = manualDriverRepass ? parseFloat(manualDriverRepass.replace(',', '.')) : undefined;

    const newRange: CepRange = {
      id: 'range-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      cepStart: formatCep(manualStart),
      cepEnd: formatCep(manualEnd),
      value: valueParsed,
      expressValue: expressValueParsed,
      driverRepass: driverRepassParsed,
      description: manualDesc.trim() || undefined,
      effectiveFrom: useEffectiveDate ? effectiveFrom : undefined
    };

    const updated = [...activeRanges, newRange];
    saveRangesWithHistory(activeClient.id, updated, 'Inclusão Manual de Faixa', `Adicionada faixa ${newRange.cepStart} a ${newRange.cepEnd}`);

    // Reset fields
    setManualStart('');
    setManualEnd('');
    setManualValue('');
    setManualExpressValue('');
    setManualDriverRepass('');
    setManualDesc('');
  };

  // Remove range
  const handleRemoveRange = (id: string) => {
    if (!activeClient) return;
    const updated = activeRanges.filter(r => r.id !== id);
    saveRangesWithHistory(activeClient.id, updated, 'Exclusão de Faixa', `Removida faixa de CEP`);
  };

  // Confirm inline edit
  const handleConfirmInlineEdit = (id: string) => {
    if (!activeClient) return;
    const valueParsed = parseFloat(editingValue.replace(',', '.'));
    if (isNaN(valueParsed) || valueParsed < 0) {
      alert('Por favor, insira um valor de frete válido.');
      return;
    }

    const expressValueParsed = editingExpressValue ? parseFloat(editingExpressValue.replace(',', '.')) : undefined;
    const driverRepassParsed = editingDriverRepass ? parseFloat(editingDriverRepass.replace(',', '.')) : undefined;

    const updated = activeRanges.map(r => {
      if (r.id === id) {
        return {
          ...r,
          value: valueParsed,
          expressValue: expressValueParsed,
          driverRepass: driverRepassParsed,
          effectiveFrom: editingEffectiveFrom.trim() || undefined
        };
      }
      return r;
    });

    saveRangesWithHistory(activeClient.id, updated, 'Edição Direta de Valor', 'Atualização de valores em faixa existente');
    setEditingRangeId(null);
  };

  // Single File Parsing Core Engine
  const parseRowsFromData = (rowsData: any[][]): ParsedPreviewRow[] => {
    if (!rowsData || rowsData.length < 2) return [];

    const headers = rowsData[0].map((h: any) => 
      String(h || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s_-]+/g, '')
    );

    let startIdx = headers.findIndex((h: string) => h.includes('cepini') || h.includes('inicial') || h.includes('start') || h.includes('origem') || h.includes('desde') || h === 'de' || h === 'cep');
    let endIdx = headers.findIndex((h: string) => h.includes('cepfim') || h.includes('final') || h.includes('end') || h.includes('destino') || h.includes('ate') || h === 'para');
    let valIdx = headers.findIndex((h: string) => h.includes('valornormal') || h.includes('valorfrete') || h.includes('fretenormal') || (h.includes('valor') && !h.includes('repasse') && !h.includes('express')) || (h.includes('frete') && !h.includes('repasse') && !h.includes('express')) || h.includes('preco') || h.includes('price') || h.includes('value') || h.includes('taxa'));
    let expressIdx = headers.findIndex((h: string) => h.includes('expresso') || h.includes('express') || h.includes('prioridade') || h.includes('urgente') || h.includes('rapido'));
    let repassIdx = headers.findIndex((h: string) => h.includes('repasse') || h.includes('condutor') || h.includes('motorista') || h.includes('driver') || h.includes('comissao') || h.includes('ganho') || h.includes('entregador') || h.includes('repas') || h.includes('pago') || h.includes('custo'));
    let descIdx = headers.findIndex((h: string) => h.includes('desc') || h.includes('regia') || h.includes('nome') || h.includes('obs') || h.includes('detalhe') || h.includes('bairro') || h.includes('observacao'));

    if (startIdx === -1) startIdx = 0;
    if (endIdx === -1) endIdx = 1;
    if (valIdx === -1) valIdx = 2;
    if (expressIdx === -1 && descIdx !== 3 && valIdx !== 3) expressIdx = 3;
    if (repassIdx === -1) {
      if (expressIdx !== 4 && valIdx !== 4 && descIdx !== 4) repassIdx = 4;
      else if (expressIdx !== 3 && valIdx !== 3 && descIdx !== 3) repassIdx = 3;
    }
    if (descIdx === -1 && expressIdx !== 5 && repassIdx !== 5) descIdx = 5;

    const parsedRows: ParsedPreviewRow[] = [];
    const existingMap = new Map<string, CepRange>();
    activeRanges.forEach(r => existingMap.set(`${cleanCep(r.cepStart)}_${cleanCep(r.cepEnd)}`, r));

    for (let i = 1; i < rowsData.length; i++) {
      const row = rowsData[i];
      if (!row || row.length === 0) continue;

      const rawStart = row[startIdx] !== undefined ? String(row[startIdx]).trim() : '';
      const rawEnd = row[endIdx] !== undefined ? String(row[endIdx]).trim() : '';
      const rawValue = row[valIdx] !== undefined ? String(row[valIdx]).trim() : '';
      const rawExpress = expressIdx !== -1 && row[expressIdx] !== undefined ? String(row[expressIdx]).trim() : '';
      const rawRepass = repassIdx !== -1 && row[repassIdx] !== undefined ? String(row[repassIdx]).trim() : '';
      const rawDesc = descIdx !== -1 && row[descIdx] !== undefined ? String(row[descIdx]).trim() : '';

      if (!rawStart && !rawEnd && !rawValue) continue;

      let cleanStart = cleanCep(rawStart);
      let cleanEnd = cleanCep(rawEnd);

      if (cleanStart.length > 0 && cleanStart.length < 8) cleanStart = cleanStart.padStart(8, '0');
      if (cleanEnd.length > 0 && cleanEnd.length < 8) cleanEnd = cleanEnd.padStart(8, '0');

      if (cleanStart.length !== 8 || cleanEnd.length !== 8) {
        parsedRows.push({
          id: `preview-${i}`,
          rawStart, rawEnd, cleanStart, cleanEnd,
          formattedStart: rawStart, formattedEnd: rawEnd,
          value: 0,
          status: 'invalid_cep',
          statusMessage: 'CEP com formato inválido (deve conter 8 dígitos)'
        });
        continue;
      }

      const valClean = rawValue.replace('R$', '').replace(/\s/g, '').replace(',', '.');
      const valNum = parseFloat(valClean);
      if (isNaN(valNum) || valNum < 0) {
        parsedRows.push({
          id: `preview-${i}`,
          rawStart, rawEnd, cleanStart, cleanEnd,
          formattedStart: formatCep(cleanStart), formattedEnd: formatCep(cleanEnd),
          value: 0,
          status: 'invalid_price',
          statusMessage: 'Valor do frete em formato inválido'
        });
        continue;
      }

      let expressNum: number | undefined = undefined;
      if (rawExpress) {
        const expressClean = rawExpress.replace('R$', '').replace(/\s/g, '').replace(',', '.');
        const parsedEx = parseFloat(expressClean);
        if (!isNaN(parsedEx) && parsedEx >= 0) expressNum = parsedEx;
      }

      let repassNum: number | undefined = undefined;
      if (rawRepass) {
        const repassClean = rawRepass.replace('R$', '').replace(/\s/g, '').replace(',', '.');
        const parsedRep = parseFloat(repassClean);
        if (!isNaN(parsedRep) && parsedRep >= 0) repassNum = parsedRep;
      }

      const key = `${cleanStart}_${cleanEnd}`;
      const existing = existingMap.get(key);

      let status: ParsedPreviewRow['status'] = 'valid';
      let statusMessage = 'Faixa válida e pronta para importar';

      if (existing) {
        if (existing.value !== valNum || existing.expressValue !== expressNum || existing.driverRepass !== repassNum) {
          status = 'price_updated';
          statusMessage = `Atualização de valor: R$ ${existing.value.toFixed(2)} ➔ R$ ${valNum.toFixed(2)}`;
        } else {
          status = 'duplicate';
          statusMessage = 'Faixa já existe com os mesmos valores';
        }
      }

      parsedRows.push({
        id: `preview-${i}`,
        rawStart, rawEnd, cleanStart, cleanEnd,
        formattedStart: formatCep(cleanStart),
        formattedEnd: formatCep(cleanEnd),
        value: valNum,
        expressValue: expressNum,
        driverRepass: repassNum,
        description: rawDesc || undefined,
        effectiveFrom: useEffectiveDate ? effectiveFrom : undefined,
        status,
        statusMessage
      });
    }

    return parsedRows;
  };

  // Text Paste Parser for Single Client
  const handleProcessTextImport = () => {
    setImportError(null);
    setImportSuccessMsg(null);

    if (!importText.trim()) {
      setImportError('Cole o conteúdo da planilha no campo antes de pré-visualizar.');
      return;
    }

    const lines = importText.trim().split('\n');
    const rowsData: any[][] = lines.map(line => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(';')) return line.split(';');
      if (line.includes('|')) return line.split('|');
      if (line.includes(',')) return line.split(',');
      return line.trim().split(/\s+/);
    });

    const preview = parseRowsFromData(rowsData);
    if (preview.length === 0) {
      setImportError('Nenhuma faixa de CEP válida pôde ser reconhecida.');
      return;
    }

    setParsedPreviewRows(preview);
  };

  // Single File Drop / Change Handler
  const handleSingleFileUpload = (file: File) => {
    setImportError(null);
    setImportSuccessMsg(null);
    setIsProcessingFile(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) return;
          const data = new Uint8Array(buffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

          const preview = parseRowsFromData(jsonData);
          setParsedPreviewRows(preview);
          setIsProcessingFile(false);
        } catch (err) {
          setImportError('Erro ao processar o arquivo Excel. Verifique a formatação.');
          setIsProcessingFile(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          if (!text) return;
          const lines = text.trim().split('\n');
          const rowsData = lines.map(l => l.includes(';') ? l.split(';') : l.split(','));
          const preview = parseRowsFromData(rowsData);
          setParsedPreviewRows(preview);
          setIsProcessingFile(false);
        } catch (err) {
          setImportError('Erro ao ler arquivo CSV/Texto.');
          setIsProcessingFile(false);
        }
      };
      reader.readAsText(file);
    }
  };

  // Confirm Single Client Import
  const handleConfirmSingleImport = (filename: string = 'Importação de Planilha') => {
    if (!activeClient || parsedPreviewRows.length === 0) return;

    const validRows = parsedPreviewRows.filter(r => r.status === 'valid' || r.status === 'price_updated' || r.status === 'duplicate');
    if (validRows.length === 0) {
      alert('Nenhuma linha válida para importar.');
      return;
    }

    const newRanges: CepRange[] = validRows.map((r, idx) => ({
      id: `range-imp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      cepStart: r.formattedStart,
      cepEnd: r.formattedEnd,
      value: r.value,
      expressValue: r.expressValue,
      driverRepass: r.driverRepass,
      description: r.description,
      effectiveFrom: useEffectiveDate ? effectiveFrom : undefined
    }));

    let finalRanges: CepRange[] = [];
    if (importMode === 'replace') {
      finalRanges = newRanges;
    } else {
      // Append mode: merge based on CEP range key
      const map = new Map<string, CepRange>();
      activeRanges.forEach(r => map.set(`${cleanCep(r.cepStart)}_${cleanCep(r.cepEnd)}`, r));
      newRanges.forEach(r => map.set(`${cleanCep(r.cepStart)}_${cleanCep(r.cepEnd)}`, r));
      finalRanges = Array.from(map.values());
    }

    saveRangesWithHistory(
      activeClient.id,
      finalRanges,
      filename,
      `Importadas ${newRanges.length} faixas de CEP (${importMode === 'replace' ? 'Substituição total' : 'Mesclagem'})`
    );

    setImportSuccessMsg(`Tabela importada com sucesso! ${newRanges.length} faixas salvas para o cliente ${activeClient.name}.`);
    setParsedPreviewRows([]);
    setImportText('');
  };

  // Multi-Client Master Import Parser
  const handleProcessMultiClientData = (rowsData: any[][], fileName: string = 'Master Multi-Cliente') => {
    setMultiClientError(null);
    setMultiClientSuccessMsg(null);

    if (!rowsData || rowsData.length < 2) {
      setMultiClientError('O arquivo master não possui linhas suficientes.');
      return;
    }

    const headers = rowsData[0].map((h: any) => 
      String(h || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s_-]+/g, '')
    );

    let clientIdx = headers.findIndex((h: string) => h.includes('client') || h.includes('codigo') || h.includes('parceiro') || h.includes('cnpj') || h.includes('empresa'));
    let startIdx = headers.findIndex((h: string) => h.includes('cepini') || h.includes('inicial') || h.includes('start') || h.includes('origem') || h.includes('de') || h === 'cep');
    let endIdx = headers.findIndex((h: string) => h.includes('cepfim') || h.includes('final') || h.includes('end') || h.includes('destino') || h.includes('ate'));
    let valIdx = headers.findIndex((h: string) => h.includes('valornormal') || h.includes('valorfrete') || h.includes('fretenormal') || (h.includes('valor') && !h.includes('repasse')) || h.includes('preco') || h.includes('taxa'));
    let expressIdx = headers.findIndex((h: string) => h.includes('expresso') || h.includes('express') || h.includes('urgente'));
    let repassIdx = headers.findIndex((h: string) => h.includes('repasse') || h.includes('condutor') || h.includes('motorista') || h.includes('driver'));
    let descIdx = headers.findIndex((h: string) => h.includes('desc') || h.includes('regia') || h.includes('bairro'));

    if (clientIdx === -1) clientIdx = 0;
    if (startIdx === -1) startIdx = 1;
    if (endIdx === -1) endIdx = 2;
    if (valIdx === -1) valIdx = 3;
    if (expressIdx === -1) expressIdx = 4;
    if (repassIdx === -1) repassIdx = 5;
    if (descIdx === -1) descIdx = 6;

    const groupResult: Record<string, {
      client: ClientPartner;
      rows: ParsedPreviewRow[];
      validCount: number;
      errorCount: number;
    }> = {};

    for (let i = 1; i < rowsData.length; i++) {
      const row = rowsData[i];
      if (!row || row.length === 0) continue;

      const rawClient = row[clientIdx] !== undefined ? String(row[clientIdx]).trim() : '';
      if (!rawClient) continue;

      // Find matching client
      const matchedClient = clientPartners.find(c => 
        isMatchingClientCode(rawClient, c.id, c.codigoCliente) ||
        c.name.toLowerCase() === rawClient.toLowerCase() ||
        (c.cnpj && c.cnpj.replace(/\D/g, '') === rawClient.replace(/\D/g, ''))
      );

      if (!matchedClient) continue;

      const rawStart = row[startIdx] !== undefined ? String(row[startIdx]).trim() : '';
      const rawEnd = row[endIdx] !== undefined ? String(row[endIdx]).trim() : '';
      const rawValue = row[valIdx] !== undefined ? String(row[valIdx]).trim() : '';
      const rawExpress = expressIdx !== -1 && row[expressIdx] !== undefined ? String(row[expressIdx]).trim() : '';
      const rawRepass = repassIdx !== -1 && row[repassIdx] !== undefined ? String(row[repassIdx]).trim() : '';
      const rawDesc = descIdx !== -1 && row[descIdx] !== undefined ? String(row[descIdx]).trim() : '';

      let cleanStart = cleanCep(rawStart);
      let cleanEnd = cleanCep(rawEnd);

      if (cleanStart.length > 0 && cleanStart.length < 8) cleanStart = cleanStart.padStart(8, '0');
      if (cleanEnd.length > 0 && cleanEnd.length < 8) cleanEnd = cleanEnd.padStart(8, '0');

      if (!groupResult[matchedClient.id]) {
        groupResult[matchedClient.id] = {
          client: matchedClient,
          rows: [],
          validCount: 0,
          errorCount: 0
        };
      }

      if (cleanStart.length !== 8 || cleanEnd.length !== 8) {
        groupResult[matchedClient.id].errorCount++;
        continue;
      }

      const valClean = rawValue.replace('R$', '').replace(/\s/g, '').replace(',', '.');
      const valNum = parseFloat(valClean);
      if (isNaN(valNum) || valNum < 0) {
        groupResult[matchedClient.id].errorCount++;
        continue;
      }

      let expressNum: number | undefined = undefined;
      if (rawExpress) {
        const parsed = parseFloat(rawExpress.replace('R$', '').replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) expressNum = parsed;
      }

      let repassNum: number | undefined = undefined;
      if (rawRepass) {
        const parsed = parseFloat(rawRepass.replace('R$', '').replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) repassNum = parsed;
      }

      groupResult[matchedClient.id].validCount++;
      groupResult[matchedClient.id].rows.push({
        id: `multi-${i}`,
        rawStart, rawEnd, cleanStart, cleanEnd,
        formattedStart: formatCep(cleanStart),
        formattedEnd: formatCep(cleanEnd),
        value: valNum,
        expressValue: expressNum,
        driverRepass: repassNum,
        description: rawDesc || undefined,
        effectiveFrom: useEffectiveDate ? effectiveFrom : undefined,
        status: 'valid',
        statusMessage: 'Válido para atualização'
      });
    }

    if (Object.keys(groupResult).length === 0) {
      setMultiClientError('Nenhum cliente correspondente foi encontrado na planilha master. Certifique-se de usar Códigos de Cliente válidos (ex: CL1-001, CL1-002).');
      return;
    }

    setMultiClientPreview(groupResult);
  };

  // Confirm Multi-Client Batch Import
  const handleConfirmMultiClientImport = () => {
    const clientIds = Object.keys(multiClientPreview);
    if (clientIds.length === 0) return;

    const clientRangesMap: Record<string, { ranges: CepRange[]; history?: CepTableHistoryItem[] }> = {};

    clientIds.forEach(cId => {
      const data = multiClientPreview[cId];
      const newRanges: CepRange[] = data.rows.map((r, idx) => ({
        id: `range-multi-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        cepStart: r.formattedStart,
        cepEnd: r.formattedEnd,
        value: r.value,
        expressValue: r.expressValue,
        driverRepass: r.driverRepass,
        description: r.description,
        effectiveFrom: useEffectiveDate ? effectiveFrom : undefined
      }));

      const timestamp = getSaoPauloDateTimeShort();
      const histItem: CepTableHistoryItem = {
        id: `hist-m-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        importedAt: timestamp,
        filename: 'Importação em Lote Múltiplos Clientes',
        rangesCount: newRanges.length,
        cepRanges: newRanges,
        note: `Atualização automatizada via Planilha Master (${newRanges.length} faixas)`
      };

      clientRangesMap[cId] = {
        ranges: newRanges,
        history: [histItem, ...(data.client.cepRangesHistory || [])]
      };

      onSaveClientCepRanges(cId, newRanges, [histItem, ...(data.client.cepRangesHistory || [])]);
      if (onRecalculateOrdersFreight) {
        onRecalculateOrdersFreight(cId, newRanges);
      }
    });

    if (onBulkSaveClientCepRanges) {
      onBulkSaveClientCepRanges(clientRangesMap);
    }

    setMultiClientSuccessMsg(`Sucesso! Tabelas de frete atualizadas para ${clientIds.length} clientes simultaneamente!`);
    setMultiClientPreview({});
    setMultiClientImportText('');
  };

  // Run Simulator
  const handleRunSimulator = (cepInput: string) => {
    const cleaned = cleanCep(cepInput);
    if (cleaned.length !== 8) {
      setQueryResult({
        matched: false,
        message: 'Digite um CEP completo de 8 dígitos (ex: 01310-100).'
      });
      return;
    }

    const num = parseInt(cleaned, 10);
    const match = activeRanges.find(r => {
      const sNum = parseInt(cleanCep(r.cepStart), 10);
      const eNum = parseInt(cleanCep(r.cepEnd), 10);
      return num >= sNum && num <= eNum;
    });

    if (match) {
      setQueryResult({
        matched: true,
        range: match,
        message: `CEP Coberto! Valor Frete Padrao: R$ ${match.value.toFixed(2)}`
      });
    } else {
      setQueryResult({
        matched: false,
        message: 'Atencao: Este CEP nao consta em nenhuma faixa de frete cadastrada para este cliente.'
      });
    }
  };

  // Export to Excel XLSX
  const handleExportExcel = () => {
    if (!activeClient || activeRanges.length === 0) return;
    const exportData = activeRanges.map(r => ({
      'CEP Inicial': r.cepStart,
      'CEP Final': r.cepEnd,
      'Valor Frete (R$)': r.value,
      'Valor Expresso (R$)': r.expressValue || '-',
      'Repasse Condutor (R$)': r.driverRepass || '-',
      'Descrição / Região': r.description || '-',
      'Vigência': r.effectiveFrom || 'Sempre Ativa'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tabela de Frete');
    XLSX.writeFile(workbook, `Tabela_Frete_${activeClient.name.replace(/\s+/g, '_')}.xlsx`);
  };

  // Export PDF Report
  const handleExportPDF = () => {
    if (!activeClient || activeRanges.length === 0) return;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`Tabela de Frete de Entregas - ${activeClient.name}`, 14, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Código Cliente: ${activeClient.codigoCliente || activeClient.id} | CNPJ: ${activeClient.cnpj || '-'}`, 14, 25);
    doc.text(`Região: ${activeClient.region} | Emitido em: ${getSaoPauloDateTimeShort()}`, 14, 31);

    const tableData = activeRanges.map(r => [
      r.cepStart,
      r.cepEnd,
      `R$ ${r.value.toFixed(2)}`,
      r.expressValue ? `R$ ${r.expressValue.toFixed(2)}` : '-',
      r.driverRepass ? `R$ ${r.driverRepass.toFixed(2)}` : '-',
      r.description || '-',
      r.effectiveFrom || 'Sempre Ativa'
    ]);

    autoTable(doc, {
      startY: 36,
      head: [['CEP Inicial', 'CEP Final', 'Valor Frete', 'Expresso', 'Repasse Condutor', 'Região / Descrição', 'Vigência']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    doc.save(`Tabela_Frete_${activeClient.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className={`bg-white flex flex-col ${isModalView ? 'w-full h-full max-h-screen rounded-none border-0 overflow-hidden' : 'rounded-2xl shadow-sm border border-slate-100 p-6'}`}>
      
      {/* HEADER SECTION & CLIENT SELECTOR */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-100">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-850 tracking-tight flex items-center gap-2">
                Controle de Importação da Tabela de Frete
                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Por Cliente
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerencie, importe e simule tabelas de frete e tarifas customizadas por cliente parceiro
              </p>
            </div>
          </div>
        </div>

        {/* Client Switcher & Batch Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {clientPartners.map(c => (
                <option key={c.id} value={c.id}>
                  {c.codigoCliente ? `[${c.codigoCliente}] ` : ''}{c.name} ({c.region})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setActiveTab('lote_multiplos')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'lote_multiplos'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-100'
            }`}
          >
            <Layers size={14} />
            <span>Importação em Lote (Master)</span>
          </button>

          {isModalView && onCloseModal && (
            <button
              onClick={onCloseModal}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 shadow-xs hover:shadow-rose-200 hover:shadow-md border border-rose-200 hover:border-rose-600 active:scale-95 shrink-0 ml-1 group"
              title="Fechar Tabela de Frete (Atalho: ESC)"
            >
              <X size={16} className="stroke-[2.5] text-rose-600 group-hover:text-white transition-colors" />
              <span className="font-extrabold tracking-wide">Fechar</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-white/80 group-hover:bg-white/20 text-rose-800 group-hover:text-white rounded border border-rose-200/80 group-hover:border-white/30 ml-0.5">
                ESC
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE CLIENT SUMMARY CARD */}
      {activeClient && activeTab !== 'lote_multiplos' && (
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-500/30 text-blue-200 font-extrabold px-2 py-0.5 rounded border border-blue-400/30 font-mono">
                    {activeClient.codigoCliente || activeClient.id}
                  </span>
                  <span className="text-xs bg-emerald-500/30 text-emerald-300 font-extrabold px-2 py-0.5 rounded border border-emerald-400/30 uppercase">
                    {activeClient.type}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">CNPJ: {activeClient.cnpj || '-'}</span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                  {activeClient.name}
                </h3>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Faixas de CEP</span>
                <span className="font-extrabold text-blue-300 text-sm">{clientStats.totalRanges} ativas</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Frete Médio</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  {clientStats.avgFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Média Repasse</span>
                <span className="font-extrabold text-amber-300 text-sm">
                  {clientStats.avgRepass.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Vigência</span>
                <span className="font-extrabold text-slate-200 text-xs truncate block">{clientStats.effectiveDate}</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1 p-2 bg-slate-100/70 border-b border-slate-200 overflow-x-auto select-none scrollbar-none">
        <button
          onClick={() => setActiveTab('tabela_ativa')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tabela_ativa'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>Tabela Ativa ({activeRanges.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('importar')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'importar'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Upload size={15} />
          <span>Importar Nova Tabela (Upload / Texto)</span>
        </button>

        <button
          onClick={() => setActiveTab('lote_multiplos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'lote_multiplos'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-violet-700 hover:bg-violet-100/60'
          }`}
        >
          <Layers size={15} />
          <span>Importação Master Múltiplos Clientes</span>
        </button>

        <button
          onClick={() => setActiveTab('historico')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'historico'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <History size={15} />
          <span>Histórico de Importações ({historyList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('simulador')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'simulador'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Calculator size={15} />
          <span>Simulador de Frete</span>
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="p-5 overflow-y-auto flex-1 space-y-6">

        {/* 1. TABELA ATIVA */}
        {activeTab === 'tabela_ativa' && activeClient && (
          <div className="space-y-5">
            
            {/* Quick Actions & Export Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por CEP ou Descrição de Bairro..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={activeRanges.length === 0}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet size={13} />
                  <span>Exportar Excel</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={activeRanges.length === 0}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <FileText size={13} />
                  <span>Gerar Relatório PDF</span>
                </button>
              </div>
            </div>

            {/* Manual Add Form */}
            <form onSubmit={handleAddManual} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
              <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider block">
                Adicionar Nova Faixa de CEP Manualmente:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">CEP Inicial *</label>
                  <input
                    type="text"
                    placeholder="01000-000"
                    value={manualStart}
                    onChange={(e) => setManualStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">CEP Final *</label>
                  <input
                    type="text"
                    placeholder="01999-999"
                    value={manualEnd}
                    onChange={(e) => setManualEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Frete Padrão (R$) *</label>
                  <input
                    type="text"
                    placeholder="15.00"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Frete Expresso (R$)</label>
                  <input
                    type="text"
                    placeholder="25.00"
                    value={manualExpressValue}
                    onChange={(e) => setManualExpressValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-violet-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Repasse Condutor (R$)</label>
                  <input
                    type="text"
                    placeholder="10.00"
                    value={manualDriverRepass}
                    onChange={(e) => setManualDriverRepass(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-amber-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Região / Descrição</label>
                  <input
                    type="text"
                    placeholder="Centro SP"
                    value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} />
                  <span>Adicionar Faixa</span>
                </button>
              </div>
            </form>

            {/* Active Ranges Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800 text-white text-[11px] uppercase font-extrabold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">CEP Inicial</th>
                    <th className="px-4 py-3">CEP Final</th>
                    <th className="px-4 py-3">Frete Padrão</th>
                    <th className="px-4 py-3">Frete Expresso</th>
                    <th className="px-4 py-3">Repasse Condutor</th>
                    <th className="px-4 py-3">Região / Descrição</th>
                    <th className="px-4 py-3">Vigência</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {activeRanges.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Nenhuma faixa de CEP cadastrada para este cliente. Importe uma planilha ou adicione manualmente acima.
                      </td>
                    </tr>
                  ) : (
                    activeRanges
                      .filter(r => 
                        !filterQuery.trim() ||
                        r.cepStart.includes(filterQuery) ||
                        r.cepEnd.includes(filterQuery) ||
                        (r.description && r.description.toLowerCase().includes(filterQuery.toLowerCase()))
                      )
                      .map((range) => {
                        const isEditing = editingRangeId === range.id;
                        return (
                          <tr key={range.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{range.cepStart}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{range.cepEnd}</td>

                            {/* Frete Padrão */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-20 px-1.5 py-0.5 border border-blue-500 rounded text-xs font-bold text-emerald-700"
                                />
                              ) : (
                                <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  {range.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              )}
                            </td>

                            {/* Frete Expresso */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingExpressValue}
                                  onChange={(e) => setEditingExpressValue(e.target.value)}
                                  className="w-20 px-1.5 py-0.5 border border-blue-500 rounded text-xs font-bold text-violet-700"
                                />
                              ) : range.expressValue ? (
                                <span className="font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                                  {range.expressValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Repasse Condutor */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingDriverRepass}
                                  onChange={(e) => setEditingDriverRepass(e.target.value)}
                                  className="w-20 px-1.5 py-0.5 border border-blue-500 rounded text-xs font-bold text-amber-700"
                                />
                              ) : range.driverRepass ? (
                                <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  {range.driverRepass.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Descrição */}
                            <td className="px-4 py-3 text-slate-600 font-semibold">{range.description || '-'}</td>

                            {/* Vigência */}
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                              {range.effectiveFrom ? range.effectiveFrom : 'Ativa'}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleConfirmInlineEdit(range.id)}
                                    className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                    title="Salvar"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={() => setEditingRangeId(null)}
                                    className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                    title="Cancelar"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingRangeId(range.id);
                                      setEditingValue(range.value.toString());
                                      setEditingExpressValue(range.expressValue ? range.expressValue.toString() : '');
                                      setEditingDriverRepass(range.driverRepass ? range.driverRepass.toString() : '');
                                      setEditingEffectiveFrom(range.effectiveFrom || '');
                                    }}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded"
                                    title="Editar valores"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveRange(range.id)}
                                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded"
                                    title="Excluir faixa"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* 2. IMPORTAR NOVA TABELA (UPLOAD OU TEXTO) */}
        {activeTab === 'importar' && activeClient && (
          <div className="space-y-6">
            
            {/* Mode & Date Settings */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Modo de Importação:
                </label>
                <div className="flex items-center gap-3 mt-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-blue-600"
                    />
                    Substituir Tabela Ativa (Recomendado)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-blue-600"
                    />
                    Mesclar / Atualizar Existentes
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Início de Vigência dos Novos Preços:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500">
                    Pedidos criados após esta data usarão a nova tarifa.
                  </span>
                </div>
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleSingleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleSingleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl mb-2 shadow-sm">
                  <Upload size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Selecione ou Arraste Planilha Excel (.xlsx / .csv)</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  A planilha deve conter colunas com CEP Inicial, CEP Final e Valor Frete.
                </p>
              </div>

              {/* Copy & Paste Area */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Cole Linhas de Planilha (Excel / Google Sheets):</span>
                  <span className="text-[10px] text-blue-600 font-extrabold">Formato TSV / CSV</span>
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Cole as linhas aqui...\nExemplo:\n01000-000\t01999-999\t15.00\t25.00\t10.00\tCentro SP`}
                  className="w-full h-28 p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleProcessTextImport}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={14} />
                  <span>Processar Texto Copiado</span>
                </button>
              </div>
            </div>

            {/* Error / Success Alerts */}
            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check size={16} className="shrink-0 text-emerald-600" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {/* Interactive Pre-Import Preview Table */}
            {parsedPreviewRows.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    Pré-Visualização do Conteúdo ({parsedPreviewRows.length} linhas)
                  </h4>
                  <button
                    onClick={() => handleConfirmSingleImport('Planilha Importada')}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check size={15} />
                    <span>Confirmar e Aplicar ao Cliente</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2">CEP Inicial</th>
                        <th className="px-3 py-2">CEP Final</th>
                        <th className="px-3 py-2">Valor Frete</th>
                        <th className="px-3 py-2">Expresso</th>
                        <th className="px-3 py-2">Repasse Condutor</th>
                        <th className="px-3 py-2">Status Validação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {parsedPreviewRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-bold">{row.formattedStart}</td>
                          <td className="px-3 py-2 font-mono font-bold">{row.formattedEnd}</td>
                          <td className="px-3 py-2 font-extrabold text-emerald-700">
                            {row.value ? row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </td>
                          <td className="px-3 py-2 font-bold text-violet-700">
                            {row.expressValue ? row.expressValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </td>
                          <td className="px-3 py-2 font-bold text-amber-700">
                            {row.driverRepass ? row.driverRepass.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              row.status === 'valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'price_updated'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {row.statusMessage}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 3. IMPORTAÇÃO MASTER MÚLTIPLOS CLIENTES */}
        {activeTab === 'lote_multiplos' && (
          <div className="space-y-6">
            <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-violet-900 flex items-center gap-2">
                  <Layers size={18} className="text-violet-600" />
                  Importador de Tabela de Frete Master (Múltiplos Clientes Simultâneos)
                </h3>
                <p className="text-xs text-violet-700 mt-0.5 max-w-2xl">
                  Atualize as tabelas de frete de vários clientes de uma só vez importando uma única planilha com a coluna identificadora do cliente (Ex: Código, CNPJ ou Nome).
                </p>
              </div>

              <button
                onClick={() => multiFileInputRef.current?.click()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 cursor-pointer inline-flex items-center gap-2 shrink-0"
              >
                <Upload size={15} />
                <span>Selecionar Planilha Master (.xlsx)</span>
              </button>
              <input
                ref={multiFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const buffer = evt.target?.result as ArrayBuffer;
                      if (!buffer) return;
                      const data = new Uint8Array(buffer);
                      const workbook = XLSX.read(data, { type: 'array' });
                      const sheet = workbook.Sheets[workbook.SheetNames[0]];
                      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                      handleProcessMultiClientData(rows, file.name);
                    };
                    reader.readAsArrayBuffer(file);
                  }
                }}
              />
            </div>

            {multiClientError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{multiClientError}</span>
              </div>
            )}

            {multiClientSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check size={16} className="text-emerald-600" />
                <span>{multiClientSuccessMsg}</span>
              </div>
            )}

            {/* Breakdown per client */}
            {Object.keys(multiClientPreview).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Resumo do Processamento Por Cliente ({Object.keys(multiClientPreview).length} clientes encontrados)
                  </span>
                  <button
                    onClick={handleConfirmMultiClientImport}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 cursor-pointer inline-flex items-center gap-2"
                  >
                    <Check size={16} />
                    <span>Aplicar Tabelas para Todos os Clientes</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Object.entries(multiClientPreview) as [string, { client: ClientPartner; rows: ParsedPreviewRow[]; validCount: number; errorCount: number }][]).map(([cId, data]) => (
                    <div key={cId} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">{data.client.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded">
                          {data.client.codigoCliente || data.client.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-700 font-extrabold">{data.validCount} faixas válidas</span>
                        {data.errorCount > 0 && (
                          <span className="text-rose-600 font-bold">{data.errorCount} erros ignorados</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. HISTÓRICO & AUDITORIA */}
        {activeTab === 'historico' && activeClient && (
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Histórico e Linha do Tempo das Tabelas Importadas
            </h4>

            {historyList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Nenhuma alteração registrada no histórico para este cliente.
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((item) => (
                  <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <History size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{item.filename}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.5 rounded">
                            {item.importedAt}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewHistoryItem(item)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye size={13} />
                        <span>Visualizar</span>
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`Deseja restaurar a tabela "${item.filename}" com ${item.rangesCount} faixas?`)) {
                            saveRangesWithHistory(
                              activeClient.id,
                              item.cepRanges,
                              `Restauração: ${item.filename}`,
                              `Restaurada tabela histórica de ${item.importedAt}`
                            );
                            alert('Tabela restaurada com sucesso!');
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-sm"
                      >
                        <RotateCcw size={13} />
                        <span>Restaurar Tabela</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. SIMULADOR DE FRETE */}
        {activeTab === 'simulador' && activeClient && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Calculator size={18} className="text-blue-400" />
                Simulador e Consulta Direta de Tarifas
              </h3>
              <p className="text-xs text-slate-300">
                Digite um CEP para verificar a regra de preço e o repasse ao condutor de acordo com a tabela do cliente <strong>{activeClient.name}</strong>.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite o CEP (ex: 01310-100)"
                  value={queryCep}
                  onChange={(e) => {
                    setQueryCep(e.target.value);
                    if (cleanCep(e.target.value).length === 8) {
                      handleRunSimulator(e.target.value);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleRunSimulator(queryCep)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Consultar CEP
                </button>
              </div>
            </div>

            {queryResult && (
              <div className={`p-5 rounded-2xl border ${
                queryResult.matched ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl text-white ${queryResult.matched ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                    <MapPin size={20} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h4 className={`text-sm font-bold ${queryResult.matched ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {queryResult.message}
                    </h4>

                    {queryResult.matched && queryResult.range && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                        <div>
                          <span className="text-[10px] text-emerald-800 font-semibold block uppercase">Frete Padrão</span>
                          <span className="font-extrabold text-emerald-900 text-sm">
                            R$ {queryResult.range.value.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-800 font-semibold block uppercase">Frete Expresso</span>
                          <span className="font-extrabold text-violet-800 text-sm">
                            {queryResult.range.expressValue ? `R$ ${queryResult.range.expressValue.toFixed(2)}` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-800 font-semibold block uppercase">Repasse Condutor</span>
                          <span className="font-extrabold text-amber-800 text-sm">
                            {queryResult.range.driverRepass ? `R$ ${queryResult.range.driverRepass.toFixed(2)}` : '-'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* PREVIEW HISTORY ITEM MODAL */}
      {previewHistoryItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">
                Visualizar Tabela Histórica: {previewHistoryItem.filename}
              </h3>
              <button
                onClick={() => setPreviewHistoryItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">CEP Inicial</th>
                    <th className="px-3 py-2">CEP Final</th>
                    <th className="px-3 py-2">Frete</th>
                    <th className="px-3 py-2">Expresso</th>
                    <th className="px-3 py-2">Repasse</th>
                  </tr>
                </thead>
                <tbody>
                  {previewHistoryItem.cepRanges.map(r => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-1.5 font-mono">{r.cepStart}</td>
                      <td className="px-3 py-1.5 font-mono">{r.cepEnd}</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">R$ {r.value.toFixed(2)}</td>
                      <td className="px-3 py-1.5 font-bold text-violet-700">{r.expressValue ? `R$ ${r.expressValue.toFixed(2)}` : '-'}</td>
                      <td className="px-3 py-1.5 font-bold text-amber-700">{r.driverRepass ? `R$ ${r.driverRepass.toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewHistoryItem(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
