/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Database, 
  Trash2, 
  Zap, 
  RefreshCw, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Truck, 
  ShoppingBag, 
  DollarSign, 
  Activity, 
  Layers, 
  FileCode, 
  Check, 
  X, 
  Sparkles, 
  Filter, 
  ShieldAlert, 
  Clock, 
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, ClientPartner, DeliveryRider, ActivityLog, FinancialTransaction, CompanyHub, OrderStatus } from '../types';
import { getSaoPauloISODate, getSaoPauloTime } from '../utils/dateUtils';
import { 
  dbBulkSaveOrders, 
  dbPurgeCollectionDocs, 
  dbPurgeAllData, 
  dbBulkDeleteOrders, 
  dbBulkDeleteClients, 
  dbBulkDeleteRiders, 
  dbBulkDeleteTransactions,
  dbBulkSaveClients,
  dbBulkSaveRiders,
  clearLocalSystemCache,
  dbPurgeMockClientPartners,
  MOCK_CLIENT_IDS
} from '../lib/dbService';

interface DataMassManagerProps {
  orders: Order[];
  clientPartners: ClientPartner[];
  deliveryRiders: DeliveryRider[];
  logs: ActivityLog[];
  financialTransactions: FinancialTransaction[];
  companyHubs: CompanyHub[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setClientPartners: React.Dispatch<React.SetStateAction<ClientPartner[]>>;
  setDeliveryRiders: React.Dispatch<React.SetStateAction<DeliveryRider[]>>;
  setLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  setFinancialTransactions: React.Dispatch<React.SetStateAction<FinancialTransaction[]>>;
  onAddActivityLog: (message: string, orderId?: string, type?: 'status' | 'rider' | 'system') => void;
  onRestoreDemoState: () => Promise<void>;
}

// SP Addresses pool for ultra-realistic order generation
const SP_ADDRESS_POOL = [
  { address: 'Av. Paulista, 1000', region: 'Centro', client: 'Ponto Av. Paulista', lat: -23.5614, lng: -46.6559 },
  { address: 'Rua Haddock Lobo, 354', region: 'Centro', client: 'Ponto Haddock Lobo', lat: -23.5539, lng: -46.6622 },
  { address: 'Al. Lorena, 1500', region: 'Zona Sul', client: 'Ponto Alameda Lorena', lat: -23.5681, lng: -46.6675 },
  { address: 'Av. Faria Lima, 3477', region: 'Zona Oeste', client: 'Ponto Faria Lima', lat: -23.5872, lng: -46.6812 },
  { address: 'Rua Augusta, 420', region: 'Centro', client: 'Ponto Rua Augusta', lat: -23.5492, lng: -46.6485 },
  { address: 'Rua Pamplona, 1792', region: 'Zona Sul', client: 'Ponto Rua Pamplona', lat: -23.5710, lng: -46.6588 },
  { address: 'Av. Paulista, 1200', region: 'Centro', client: 'Ponto Paulista Express', lat: -23.5621, lng: -46.6548 },
  { address: 'Rua Teodoro Sampaio, 800', region: 'Zona Oeste', client: 'Livraria Cultura', lat: -23.5580, lng: -46.6800 },
  { address: 'Rua Clélia, 1200', region: 'Zona Oeste', client: 'Sesc Pompeia', lat: -23.5255, lng: -46.6833 },
  { address: 'Av. Eng. Luís Carlos Berrini, 1000', region: 'Zona Sul', client: 'Tech Hub Berrini', lat: -23.6081, lng: -46.6961 },
  { address: 'Rua Vergueiro, 2500', region: 'Zona Sul', client: 'Hospital Santa Cruz', lat: -23.5855, lng: -46.6358 },
  { address: 'Rua Voluntários da Pátria, 2100', region: 'Zona Norte', client: 'Distribuidora Santana', lat: -23.5022, lng: -46.6248 },
  { address: 'Rua Tuiuti, 1500', region: 'Zona Leste', client: 'Comercial Tatuapé', lat: -23.5388, lng: -46.5750 }
];

const ITEMS_POOL = [
  '1x Caixa de Documentos Fiscais',
  '2x Embalagens de Medicamentos Especiais',
  '1x Sacola Gourmet Bella Paulista',
  '3x Combos Especial Burger King',
  '1x Pacote de Equipamentos de TI',
  '2x Peças Automotivas de Reposição',
  '1x Envelope de Contrato Social Assinado',
  '4x Caixas de Insumos Hospitalares'
];

const RECIPIENTS_POOL = [
  { name: 'Ricardo Oliveira', doc: '34.567.890-1' },
  { name: 'Camila Fernandes', doc: '28.901.234-5' },
  { name: 'Gabriel Souza', doc: '41.234.567-8' },
  { name: 'Juliana Barbosa', doc: '19.876.543-2' },
  { name: 'Fernando Costa', doc: '32.109.876-4' },
  { name: 'Vanessa Martins', doc: '25.678.901-3' }
];

export default function DataMassManager({
  orders,
  clientPartners,
  deliveryRiders,
  logs,
  financialTransactions,
  companyHubs,
  setOrders,
  setClientPartners,
  setDeliveryRiders,
  setLogs,
  setFinancialTransactions,
  onAddActivityLog,
  onRestoreDemoState
}: DataMassManagerProps) {
  const [activeTab, setActiveTab] = useState<'seed' | 'purge' | 'backup' | 'audit'>('seed');

  // Generator states
  const [orderQty, setOrderQty] = useState<number>(25);
  const [statusPreset, setStatusPreset] = useState<'mix' | 'Não iniciado' | 'Em rota' | 'Concluído' | 'Ocorrência'>('mix');
  const [dateMode, setDateMode] = useState<'today' | 'distributed7' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(getSaoPauloISODate());
  const [targetClient, setTargetClient] = useState<string>('all');
  const [targetRider, setTargetRider] = useState<string>('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  // Purge states
  const [showPurgeAllModal, setShowPurgeAllModal] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  
  // Universal Confirmation Dialog state for all Seeder and Purge operations
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmButtonText: string;
    isDanger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isProcessingModal, setIsProcessingModal] = useState(false);
  
  // Filtered Purge states
  const [purgeStatusFilter, setPurgeStatusFilter] = useState<string>('Concluído');
  const [purgeClientFilter, setPurgeClientFilter] = useState<string>('all');
  const [purgeFinancialTypeFilter, setPurgeFinancialTypeFilter] = useState<'all' | 'payable' | 'receivable'>('all');
  const [purgeFinancialStatusFilter, setPurgeFinancialStatusFilter] = useState<string>('all');

  // Toast notification
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Helper to generate realistic signature Data URL
  const generateMockSignatureDataUrl = (name: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <path d="M 20 50 Q 50 20, 80 50 T 140 40 T 200 60 T 260 30" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
      <text x="20" y="85" font-family="sans-serif" font-size="12" fill="#64748b">Assinado por: ${name}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  };

  // Handler: Batch Order Generator
  const handleGenerateOrders = async () => {
    if (orderQty <= 0) return;
    setIsGenerating(true);
    setGenProgress(10);

    try {
      const newOrders: Order[] = [];
      const nowSp = getSaoPauloISODate();
      const nowTimeSp = getSaoPauloTime();

      const statuses: OrderStatus[] = ['Não iniciado', 'Em rota', 'Entregando', 'Concluído', 'Ocorrência'];
      
      for (let i = 0; i < orderQty; i++) {
        const randIndex = Math.floor(Math.random() * SP_ADDRESS_POOL.length);
        const location = SP_ADDRESS_POOL[randIndex];
        
        // Determine status based on preset
        let selectedStatus: OrderStatus = 'Não iniciado';
        if (statusPreset === 'mix') {
          const r = Math.random();
          if (r < 0.45) selectedStatus = 'Concluído';
          else if (r < 0.65) selectedStatus = 'Em rota';
          else if (r < 0.80) selectedStatus = 'Não iniciado';
          else if (r < 0.90) selectedStatus = 'Entregando';
          else selectedStatus = 'Ocorrência';
        } else {
          selectedStatus = statusPreset;
        }

        // Determine client
        let clientName = location.client;
        if (targetClient !== 'all') {
          const cl = clientPartners.find(c => c.id === targetClient);
          if (cl) clientName = cl.name;
        }

        // Determine rider
        let riderName: string | undefined = undefined;
        let riderId: string | undefined = undefined;
        if (targetRider === 'auto' && deliveryRiders.length > 0) {
          const randomRider = deliveryRiders[Math.floor(Math.random() * deliveryRiders.length)];
          riderName = randomRider.name;
          riderId = randomRider.id;
        } else if (targetRider !== 'auto' && targetRider !== 'none') {
          const selectedRiderObj = deliveryRiders.find(r => r.id === targetRider);
          if (selectedRiderObj) {
            riderName = selectedRiderObj.name;
            riderId = selectedRiderObj.id;
          }
        }

        // Determine date
        let orderDate = nowSp;
        if (dateMode === 'custom' && customDate) {
          orderDate = customDate;
        } else if (dateMode === 'distributed7') {
          const daysBack = Math.floor(Math.random() * 7);
          const d = new Date();
          d.setDate(d.getDate() - daysBack);
          orderDate = d.toISOString().split('T')[0];
        }

        const uniqueNum = Math.floor(1000 + Math.random() * 9000);
        const orderId = `ped-${uniqueNum}`;
        const protocolNumber = `PROT-SEED${uniqueNum}`;

        // Completed protocol details if Concluído
        let recipientName: string | undefined = undefined;
        let recipientDoc: string | undefined = undefined;
        let signatureUrl: string | undefined = undefined;
        let deliveryPhotoUrl: string | undefined = undefined;
        let deliveryDate: string | undefined = undefined;
        let deliveryTime: string | undefined = undefined;

        if (selectedStatus === 'Concluído') {
          const rec = RECIPIENTS_POOL[Math.floor(Math.random() * RECIPIENTS_POOL.length)];
          recipientName = rec.name;
          recipientDoc = rec.doc;
          signatureUrl = generateMockSignatureDataUrl(rec.name);
          deliveryPhotoUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80';
          deliveryDate = orderDate;
          deliveryTime = '14:30';
        }

        const value = Number((15 + Math.random() * 85).toFixed(2));

        const newOrder: Order = {
          id: orderId,
          clientName,
          partnerName: clientName,
          phone: '(11) 99888-7766',
          address: location.address,
          region: location.region,
          status: selectedStatus,
          createdAt: '10:00',
          value,
          riderId,
          itemsCount: 1,
          cep: '01000-000',
          priority: Math.random() > 0.7 ? 'Alta' : 'Normal',
          date: orderDate,
          protocolNumber,
          deliveryDate,
          deliveryTime,
          recipientName,
          recipientDoc,
          signatureUrl,
          deliveryPhotoUrl,
          history: [
            { timestamp: `${orderDate} 10:00`, action: 'Pedido Gerado em Massa (Seeder)', user: 'Seeder Engine' },
            ...(selectedStatus === 'Concluído' ? [{ timestamp: `${orderDate} 14:30`, action: `Concluído por ${riderName || 'Entregador'}`, user: riderName || 'Entregador' }] : [])
          ]
        };

        newOrders.push(newOrder);
      }

      setGenProgress(60);

      // Save to Firestore & local state
      await dbBulkSaveOrders(newOrders);
      setOrders(prev => [...newOrders, ...prev]);

      onAddActivityLog(`Gerados ${newOrders.length} pedidos em massa via Seeder.`, undefined, 'system');
      setGenProgress(100);
      showToast(`${newOrders.length} pedidos gerados e gravados com sucesso!`, 'success');
    } catch (err) {
      console.error('Error generating batch orders:', err);
      showToast('Erro ao gerar pedidos em massa.', 'error');
    } finally {
      setIsGenerating(false);
      setGenProgress(0);
    }
  };

  // Handler: Quick Seed (Reset Demo with Confirmation)
  const handleQuickSeedDemo = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restaurar Base de Demonstração (Seeder)',
      description: 'Deseja substituir/recriar a base de dados com o conjunto de teste padrão da Sede Vinimap? Todos os registros atuais serão redefinidos.',
      confirmButtonText: 'Confirmar Restauração',
      isDanger: false,
      onConfirm: async () => {
        setIsGenerating(true);
        try {
          await onRestoreDemoState();
          await clearLocalSystemCache();
          showToast('Base de demonstração padrão restaurada com sucesso!', 'success');
        } catch (err) {
          showToast('Falha ao restaurar base padrão.', 'error');
        } finally {
          setIsGenerating(false);
        }
      }
    });
  };

  // Handler: Purge All
  const handleExecutePurgeAll = async () => {
    if (purgeConfirmInput.trim().toUpperCase() !== 'ZERAR') {
      showToast('Digite "ZERAR" para confirmar a exclusão.', 'error');
      return;
    }

    setIsPurging(true);
    try {
      await dbPurgeAllData();
      await clearLocalSystemCache();
      
      setOrders([]);
      setClientPartners([]);
      setDeliveryRiders([]);
      setLogs([]);
      setFinancialTransactions([]);

      onAddActivityLog('EXCLUSÃO TOTAL: Toda a base de dados e o cache local (IndexedDB) foram expurgados pelo administrador.', undefined, 'system');
      showToast('Toda a base e o cache local (IndexedDB) foram limpos! Estado zerado permanentemente.', 'success');
      setShowPurgeAllModal(false);
      setPurgeConfirmInput('');
    } catch (err) {
      console.error('Error executing full purge:', err);
      showToast('Erro ao realizar expurgo total da base.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  // Handler: Selective Purge by Module with Modal Confirmation
  const handlePurgeModule = (moduleName: 'orders' | 'financial' | 'logs' | 'clients' | 'riders') => {
    const labels: Record<string, string> = {
      orders: 'Mapeamento de Pedidos e Entregas',
      financial: 'Contas a Pagar e Receber',
      logs: 'Logs e Eventos do Sistema',
      clients: 'Cadastro de Clientes Parceiros',
      riders: 'Cadastro de Entregadores'
    };
    const targetLabel = labels[moduleName] || moduleName;

    setConfirmDialog({
      isOpen: true,
      title: `Excluir Módulo: ${targetLabel}`,
      description: `Tem certeza que deseja apagar DEFINITIVAMENTE todos os registros do módulo "${targetLabel}"? Os dados serão excluídos de forma permanente e irreversível do banco e do cache local.`,
      confirmButtonText: 'Sim, Excluir Definitivamente',
      isDanger: true,
      onConfirm: async () => {
        setIsPurging(true);
        try {
          if (moduleName === 'orders') {
            await dbPurgeCollectionDocs('orders');
            setOrders([]);
            onAddActivityLog('Mapeamento de pedidos totalmente expurgado.', undefined, 'system');
            showToast('Todos os pedidos foram excluídos definitivamente.', 'success');
          } else if (moduleName === 'financial') {
            await dbPurgeCollectionDocs('financialTransactions');
            setFinancialTransactions([]);
            onAddActivityLog('Lançamentos financeiros totalmente expurgados.', undefined, 'system');
            showToast('Todos os lançamentos financeiros foram excluídos definitivamente.', 'success');
          } else if (moduleName === 'logs') {
            await dbPurgeCollectionDocs('activityLogs');
            setLogs([]);
            showToast('Todos os logs de atividade foram limpos definitivamente.', 'success');
          } else if (moduleName === 'clients') {
            await dbPurgeCollectionDocs('clientPartners');
            setClientPartners([]);
            onAddActivityLog('Cadastro de clientes totalmente expurgado.', undefined, 'system');
            showToast('Todos os clientes foram excluídos definitivamente.', 'success');
          } else if (moduleName === 'riders') {
            await dbPurgeCollectionDocs('deliveryRiders');
            setDeliveryRiders([]);
            onAddActivityLog('Cadastro de entregadores totalmente expurgado.', undefined, 'system');
            showToast('Todos os entregadores foram excluídos definitivamente.', 'success');
          }
          await clearLocalSystemCache();
        } catch (err) {
          console.error('Error purging module:', err);
          showToast(`Erro ao apagar módulo ${moduleName}.`, 'error');
        } finally {
          setIsPurging(false);
        }
      }
    });
  };

  // Handler: Filtered Order Purge with Modal Confirmation
  const handlePurgeFilteredOrders = () => {
    const toDelete = orders.filter(o => {
      let matchesStatus = true;
      let matchesClient = true;

      if (purgeStatusFilter !== 'all') {
        matchesStatus = o.status === purgeStatusFilter;
      }
      if (purgeClientFilter !== 'all') {
        matchesClient = o.clientName === purgeClientFilter;
      }

      return matchesStatus && matchesClient;
    });

    if (toDelete.length === 0) {
      showToast('Nenhum pedido encontrado com os filtros selecionados.', 'info');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Excluir ${toDelete.length} Pedido(s) Filtrado(s)`,
      description: `Confirma a exclusão definitiva de ${toDelete.length} pedido(s) que coincidem com os filtros informados? Esta ação apagará permanentemente os registros do banco de dados.`,
      confirmButtonText: `Excluir ${toDelete.length} Pedido(s) Definitivamente`,
      isDanger: true,
      onConfirm: async () => {
        setIsPurging(true);
        try {
          const ids = toDelete.map(o => o.id);
          await dbBulkDeleteOrders(ids);
          
          setOrders(prev => prev.filter(o => !ids.includes(o.id)));
          onAddActivityLog(`Expurgo filtrado: ${toDelete.length} pedidos excluídos.`, undefined, 'system');
          await clearLocalSystemCache();
          showToast(`${toDelete.length} pedidos expurgados com sucesso!`, 'success');
        } catch (err) {
          console.error('Error purging filtered orders:', err);
          showToast('Erro ao excluir pedidos filtrados.', 'error');
        } finally {
          setIsPurging(false);
        }
      }
    });
  };

  // Filtered Financial matching count computation
  const matchingFinancialToPurge = useMemo(() => {
    return financialTransactions.filter(tx => {
      let matchesType = true;
      let matchesStatus = true;

      if (purgeFinancialTypeFilter !== 'all') {
        const targetType = purgeFinancialTypeFilter.toLowerCase();
        const txType = (tx.type || '').toLowerCase();
        if (targetType === 'payable') {
          matchesType = txType === 'payable' || txType === 'despesa' || txType === 'pagar';
        } else if (targetType === 'receivable') {
          matchesType = txType === 'receivable' || txType === 'receita' || txType === 'receber';
        } else {
          matchesType = txType === targetType;
        }
      }
      if (purgeFinancialStatusFilter !== 'all') {
        const targetStatus = purgeFinancialStatusFilter.toLowerCase().trim();
        const txStatus = (tx.status || '').toLowerCase().trim();
        if (targetStatus === 'pago') {
          matchesStatus = txStatus === 'pago' || txStatus === 'pago / liquidado' || txStatus === 'liquidado';
        } else if (targetStatus === 'pendente') {
          matchesStatus = txStatus === 'pendente' || txStatus === 'a pagar' || txStatus === 'a receber';
        } else if (targetStatus === 'atrasado') {
          matchesStatus = txStatus === 'atrasado' || txStatus === 'vencido';
        } else {
          matchesStatus = txStatus === targetStatus;
        }
      }

      return matchesType && matchesStatus;
    });
  }, [financialTransactions, purgeFinancialTypeFilter, purgeFinancialStatusFilter]);

  // Handler: Filtered Financial Purge (Contas a Pagar e Receber) with Modal Confirmation
  const handlePurgeFilteredFinancial = () => {
    const toDelete = matchingFinancialToPurge;

    if (toDelete.length === 0) {
      showToast('Nenhum lançamento financeiro encontrado com os filtros selecionados.', 'info');
      return;
    }

    const typeLabel = purgeFinancialTypeFilter === 'payable' ? 'Contas a Pagar (Despesas)' : purgeFinancialTypeFilter === 'receivable' ? 'Contas a Receber (Receitas)' : 'Contas a Pagar e Receber';

    setConfirmDialog({
      isOpen: true,
      title: `Excluir ${toDelete.length} Lançamento(s) - ${typeLabel}`,
      description: `Confirma a exclusão definitiva de ${toDelete.length} lançamentos do módulo de ${typeLabel}? A exclusão removerá permanentemente esses registros do banco e do histórico.`,
      confirmButtonText: `Excluir ${toDelete.length} Lançamento(s) Definitivamente`,
      isDanger: true,
      onConfirm: async () => {
        setIsPurging(true);
        try {
          const ids = toDelete.map(tx => tx.id);
          await dbBulkDeleteTransactions(ids);
          
          setFinancialTransactions(prev => prev.filter(tx => !ids.includes(tx.id)));
          onAddActivityLog(`Expurgo de ${typeLabel}: ${toDelete.length} lançamentos removidos.`, undefined, 'system');
          await clearLocalSystemCache();
          showToast(`${toDelete.length} lançamentos de ${typeLabel} expurgados com sucesso!`, 'success');
        } catch (err) {
          console.error('Error purging filtered financial transactions:', err);
          showToast('Erro ao excluir lançamentos de contas a pagar/receber.', 'error');
        } finally {
          setIsPurging(false);
        }
      }
    });
  };

  // Handler: Export Backup JSON Snapshot
  const handleExportBackup = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      app: 'Vinimap Logistics OS',
      version: '1.4.2',
      orders,
      clientPartners,
      deliveryRiders,
      logs,
      financialTransactions,
      companyHubs
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vinimap_snapshot_${getSaoPauloISODate()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Backup JSON exportado com sucesso!', 'success');
  };

  // Handler: Import Backup JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.orders && !parsed.clientPartners) {
          showToast('Arquivo de backup inválido.', 'error');
          return;
        }

        if (parsed.orders) setOrders(parsed.orders);
        if (parsed.clientPartners) setClientPartners(parsed.clientPartners);
        if (parsed.deliveryRiders) setDeliveryRiders(parsed.deliveryRiders);
        if (parsed.logs) setLogs(parsed.logs);
        if (parsed.financialTransactions) setFinancialTransactions(parsed.financialTransactions);

        if (parsed.orders && parsed.orders.length > 0) {
          await dbBulkSaveOrders(parsed.orders);
        }

        showToast('Snapshot importado e sincronizado com sucesso!', 'success');
      } catch (err) {
        console.error('Error importing JSON backup:', err);
        showToast('Falha ao processar arquivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" id="view-massa-dados">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${
              toastMsg.type === 'success' ? 'bg-emerald-900 text-white border-emerald-700' :
              toastMsg.type === 'error' ? 'bg-rose-900 text-white border-rose-700' :
              'bg-blue-900 text-white border-blue-700'
            }`}
          >
            {toastMsg.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
            {toastMsg.type === 'error' && <AlertTriangle size={18} className="text-rose-400" />}
            {toastMsg.type === 'info' && <Sparkles size={18} className="text-blue-400" />}
            <span className="text-xs font-bold">{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700/50 relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
              <Database size={22} className="animate-pulse" />
            </span>
            <h1 className="text-xl font-black tracking-tight">Gerenciador de Massa de Dados (Seeder & Purge)</h1>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Ferramenta administrativa para geração automatizada em lote de pedidos, testes de carga/estresse da operação, expurgo seguro de registros e sincronização com banco Firestore/Supabase.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 shrink-0">
          <button
            onClick={handleQuickSeedDemo}
            disabled={isGenerating}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
            Restaurar Base Padrão
          </button>
          
          <button
            onClick={() => setShowPurgeAllModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 size={14} />
            Zerar Base Total
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Pedidos</span>
            <h3 className="text-lg font-black text-slate-800">{orders.length}</h3>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ShoppingBag size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Clientes</span>
            <h3 className="text-lg font-black text-slate-800">{clientPartners.length}</h3>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Entregadores</span>
            <h3 className="text-lg font-black text-slate-800">{deliveryRiders.length}</h3>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Truck size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Financeiro</span>
            <h3 className="text-lg font-black text-slate-800">{financialTransactions.length}</h3>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Logs de Sistema</span>
            <h3 className="text-lg font-black text-slate-800">{logs.length}</h3>
          </div>
          <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl">
            <Activity size={18} />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('seed')}
          className={`pb-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'seed'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap size={16} />
          Gerador em Massa (Seeder)
        </button>

        <button
          onClick={() => setActiveTab('purge')}
          className={`pb-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'purge'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trash2 size={16} />
          Limpeza & Purge
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`pb-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'backup'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download size={16} />
          Backup & Importação JSON
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} />
          Auditoria & Métricas
        </button>
      </div>

      {/* TAB 1: SEEDER */}
      {activeTab === 'seed' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Gerador Avançado de Pedidos em Lote</h2>
              <p className="text-xs text-slate-500">Gere centenas de pedidos realistas com bairros de São Paulo, geolocalização e protocolos de entrega.</p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold rounded-full">
              Engine Seeder v2.1
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Quantity Controls */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Quantidade de Pedidos</span>
                <span className="font-mono text-indigo-600 font-extrabold text-sm">{orderQty}</span>
              </label>
              <input
                type="range"
                min={1}
                max={500}
                value={orderQty}
                onChange={(e) => setOrderQty(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 pt-1">
                {[10, 25, 50, 100, 250, 500].map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setOrderQty(qty)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                      orderQty === qty 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +{qty}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Distribuição de Status</label>
              <select
                value={statusPreset}
                onChange={(e) => setStatusPreset(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="mix">📊 Mix Realista (45% Concluído, 20% Em Rota, 15% Não iniciado, 10% Entregando, 10% Ocorrência)</option>
                <option value="Não iniciado">⏳ 100% Não iniciados / Aguardando Alocação</option>
                <option value="Em rota">🚚 100% Em Rota</option>
                <option value="Concluído">✅ 100% Concluídos (Com Protocolo e Assinatura)</option>
                <option value="Ocorrência">⚠️ 100% Ocorrências / Incidentes</option>
              </select>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Período / Data do Pedido</label>
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="today">📅 Data de Hoje ({getSaoPauloISODate()})</option>
                <option value="distributed7">🗓️ Distribuído nos últimos 7 dias</option>
                <option value="custom">📌 Data Específica</option>
              </select>

              {dateMode === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full p-2 mt-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              )}
            </div>

            {/* Target Client */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Cliente Emitente</label>
              <select
                value={targetClient}
                onChange={(e) => setTargetClient(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">🔀 Distribuir Aleatoriamente entre Clientes</option>
                {clientPartners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Rider */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Alocação de Entregador</label>
              <select
                value={targetRider}
                onChange={(e) => setTargetRider(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="auto">🤖 Atribuir Automático (Sorteio entre Entregadores)</option>
                <option value="none">🚫 Não Atribuir (Manter Sem Condutor)</option>
                {deliveryRiders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.vehicle})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Trigger */}
            <div className="flex flex-col justify-end">
              <button
                onClick={handleGenerateOrders}
                disabled={isGenerating}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Zap size={16} className={isGenerating ? 'animate-bounce' : ''} />
                {isGenerating ? `Gerando ${genProgress}%...` : `⚡ Gerar ${orderQty} Pedidos Agora`}
              </button>
            </div>

          </div>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300" 
                style={{ width: `${genProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PURGE */}
      {activeTab === 'purge' && (
        <div className="space-y-6">
          
          {/* Module Purge Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Trash2 size={16} className="text-rose-600" />
                Limpeza Seletiva por Módulo
              </h2>
              <p className="text-xs text-slate-500">Expurgue tabelas específicas sem afetar as demais entidades do sistema.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">Limpar Todos os Pedidos</h4>
                  <p className="text-[10px] text-slate-500">{orders.length} pedidos em estoque</p>
                </div>
                <button
                  onClick={() => handlePurgeModule('orders')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Limpar
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-600" />
                    Limpar Contas a Pagar e Receber
                  </h4>
                  <p className="text-[10px] text-slate-500">{financialTransactions.length} lançamentos no módulo financeiro</p>
                </div>
                <button
                  onClick={() => handlePurgeModule('financial')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Limpar
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">Limpar Logs de Atividade</h4>
                  <p className="text-[10px] text-slate-500">{logs.length} eventos registrados</p>
                </div>
                <button
                  onClick={() => handlePurgeModule('logs')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Limpar
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">Limpar Cadastro de Clientes</h4>
                  <p className="text-[10px] text-slate-500">{clientPartners.length} parceiros salvos</p>
                </div>
                <button
                  onClick={() => handlePurgeModule('clients')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Limpar
                </button>
              </div>

              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                    <Trash2 size={14} className="text-amber-600" />
                    Excluir Parceiros Mockados
                  </h4>
                  <p className="text-[10px] text-amber-700">Expurgar definitivamente os 7 parceiros padrão de exemplo</p>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm('Deseja realmente excluir todos os clientes parceiros mockados de exemplo do banco de dados?')) {
                      try {
                        await dbPurgeMockClientPartners();
                        setClientPartners(prev => prev.filter(c => !MOCK_CLIENT_IDS.includes(c.id)));
                        showToast('Clientes parceiros mockados foram excluídos com sucesso!', 'success');
                      } catch (err: any) {
                        showToast(`Erro ao excluir parceiros mockados: ${err.message || err}`, 'error');
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Excluir Mockados
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">Limpar Cadastro de Entregadores</h4>
                  <p className="text-[10px] text-slate-500">{deliveryRiders.length} motoristas no mapa</p>
                </div>
                <button
                  onClick={() => handlePurgeModule('riders')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>

          {/* Filtered Purge Section - Orders */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Filter size={16} className="text-amber-600" />
                Exclusão Inteligente de Pedidos por Filtro
              </h2>
              <p className="text-xs text-slate-500">Expurgue apenas pedidos que correspondam aos filtros de status e cliente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs font-bold text-slate-700">Filtrar por Status</label>
                <select
                  value={purgeStatusFilter}
                  onChange={(e) => setPurgeStatusFilter(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="all">Todos os Status</option>
                  <option value="Concluído">✅ Concluídos</option>
                  <option value="Ocorrência">⚠️ Ocorrências / Cancelados</option>
                  <option value="Não iniciado">⏳ Não iniciados</option>
                  <option value="Em rota">🚚 Em Rota</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Filtrar por Cliente</label>
                <select
                  value={purgeClientFilter}
                  onChange={(e) => setPurgeClientFilter(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="all">Todos os Clientes</option>
                  {clientPartners.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handlePurgeFilteredOrders}
                disabled={isPurging}
                className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                🔥 Purga Filtrada (Pedidos)
              </button>
            </div>
          </div>

          {/* Filtered Purge Section - Financial (Contas a Pagar e Receber) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-600" />
                Exclusão Inteligente de Contas a Pagar e Receber
              </h2>
              <p className="text-xs text-slate-500">Expurgue lançamentos financeiros por tipo (Contas a Pagar / Receber) e status de quitação.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs font-bold text-slate-700">Tipo de Lançamento</label>
                <select
                  value={purgeFinancialTypeFilter}
                  onChange={(e) => setPurgeFinancialTypeFilter(e.target.value as any)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="all">Todas as Contas (Pagar + Receber)</option>
                  <option value="payable">💸 Apenas Contas a Pagar (Despesas)</option>
                  <option value="receivable">💰 Apenas Contas a Receber (Receitas)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Filtrar por Status</label>
                <select
                  value={purgeFinancialStatusFilter}
                  onChange={(e) => setPurgeFinancialStatusFilter(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="all">Todos os Status</option>
                  <option value="Pendente">⏳ Pendentes</option>
                  <option value="Pago">✅ Pagos / Liquidados</option>
                  <option value="Atrasado">🚨 Atrasados</option>
                </select>
              </div>

              <button
                onClick={handlePurgeFilteredFinancial}
                disabled={isPurging || matchingFinancialToPurge.length === 0}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>{matchingFinancialToPurge.length > 0 ? `🔥 Excluir ${matchingFinancialToPurge.length} Lançamento(s)` : 'Nenhum Lançamento Encontrado'}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: BACKUP & SNAPSHOT */}
      {activeTab === 'backup' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Download size={16} className="text-blue-600" />
              Backup Integral e Importação de Snapshot
            </h2>
            <p className="text-xs text-slate-500">Exporte ou restaure um instantâneo completo em JSON contendo todas as tabelas e estado da aplicação.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Export Card */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">Exportar Backup JSON</h3>
                  <p className="text-xs text-slate-500">Gere um arquivo estruturado com {orders.length} pedidos e cadastros.</p>
                </div>
              </div>

              <button
                onClick={handleExportBackup}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={16} />
                Baixar Snapshot JSON
              </button>
            </div>

            {/* Import Card */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">Restaurar Snapshot JSON</h3>
                  <p className="text-xs text-slate-500">Importe um arquivo `.json` salvo anteriormente para carregar o banco.</p>
                </div>
              </div>

              <label className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload size={16} />
                <span>Selecionar Arquivo JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: AUDIT */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-800">Auditoria do Banco de Dados</h2>
            <p className="text-xs text-slate-500">Detalhamento dos registros ativos por status e região geográfica.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Status Breakdown */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Status dos Pedidos</h4>
              <div className="space-y-2">
                {['Concluído', 'Em rota', 'Entregando', 'Não iniciado', 'Ocorrência'].map((st) => {
                  const count = orders.filter(o => o.status === st).length;
                  const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                  return (
                    <div key={st} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{st}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{count}</span>
                        <span className="text-[10px] text-slate-400 font-bold w-10 text-right">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Region Breakdown */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Distribuição por Região (SP)</h4>
              <div className="space-y-2">
                {['Centro', 'Zona Sul', 'Zona Oeste', 'Zona Norte', 'Zona Leste'].map((rg) => {
                  const count = orders.filter(o => o.region === rg).length;
                  const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                  return (
                    <div key={rg} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{rg}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{count}</span>
                        <span className="text-[10px] text-slate-400 font-bold w-10 text-right">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Safety Modal: Purge All Confirmation */}
      {showPurgeAllModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white max-w-md w-full p-6 rounded-2xl shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Confirmar Exclusão TOTAL</h3>
                <p className="text-xs text-slate-500">Ação irreversível de expurgo do sistema.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-rose-50 p-3 rounded-xl border border-rose-100 font-medium">
              Atenção: Esta ação irá apagar <strong>TODOS</strong> os pedidos, clientes, entregadores, lançamentos financeiros e histórico de atividades de forma definitiva no Firestore e Supabase.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Digite <span className="font-mono font-extrabold text-rose-600">ZERAR</span> para prosseguir:
              </label>
              <input
                type="text"
                value={purgeConfirmInput}
                onChange={(e) => setPurgeConfirmInput(e.target.value)}
                placeholder="ZERAR"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowPurgeAllModal(false);
                  setPurgeConfirmInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                onClick={handleExecutePurgeAll}
                disabled={purgeConfirmInput.trim().toUpperCase() !== 'ZERAR' || isPurging}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                {isPurging ? 'Expurgando...' : 'ZERAR BASE TOTAL'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Universal Confirmation Modal for Seeder & Purge operations */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white max-w-md w-full p-6 rounded-2xl shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500 font-medium">Confirmação de Ação Definitiva</p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed p-3.5 rounded-xl border font-medium ${
              confirmDialog.isDanger ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-amber-50 text-amber-800 border-amber-100'
            }`}>
              {confirmDialog.description}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={isProcessingModal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                onClick={async () => {
                  setIsProcessingModal(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setIsProcessingModal(false);
                    setConfirmDialog(null);
                  }
                }}
                disabled={isProcessingModal}
                className={`px-5 py-2 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 ${
                  confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                <Trash2 size={14} />
                <span>{isProcessingModal ? 'Processando Exclusão...' : confirmDialog.confirmButtonText}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
