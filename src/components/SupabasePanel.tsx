import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Code, 
  Terminal, 
  Info,
  Zap,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Table,
  Layers,
  Activity,
  FileSpreadsheet,
  Users,
  Truck,
  DollarSign,
  Clock,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';
import { isSupabaseConfigured, createCustomSupabaseClient } from '../supabase';
import { 
  syncAllStateToSupabase, 
  fetchAllStateFromSupabase,
  checkTableSyncStatus,
  syncSingleTableToSupabase,
  TableSyncDiagnostic,
  TABLE_SQL_FIXES,
  SyncStats,
  SupabaseLoadedState
} from '../lib/supabaseService';
import { 
  Order, 
  ClientPartner, 
  DeliveryRider, 
  ActivityLog, 
  FinancialTransaction, 
  CompanyHub 
} from '../types';

interface SupabasePanelProps {
  orders: Order[];
  clientPartners: ClientPartner[];
  riders: DeliveryRider[];
  activityLogs: ActivityLog[];
  financialTransactions: FinancialTransaction[];
  companyHubs: CompanyHub[];
  onLoadExternalState: (state: SupabaseLoadedState) => void;
  onAddLog: (message: string, type: 'info' | 'success' | 'warning' | 'danger') => void;
}

export default function SupabasePanel({
  orders,
  clientPartners,
  riders,
  activityLogs,
  financialTransactions,
  companyHubs,
  onLoadExternalState,
  onAddLog
}: SupabasePanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  const [copiedRlsFix, setCopiedRlsFix] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncStats | null>(null);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Filter for tables
  const [tableFilter, setTableFilter] = useState<'all' | 'discrepancy' | 'error' | 'synced'>('all');

  // Modal for Viewing Table SQL
  const [sqlModalTable, setSqlModalTable] = useState<{ name: string; title: string; sql: string } | null>(null);

  // Table diagnostics state
  const [isCheckingAllTables, setIsCheckingAllTables] = useState(false);
  const [tableSyncingMap, setTableSyncingMap] = useState<Record<string, boolean>>({});

  const initialTableDiagnostics: Record<string, TableSyncDiagnostic> = {
    company_hubs: {
      tableName: 'company_hubs',
      label: 'Sedes & Hubs (company_hubs)',
      description: 'Matriz e centros de distribuição para cálculo de rotas e coordenadas',
      localCount: companyHubs.length,
      remoteCount: null,
      status: 'idle',
      sqlFix: TABLE_SQL_FIXES.company_hubs
    },
    client_partners: {
      tableName: 'client_partners',
      label: 'Clientes & Parceiros (client_partners)',
      description: 'Contratos, faixas de CEP customizadas e regras de frete',
      localCount: clientPartners.length,
      remoteCount: null,
      status: 'idle',
      sqlFix: TABLE_SQL_FIXES.client_partners
    },
    delivery_riders: {
      tableName: 'delivery_riders',
      label: 'Entregadores & Frota (delivery_riders)',
      description: 'Condutores, modelos de repasse, senhas e status de conexão',
      localCount: riders.length,
      remoteCount: null,
      status: 'idle',
      sqlFix: TABLE_SQL_FIXES.delivery_riders
    },
    orders: {
      tableName: 'orders',
      label: 'Pedidos & Entregas (orders)',
      description: 'Rastreamento, histórico de ocorrências, comprovantes e valores',
      localCount: orders.length,
      remoteCount: null,
      status: 'idle',
      sqlFix: TABLE_SQL_FIXES.orders
    },
    activity_logs: {
      tableName: 'activity_logs',
      label: 'Auditoria & Logs (activity_logs)',
      description: 'Registro histórico de eventos e alterações do sistema',
      localCount: activityLogs.length,
      remoteCount: null,
      status: 'idle',
      sqlFix: TABLE_SQL_FIXES.activity_logs
    },
    financial_transactions: {
      tableName: 'financial_transactions',
      label: 'Financeiro (financial_transactions)',
      description: 'Contas a pagar/receber, repasses e fluxo de caixa',
      localCount: financialTransactions.length,
      remoteCount: null,
      status: 'idle',
      sqlFix: TABLE_SQL_FIXES.financial_transactions
    }
  };

  const [tableDiagnostics, setTableDiagnostics] = useState<Record<string, TableSyncDiagnostic>>(initialTableDiagnostics);

  // Sync local count changes to table diagnostics
  useEffect(() => {
    setTableDiagnostics(prev => ({
      ...prev,
      company_hubs: { ...prev.company_hubs, localCount: companyHubs.length },
      client_partners: { ...prev.client_partners, localCount: clientPartners.length },
      delivery_riders: { ...prev.delivery_riders, localCount: riders.length },
      orders: { ...prev.orders, localCount: orders.length },
      activity_logs: { ...prev.activity_logs, localCount: activityLogs.length },
      financial_transactions: { ...prev.financial_transactions, localCount: financialTransactions.length }
    }));
  }, [companyHubs.length, clientPartners.length, riders.length, orders.length, activityLogs.length, financialTransactions.length]);

  const getInitialUrl = () => {
    const rawUrl = localStorage.getItem('SUPABASE_URL') || '';
    if (rawUrl.startsWith('sb_publishable_') || rawUrl.startsWith('sb_secret_') || rawUrl.startsWith('eyJ')) {
      return '';
    }
    return rawUrl;
  };

  const getInitialKey = () => {
    const rawKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    const rawUrl = localStorage.getItem('SUPABASE_URL') || '';
    if (!rawKey && (rawUrl.startsWith('sb_publishable_') || rawUrl.startsWith('sb_secret_') || rawUrl.startsWith('eyJ'))) {
      return rawUrl;
    }
    return rawKey;
  };

  const [inputUrl, setInputUrl] = useState(getInitialUrl);
  const [inputKey, setInputKey] = useState(getInitialKey);
  const [isEditingConfig, setIsEditingConfig] = useState(!isSupabaseConfigured);

  const handleUrlInputChange = (val: string) => {
    setErrorMsg(null);
    setTestDiagnostic(null);
    const trimmed = val.trim();
    if (trimmed.startsWith('sb_publishable_') || trimmed.startsWith('sb_secret_') || trimmed.startsWith('eyJ')) {
      setInputKey(trimmed);
      setInputUrl('');
      setSaveSuccessToast('Chave de API detectada! Movida automaticamente para o campo "Anon API Key". Digite a URL do projeto (ex: https://xxxx.supabase.co) no campo de URL.');
      setTimeout(() => setSaveSuccessToast(null), 7000);
      return;
    }
    setInputUrl(val);
  };

  const handleKeyInputChange = (val: string) => {
    setErrorMsg(null);
    setTestDiagnostic(null);
    const trimmed = val.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setInputUrl(trimmed);
      setInputKey('');
      setSaveSuccessToast('URL do Supabase detectada! Movida automaticamente para o campo "Supabase Project URL". Cole a sua Anon API Key no campo abaixo.');
      setTimeout(() => setSaveSuccessToast(null), 7000);
      return;
    }
    setInputKey(val);
  };

  // Live connection test state
  const [testingConn, setTestingConn] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [testDiagnostic, setTestDiagnostic] = useState<{
    status: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    actionHint?: string;
  } | null>(null);

  const supabaseUrl = process.env.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';
  const maskedKey = supabaseKey 
    ? `${supabaseKey.substring(0, 8)}...${supabaseKey.substring(supabaseKey.length - 8)}`
    : '';

  // Function to check all tables
  const handleCheckAllTables = async () => {
    setIsCheckingAllTables(true);
    setErrorMsg(null);

    const tablesToCheck: Array<TableSyncDiagnostic['tableName']> = [
      'orders',
      'delivery_riders',
      'client_partners',
      'company_hubs',
      'financial_transactions',
      'activity_logs'
    ];

    const localCountMap: Record<TableSyncDiagnostic['tableName'], number> = {
      orders: orders.length,
      delivery_riders: riders.length,
      client_partners: clientPartners.length,
      company_hubs: companyHubs.length,
      financial_transactions: financialTransactions.length,
      activity_logs: activityLogs.length
    };

    // Mark all as checking
    setTableDiagnostics(prev => {
      const next = { ...prev };
      tablesToCheck.forEach(t => {
        if (next[t]) {
          next[t] = { ...next[t], status: 'checking' };
        }
      });
      return next;
    });

    try {
      const results = await Promise.all(
        tablesToCheck.map(t => checkTableSyncStatus(t, localCountMap[t]))
      );

      const nextMap: Record<string, TableSyncDiagnostic> = {};
      results.forEach(res => {
        nextMap[res.tableName] = res;
      });

      setTableDiagnostics(prev => ({ ...prev, ...nextMap }));

      const syncedCount = results.filter(r => r.status === 'synced').length;
      const discrepancyCount = results.filter(r => r.status === 'discrepancy').length;
      const errorCount = results.filter(r => r.status === 'missing_table' || r.status === 'permission_error' || r.status === 'error' || r.status === 'column_mismatch').length;

      if (errorCount > 0) {
        setStatusToast({
          message: `Diagnóstico concluído: ${errorCount} tabela(s) com erro ou bloqueio de RLS. Copie o script SQL para corrigir.`,
          type: 'warning'
        });
      } else if (discrepancyCount > 0) {
        setStatusToast({
          message: `Diagnóstico concluído: ${syncedCount} tabela(s) sincronizada(s) e ${discrepancyCount} com discrepâncias de contagem.`,
          type: 'info'
        });
      } else {
        setStatusToast({
          message: `Diagnóstico concluído: Todas as 6 tabelas do Supabase estão 100% sincronizadas e operacionais!`,
          type: 'success'
        });
      }
      setTimeout(() => setStatusToast(null), 6000);
    } catch (err: any) {
      console.error('[handleCheckAllTables] Error:', err);
      setErrorMsg(`Erro ao executar diagnóstico das tabelas: ${err.message || err}`);
    } finally {
      setIsCheckingAllTables(false);
    }
  };

  // Check a single table
  const handleCheckSingleTable = async (tableName: TableSyncDiagnostic['tableName']) => {
    setTableDiagnostics(prev => ({
      ...prev,
      [tableName]: { ...prev[tableName], status: 'checking' }
    }));

    const localCountMap: Record<TableSyncDiagnostic['tableName'], number> = {
      orders: orders.length,
      delivery_riders: riders.length,
      client_partners: clientPartners.length,
      company_hubs: companyHubs.length,
      financial_transactions: financialTransactions.length,
      activity_logs: activityLogs.length
    };

    try {
      const res = await checkTableSyncStatus(tableName, localCountMap[tableName]);
      setTableDiagnostics(prev => ({
        ...prev,
        [tableName]: res
      }));
    } catch (err: any) {
      setTableDiagnostics(prev => ({
        ...prev,
        [tableName]: {
          ...prev[tableName],
          status: 'error',
          errorMessage: err.message || String(err)
        }
      }));
    }
  };

  // Sync a single table
  const handleSyncSingleTable = async (tableName: TableSyncDiagnostic['tableName']) => {
    setTableSyncingMap(prev => ({ ...prev, [tableName]: true }));
    setErrorMsg(null);

    try {
      const count = await syncSingleTableToSupabase(tableName, {
        hubs: companyHubs,
        clients: clientPartners,
        riders,
        orders,
        logs: activityLogs,
        txs: financialTransactions
      });

      onAddLog(`Tabela "${tableName}" sincronizada com sucesso para o Supabase (${count} registros gravados).`, 'success');
      setStatusToast({
        message: `Tabela "${tableName}" sincronizada com sucesso (${count} registros gravados no Supabase)!`,
        type: 'success'
      });
      setTimeout(() => setStatusToast(null), 4000);

      // Re-check this table
      await handleCheckSingleTable(tableName);
    } catch (err: any) {
      console.error(`[handleSyncSingleTable] Error syncing ${tableName}:`, err);
      const rawMsg = err.message || String(err);
      setErrorMsg(`Falha ao sincronizar tabela "${tableName}": ${rawMsg}`);
      onAddLog(`Erro de sincronização na tabela ${tableName}: ${rawMsg}`, 'danger');
    } finally {
      setTableSyncingMap(prev => ({ ...prev, [tableName]: false }));
    }
  };

  // Sync all discrepant tables
  const handleSyncDiscrepantTables = async () => {
    setSyncing(true);
    setErrorMsg(null);

    try {
      const stats = await syncAllStateToSupabase({
        hubs: companyHubs,
        clients: clientPartners,
        riders,
        orders,
        logs: activityLogs,
        txs: financialTransactions
      });

      setSyncResult(stats);
      onAddLog('Sincronização em lote concluída com sucesso para o banco de dados Supabase.', 'success');
      setStatusToast({
        message: 'Todas as tabelas foram sincronizadas com sucesso com o Supabase!',
        type: 'success'
      });
      setTimeout(() => setStatusToast(null), 5000);

      // Re-run diagnostic
      await handleCheckAllTables();
    } catch (err: any) {
      console.warn(err);
      const rawMsg = err.message || String(err);
      setErrorMsg(`Falha ao sincronizar dados com o Supabase: ${rawMsg}`);
      onAddLog(`Erro de sincronização Supabase: ${rawMsg}`, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async (urlToTest?: string, keyToTest?: string) => {
    const url = (urlToTest !== undefined ? urlToTest : inputUrl).trim();
    const key = (keyToTest !== undefined ? keyToTest : inputKey).trim();

    if (!url || !key) {
      setTestDiagnostic({
        status: 'error',
        title: 'Credenciais Incompletas',
        message: 'Preencha a URL do Projeto Supabase e a Anon Key para testar a conexão.'
      });
      return;
    }

    setTestingConn(true);
    setTestDiagnostic(null);

    try {
      const testClient = createCustomSupabaseClient(url, key);
      if (!testClient) {
        setTestDiagnostic({
          status: 'error',
          title: 'URL do Supabase Inválida',
          message: 'A URL inserida deve ter um formato válido iniciado por http:// ou https:// (ex: https://xyz123.supabase.co).'
        });
        setTestingConn(false);
        return;
      }

      // Query table 'orders' (tabela de pedidos) to test table, API access, and RLS permissions
      const { data, error } = await testClient.from('orders').select('id, client_name, status').limit(1);

      if (!error) {
        setTestDiagnostic({
          status: 'success',
          title: 'Conexão e Permissões RLS Validadas na Tabela de Pedidos (orders)!',
          message: `A consulta simples na tabela de pedidos foi concluída com sucesso (${data?.length ?? 0} registros lidos). Suas credenciais e permissões de RLS estão 100% corretas.`,
          actionHint: 'Sua integração com o Supabase está pronta para uso! Salve as configurações para ativar o sincronismo.'
        });
      } else {
        const errMsg = error.message || String(error);
        if (
          errMsg.includes('does not exist') || 
          errMsg.includes('Could not find') || 
          error.code === 'PGRST204' || 
          error.code === '42P01'
        ) {
          setTestDiagnostic({
            status: 'warning',
            title: 'Credenciais Válidas! Tabela de Pedidos (orders) Não Criada',
            message: 'O servidor do Supabase respondeu com sucesso, mas a tabela "orders" ainda não existe no seu banco PostgreSQL.',
            actionHint: 'Copie o código SQL ao lado e cole no "SQL Editor" do seu Supabase para criar a tabela de pedidos e demais tabelas.'
          });
        } else if (errMsg.includes('row-level security') || errMsg.includes('RLS') || error.code === '42501') {
          setTestDiagnostic({
            status: 'warning',
            title: 'Regras de Segurança (RLS) Bloqueando Acesso em "orders"',
            message: 'A conexão foi aceita, porém o RLS (Row Level Security) está ativo e bloqueou a leitura da tabela de pedidos.',
            actionHint: 'Copie e execute a instrução SQL "ALTER TABLE orders DISABLE ROW LEVEL SECURITY;" ou configure a política de leitura no Supabase.'
          });
        } else if (errMsg.includes('JWT') || errMsg.includes('API key') || error.code === 'PGRST301') {
          setTestDiagnostic({
            status: 'error',
            title: 'Chave Anon API Key Recusada',
            message: 'A chave anon inserida é inválida ou incorreta para este projeto.',
            actionHint: 'Verifique no Supabase em Project Settings > API > Project API keys e copie o token "anon public".'
          });
        } else {
          setTestDiagnostic({
            status: 'error',
            title: 'Erro de Resposta da Tabela de Pedidos (orders)',
            message: `O Supabase retornou o seguinte erro ao consultar "orders": ${errMsg}`,
            actionHint: 'Confirme se a URL e as permissões de acesso da tabela de pedidos estão corretas.'
          });
        }
      }
    } catch (err: any) {
      setTestDiagnostic({
        status: 'error',
        title: 'Erro ao Conectar com a URL',
        message: `Não foi possível alcançar a URL especificada: ${err.message || String(err)}`
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveConfig = (urlToSave?: unknown, keyToSave?: unknown) => {
    setErrorMsg(null);
    setSaveSuccessToast(null);

    let targetUrl = (typeof urlToSave === 'string' ? urlToSave : inputUrl).trim();
    let targetKey = (typeof keyToSave === 'string' ? keyToSave : inputKey).trim();

    const isUrlKey = targetUrl.startsWith('sb_publishable_') || targetUrl.startsWith('sb_secret_') || targetUrl.startsWith('eyJ');
    const isKeyUrl = targetKey.startsWith('http://') || targetKey.startsWith('https://');

    if (isUrlKey && isKeyUrl) {
      const temp = targetUrl;
      targetUrl = targetKey;
      targetKey = temp;
      setInputUrl(targetUrl);
      setInputKey(targetKey);
    } else if (isUrlKey) {
      targetKey = targetUrl;
      targetUrl = '';
      setInputUrl('');
      setInputKey(targetKey);
      setErrorMsg(`A chave "${targetKey.length > 20 ? targetKey.substring(0, 20) + '...' : targetKey}" é a sua Anon API Key e foi movida para o campo "Anon API Key (Public)". Por favor, informe a URL do seu projeto Supabase no primeiro campo (ex: https://xxxxxx.supabase.co).`);
      return;
    } else if (isKeyUrl) {
      targetUrl = targetKey;
      targetKey = '';
      setInputUrl(targetUrl);
      setInputKey('');
      setErrorMsg(`A URL "${targetUrl}" foi movida para o campo "Supabase Project URL". Por favor, informe a sua Anon API Key no campo abaixo.`);
      return;
    }

    if (targetUrl || targetKey) {
      if (!targetUrl || !targetKey) {
        const missingField = !targetUrl ? 'URL do Supabase' : 'Anon API Key';
        setErrorMsg(`Por favor, preencha o campo ${missingField} antes de salvar as credenciais.`);
        return;
      }

      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setErrorMsg('A URL do Supabase deve ser um endereço válido iniciado por http:// ou https://');
          return;
        }
      } catch (err) {
        setErrorMsg('URL do Supabase inválida. Exemplo válido: https://xxxxxx.supabase.co');
        return;
      }

      setIsSavingConfig(true);
      try {
        localStorage.setItem('SUPABASE_URL', targetUrl);
        localStorage.setItem('SUPABASE_ANON_KEY', targetKey);
        setSaveSuccessToast('Credenciais do Supabase salvas com sucesso! Ativando integração...');
        
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } catch (err) {
        setIsSavingConfig(false);
        setErrorMsg(`Erro ao salvar no armazenamento do navegador: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      setIsSavingConfig(true);
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
      setSaveSuccessToast('Credenciais removidas. Recarregando aplicação...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const sqlMigrationCode = `-- -------------------------------------------------------------
-- SQL Migration Schema for Supabase (PostgreSQL)
-- Application: Vinimap Logistics OS
-- -------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: company_hubs
CREATE TABLE IF NOT EXISTS company_hubs (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    address TEXT NOT NULL,
    cep VARCHAR(10) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: client_partners
CREATE TABLE IF NOT EXISTS client_partners (
    id VARCHAR(100) PRIMARY KEY,
    codigo_cliente VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    tel VARCHAR(50),
    addr TEXT,
    status VARCHAR(50) DEFAULT 'Ativo',
    type VARCHAR(20) DEFAULT 'Parceiro',
    cnpj VARCHAR(20),
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    enable_completion_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    cep_ranges JSONB DEFAULT '[]'::jsonb,
    cep_ranges_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: delivery_riders
CREATE TABLE IF NOT EXISTS delivery_riders (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    vehicle VARCHAR(50) DEFAULT 'Moto',
    rating NUMERIC(3, 2) DEFAULT 5.0,
    status VARCHAR(50) DEFAULT 'Offline',
    phone VARCHAR(50),
    lat NUMERIC(10, 6) DEFAULT 0.0,
    lng NUMERIC(10, 6) DEFAULT 0.0,
    completed_deliveries INT DEFAULT 0,
    current_order_id VARCHAR(100),
    battery_percent INT DEFAULT 100,
    billing_model VARCHAR(50) DEFAULT 'misto',
    billing_fixed_fee NUMERIC(10, 2) DEFAULT 0.00,
    billing_variable_percent NUMERIC(5, 2) DEFAULT 0.00,
    billing_freight_percent NUMERIC(5, 2) DEFAULT 0.00,
    exibir_valor_turno BOOLEAN DEFAULT TRUE NOT NULL,
    ocultar_valores_protocolos BOOLEAN DEFAULT FALSE NOT NULL,
    autorizar_imprimir_recibo BOOLEAN DEFAULT FALSE NOT NULL,
    device_number VARCHAR(100),
    password VARCHAR(100),
    address TEXT,
    cpf_cnpj VARCHAR(20),
    vehicle_plate VARCHAR(20),
    cnh VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: orders
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT NOT NULL,
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Não iniciado',
    priority VARCHAR(20) DEFAULT 'Média',
    value NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    rider_id VARCHAR(100),
    items_count INT DEFAULT 1 NOT NULL,
    date DATE NOT NULL,
    cep VARCHAR(10),
    partner_name VARCHAR(255),
    delivery_value NUMERIC(10, 2) DEFAULT 0.00,
    driver_value NUMERIC(10, 2) DEFAULT 0.00,
    raw_data JSONB DEFAULT '{}'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    protocol_number VARCHAR(100),
    signature_url TEXT,
    delivery_photo_url TEXT,
    recipient_name VARCHAR(255),
    recipient_doc VARCHAR(50),
    delivery_date VARCHAR(50),
    delivery_time VARCHAR(50),
    data_conclusao VARCHAR(50),
    horario_inicial VARCHAR(50),
    horario_final VARCHAR(50),
    sequence INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(100) PRIMARY KEY,
    time VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    order_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
    id VARCHAR(100) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    actual_payment_date DATE,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    recipient_or_payer VARCHAR(255),
    payment_method VARCHAR(100),
    notes TEXT,
    cost_type VARCHAR(20),
    is_recurring BOOLEAN DEFAULT FALSE NOT NULL,
    recurrence_period VARCHAR(20),
    recurrence_installment INT,
    total_installments INT,
    parent_recurrence_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Performance Indices for fast queries & filters
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_name);
CREATE INDEX IF NOT EXISTS idx_orders_date_status_partner ON orders(date, status, partner_name);
CREATE INDEX IF NOT EXISTS idx_financial_due_date ON financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_category ON financial_transactions(category);

-- Ensure missing columns exist in pre-existing tables
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS enable_completion_notifications BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS cep_ranges_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS autorizar_imprimir_recibo BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_conclusao VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS horario_inicial VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS horario_final VARCHAR(50);

-- Remove legacy foreign key constraint if present
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_rider_id_fkey;

-- Fix RLS permissions for Anonymous Dashboard Sync
ALTER TABLE company_hubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_riders DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions DISABLE ROW LEVEL SECURITY;

-- Grant permissions to public role
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';`;

  const rlsFixSqlCode = `-- -------------------------------------------------------------
-- SQL RLS & Permissions Fix Script
-- Copie e cole no SQL Editor do Supabase para destravar as permissões
-- -------------------------------------------------------------

ALTER TABLE company_hubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_riders DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;

NOTIFY pgrst, 'reload schema';`;

  const copyMigration = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRlsFix = () => {
    navigator.clipboard.writeText(rlsFixSqlCode);
    setCopiedRlsFix(true);
    setTimeout(() => setCopiedRlsFix(false), 2000);
  };

  const copyTableSql = (tableName: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedTable(tableName);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  const handleSyncToSupabase = async () => {
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase não está configurado. Insira SUPABASE_URL e SUPABASE_ANON_KEY nos segredos/variáveis do projeto.');
      return;
    }

    setSyncing(true);
    setErrorMsg(null);
    setSyncResult(null);
    setFetchResult(null);

    try {
      const stats = await syncAllStateToSupabase({
        hubs: companyHubs,
        clients: clientPartners,
        riders,
        orders,
        logs: activityLogs,
        txs: financialTransactions
      });

      setSyncResult(stats);
      onAddLog('Sincronização em lote concluída com sucesso para o banco de dados Supabase.', 'success');
      await handleCheckAllTables();
    } catch (err: any) {
      console.warn(err);
      const rawMsg = err.message || String(err);
      if (rawMsg.includes('schema cache') || rawMsg.includes('Could not find the table') || rawMsg.includes('Could not find') || rawMsg.includes('column')) {
        setErrorMsg(`Estrutura de tabelas/colunas incompleta no Supabase (${rawMsg}). Por favor, copie e execute o código SQL atualizado (ao lado) no "SQL Editor" do Supabase para alinhar todas as colunas e permissões.`);
      } else if (rawMsg.includes('row-level security policy') || rawMsg.includes('RLS')) {
        setErrorMsg(`Erro de permissão (RLS) no Supabase (${rawMsg}). Execute o script SQL ao lado no "SQL Editor" para desabilitar o RLS e conceder permissões.`);
      } else {
        setErrorMsg(`Falha ao sincronizar dados com o Supabase: ${rawMsg}`);
      }
      onAddLog(`Erro de sincronização Supabase: ${rawMsg}`, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchFromSupabase = async () => {
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase não está configurado.');
      return;
    }

    setFetching(true);
    setErrorMsg(null);
    setSyncResult(null);
    setFetchResult(null);

    try {
      const state = await fetchAllStateFromSupabase();
      
      const totalRecords = state.orders.length + state.clients.length + state.riders.length + state.hubs.length + state.logs.length + state.txs.length;
      
      if (totalRecords === 0) {
        setFetchResult('Nenhum registro encontrado no Supabase. O banco remoto está vazio ou precisa de sincronização inicial.');
        return;
      }

      onLoadExternalState(state);
      setFetchResult(
        `Sucesso! Dados carregados do Supabase: ${state.hubs.length} Hubs, ` +
        `${state.clients.length} Clientes, ${state.riders.length} Entregadores, ` +
        `${state.orders.length} Pedidos, ${state.logs.length} Atividades, ${state.txs.length} Transações.`
      );
      onAddLog('Dados do Supabase baixados e aplicados com sucesso como o estado ativo do dashboard.', 'success');
      await handleCheckAllTables();
    } catch (err: any) {
      console.warn(err);
      setErrorMsg(err.message || 'Falha ao obter dados do Supabase. Verifique se as tabelas foram criadas usando as migrations fornecidas.');
      onAddLog(`Erro ao carregar dados do Supabase: ${err.message || err}`, 'danger');
    } finally {
      setFetching(false);
    }
  };

  // Metrics calculations
  const diagnosticList = Object.values(tableDiagnostics);
  const totalTables = diagnosticList.length;
  const syncedCount = diagnosticList.filter(d => d.status === 'synced').length;
  const discrepancyCount = diagnosticList.filter(d => d.status === 'discrepancy').length;
  const errorCount = diagnosticList.filter(d => ['missing_table', 'permission_error', 'column_mismatch', 'error'].includes(d.status)).length;
  const idleCount = diagnosticList.filter(d => d.status === 'idle').length;

  const totalLocalRecords = diagnosticList.reduce((acc, curr) => acc + curr.localCount, 0);
  const totalRemoteRecords = diagnosticList.reduce((acc, curr) => acc + (curr.remoteCount || 0), 0);

  // Filtered list
  const filteredDiagnostics = diagnosticList.filter(d => {
    if (tableFilter === 'discrepancy') return d.status === 'discrepancy';
    if (tableFilter === 'error') return ['missing_table', 'permission_error', 'column_mismatch', 'error'].includes(d.status);
    if (tableFilter === 'synced') return d.status === 'synced';
    return true;
  });

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'orders': return <FileSpreadsheet size={16} className="text-blue-600" />;
      case 'delivery_riders': return <Truck size={16} className="text-emerald-600" />;
      case 'client_partners': return <Users size={16} className="text-purple-600" />;
      case 'company_hubs': return <Layers size={16} className="text-amber-600" />;
      case 'financial_transactions': return <DollarSign size={16} className="text-emerald-600" />;
      case 'activity_logs': return <Activity size={16} className="text-slate-600" />;
      default: return <Table size={16} className="text-slate-600" />;
    }
  };

  const getStatusBadge = (status: TableSyncDiagnostic['status']) => {
    switch (status) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            <span>Sincronizada</span>
          </span>
        );
      case 'discrepancy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle size={12} className="text-amber-600 shrink-0" />
            <span>Discrepância</span>
          </span>
        );
      case 'missing_table':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200">
            <ShieldAlert size={12} className="text-red-600 shrink-0" />
            <span>Tabela Não Encontrada</span>
          </span>
        );
      case 'permission_error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert size={12} className="text-rose-600 shrink-0" />
            <span>Bloqueio RLS / Permissão</span>
          </span>
        );
      case 'column_mismatch':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle size={12} className="text-purple-600 shrink-0" />
            <span>Colunas Desatualizadas</span>
          </span>
        );
      case 'checking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw size={12} className="text-blue-600 animate-spin shrink-0" />
            <span>Verificando...</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200">
            <AlertCircle size={12} className="text-red-600 shrink-0" />
            <span>Erro</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span>Não Verificada</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="supabase-panel-component">
      {/* Toast Notification */}
      {statusToast && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-md animate-fadeIn ${
          statusToast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : statusToast.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            {statusToast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
            {statusToast.type === 'warning' && <AlertCircle size={18} className="text-amber-600 shrink-0" />}
            {statusToast.type === 'info' && <Info size={18} className="text-blue-600 shrink-0" />}
            <span>{statusToast.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setStatusToast(null)}
            className="text-slate-400 hover:text-slate-700 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left (Tables Status & Sync), Right (Migration Code & Instructions) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - Detailed Tables Status & Sync Controls */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Connection Status & Quick Settings Card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans flex items-center gap-2">
                  <Database className="text-slate-600" size={18} />
                  <span>Integração Supabase Database (PostgreSQL)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conexão persistente com tabelas relacionais e sincronização em tempo real.
                </p>
              </div>
              
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-tight self-start sm:self-auto ${
                isSupabaseConfigured 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                  : testDiagnostic?.status === 'success'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isSupabaseConfigured 
                    ? 'bg-emerald-500 animate-pulse' 
                    : testDiagnostic?.status === 'success'
                    ? 'bg-blue-600 animate-bounce'
                    : 'bg-amber-400'
                }`}></span>
                <span>
                  {isSupabaseConfigured 
                    ? 'CONECTADO / CONFIGURADO' 
                    : testDiagnostic?.status === 'success'
                    ? 'TESTADO — PENDENTE DE SALVAR'
                    : 'AGUARDANDO CONFIGURAÇÃO'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Quick Step-by-Step Setup Guide */}
              <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/60 p-4 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <Zap size={14} className="text-blue-600" />
                    <span>Guia Rápido de Configuração Supabase (3 Passos)</span>
                  </span>
                  <a 
                    href="https://supabase.com/dashboard" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>Abrir Painel Supabase</span>
                    <ExternalLink size={11} />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="bg-white/80 p-3 rounded-lg border border-slate-200/60 space-y-1">
                    <div className="font-bold text-blue-700 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-black">1</span>
                      <span>Copiar Credenciais</span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      No Supabase, vá em <b>Project Settings &gt; API</b> e copie a <b>URL do Projeto</b> e a chave <b>anon public</b>.
                    </p>
                  </div>

                  <div className="bg-white/80 p-3 rounded-lg border border-slate-200/60 space-y-1">
                    <div className="font-bold text-blue-700 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-black">2</span>
                      <span>Executar Script SQL</span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      Clique em <b>Copiar SQL</b> (à direita) e cole no menu <b>SQL Editor</b> do Supabase para criar as tabelas do ViniMap.
                    </p>
                  </div>

                  <div className="bg-white/80 p-3 rounded-lg border border-slate-200/60 space-y-1">
                    <div className="font-bold text-blue-700 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-black">3</span>
                      <span>Testar &amp; Conectar</span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      Cole as duas chaves abaixo, clique em <b>Testar Conexão em Tempo Real</b> para validar e depois salve!
                    </p>
                  </div>
                </div>
              </div>

              {/* Diagnostic Alert Result Box */}
              {testDiagnostic && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 animate-fadeIn ${
                  testDiagnostic.status === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : testDiagnostic.status === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {testDiagnostic.status === 'success' && <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />}
                    {testDiagnostic.status === 'warning' && <AlertCircle className="text-amber-600 shrink-0" size={18} />}
                    {testDiagnostic.status === 'error' && <ShieldAlert className="text-red-600 shrink-0" size={18} />}
                    <span>{testDiagnostic.title}</span>
                  </div>
                  <p className="leading-relaxed">{testDiagnostic.message}</p>
                  {testDiagnostic.actionHint && (
                    <div className="mt-2 pt-2 border-t border-black/10 font-medium text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Info size={13} className="shrink-0" />
                        <span><b>Ação Recomendada:</b> {testDiagnostic.actionHint}</span>
                      </div>

                      {testDiagnostic.status === 'success' && (
                        <button
                          type="button"
                          disabled={isSavingConfig || testingConn}
                          onClick={() => handleSaveConfig(inputUrl, inputKey)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-all"
                        >
                          {isSavingConfig ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              <span>Salvar Credenciais e Ativar Agora</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Save Success Toast Box */}
              {saveSuccessToast && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between gap-2 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 animate-bounce" />
                    <span>{saveSuccessToast}</span>
                  </div>
                  <RefreshCw size={14} className="text-emerald-600 animate-spin shrink-0" />
                </div>
              )}

              {/* Error Message Box */}
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center justify-between gap-2 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setErrorMsg(null)} 
                    className="text-red-500 hover:text-red-700 font-bold text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {isEditingConfig ? (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Supabase Project URL <span className="text-slate-400 font-normal lowercase">(ex: https://xxxxxx.supabase.co)</span>
                      </label>
                      <input 
                        type="text" 
                        value={inputUrl}
                        onChange={e => handleUrlInputChange(e.target.value)}
                        placeholder="https://xxxxxx.supabase.co"
                        className="w-full bg-white border border-slate-200 text-sm p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Anon API Key <span className="text-slate-400 font-normal lowercase">(ex: sb_publishable_... ou eyJ...)</span>
                      </label>
                      <input 
                        type="text" 
                        value={inputKey}
                        onChange={e => handleKeyInputChange(e.target.value)}
                        placeholder="sb_publishable_... ou eyJ..."
                        className="w-full bg-white border border-slate-200 text-sm p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => handleTestConnection()}
                      disabled={testingConn}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {testingConn ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Consultando tabela orders...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} className="text-amber-400" />
                          <span>Testar Conexão e RLS (Tabela orders)</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setInputUrl(supabaseUrl);
                          setInputKey(supabaseKey);
                          setIsEditingConfig(false);
                          setTestDiagnostic(null);
                          setErrorMsg(null);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button"
                        disabled={isSavingConfig || testingConn}
                        onClick={() => handleSaveConfig(inputUrl, inputKey)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        {isSavingConfig ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <span>Salvar e Recarregar</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative group">
                    <button 
                      onClick={() => setIsEditingConfig(true)}
                      className="absolute -top-3 -right-2 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 p-1.5 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                      title="Editar Configurações"
                    >
                      <Code size={14} />
                    </button>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supabase Project URL</span>
                      <span className="text-xs font-mono font-bold text-slate-700 truncate block">
                        {supabaseUrl || 'Não configurado'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Anon API Key</span>
                      <span className="text-xs font-mono font-bold text-slate-700 truncate block">
                        {maskedKey || 'Não configurada'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Configuração salva localmente e aplicada no cliente API.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(supabaseUrl, supabaseKey)}
                        disabled={testingConn || !isSupabaseConfigured}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {testingConn ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Zap size={13} className="text-amber-500" />
                        )}
                        <span>Testar Conexão Rápida</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingConfig(true)}
                        className="px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Alterar Credenciais
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NOVO: Painel de Integridade & Status Detalhado das Tabelas */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans flex items-center gap-2">
                  <Table className="text-blue-600" size={18} />
                  <span>Painel de Integridade &amp; Sincronização de Tabelas (PostgreSQL)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifique em tempo real quais tabelas existem, permissões de RLS, contagem remota e discrepâncias de dados.
                </p>
              </div>

              {/* Primary Diagnostic Action Button */}
              <button
                type="button"
                onClick={handleCheckAllTables}
                disabled={isCheckingAllTables || !isSupabaseConfigured}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <RefreshCw size={14} className={isCheckingAllTables ? 'animate-spin' : ''} />
                <span>{isCheckingAllTables ? 'Analisando Tabelas...' : 'Verificar Saúde de Todas as Tabelas'}</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Tabelas</span>
                <div className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span>{totalTables}</span>
                  <span className="text-[10px] text-slate-500 font-normal">definidas no SQL</span>
                </div>
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100 space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">100% Sincronizadas</span>
                <div className="text-lg font-black text-emerald-700 flex items-center gap-2">
                  <span>{syncedCount} / {totalTables}</span>
                  {syncedCount === totalTables && <CheckCircle2 size={16} className="text-emerald-600" />}
                </div>
              </div>

              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100 space-y-1">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Com Discrepâncias</span>
                <div className="text-lg font-black text-amber-700 flex items-center gap-2">
                  <span>{discrepancyCount}</span>
                  <span className="text-[10px] text-amber-600 font-normal">tabelas</span>
                </div>
              </div>

              <div className="bg-red-50/70 p-3.5 rounded-xl border border-red-100 space-y-1">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Erros / Bloqueio RLS</span>
                <div className="text-lg font-black text-red-700 flex items-center gap-2">
                  <span>{errorCount}</span>
                  <span className="text-[10px] text-red-600 font-normal">requerem ajuste</span>
                </div>
              </div>
            </div>

            {/* Quick Batch Actions & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setTableFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableFilter === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas ({totalTables})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('discrepancy')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableFilter === 'discrepancy'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Discrepâncias ({discrepancyCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('error')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableFilter === 'error'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  Erros / RLS ({errorCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('synced')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableFilter === 'synced'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Sincronizadas ({syncedCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {discrepancyCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncDiscrepantTables}
                    disabled={syncing}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <ArrowUpRight size={13} />
                    <span>Sincronizar Pendências ({discrepancyCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={copyRlsFix}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Copiar instrução SQL para desabilitar o RLS de todas as tabelas"
                >
                  {copiedRlsFix ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span className="text-emerald-700">Copiado SQL RLS!</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={13} className="text-slate-600" />
                      <span>Copiar Destravar RLS</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tables Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDiagnostics.map(diag => {
                const isTableSyncing = tableSyncingMap[diag.tableName] || false;
                const isCheckingThis = diag.status === 'checking';
                const hasDiscrepancy = diag.status === 'discrepancy';
                const hasError = ['missing_table', 'permission_error', 'column_mismatch', 'error'].includes(diag.status);
                const isSynced = diag.status === 'synced';

                return (
                  <div 
                    key={diag.tableName}
                    className={`rounded-2xl border p-4.5 transition-all space-y-3.5 ${
                      isSynced 
                        ? 'bg-emerald-50/20 border-emerald-200/80 hover:border-emerald-300' 
                        : hasDiscrepancy
                        ? 'bg-amber-50/20 border-amber-200/80 hover:border-amber-300'
                        : hasError
                        ? 'bg-red-50/20 border-red-200/80 hover:border-red-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Card Header: Icon, Table Name, Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
                          {getTableIcon(diag.tableName)}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 font-mono tracking-tight">
                            {diag.tableName}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-sans block truncate max-w-[200px]">
                            {diag.description}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {getStatusBadge(diag.status)}
                      </div>
                    </div>

                    {/* Stats Comparison Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100/80 text-center font-mono">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Local (App)</span>
                        <span className="text-xs font-black text-slate-800">{diag.localCount}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Supabase</span>
                        <span className={`text-xs font-black ${
                          diag.remoteCount === null ? 'text-slate-400' : 'text-slate-800'
                        }`}>
                          {diag.remoteCount !== null ? diag.remoteCount : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Diferença</span>
                        <span className={`text-xs font-black ${
                          diag.remoteCount === null 
                            ? 'text-slate-400' 
                            : diag.localCount === diag.remoteCount
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}>
                          {diag.remoteCount !== null 
                            ? (diag.localCount - diag.remoteCount === 0 ? '0' : `${diag.localCount - diag.remoteCount > 0 ? '+' : ''}${diag.localCount - diag.remoteCount}`) 
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Diagnostic Message or Warning */}
                    {diag.errorMessage && (
                      <div className={`p-2.5 rounded-lg text-[11px] leading-relaxed border space-y-1 ${
                        hasError 
                          ? 'bg-red-50 border-red-200 text-red-800' 
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5">
                          {hasError ? <ShieldAlert size={13} className="text-red-600 shrink-0" /> : <AlertCircle size={13} className="text-amber-600 shrink-0" />}
                          <span>{diag.errorMessage}</span>
                        </div>
                        {diag.actionHint && (
                          <div className="text-[10px] opacity-90 pl-4">
                            <b>Ação:</b> {diag.actionHint}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Latency & Metadata Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {diag.latencyMs !== undefined && (
                          <span className="flex items-center gap-1 font-mono text-slate-500">
                            <Zap size={10} className="text-amber-500" />
                            <span>{diag.latencyMs}ms</span>
                          </span>
                        )}
                        {diag.lastChecked && (
                          <span>Checado às {diag.lastChecked}</span>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Quick View SQL */}
                        <button
                          type="button"
                          onClick={() => setSqlModalTable({
                            name: diag.tableName,
                            title: diag.label,
                            sql: diag.sqlFix || TABLE_SQL_FIXES[diag.tableName]
                          })}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Ver SQL desta tabela"
                        >
                          <Code size={11} />
                          <span>SQL</span>
                        </button>

                        {/* Copy Table SQL */}
                        <button
                          type="button"
                          onClick={() => copyTableSql(diag.tableName, diag.sqlFix || TABLE_SQL_FIXES[diag.tableName])}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Copiar instrução SQL de criação/correção desta tabela"
                        >
                          {copiedTable === diag.tableName ? (
                            <>
                              <Check size={11} className="text-emerald-600" />
                              <span className="text-emerald-600 font-black">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        {/* Re-check Single Table */}
                        <button
                          type="button"
                          onClick={() => handleCheckSingleTable(diag.tableName)}
                          disabled={isCheckingThis || isCheckingAllTables || !isSupabaseConfigured}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="Re-verificar status desta tabela"
                        >
                          <RefreshCw size={11} className={isCheckingThis ? 'animate-spin' : ''} />
                          <span>Testar</span>
                        </button>

                        {/* Push Single Table */}
                        <button
                          type="button"
                          onClick={() => handleSyncSingleTable(diag.tableName)}
                          disabled={isTableSyncing || !isSupabaseConfigured}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[10px] font-black transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="Enviar dados locais desta tabela para o Supabase"
                        >
                          {isTableSyncing ? (
                            <RefreshCw size={11} className="animate-spin text-blue-600" />
                          ) : (
                            <ArrowUpRight size={11} className="text-blue-600" />
                          )}
                          <span>Enviar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sync Controls Card (Bulk Push & Pull) */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans">
                Central de Sincronização Completa de Dados
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Faça a migração em massa bidirecional para manter seus bancos local (Firestore/demo) e remoto (Supabase) idênticos.
              </p>
            </div>

            {syncResult && (
              <div className="bg-emerald-50 text-emerald-800 text-xs p-4 rounded-xl border border-emerald-100 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Envio para o Supabase Concluído!</span>
                </div>
                <p className="text-slate-600">
                  Os dados locais do Vinimap foram migrados para o PostgreSQL com sucesso:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 font-mono text-[10px] font-semibold text-slate-700 bg-white/60 p-3 rounded-lg border border-emerald-100/40">
                  <div>• Hubs: {syncResult.hubsCount}</div>
                  <div>• Parceiros: {syncResult.clientsCount}</div>
                  <div>• Condutores: {syncResult.ridersCount}</div>
                  <div>• Pedidos: {syncResult.ordersCount}</div>
                  <div>• Atividades: {syncResult.logsCount}</div>
                  <div>• Financeiro: {syncResult.txsCount}</div>
                </div>
              </div>
            )}

            {fetchResult && (
              <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-xl border border-blue-100 flex gap-2.5">
                <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <span>{fetchResult}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* PUSH to Supabase */}
              <button
                onClick={handleSyncToSupabase}
                disabled={syncing || fetching}
                className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-slate-50 transition-all text-center gap-3 group disabled:opacity-50 cursor-pointer"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-100 group-hover:scale-105 transition-all">
                  {syncing ? (
                    <RefreshCw className="animate-spin" size={24} />
                  ) : (
                    <ArrowUpRight size={24} />
                  )}
                </div>
                <div>
                  <span className="text-xs font-black text-slate-800 block">Enviar Todos os Dados Locais</span>
                  <span className="text-[10px] text-slate-400 mt-1 block leading-normal px-2">
                    Grava em massa todos os dados atuais do dashboard diretamente nas tabelas PostgreSQL do Supabase.
                  </span>
                </div>
              </button>

              {/* PULL from Supabase */}
              <button
                onClick={handleFetchFromSupabase}
                disabled={syncing || fetching}
                className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-slate-50 transition-all text-center gap-3 group disabled:opacity-50 cursor-pointer"
              >
                <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl group-hover:bg-sky-100 group-hover:scale-105 transition-all">
                  {fetching ? (
                    <RefreshCw className="animate-spin" size={24} />
                  ) : (
                    <ArrowDownLeft size={24} />
                  )}
                </div>
                <div>
                  <span className="text-xs font-black text-slate-800 block">Carregar Todos do Supabase</span>
                  <span className="text-[10px] text-slate-400 mt-1 block leading-normal px-2">
                    Baixa as informações ativas do Supabase e substitui o estado atual do painel em tempo real.
                  </span>
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column - SQL Migration Code Block & Fast Troubleshooting */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col h-full min-h-[460px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-800 text-slate-400 rounded-lg">
                  <Terminal size={14} />
                </div>
                <span className="text-xs font-extrabold text-slate-300 font-mono tracking-tight">supabase-migration.sql</span>
              </div>

              <button
                onClick={copyMigration}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[10px] text-slate-400 mb-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800 font-sans leading-normal flex gap-1.5">
              <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                Copie o código SQL abaixo e execute-o na guia <b>SQL Editor</b> do painel do seu projeto Supabase para criar as tabelas indexadas e habilitar o sincronismo de dados!
              </span>
            </div>

            {/* Code display */}
            <div className="relative flex-1 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 overflow-y-auto max-h-[500px] font-mono text-[10px] text-slate-300 whitespace-pre scrollbar-thin scrollbar-thumb-slate-800">
              {sqlMigrationCode}
            </div>

            {/* Quick RLS Unlock block */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-amber-400" />
                  <span>Script de Destravar Permissões (RLS)</span>
                </span>
                <button
                  type="button"
                  onClick={copyRlsFix}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  {copiedRlsFix ? 'Copiado!' : 'Copiar Trecho'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Se alguma tabela acusar erro 42501 (Row Level Security), cole este comando no SQL Editor para liberar a leitura e escrita anônima do dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SQL View Modal */}
      {sqlModalTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white font-mono">
                  DDL &amp; Permissões: {sqlModalTable.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSqlModalTable(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Instruções SQL para criar a tabela <b>{sqlModalTable.name}</b> com suas colunas, restrições e liberação de permissões RLS no Supabase PostgreSQL:
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre overflow-y-auto max-h-[350px] scrollbar-thin scrollbar-thumb-slate-800">
              {sqlModalTable.sql}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                Execute este trecho no <b>SQL Editor</b> do Supabase para corrigir esta tabela isoladamente.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSqlModalTable(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => copyTableSql(sqlModalTable.name, sqlModalTable.sql)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedTable === sqlModalTable.name ? (
                    <>
                      <Check size={13} />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
