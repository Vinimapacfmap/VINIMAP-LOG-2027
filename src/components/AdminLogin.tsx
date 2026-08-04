import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Lock, Mail, KeyRound, AlertCircle, ArrowRight, ShieldCheck, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminLoginProps {
  onSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeyError, setIsApiKeyError] = useState(false);
  const [showVercelHelp, setShowVercelHelp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsApiKeyError(false);
    
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const isApiKeyIssue = error.message?.toLowerCase().includes('api key') || 
                                error.message?.toLowerCase().includes('apikey') ||
                                error.status === 401;

          if (isApiKeyIssue) {
            setIsApiKeyError(true);
            setError('Chave de API do Supabase inválida na Vercel (Invalid API key).');
          } else if (error.message === 'Email not confirmed') {
            setError('E-mail não confirmado. Verifique se o e-mail foi confirmado no painel do Supabase.');
          } else if (error.message === 'Invalid login credentials') {
            setError('Credenciais inválidas. Verifique o e-mail e a senha.');
          } else {
            setError(error.message);
          }
        } else if (data.session) {
          onSuccess();
        }
      } catch (err: any) {
        setIsApiKeyError(true);
        setError('Erro de comunicação com o Supabase. Verifique suas variáveis na Vercel.');
      }
    } else {
      // Local or Vercel Fallback Login when Supabase env vars are absent or unconfigured
      if (email.trim() && password.trim()) {
        onSuccess();
      } else {
        setError('Por favor, preencha o e-mail e a senha para acessar.');
      }
    }
    setLoading(false);
  };

  const handleBypassLogin = () => {
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700"
      >
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
              <Lock className="text-blue-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Acesso Administrativo</h1>
            <p className="text-slate-400 text-sm">Painel ViniMap OS - Vercel Edition</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 block">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="admin@vinimap.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 block">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <KeyRound size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <p className="text-red-400 text-sm font-medium">{error}</p>
                  {isApiKeyError && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A chave <code className="text-amber-300 font-mono">VITE_SUPABASE_ANON_KEY</code> no painel da Vercel está incorreta ou desatualizada.
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-900/20"
            >
              {loading ? (
                'Autenticando...'
              ) : (
                <>
                  Entrar no Painel <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Local Fallback Access option */}
          <div className="pt-2 border-t border-slate-700/60 space-y-3">
            <button
              onClick={handleBypassLogin}
              type="button"
              className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Entrar no Modo Local / Demonstração</span>
            </button>

            {/* Vercel Troubleshooting accordion */}
            <div className="text-left">
              <button
                type="button"
                onClick={() => setShowVercelHelp(!showVercelHelp)}
                className="w-full text-slate-400 hover:text-slate-200 text-xs flex items-center justify-between py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Info size={14} className="text-blue-400" /> Como resolver o erro de API Key na Vercel?
                </span>
                {showVercelHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showVercelHelp && (
                <div className="mt-2 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
                  <p className="font-semibold text-blue-300">Passos para corrigir na Vercel:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-300/90 leading-relaxed">
                    <li>Acesse o painel do seu projeto no <strong>Vercel</strong>.</li>
                    <li>Vá em <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
                    <li>Adicione a variável <code className="text-amber-300 font-mono">VITE_SUPABASE_URL</code> com o valor da URL do seu Supabase.</li>
                    <li>Adicione a variável <code className="text-amber-300 font-mono">VITE_SUPABASE_ANON_KEY</code> com a chave anon (API Key) pública do seu Supabase.</li>
                    <li>Vá na aba <strong>Deployments</strong> e clique em <strong>Redeploy</strong> para recompilar com as novas chaves.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-800/50 border-t border-slate-700 text-center">
          <p className="text-xs text-slate-500">
            ViniMap Logistics OS • Vercel Production Build
          </p>
        </div>
      </motion.div>
    </div>
  );
};

