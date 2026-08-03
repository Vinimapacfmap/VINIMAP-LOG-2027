import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Lock, Mail, KeyRound, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminLoginProps {
  onSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message === 'Email not confirmed' 
          ? 'E-mail não confirmado. Verifique se o e-mail foi confirmado no painel do Supabase.' 
          : error.message === 'Invalid login credentials' 
          ? 'Credenciais inválidas. Verifique o e-mail e a senha.' 
          : error.message
        );
      } else if (data.session) {
        onSuccess();
      }
    } else {
      // Local or Vercel Fallback Login when Supabase env vars are absent
      if (email.trim() && password.trim()) {
        onSuccess();
      } else {
        setError('Por favor, preencha o e-mail e a senha para acessar.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700"
      >
        <div className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Lock className="text-blue-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Acesso Administrativo</h1>
            <p className="text-slate-400 text-sm">Faça login com sua conta do Supabase para acessar o painel Vinimap.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
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
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
        </div>
        <div className="p-4 bg-slate-800/50 border-t border-slate-700 text-center">
          <p className="text-xs text-slate-500">
            Acesso restrito a administradores autorizados.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
