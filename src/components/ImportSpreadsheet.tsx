/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Info, 
  Trash2, 
  Check, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  XOctagon,
  Search,
  X
} from 'lucide-react';
import { Order, DeliveryRider, ClientPartner, isMatchingClientCode, OrderStatus } from '../types';
import { getOrderFreightValue, calculateRiderCommissionForOrder } from '../utils/billingUtils';
import { matchesAddressQuery } from '../utils/addressUtils';
import { findRiderByIdentifier } from '../utils/partnerUtils';
import * as XLSX from 'xlsx';
import { getSaoPauloDateTimeShort, getSaoPauloISODate, getSaoPauloTime, getSaoPauloDate, formatToBrazilianDate, extractISODateFromTimestamp } from '../utils/dateUtils';

interface ImportSpreadsheetProps {
  orders: Order[];
  riders: DeliveryRider[];
  clientPartners: ClientPartner[];
  onImportOrders: (imported: Order[]) => void;
  onNavigateToOrders?: () => void;
}

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export default function ImportSpreadsheet({ orders, riders, clientPartners, onImportOrders, onNavigateToOrders }: ImportSpreadsheetProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Record<number, boolean>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [importSummary, setImportSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeKey = (key: string): string => {
    return key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  };

  const getRowValue = (data: Record<string, string>, fieldName: string): string => {
    const keys = Object.keys(data);
    const normalizedTarget = normalizeKey(fieldName);
    const match = keys.find(k => normalizeKey(k) === normalizedTarget);
    return match ? data[match] : '';
  };

  // Expected 32 columns
  const REQUIRED_COLUMNS = [
    'Sequencia', 'CodigoCliente', 'DataSolicitacao', 'Pedido', 'ProcurarPor', 
    'Endereco', 'CEP', 'Telefone', 'DispositivoCondutor', 'Complemento', 
    'ValorNotaFiscal', 'HorarioFinal', 'Email', 'DocumentoEmpresa', 'TipoEntrega', 
    'Chamado', 'DANFE', 'DataLimite', 'NomeFantasia', 'HorarioInicio', 
    'DataAgendamento', 'CidadeMunicipio', 'Estado', 'Detalhe', 'ValorReceber', 
    'ValorEntrega', 'Latitude', 'Longitude', 'DestinatarioCnpjCpf', 'ValorCondutor',
    'Prioridade', 'DataConclusao'
  ];

  // Helper to get today's date formatted as YYYY-MM-DD in SP timezone
  const getTodayDateStr = () => {
    return getSaoPauloISODate();
  };

  const getRealTodayDateStr = () => {
    return getSaoPauloISODate();
  };

  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleaned = dateStr.trim();

    // Check if it's an Excel date serial number (e.g. "46205")
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      const num = parseFloat(cleaned);
      if (num > 30000 && num < 60000) {
        const date = new Date(1899, 11, 30);
        date.setDate(date.getDate() + Math.floor(num));
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Try extractISODateFromTimestamp
    const extracted = extractISODateFromTimestamp(cleaned);
    if (extracted) return extracted;

    if (cleaned.includes('/')) {
      const parts = cleaned.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return cleaned;
        } else {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          return `${year}-${month}-${day}`;
        }
      }
    }

    return cleaned;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // Enable cellDates so SheetJS parses dates to real Date objects where possible
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to an array of arrays (rows)
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        parseExcelData(jsonData);
      } catch (err) {
        console.error("Erro ao ler planilha: ", err);
        alert("Erro ao decodificar a planilha. Verifique se o arquivo está corrompido ou em formato inválido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseExcelData = (rowsData: any[][]) => {
    // Filter empty rows
    const nonAmptyRows = rowsData.filter(row => row && row.length > 0 && row.some(cell => String(cell).trim() !== ''));
    if (nonAmptyRows.length < 2) {
      alert("A planilha está vazia ou não contém dados suficientes (mínimo cabeçalho + 1 linha).");
      return;
    }

    // First row is the header - support all columns, even empty ones
    const sheetHeaders = nonAmptyRows[0].map((h, idx) => String(h || '').trim() || `Coluna ${idx + 1}`);
    setHeaders(sheetHeaders);

    // Map columns
    const headerMap: Record<string, number> = {};
    REQUIRED_COLUMNS.forEach(col => {
      const idx = sheetHeaders.findIndex(h => normalizeKey(h) === normalizeKey(col));
      if (idx !== -1) {
        headerMap[col] = idx;
      }
    });

    // Check how many of our 30 columns exist
    const missingColumns = REQUIRED_COLUMNS.filter(col => headerMap[col] === undefined);
    if (missingColumns.length > 15) { // If too many columns are missing, alert
      alert(`As colunas da planilha não correspondem ao modelo de 30 colunas esperado. Colunas ausentes detectadas: ${missingColumns.slice(0, 5).join(', ')}...`);
      return;
    }

    const todayBaseline = getTodayDateStr(); // "2026-07-02"
    const todayReal = getRealTodayDateStr(); // current calendar date

    const rows: ParsedRow[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = 1; i < nonAmptyRows.length; i++) {
      const rowCells = nonAmptyRows[i];

      // Map cells to ALL headers in the sheet, keeping empty values
      const rowData: Record<string, string> = {};
      sheetHeaders.forEach((header, index) => {
        let val = '';
        if (index < rowCells.length) {
          const rawVal = rowCells[index];
          if (rawVal !== null && rawVal !== undefined) {
            const isDateCol = ['datasolicitacao', 'datalimite', 'dataagendamento'].includes(header.toLowerCase());
            if (rawVal instanceof Date) {
              const year = rawVal.getFullYear();
              const month = String(rawVal.getMonth() + 1).padStart(2, '0');
              const day = String(rawVal.getDate()).padStart(2, '0');
              val = `${year}-${month}-${day}`;
            } else if (isDateCol && typeof rawVal === 'number') {
              const date = new Date(1899, 11, 30);
              date.setDate(date.getDate() + Math.floor(rawVal));
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              val = `${year}-${month}-${day}`;
            } else if (isDateCol && typeof rawVal === 'string' && /^\d+(\.\d+)?$/.test(rawVal.trim())) {
              const num = parseFloat(rawVal.trim());
              if (num > 30000 && num < 60000) {
                const date = new Date(1899, 11, 30);
                date.setDate(date.getDate() + Math.floor(num));
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                val = `${year}-${month}-${day}`;
              } else {
                val = rawVal.trim();
              }
            } else {
              val = String(rawVal).trim();
            }
          }
        }
        rowData[header] = val;
      });

      // Validations using case-insensitive helpers
      const errors: string[] = [];
      const warnings: string[] = [];

      const seq = getRowValue(rowData, 'Sequencia');
      let codCliente = getRowValue(rowData, 'CodigoCliente') || getRowValue(rowData, 'NomeFantasia') || getRowValue(rowData, 'Cliente') || getRowValue(rowData, 'Parceiro');
      const dataSol = getRowValue(rowData, 'DataSolicitacao');
      const pedidoNum = getRowValue(rowData, 'Pedido');
      const procurarPor = getRowValue(rowData, 'ProcurarPor');
      const endereco = getRowValue(rowData, 'Endereco');
      const cep = getRowValue(rowData, 'CEP');

      // Rule 1: Priority / mandatory fields check (*)
      if (!pedidoNum) errors.push("Campo obrigatório ausente: 'Pedido' (Número do Pedido).");
      if (!procurarPor) errors.push("Campo obrigatório ausente: 'ProcurarPor' (Nome do Cliente).");
      if (!endereco) errors.push("Campo obrigatório ausente: 'Endereco' (Endereço de entrega).");
      if (!cep) errors.push("Campo obrigatório ausente: 'CEP'.");
      if (!codCliente) {
        errors.push("Campo obrigatório ausente: 'CodigoCliente' ou 'NomeFantasia' (Cliente Parceiro).");
      } else {
        const isValidRawCode = clientPartners?.some(cp => 
          isMatchingClientCode(codCliente.trim(), cp.id, cp.codigoCliente) ||
          cp.name.toLowerCase() === codCliente.trim().toLowerCase()
        );
        if (!isValidRawCode) {
          warnings.push(`O parceiro '${codCliente}' será cadastrado automaticamente no sistema ao importar.`);
        }
      }

      // Rule 2: Mandatory 'DataSolicitacao' (Obrigatório estar preenchido quando houver dados na linha)
      if (!dataSol || !dataSol.trim()) {
        errors.push("Campo obrigatório ausente: 'DataSolicitacao' (A data da solicitação deve estar preenchida).");
      } else {
        const normalizedSolDate = normalizeDate(dataSol);
        if (!normalizedSolDate || normalizedSolDate.length < 8) {
          errors.push(`Campo 'DataSolicitacao' com formato inválido: '${dataSol}'. Utilize o padrão brasileiro DD/MM/AAAA ou DD-MM-AAAA.`);
        }
      }

      // Rule 3: Duplication check against existing orders in the system:
      // Allow orders with the same order number if partner client is different!
      if (pedidoNum && codCliente) {
        const fullId = 'ped-' + pedidoNum;
        
        let resolvedPartnerId = codCliente.trim();
        const matchedCp = clientPartners?.find(cp => 
          isMatchingClientCode(codCliente.trim(), cp.id, cp.codigoCliente)
        );
        if (matchedCp) {
          resolvedPartnerId = matchedCp.id;
        }

        const duplicateOrder = orders.find(o => 
          (o.id === fullId || o.id === pedidoNum || (o.rawData && (getRowValue(o.rawData, 'Pedido') === pedidoNum || o.rawData.Pedido === pedidoNum))) && 
          (o.partnerName.toLowerCase() === resolvedPartnerId.toLowerCase() ||
           (matchedCp && isMatchingClientCode(o.partnerName, matchedCp.id, matchedCp.codigoCliente)))
        );

        if (duplicateOrder) {
          if (duplicateOrder.status !== 'Cancelado') {
            errors.push(`Duplicado: Já existe o pedido #${pedidoNum} para o parceiro '${codCliente}' com status '${duplicateOrder.status}'.`);
            duplicateCount++;
          } else {
            warnings.push(`O pedido #${pedidoNum} já existe no sistema para o parceiro '${codCliente}' com status 'Cancelado', portanto será reimportado.`);
          }
        }
      }

      const isValid = errors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }

      rows.push({
        index: i,
        data: rowData,
        isValid,
        errors,
        warnings
      });
    }

    setParsedRows(rows);
    const initialSelected: Record<number, boolean> = {};
    rows.forEach(r => {
      if (r.isValid) {
        initialSelected[r.index] = true;
      }
    });
    setSelectedRowIndexes(initialSelected);
    setImportSummary({
      total: rows.length,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount
    });
  };

  const handleDownloadTemplate = () => {
    // Generate genuine Excel spreadsheet (.xlsx) template file with today's real date in Brazilian format (DD/MM/YYYY)
    const todayBrStr = getSaoPauloDate(); // e.g. "17/08/2026"
    const headers = REQUIRED_COLUMNS;
    const sampleRow1 = [
      '1', 'PARCEIRO-01', todayBrStr, '901', 'Cliente Exemplo 1', 'Av. Paulista, 1000', '01310-100', '11999998888', '', 'Apto 42', '120.50', '18:00', 'cliente1@exemplo.com', '12345678000199', 'Rápida', 'CH-991', 'DANFE-111', todayBrStr, 'Parceiro Modelo Exemplo', '14:00', todayBrStr, 'São Paulo', 'SP', 'Entregar na portaria', '120.50', '12.00', '-23.5612', '-46.6543', '12345678909', '8.50', 'expresso', todayBrStr
    ];
    const sampleRow2 = [
      '2', 'PARCEIRO-02', todayBrStr, '902', 'Cliente Exemplo 2', 'Rua Augusta, 500', '01304-001', '11988887777', '', 'Casa fundos', '75.00', '19:00', 'cliente2@exemplo.com', '98765432000188', 'Normal', 'CH-992', 'DANFE-222', todayBrStr, 'Parceiro Modelo B', '15:00', todayBrStr, 'São Paulo', 'SP', 'Tocar o interfone', '75.00', '10.00', '-23.5512', '-46.6643', '98765432101', '7.00', '', todayBrStr
    ];

    const aoaData = [headers, sampleRow1, sampleRow2];
    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo_Importacao");
    
    XLSX.writeFile(workbook, "modelo_importacao_pedidos.xlsx");
  };

  const handleExecuteImport = () => {
    const selectedValidRows = parsedRows.filter(r => r.isValid && selectedRowIndexes[r.index]);
    if (selectedValidRows.length === 0) {
      alert("Nenhum pedido selecionado para importar.");
      return;
    }

    // Map rows to system Order model
    const newOrders: Order[] = selectedValidRows.map(row => {
      const data = row.data;
      const rawValorReceber = getRowValue(data, 'ValorReceber') || getRowValue(data, 'valorreceber') || getRowValue(data, 'VALORRECEBER');
      const rawValorNotaFiscal = getRowValue(data, 'ValorNotaFiscal') || getRowValue(data, 'valornotafiscal') || getRowValue(data, 'VALORNOTAFISCAL') || getRowValue(data, 'ValorMercadoria') || getRowValue(data, 'valormercadoria');
      let valNF = 0;
      
      if (rawValorReceber && rawValorReceber.trim() !== '') {
        const parsed = parseFloat(String(rawValorReceber).replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          valNF = parsed;
        }
      } else if (rawValorNotaFiscal && rawValorNotaFiscal.trim() !== '') {
        const parsed = parseFloat(String(rawValorNotaFiscal).replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          valNF = parsed;
        }
      }
      
      // Determine region based on CEP
      const cep = getRowValue(data, 'CEP');
      const formattedCep = (() => {
        let cleanCep = (cep || '').replace(/\D/g, '');
        if (cleanCep.length > 0 && cleanCep.length < 8) {
          cleanCep = cleanCep.padStart(8, '0');
        }
        if (cleanCep.length === 8) {
          return `${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`;
        }
        return cep;
      })();
      const cepStr = formattedCep.replace(/\D/g, '');
      let region = 'Centro';
      const cepPrefix = parseInt(cepStr.substring(0, 5)) || 0;
      if (cepPrefix >= 4000 && cepPrefix <= 4999) region = 'Zona Sul';
      else if (cepPrefix >= 5000 && cepPrefix <= 5999) region = 'Zona Oeste';
      else if (cepPrefix >= 2000 && cepPrefix <= 2999) region = 'Zona Norte';
      else if (cepPrefix >= 3000 && cepPrefix <= 3999) region = 'Zona Leste';

      // Find matching rider ID from DispositivoCondutor, Condutor, Entregador, Motorista, etc.
      let matchedRiderId = undefined;
      const rawCondutorVal = (
        getRowValue(data, 'DispositivoCondutor') ||
        getRowValue(data, 'Condutor') ||
        getRowValue(data, 'NomeCondutor') ||
        getRowValue(data, 'Entregador') ||
        getRowValue(data, 'NomeEntregador') ||
        getRowValue(data, 'Motorista') ||
        getRowValue(data, 'NomeMotorista') ||
        getRowValue(data, 'Rider') ||
        getRowValue(data, 'Driver')
      ).trim();
      
      const condutorVal = rawCondutorVal.toLowerCase();
      const genericKeywords = ['condutor', 'entregador', 'dispositivo', 'moto', 'sem condutor', 'não alocado', 'nao alocado', 'não vinculado', 'nao vinculado', 'nenhum', 'unassign', 'desalocar', 'null', 'undefined', '-'];
      
      if (condutorVal && !genericKeywords.includes(condutorVal)) {
        const foundRider = findRiderByIdentifier(riders, rawCondutorVal) || riders.find(r => 
          r.id.toLowerCase() === condutorVal || 
          r.name.toLowerCase() === condutorVal ||
          (r.deviceNumber && r.deviceNumber.trim().toLowerCase() === condutorVal) ||
          (r.phone && r.phone.replace(/\D/g, '') === condutorVal.replace(/\D/g, '') && condutorVal.replace(/\D/g, '').length >= 8) ||
          (!genericKeywords.some(gk => gk.includes(condutorVal)) && r.name.toLowerCase().includes(condutorVal) && condutorVal.length >= 4)
        );
        if (foundRider) {
          matchedRiderId = foundRider.id;
        }
      }

      // 1. Resolve correct client partner ID or fallback
      const partnerName = (() => {
        const codClienteVal = getRowValue(data, 'CodigoCliente').trim();
        const matchedCp = clientPartners?.find(cp => 
          isMatchingClientCode(codClienteVal, cp.id, cp.codigoCliente)
        );
        if (matchedCp) return matchedCp.id;
        return codClienteVal;
      })();

      const valEntregaRaw = getRowValue(data, 'ValorEntrega');
      const valCondutorRaw = getRowValue(data, 'ValorCondutor');
      const parsedValEntrega = valEntregaRaw ? parseFloat(valEntregaRaw.replace(',', '.')) : undefined;
      const parsedValCondutor = valCondutorRaw ? parseFloat(valCondutorRaw.replace(',', '.')) : undefined;

      // Parse spreadsheet priority field: blank -> "Normal", "expresso" -> "expresso"
      const rawPrioridade = (getRowValue(data, 'Prioridade') || getRowValue(data, 'prioridade') || '').trim();
      const itemPriority = rawPrioridade.toLowerCase() === 'expresso' ? 'expresso' : 'Normal';

      // 2. Compute correct freight value based on CepRanges of the matched partner
      const tempOrderForFreight: any = {
        partnerName,
        cep: formattedCep,
        priority: itemPriority,
        deliveryValue: (parsedValEntrega !== undefined && !isNaN(parsedValEntrega)) ? parsedValEntrega : undefined,
        rawData: data
      };
      const finalFreightValue = getOrderFreightValue(tempOrderForFreight as Order, clientPartners || []);

      // 3. Compute correct driver commission based on billing model
      const tempOrderForCommission: any = {
        value: valNF,
        partnerName,
        cep: formattedCep,
        priority: itemPriority,
        deliveryValue: finalFreightValue,
        riderId: matchedRiderId,
        rawData: data,
        status: 'Não iniciado'
      };
      const foundRider = findRiderByIdentifier(riders, matchedRiderId) || riders.find(r => r.id === matchedRiderId);
      const commissionResult = calculateRiderCommissionForOrder(foundRider, tempOrderForCommission as Order, clientPartners || []);
      const finalDriverValue = matchedRiderId ? commissionResult.total : (parsedValCondutor !== undefined && !isNaN(parsedValCondutor) ? parsedValCondutor : undefined);

      const rawPedido = getRowValue(data, 'Pedido');
      const baseId = 'ped-' + rawPedido;
      // Check if baseId is already used by a DIFFERENT partner client in existing orders
      const isBaseIdTaken = orders.some(o => o.id === baseId && o.partnerName.toLowerCase() !== partnerName.toLowerCase());
      const uniqueOrderId = isBaseIdTaken ? `ped-${partnerName}-${rawPedido}` : baseId;

      // Parse explicit Latitude and Longitude from Excel columns or generate based on CEP prefix
      const rawLat = getRowValue(data, 'Latitude') || getRowValue(data, 'latitude');
      const rawLng = getRowValue(data, 'Longitude') || getRowValue(data, 'longitude');
      let orderLat: number | undefined = rawLat ? parseFloat(rawLat.replace(',', '.')) : undefined;
      let orderLng: number | undefined = rawLng ? parseFloat(rawLng.replace(',', '.')) : undefined;

      if ((orderLat === undefined || isNaN(orderLat)) && cepStr.length === 8) {
        const prefix = parseInt(cepStr.substring(0, 5)) || 1000;
        const latBase = -23.55052;
        const lngBase = -46.633308;
        const offset1 = ((prefix % 100) - 50) * 0.0025;
        const offset2 = ((prefix % 73) - 36) * 0.0025;
        orderLat = parseFloat((latBase + offset1).toFixed(6));
        orderLng = parseFloat((lngBase + offset2).toFixed(6));
      }

      // Check if Excel explicitly provides dataConclusao and status
      const rawStatusVal = (getRowValue(data, 'Status') || getRowValue(data, 'status') || getRowValue(data, 'Situacao') || getRowValue(data, 'situação') || '').trim().toLowerCase();
      const isExplicitlyConcluidoInExcel = rawStatusVal === 'concluído' || rawStatusVal === 'concluido' || rawStatusVal === 'entregue' || rawStatusVal === 'baixado';
      
      const initialStatus: OrderStatus = isExplicitlyConcluidoInExcel ? 'Concluído' : 'Não iniciado';
      const rawDataConclusao = normalizeDate(getRowValue(data, 'DataConclusao'));
      const finalDataConclusao = isExplicitlyConcluidoInExcel ? (rawDataConclusao || getSaoPauloISODate()) : undefined;

      const rawProtocol = getRowValue(data, 'NumeroProtocolo') || getRowValue(data, 'Protocolo');
      const protocolNumber = isExplicitlyConcluidoInExcel 
        ? (rawProtocol || 'PROT-' + Math.random().toString(36).substring(2, 9).toUpperCase())
        : (rawProtocol || undefined);

      return {
        id: uniqueOrderId,
        clientName: getRowValue(data, 'ProcurarPor'),
        phone: getRowValue(data, 'Telefone') || getRowValue(data, 'Celular') || '(11) 99999-9999',
        address: `${getRowValue(data, 'Endereco')}${getRowValue(data, 'Complemento') ? ', ' + getRowValue(data, 'Complemento') : ''}, ${getRowValue(data, 'CidadeMunicipio') || 'São Paulo'} - ${getRowValue(data, 'Estado') || 'SP'}`,
        region,
        status: initialStatus,
        value: valNF,
        priority: itemPriority,
        riderId: matchedRiderId,
        createdAt: getRowValue(data, 'HorarioInicio') || getRowValue(data, 'HorarioAbertura') || getRowValue(data, 'HoraLancamento') || getSaoPauloTime(),
        horarioInicial: getRowValue(data, 'HorarioInicio') || getRowValue(data, 'HorarioAbertura') || getRowValue(data, 'HoraLancamento') || getSaoPauloTime(),
        horarioFinal: getRowValue(data, 'HorarioFinal') || undefined,
        deliveryTime: getRowValue(data, 'HorarioFinal') || undefined,
        deliveryDate: normalizeDate(getRowValue(data, 'DataSolicitacao')) || getSaoPauloISODate(),
        dataConclusao: finalDataConclusao,
        lat: orderLat,
        lng: orderLng,
        timeRemaining: 40,
        itemsCount: Math.floor(Math.random() * 3) + 1,
        date: normalizeDate(getRowValue(data, 'DataSolicitacao')) || getSaoPauloISODate(),
        cep: formattedCep,
        deliveryValue: finalFreightValue,
        driverValue: finalDriverValue,
        partnerName,
        rawData: data,
        protocolNumber,
        history: [
          {
            timestamp: getSaoPauloDateTimeShort(),
            action: 'Pedido Importado',
            user: 'Sistema (Planilha)',
            details: `Importação de dados via planilha Excel realizada com sucesso. Status inicial: ${initialStatus}.`
          }
        ]
      };
    });

    onImportOrders(newOrders);
    const totalValidCount = parsedRows.filter(r => r.isValid).length;
    const nonSelectedValidCount = totalValidCount - selectedValidRows.length;
    const ignoredCount = parsedRows.length - totalValidCount + nonSelectedValidCount;
    let message = `${newOrders.length} pedidos importados com sucesso para a data ${getTodayDateStr()}!`;
    if (ignoredCount > 0) {
      message += ` (${ignoredCount} linhas com erros ou não selecionadas foram desconsideradas).`;
    }
    setSuccessMessage(message);
    
    // Clear state
    setParsedRows([]);
    setSelectedRowIndexes({});
    setImportSummary(null);

    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleClear = () => {
    setParsedRows([]);
    setSelectedRowIndexes({});
    setImportSummary(null);
    setSortConfig(null);
    setDraggedColIdx(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleMoveColumn = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= headers.length) return;
    const updatedHeaders = [...headers];
    const [moved] = updatedHeaders.splice(fromIndex, 1);
    updatedHeaders.splice(toIndex, 0, moved);
    setHeaders(updatedHeaders);
  };

  const getSortedRows = () => {
    let validRows = parsedRows.filter(r => r.isValid);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      validRows = validRows.filter(r => {
        const addr = getRowValue(r.data, 'Endereco') || r.data['Endereco'] || r.data['endereco'] || '';
        if (matchesAddressQuery(addr, searchQuery)) return true;
        return Object.values(r.data).some(val => String(val).toLowerCase().includes(q));
      });
    }

    if (!sortConfig) return validRows;
    
    const { key, direction } = sortConfig;
    return [...validRows].sort((a, b) => {
      const valA = String(a.data[key] ?? '');
      const valB = String(b.data[key] ?? '');
      
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return direction === 'asc' ? numA - numB : numB - numA;
      }
      
      return direction === 'asc' 
        ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
        : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const validRows = parsedRows.filter(r => r.isValid);
  const selectedCount = validRows.filter(r => selectedRowIndexes[r.index]).length;

  return (
    <motion.div
      key="import-spreadsheet-view"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
      id="view-import-spreadsheet"
    >
      {/* Introduction Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-600" size={22} />
            <span>Importação de Planilha Excel (.xlsx, .xls)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Importe pedidos de clientes parceiros com consistência de dados, validação de datas e regras contra duplicidade.</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100/60 transition-all shadow-sm cursor-pointer"
          id="btn-download-template"
        >
          <Download size={14} />
          <span>Baixar Modelo Excel (.xlsx)</span>
        </button>
      </div>

      {/* Rules Board */}
      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4" id="rules-board">
        <div className="flex gap-3">
          <div className="p-2 bg-blue-500 rounded-xl text-white h-fit shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">Regra de Data Vigente</h4>
            <p className="text-[11px] text-blue-700/80 mt-1 leading-relaxed">
              Somente linhas com <b>DataSolicitacao</b> correspondente ao dia de hoje (<b>{getTodayDateStr()}</b> ou calendar dia atual) serão importadas. Outras datas serão ignoradas para evitar erros operacionais.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="p-2 bg-amber-500 rounded-xl text-white h-fit shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Campos Obrigatórios (*)</h4>
            <p className="text-[11px] text-amber-700/80 mt-1 leading-relaxed">
              Linhas com campos prioritários ausentes (<b>Pedido</b>, <b>ProcurarPor</b>/Nome do cliente, <b>Endereco</b>, <b>CEP</b>, <b>DataSolicitacao</b>, <b>CodigoCliente</b>) serão rejeitadas.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="p-2 bg-indigo-500 rounded-xl text-white h-fit shrink-0">
            <XCircle size={16} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Anti-Duplicidade</h4>
            <p className="text-[11px] text-indigo-700/80 mt-1 leading-relaxed">
              Pedidos com o mesmo ID do mesmo parceiro já cadastrado no sistema serão rejeitados, <b>a menos</b> se o pedido original estiver com o status <b>Cancelado</b>.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-800 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
            <span className="text-xs font-bold">{successMessage}</span>
          </div>
          {onNavigateToOrders && (
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-sm shadow-emerald-200"
            >
              Ver na Central de Pedidos →
            </button>
          )}
        </motion.div>
      )}

      {/* File Upload Zone / Diagnostic Stage */}
      {parsedRows.length === 0 ? (
        <div 
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all ${
            dragActive 
              ? 'border-blue-500 bg-blue-50/20' 
              : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/20'
          }`}
          id="drop-zone-container"
        >
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl mb-4 shadow-sm">
            <Upload size={32} className="animate-pulse" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Arraste e solte sua planilha de pedidos Excel</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">Suporta arquivos Excel formatados como <b>.xlsx</b> ou <b>.xls</b> de 30 colunas padrão do sistema.</p>
          
          <div className="mt-5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="file-upload-input"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all cursor-pointer"
            >
              Procurar Planilha Excel
            </button>
          </div>
        </div>
      ) : importSummary && importSummary.valid === 0 ? (
        /* Only display the error notification card, NO spreadsheet list when there are no valid rows! */
        <motion.div
          key="import-error-view"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border-2 border-rose-100 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-6"
          id="import-error-container"
        >
          <div className="p-4 bg-rose-50 text-rose-600 rounded-full shadow-sm animate-bounce">
            <XOctagon size={40} />
          </div>
          
          <div className="space-y-2 max-w-lg">
            <h3 className="font-extrabold text-rose-950 text-base">Planilha com erro, verifique!</h3>
            <p className="text-xs text-rose-700 font-semibold leading-relaxed">
              O arquivo enviado não pôde ser importado porque nenhum pedido cumpre as regras de importação do sistema.
            </p>
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed uppercase tracking-wider">
              Diagnósticos Prováveis do Descarte Automático:
            </p>
          </div>

          <div className="w-full max-w-md bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-2.5 text-xs text-slate-600">
            <div className="flex gap-2.5 items-start">
              <span className="text-rose-500 font-bold">•</span>
              <p><b>Data de Solicitação Incorreta:</b> A data da solicitação deve corresponder à data de hoje (<b>{getTodayDateStr()}</b>).</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="text-rose-500 font-bold">•</span>
              <p><b>Pedidos Duplicados Ativos:</b> Os números de pedidos já existem e estão ativos/não cancelados no sistema.</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="text-rose-500 font-bold">•</span>
              <p><b>Campos Obrigatórios Vazios:</b> Colunas prioritárias como <b>Pedido</b>, <b>CEP</b> ou <b>Endereço</b> estão ausentes ou em branco.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClear}
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              Cancelar e Voltar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-rose-100 cursor-pointer"
            >
              Enviar Outra Planilha
            </button>
          </div>
        </motion.div>
      ) : (
        /* Excel Preview & Audit Trail Stage (only displayed when there is at least 1 valid row) */
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-xs">Resumo do Diagnóstico da Planilha</h3>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Auditoria pré-importação das linhas</p>
                </div>
              </div>
            </div>

            {/* Structured responsive side-by-side grid to bring the approval metric and the cancel/approve actions together */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="import-stats">
              {/* Card 1: Metrics (Aprovados para Importação) */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider block">Selecionados para Importação</span>
                  <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                    Pedidos válidos e selecionados por você para entrar no sistema. Você pode marcar ou desmarcar linhas na tabela abaixo.
                  </p>
                </div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-2xl font-black text-emerald-700">{selectedCount}</span>
                  <span className="text-xs text-slate-400 font-semibold">de {validRows.length} válidos ({importSummary?.total} totais lidos)</span>
                </div>
              </div>

              {/* Card 2: Actions (Cancelar Importação ou Executar Importação) */}
              <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Ações de Importação</span>
                  <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                    Selecione se deseja descartar os dados auditados ou prosseguir e importar apenas os registros selecionados na base atual.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 mt-4">
                  <button
                    onClick={handleClear}
                    className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-xs cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    disabled={selectedCount === 0}
                    className={`flex-1 px-4 py-2 text-xs font-extrabold rounded-xl text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedCount > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                        : 'bg-slate-300 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <Check size={14} className="shrink-0" />
                    <span>Importar {selectedCount} Selecionados</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Visualização de Pedidos Válidos</h3>
                <p className="text-xs text-slate-400 mt-0.5">Clique nas colunas para ordenar de forma crescente/decrescente. Arraste-as ou use as setas para reorganizar a visualização.</p>
              </div>

              {/* Table search filter */}
              <div className="relative w-full md:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por endereço, CEP, cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-8 py-1.5 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                    title="Limpar busca"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-slate-100 rounded-xl">
              <table className="min-w-full text-[11px] text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-left text-[11px] uppercase sticky top-0 z-10">
                    <th className="px-4 py-3 w-12 bg-slate-50/90 z-20 sticky left-0 border-r border-slate-100 text-center">
                      <input 
                        type="checkbox"
                        checked={validRows.length > 0 && selectedCount === validRows.length}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const updated = { ...selectedRowIndexes };
                          validRows.forEach(r => {
                            updated[r.index] = checked;
                          });
                          setSelectedRowIndexes(updated);
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        id="select-all-import"
                      />
                    </th>
                    <th className="px-4 py-3 w-16 bg-slate-50/90 z-20 sticky left-12 border-r border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase">Linha</th>
                    {headers.map((header, idx) => (
                      <th 
                        key={header} 
                        className={`px-4 py-3 select-none transition-colors border-r border-slate-100 relative ${
                          draggedColIdx === idx ? 'bg-blue-50/60' : 'hover:bg-slate-100/60'
                        }`}
                        draggable
                        onDragStart={(e) => {
                          setDraggedColIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedColIdx !== null && draggedColIdx !== idx) {
                            handleMoveColumn(draggedColIdx, idx);
                          }
                          setDraggedColIdx(null);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-[140px] group/th">
                          <span 
                            className="cursor-grab active:cursor-grabbing font-extrabold text-slate-700 text-[11px] uppercase tracking-wider truncate flex-1" 
                            title="Clique para ordenar ou arraste para reorganizar"
                            onClick={() => handleSort(header)}
                          >
                            {header}
                          </span>
                          
                          {/* Left/Right movement buttons on hover */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/th:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveColumn(idx, idx - 1); }}
                              disabled={idx === 0}
                              className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer text-slate-500"
                              title="Mover para esquerda"
                            >
                              <ChevronLeft size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMoveColumn(idx, idx + 1); }}
                              disabled={idx === headers.length - 1}
                              className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer text-slate-500"
                              title="Mover para direita"
                            >
                              <ChevronRight size={12} />
                            </button>
                          </div>

                          {/* Sorting direction indicator */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSort(header); }}
                            className="shrink-0 p-0.5 hover:bg-slate-200 rounded cursor-pointer text-slate-400 hover:text-slate-600"
                          >
                            {sortConfig?.key === header ? (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp size={12} className="text-emerald-600" />
                              ) : (
                                <ArrowDown size={12} className="text-emerald-600" />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="text-slate-300 group-hover/th:text-slate-400" />
                            )}
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {getSortedRows().map((row) => (
                    <tr key={row.index} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-2.5 text-center sticky left-0 z-10 bg-slate-50/80 border-r border-slate-100 w-12">
                        <input
                          type="checkbox"
                          checked={!!selectedRowIndexes[row.index]}
                          onChange={(e) => {
                            setSelectedRowIndexes(prev => ({
                              ...prev,
                              [row.index]: e.target.checked
                            }));
                          }}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          id={`import-row-checkbox-${row.index}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px] font-bold bg-slate-50/80 sticky left-12 z-10 border-r border-slate-100">#{row.index}</td>
                      {headers.map((header) => {
                        let val = row.data[header];
                        const normalizedHeader = normalizeKey(header);
                        
                        // Encontrar parceiro e calcular CEP formatado para cálculos dinâmicos
                        const codClienteVal = getRowValue(row.data, 'CodigoCliente').trim();
                        const matchedCp = clientPartners?.find(cp => 
                          cp.name.toLowerCase() === codClienteVal.toLowerCase() ||
                          isMatchingClientCode(codClienteVal, cp.id, cp.codigoCliente)
                        );
                        
                        const rawCep = getRowValue(row.data, 'CEP');
                        const formattedCep = (() => {
                          let cleanCep = (rawCep || '').replace(/\D/g, '');
                          if (cleanCep.length > 0 && cleanCep.length < 8) {
                            cleanCep = cleanCep.padStart(8, '0');
                          }
                          if (cleanCep.length === 8) {
                            return `${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`;
                          }
                          return rawCep;
                        })();

                        if (normalizedHeader === 'codigocliente') {
                          val = matchedCp ? (matchedCp.codigoCliente || matchedCp.id) : codClienteVal;
                        } else if (normalizedHeader === 'nomefantasia') {
                          if (matchedCp) {
                            val = matchedCp.name;
                          } else {
                            const keys = Object.keys(row.data);
                            const nameKey = keys.find(k => normalizeKey(k) === 'nomefantasia');
                            if (nameKey && row.data[nameKey]) {
                              val = row.data[nameKey];
                            }
                          }
                        } else if (normalizedHeader === 'valorentrega') {
                          // Calcular dinamicamente o frete usando as faixas de CEP do parceiro da planilha!
                          const tempOrder: any = {
                            partnerName: matchedCp ? matchedCp.id : codClienteVal,
                            cep: formattedCep,
                            deliveryValue: val ? parseFloat(val.replace(',', '.')) : undefined,
                            rawData: row.data
                          };
                          const freightVal = getOrderFreightValue(tempOrder as Order, clientPartners || []);
                          val = String(freightVal);
                        } else if (normalizedHeader === 'valorcondutor') {
                          // Calcular dinamicamente a comissão do condutor se houver condutor correspondido
                          const condutorVal = getRowValue(row.data, 'DispositivoCondutor').toLowerCase();
                          const foundRider = riders.find(r => 
                            r.id.toLowerCase() === condutorVal || 
                            r.name.toLowerCase().includes(condutorVal)
                          );
                          
                          const rawValNF = getRowValue(row.data, 'ValorNotaFiscal') || getRowValue(row.data, 'ValorReceber') || getRowValue(row.data, 'ValorMercadoria');
                          let valNF = 0;
                          if (rawValNF && rawValNF.trim() !== '') {
                            const parsed = parseFloat(String(rawValNF).replace(',', '.'));
                            if (!isNaN(parsed) && parsed > 0) valNF = parsed;
                          }

                          const tempOrder: any = {
                            value: valNF,
                            partnerName: matchedCp ? matchedCp.id : codClienteVal,
                            cep: formattedCep,
                            rawData: row.data,
                            riderId: foundRider ? foundRider.id : undefined,
                            status: 'Concluído'
                          };
                          
                          const freightVal = getOrderFreightValue(tempOrder as Order, clientPartners || []);
                          tempOrder.deliveryValue = freightVal;
                          
                          const commission = calculateRiderCommissionForOrder(foundRider, tempOrder as Order, clientPartners || []);
                          val = String(commission.total);
                        }

                        const isSpecial = ['pedido', 'codigocliente', 'datasolicitacao', 'procurarpor', 'cep'].some(
                          c => c === normalizedHeader
                        );
                        
                        const isMonetary = ['valorentrega', 'valorcondutor', 'valornotafiscal', 'valorreceber'].includes(normalizedHeader);
                        const isDate = ['datasolicitacao', 'datalimite', 'dataagendamento', 'dataconclusao'].includes(normalizedHeader) || normalizedHeader.includes('data') || normalizedHeader.includes('date');
                        
                        return (
                          <td 
                            key={header} 
                            className={`px-4 py-2.5 max-w-[200px] truncate border-r border-slate-50 text-[11px] ${
                              isSpecial ? 'font-bold text-slate-800' : 'text-slate-500 font-medium'
                            }`}
                          >
                            {val === '' ? (
                              <span className="text-slate-300 italic font-normal text-[11px]">vazio</span>
                            ) : isMonetary ? (
                              isNaN(parseFloat(val)) ? val : `R$ ${parseFloat(val).toFixed(2).replace('.', ',')}`
                            ) : isDate ? (
                              formatToBrazilianDate(val)
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {getSortedRows().length === 0 && (
                    <tr>
                      <td colSpan={headers.length + 2} className="px-4 py-12 text-center text-slate-400 text-[11px] font-semibold">
                        Nenhum pedido válido encontrado nesta planilha.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
