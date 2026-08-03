import React, { useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Info, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { getSupabaseConfig, isSupabaseConfigured, testSupabaseConnection } from '../supabase';

export const DiagnosticUtility: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; code?: string } | null>(null);

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

  const copyVercelTemplate = () => {
    const text = `VITE_SUPABASE_URL=${activeConfig.url || 'https://seu-projeto.supabase.co'}\nVITE_SUPABASE_ANON_KEY=${activeConfig.key || 'sua-chave-anon'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div id="diagnostic-utility-container" className="fixed bottom-4 right-4 z-[9999] font-sans">
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
        <div className="bg-slate-900 text-slate-100 w-80 sm:w-96 rounded-2xl shadow-2xl border border-slate-800 p-4 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Diagnóstico de Ambiante Vercel</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Vercel Env Vars Indicator */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Variáveis do Vite (`VITE_`)</span>
              <span className="text-[10px] text-slate-500">Obrigatório na Vercel</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-300">VITE_SUPABASE_URL</span>
                {isViteUrlValid ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Configurada
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 font-medium text-[10px]">
                    <AlertTriangle className="w-3 h-3" /> Ausente/Inválida
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-300">VITE_SUPABASE_ANON_KEY</span>
                {isViteKeyValid ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Configurada
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 font-medium text-[10px]">
                    <AlertTriangle className="w-3 h-3" /> Ausente/Inválida
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Active Config Status */}
          <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Origem Ativa:</span>
              <span className="font-semibold text-slate-200">
                {isViteUrlValid && isViteKeyValid ? 'Variáveis Vercel (VITE_*)' : localUrl ? 'Cache Local (browser)' : 'Padrão / Ausente'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate">
              URL: {activeConfig.url || 'Não configurada'}
            </div>
          </div>

          {/* Solution for Vercel token error */}
          <div className="bg-blue-950/40 border border-blue-800/50 p-2.5 rounded-xl text-blue-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-blue-300 text-[11px]">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Por que ocorre erro de Token na Vercel?</span>
            </div>
            <p className="text-[10px] leading-relaxed text-blue-300/90">
              No Vite/Vercel, variáveis sem o prefixo <code className="bg-blue-900/60 px-1 py-0.5 rounded text-blue-100 font-mono">VITE_</code> não são incluídas no código compilado.
            </p>
            <div className="pt-1 flex items-center justify-between">
              <button
                onClick={copyVercelTemplate}
                className="flex items-center gap-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copiado!' : 'Copiar nomes para Vercel'}</span>
              </button>
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-1.5 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
              <span>{testing ? 'Testando Conexão...' : 'Testar Conexão Supabase'}</span>
            </button>
          </div>

          {testResult && (
            <div className={`p-2.5 rounded-xl text-[10px] leading-tight border ${
              testResult.success ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-rose-950/50 border-rose-800 text-rose-200'
            }`}>
              <div className="font-bold flex items-center gap-1 mb-0.5">
                {testResult.success ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                <span>{testResult.success ? 'Conexão OK!' : 'Falha na Conexão'}</span>
              </div>
              <p>{testResult.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
