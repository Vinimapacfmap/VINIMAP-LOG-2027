import React, { useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Info, Copy, ExternalLink, ShieldAlert, Trash2 } from 'lucide-react';
import { getSupabaseConfig, isSupabaseConfigured, testSupabaseConnection, SupabaseTestResult, clearSupabaseLocalStorage } from '../supabase';

interface DiagnosticUtilityProps {
  mode?: 'floating' | 'sidebar';
  isExpanded?: boolean;
}

export const DiagnosticUtility: React.FC<DiagnosticUtilityProps> = ({ mode = 'floating', isExpanded = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [testResult, setTestResult] = useState<SupabaseTestResult | null>(null);

  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const viteUrl = metaEnv.VITE_SUPABASE_URL || '';
  const viteKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';
  
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('SUPABASE_URL') || '' : '';
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('SUPABASE_ANON_KEY') || '' : '';

  const activeConfig = getSupabaseConfig();

  const isViteUrlValid = viteUrl.startsWith('http://') || viteUrl.startsWith('https://');
  const isViteKeyValid = viteKey.length > 20 && (viteKey.startsWith('sb_publishable_') || viteKey.startsWith('sb_secret_') || viteKey.startsWith('eyJ'));

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'Erro inesperado na conexão' });
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = () => {
    setCleared(true);
    clearSupabaseLocalStorage();
    // Clear session filter flags to prevent blank state
    try {
      sessionStorage.removeItem('vinimap_filter_session');
    } catch (_) {}
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const copyVercelTemplate = () => {
    const text = `VITE_SUPABASE_URL=${activeConfig.url || 'https://seu-projeto.supabase.co'}\nVITE_SUPABASE_ANON_KEY=${activeConfig.key || 'sua-chave-anon'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const diagnosticPanelContent = (
    <div className="bg-slate-900 text-slate-100 w-80 sm:w-84 rounded-2xl shadow-2xl border border-slate-800 p-3.5 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150 z-50">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold text-slate-200">
          <Activity className="w-4 h-4 text-blue-400" />
          <span>Status Vercel & Supabase</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Vercel Env Vars Indicator */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Variáveis Vite (`VITE_`)</span>
          <span className="text-[9px] text-slate-500">Vercel Config</span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-mono text-slate-300">VITE_SUPABASE_URL</span>
            {isViteUrlValid ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium text-[9px]">
                <CheckCircle2 className="w-3 h-3" /> OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-medium text-[9px]">
                <AlertTriangle className="w-3 h-3" /> Ausente
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px]">
            <span className="font-mono text-slate-300">VITE_SUPABASE_ANON_KEY</span>
            {isViteKeyValid ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium text-[9px]">
                <CheckCircle2 className="w-3 h-3" /> OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-medium text-[9px]">
                <AlertTriangle className="w-3 h-3" /> Ausente
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Active Config Status */}
      <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 space-y-1 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Origem Ativa:</span>
          <span className="font-semibold text-slate-200">
            {isViteUrlValid && isViteKeyValid ? 'Vercel (VITE_*)' : localUrl ? 'Cache Local' : 'Padrão'}
          </span>
        </div>
        <div className="font-mono text-slate-400 truncate">
          URL: {activeConfig.url || 'Não configurada'}
        </div>
      </div>

      {/* Solution for Vercel token error */}
      <div className="bg-blue-950/40 border border-blue-800/50 p-2 rounded-xl text-blue-200 space-y-1 text-[10px]">
        <div className="flex items-center gap-1 font-semibold text-blue-300">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Configuração Vercel</span>
        </div>
        <p className="leading-relaxed text-blue-300/90 text-[9.5px]">
          Variáveis devem possuir o prefixo <code className="bg-blue-900/60 px-1 py-0.5 rounded text-blue-100 font-mono">VITE_</code>.
        </p>
        <div className="pt-0.5 flex items-center justify-between">
          <button
            onClick={copyVercelTemplate}
            className="flex items-center gap-1 text-[9.5px] bg-blue-600 hover:bg-blue-500 text-white font-medium px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            <span>{copied ? 'Copiado!' : 'Copiar para Vercel'}</span>
          </button>
        </div>
      </div>

      {/* Test Connection & Clear Cache Buttons */}
      <div className="pt-0.5 flex items-center gap-1.5">
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-1 rounded-xl border border-slate-700 flex items-center justify-center gap-1 text-[10px] transition-colors cursor-pointer disabled:opacity-50"
        >
          <Activity className={`w-3 h-3 ${testing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
          <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
        </button>
        <button
          onClick={handleClearCache}
          title="Limpar chaves salvas no cache do navegador (localStorage)"
          className="bg-slate-800 hover:bg-rose-950/80 hover:border-rose-700 text-slate-300 hover:text-rose-200 font-medium py-1 px-2 rounded-xl border border-slate-700 flex items-center gap-1 text-[10px] transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3 text-rose-400" />
          <span>{cleared ? 'Limpando...' : 'Limpar'}</span>
        </button>
      </div>

      {testResult && (
        <div className={`p-2 rounded-xl text-[9.5px] leading-tight border space-y-1 ${
          testResult.success ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-rose-950/50 border-rose-800 text-rose-200'
        }`}>
          <div className="font-bold flex items-center justify-between gap-1">
            <span className="flex items-center gap-1">
              {testResult.success ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
              <span>{testResult.success ? 'Conexão OK!' : 'Falha'}</span>
            </span>
            {testResult.code && (
              <span className="font-mono text-[8.5px] px-1 py-0.5 rounded bg-slate-900/80 border border-slate-700/80 text-amber-300">
                {testResult.code}
              </span>
            )}
          </div>
          <p className="font-medium">{testResult.message}</p>
        </div>
      )}
    </div>
  );

  if (mode === 'sidebar') {
    return (
      <div className="relative font-sans">
        {isExpanded ? (
          <div className="bg-slate-900 text-white rounded-2xl p-2.5 border border-slate-800 shadow-sm space-y-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
              title="Clique para abrir ou fechar detalhes de conexão"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Activity className={`w-3.5 h-3.5 shrink-0 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold truncate text-slate-200 group-hover:text-white">
                    Vercel & Supabase
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium truncate">
                    {isSupabaseConfigured ? 'Conexão Ativa' : 'Aguardando Configuração'}
                  </span>
                </div>
              </div>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                isSupabaseConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {isOpen ? 'Fechar' : 'Status'}
              </span>
            </button>

            {isOpen && (
              <div className="pt-2 border-t border-slate-800">
                {diagnosticPanelContent}
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex justify-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 cursor-pointer transition-all relative group"
              title="Status Vercel & Supabase"
            >
              <Activity className={`w-4 h-4 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900" />
            </button>

            {isOpen && (
              <div className="absolute left-14 bottom-0 z-50">
                {diagnosticPanelContent}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="diagnostic-utility-container" className="fixed top-18 right-4 z-[9999] font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-full shadow-lg border border-slate-700 transition-all cursor-pointer"
          title="Diagnóstico de Conexão e Vercel"
        >
          <Activity className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
          <span>Status Vercel & Supabase</span>
        </button>
      ) : (
        diagnosticPanelContent
      )}
    </div>
  );
};
