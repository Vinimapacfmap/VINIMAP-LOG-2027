import React, { useState } from 'react';
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
  Server
} from 'lucide-react';
import { isSupabaseConfigured } from '../supabase';
import { 
  syncAllStateToSupabase, 
  fetchAllStateFromSupabase,
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
  const [syncResult, setSyncResult] = useState<SyncStats | null>(null);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [inputUrl, setInputUrl] = useState(localStorage.getItem('SUPABASE_URL') || '');
  const [inputKey, setInputKey] = useState(localStorage.getItem('SUPABASE_ANON_KEY') || '');
  const [isEditingConfig, setIsEditingConfig] = useState(!isSupabaseConfigured);

  const supabaseUrl = process.env.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';
  const maskedKey = supabaseKey 
    ? `${supabaseKey.substring(0, 8)}...${supabaseKey.substring(supabaseKey.length - 8)}`
    : '';

  const handleSaveConfig = () => {
    if (inputUrl && inputKey) {
      const trimmedUrl = inputUrl.trim();
      const trimmedKey = inputKey.trim();
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setErrorMsg('A URL do Supabase deve ser um endereço válido iniciado por http:// ou https://');
          return;
        }
      } catch (_) {
        setErrorMsg('URL do Supabase inválida. Exemplo válido: https://xxxxxx.supabase.co');
        return;
      }

      localStorage.setItem('SUPABASE_URL', trimmedUrl);
      localStorage.setItem('SUPABASE_ANON_KEY', trimmedKey);
    } else {
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
    }
    window.location.reload();
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
    cep_ranges JSONB DEFAULT '[]'::jsonb,
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

-- Ensure missing columns exist in pre-existing tables
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

  const copyMigration = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    } catch (err: any) {
      console.warn(err);
      setErrorMsg(err.message || 'Falha ao obter dados do Supabase. Verifique se as tabelas foram criadas usando as migrations fornecidas.');
      onAddLog(`Erro ao carregar dados do Supabase: ${err.message || err}`, 'danger');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="supabase-panel-component">
      {/* Left Columns - Configuration & Sync Status */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Connection Status Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans flex items-center gap-2">
              <Database className="text-slate-500" size={18} />
              <span>Integração Supabase Database (PostgreSQL)</span>
            </h3>
            
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-tight ${
              isSupabaseConfigured 
                ? 'bg-emerald-50 text-emerald-600' 
                : 'bg-amber-50 text-amber-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isSupabaseConfigured ? 'CONECTADO / CONFIGURADO' : 'AGUARDANDO CONFIGURAÇÃO'}</span>
            </div>
          </div>

          <div className="space-y-4">
            {isEditingConfig ? (
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Supabase Project URL</label>
                    <input 
                      type="text" 
                      value={inputUrl}
                      onChange={e => setInputUrl(e.target.value)}
                      placeholder="https://xxxxxx.supabase.co"
                      className="w-full bg-white border border-slate-200 text-sm p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Anon API Key</label>
                    <input 
                      type="password" 
                      value={inputKey}
                      onChange={e => setInputKey(e.target.value)}
                      placeholder="eyJh..."
                      className="w-full bg-white border border-slate-200 text-sm p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setInputUrl(supabaseUrl);
                      setInputKey(supabaseKey);
                      setIsEditingConfig(false);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveConfig}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    Salvar e Recarregar
                  </button>
                </div>
              </div>
            ) : (
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
                    {supabaseUrl || 'Não configurado (.env / secrets)'}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Anon API Key</span>
                  <span className="text-xs font-mono font-bold text-slate-700 truncate block">
                    {maskedKey || 'Não configurada (.env / secrets)'}
                  </span>
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100/40 flex gap-2.5">
              <Info className="text-slate-400 shrink-0 mt-0.5" size={15} />
              <div>
                <p className="font-semibold text-slate-600">Funcionamento da Sincronização:</p>
                <p className="mt-1">
                  Esta integração conecta o dashboard Vinimap ao seu banco de dados PostgreSQL do Supabase. 
                  Com a conexão configurada, todos os novos cadastros e alterações efetuados em tempo real (pedidos, repasses, rotas, despesas e faturamento) são espelhados de forma automática e durável.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Controls Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight font-sans">
              Central de Sincronização de Dados
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Faça a migração em massa bidirecional para manter seus bancos local (Firestore/demo) e remoto (Supabase) idênticos.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-xs p-4 rounded-xl border border-red-100 flex gap-2">
              <AlertCircle className="shrink-0 mt-0.5" size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

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
                <span className="text-xs font-black text-slate-800 block">Enviar Dados Locais</span>
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
                <span className="text-xs font-black text-slate-800 block">Carregar do Supabase</span>
                <span className="text-[10px] text-slate-400 mt-1 block leading-normal px-2">
                  Baixa as informações ativas do Supabase e substitui o estado atual do painel em tempo real.
                </span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Right Column - SQL Migration Code Block */}
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col h-full min-h-[460px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-800 text-slate-400 rounded-lg">
                <Terminal size={14} />
              </div>
              <span className="text-xs font-extrabold text-slate-300 font-mono tracking-tight">Supabase Migrations SQL</span>
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
          <div className="relative flex-1 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 overflow-y-auto max-h-[350px] font-mono text-[10px] text-slate-300 whitespace-pre scrollbar-thin scrollbar-thumb-slate-800">
            {sqlMigrationCode}
          </div>
        </div>
      </div>
    </div>
  );
}
