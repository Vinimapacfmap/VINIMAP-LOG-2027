/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  FolderGit2, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  User, 
  Plus, 
  GitCommit, 
  ShieldCheck, 
  Copy, 
  Check, 
  ArrowRight,
  Code2,
  Lock,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';

interface GithubUser {
  login: string;
  name?: string;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  total_private_repos?: number;
  bio?: string;
}

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  updated_at: string;
  default_branch: string;
}

export default function GithubPanel() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('GITHUB_TOKEN') || '');
  const [user, setUser] = useState<GithubUser | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingUser, setLoadingUser] = useState<boolean>(false);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [oauthConfigured, setOauthConfigured] = useState<boolean>(false);
  const [oauthUrl, setOauthUrl] = useState<string>('');
  const [redirectUri, setRedirectUri] = useState<string>('');

  // Repositories Creation Form State
  const [newRepoName, setNewRepoName] = useState('vinimap-dashboard');
  const [newRepoDesc, setNewRepoDesc] = useState('ViniMap Logistics OS - Painel de Controle e Gestão Logística Urbana em Tempo Real');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);

  // Sync Code State
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [commitMsg, setCommitMsg] = useState('feat(vinimap): Sincronização automática do código ViniMap Logistics OS');
  const [targetBranch, setTargetBranch] = useState('main');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    commitSha?: string;
    commitUrl?: string;
    repoUrl?: string;
    syncedFilesCount?: number;
    syncedAt?: string;
    error?: string;
  } | null>(null);

  // Status & Feedback Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedDevUrl, setCopiedDevUrl] = useState(false);
  const [copiedSharedUrl, setCopiedSharedUrl] = useState(false);

  const devCallbackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/github/callback`;
  const sharedCallbackUrl = `https://ais-pre-f2qrzggmndpgnd26n6xji6-206823815065.us-west1.run.app/auth/github/callback`;

  // Check OAuth config on server
  useEffect(() => {
    fetch('/api/auth/github/url')
      .then(res => res.json())
      .then(data => {
        setOauthConfigured(data.configured);
        setOauthUrl(data.url);
        setRedirectUri(data.redirectUri || devCallbackUrl);
      })
      .catch(err => console.warn('Erro ao verificar OAuth GitHub:', err));
  }, []);

  // Fetch user if token present
  const fetchGithubUser = async (authToken: string) => {
    if (!authToken) return;
    setLoadingUser(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/github/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      });
      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('GITHUB_TOKEN', authToken);
        setSuccessMsg(`Conectado com sucesso como @${data.user.login}`);
        fetchUserRepos(authToken);
      } else {
        setErrorMsg(data.error || 'Token do GitHub inválido ou expirado.');
        setUser(null);
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão ao validar usuário no GitHub.');
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  // Fetch repositories list
  const fetchUserRepos = async (authToken: string) => {
    if (!authToken) return;
    setLoadingRepos(true);

    try {
      const res = await fetch('/api/github/repos/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.repos)) {
        setRepos(data.repos);
        if (data.repos.length > 0 && !selectedRepo) {
          const matchVini = data.repos.find((r: GithubRepo) => r.name.toLowerCase().includes('vinimap'));
          setSelectedRepo(matchVini ? matchVini.full_name : data.repos[0].full_name);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar repositórios:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchGithubUser(token);
    }
  }, []);

  // Listen for OAuth postMessage from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const receivedToken = event.data.token;
        if (receivedToken) {
          setToken(receivedToken);
          localStorage.setItem('GITHUB_TOKEN', receivedToken);
          if (event.data.user) {
            setUser(event.data.user);
            setSuccessMsg(`OAuth do GitHub vinculado com sucesso! Bem-vindo, @${event.data.user.login}`);
            fetchUserRepos(receivedToken);
          } else {
            fetchGithubUser(receivedToken);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle OAuth Popup trigger
  const handleConnectOAuth = async () => {
    setErrorMsg(null);
    try {
      let urlToOpen = oauthUrl;
      if (!urlToOpen) {
        const res = await fetch('/api/auth/github/url');
        const data = await res.json();
        urlToOpen = data.url;
      }

      if (!urlToOpen) {
        setErrorMsg('GitHub Client ID não configurado no servidor. Insira as credenciais GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET nas variáveis de ambiente ou utilize o Token de Acesso Pessoal (PAT) abaixo.');
        return;
      }

      const popup = window.open(urlToOpen, 'github_oauth_popup', 'width=600,height=720,scrollbars=yes');
      if (!popup) {
        alert('O navegador bloqueou o pop-up. Por favor, permita pop-ups para autenticar com o GitHub.');
      }
    } catch (err: any) {
      setErrorMsg('Erro ao iniciar fluxo de autenticação OAuth com o GitHub.');
    }
  };

  // Handle Manual Token Save
  const handleSaveToken = () => {
    if (!token.trim()) {
      localStorage.removeItem('GITHUB_TOKEN');
      setUser(null);
      setRepos([]);
      setSuccessMsg('Token do GitHub removido.');
      return;
    }
    fetchGithubUser(token.trim());
  };

  // Handle Disconnect
  const handleDisconnect = () => {
    setToken('');
    setUser(null);
    setRepos([]);
    localStorage.removeItem('GITHUB_TOKEN');
    setSuccessMsg('Conta do GitHub desconectada.');
  };

  // Handle Create Repository
  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) {
      setErrorMsg('Digite um nome válido para o repositório.');
      return;
    }
    setCreatingRepo(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/github/repos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: newRepoName.trim(),
          description: newRepoDesc,
          isPrivate: newRepoPrivate,
          autoInit: true
        })
      });

      const data = await res.json();
      if (data.success && data.repo) {
        setSuccessMsg(`Repositório "${data.repo.full_name}" criado com sucesso no GitHub!`);
        setSelectedRepo(data.repo.full_name);
        fetchUserRepos(token);
      } else {
        setErrorMsg(data.error || 'Erro ao criar repositório no GitHub.');
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão ao criar repositório.');
    } finally {
      setCreatingRepo(false);
    }
  };

  // Handle Sync Codebase
  const handleSyncCode = async () => {
    if (!selectedRepo) {
      setErrorMsg('Selecione ou informe um repositório para sincronização.');
      return;
    }

    setSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSyncResult(null);

    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          repoFullName: selectedRepo,
          commitMessage: commitMsg,
          branch: targetBranch || 'main'
        })
      });

      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
        setSuccessMsg(`Código ViniMap sincronizado com sucesso no GitHub! ${data.syncedFilesCount} arquivos atualizados.`);
      } else {
        setErrorMsg(data.error || 'Falha na sincronização do código com o repositório.');
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão durante o processo de envio dos arquivos.');
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string, type: 'dev' | 'shared') => {
    navigator.clipboard.writeText(text);
    if (type === 'dev') {
      setCopiedDevUrl(true);
      setTimeout(() => setCopiedDevUrl(false), 2000);
    } else {
      setCopiedSharedUrl(true);
      setTimeout(() => setCopiedSharedUrl(false), 2000);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 select-none" id="github-panel-container">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 translate-x-12 -translate-y-6 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-inner">
              <GitBranch className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Integração & Sincronização GitHub</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                  ViniMap OS v2.0
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Vinculação OAuth, criação de repositórios e envio direto do código ViniMap para o GitHub.
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700/70 p-2.5 rounded-xl">
              <img 
                src={user.avatar_url} 
                alt={user.login} 
                className="w-9 h-9 rounded-lg object-cover border border-slate-600"
                referrerPolicy="no-referrer"
              />
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  @{user.login}
                  <a 
                    href={user.html_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-slate-400 hover:text-blue-400"
                    title="Ver Perfil"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="text-[10px] text-slate-400">
                  {user.public_repos} repos públicos
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="ml-2 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-2.5 py-1 rounded-md border border-red-500/30 font-medium transition cursor-pointer"
                id="github-disconnect-btn"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 text-xs shadow-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Atenção</span>
            {errorMsg}
          </div>
        </motion.div>
      )}

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-xs shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {/* SECTION 1: CONEXÃO OAUTH & TOKEN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">1. Vinculação de Conta com GitHub</h2>
            </div>
            {user ? (
              <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Conectado
              </span>
            ) : (
              <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1.5">
                <AlertCircle size={13} /> Não Conectado
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* OAuth Connection Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-xs text-slate-800">Autenticação OAuth (Recomendada)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-4">
                  Conecte sua conta do GitHub via janela segura de autorização OAuth do navegador com escopos de repositório.
                </p>
              </div>

              <button
                onClick={handleConnectOAuth}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                id="github-oauth-connect-btn"
              >
                <FolderGit2 size={16} />
                {user ? 'Reconectar via OAuth GitHub' : 'Conectar via OAuth GitHub'}
              </button>
            </div>

            {/* PAT Token Fallback */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-slate-700" />
                  <span className="font-bold text-xs text-slate-800">Token de Acesso Pessoal (PAT)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                  Ou insira diretamente seu token pessoal do GitHub com escopos <code className="bg-slate-200 px-1 rounded text-slate-800">repo</code> e <code className="bg-slate-200 px-1 rounded text-slate-800">user</code>.
                </p>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono mb-3"
                  id="github-token-input"
                />
              </div>

              <button
                onClick={handleSaveToken}
                disabled={loadingUser}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                id="github-save-token-btn"
              >
                {loadingUser ? <RefreshCw className="animate-spin w-4 h-4" /> : <CheckCircle2 size={16} />}
                Validar e Salvar Token
              </button>
            </div>
          </div>
        </div>

        {/* OAuth Configuration Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">URLs de Callback OAuth</h3>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
              Ao criar seu app OAuth no GitHub Developer Settings (<a href="https://github.com/settings/developers" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">github.com/settings/developers</a>), configure estas URLs de Callback exatas:
            </p>

            <div className="space-y-2 text-[10px]">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-bold block mb-1">URL de Desenvolvimento:</span>
                <div className="flex items-center justify-between gap-1">
                  <code className="text-blue-700 font-mono text-[9px] break-all">{devCallbackUrl}</code>
                  <button 
                    onClick={() => copyToClipboard(devCallbackUrl, 'dev')}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0 cursor-pointer"
                    title="Copiar URL"
                  >
                    {copiedDevUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-bold block mb-1">URL Deploiada / Compartilhada:</span>
                <div className="flex items-center justify-between gap-1">
                  <code className="text-blue-700 font-mono text-[9px] break-all">{sharedCallbackUrl}</code>
                  <button 
                    onClick={() => copyToClipboard(sharedCallbackUrl, 'shared')}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0 cursor-pointer"
                    title="Copiar URL"
                  >
                    {copiedSharedUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CRIAÇÃO DE REPOSITÓRIOS & SELEÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Repo Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">2. Criar Novo Repositório no GitHub</h2>
          </div>

          <form onSubmit={handleCreateRepo} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Repositório</label>
              <input 
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="vinimap-dashboard"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
                id="github-create-reponame-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
              <textarea 
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                {newRepoPrivate ? <Lock className="w-4 h-4 text-amber-600" /> : <Globe className="w-4 h-4 text-emerald-600" />}
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Visibilidade: {newRepoPrivate ? 'Privado' : 'Público'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {newRepoPrivate ? 'Restrito apenas a membros convidados' : 'Visível publicamente no GitHub'}
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  checked={newRepoPrivate}
                  onChange={(e) => setNewRepoPrivate(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <button
              type="submit"
              disabled={creatingRepo || !token}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="github-submit-create-repo-btn"
            >
              {creatingRepo ? <RefreshCw className="animate-spin w-4 h-4" /> : <Plus size={16} />}
              Criar Repositório no GitHub
            </button>
          </form>
        </div>

        {/* Existing Repos Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-800">Seus Repositórios no GitHub</h2>
              </div>
              <button
                onClick={() => fetchUserRepos(token)}
                disabled={loadingRepos || !token}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Atualizar lista"
              >
                <RefreshCw size={14} className={loadingRepos ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingRepos ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="animate-spin w-5 h-5 text-blue-600" />
                Carregando repositórios...
              </div>
            ) : repos.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {repos.map((r) => (
                  <div 
                    key={r.id}
                    onClick={() => setSelectedRepo(r.full_name)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      selectedRepo === r.full_name 
                        ? 'border-blue-500 bg-blue-50/60 shadow-xs' 
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 truncate">
                        {r.private ? <Lock size={12} className="text-amber-600 shrink-0" /> : <Globe size={12} className="text-emerald-600 shrink-0" />}
                        <span className="truncate">{r.full_name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {r.description || 'Sem descrição.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a 
                        href={r.html_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-slate-700"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir no GitHub"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {selectedRepo === r.full_name && (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                {user ? 'Nenhum repositório encontrado ou lista vazia.' : 'Conecte sua conta para listar repositórios.'}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-500">
            Repositório Selecionado para Sincronia: <code className="font-mono font-bold text-slate-800">{selectedRepo || 'Nenhum'}</code>
          </div>
        </div>
      </div>

      {/* SECTION 3: SINCRONIZAÇÃO DE CÓDIGO VINIMAP */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">3. Sincronizar Código ViniMap para o GitHub</h2>
              <p className="text-xs text-slate-500">Envia todos os componentes, páginas, estilos e backend em tempo real.</p>
            </div>
          </div>

          {syncResult && syncResult.success && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Commit Realizado
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Repositório Destino</label>
            <input 
              type="text"
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              placeholder="usuario/vinimap-dashboard"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
              id="github-sync-repo-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Destino</label>
            <input 
              type="text"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mensagem do Commit</label>
            <input 
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="feat: atualizacao do painel vinimap"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <Code2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">Arquivos do ViniMap Prontos para Commit</span>
              <span className="text-[11px] text-slate-500">Inclui /src, /public, componentes, servicos, estilos, README e server.ts</span>
            </div>
          </div>

          <button
            onClick={handleSyncCode}
            disabled={syncing || !token || !selectedRepo}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            id="github-start-sync-btn"
          >
            {syncing ? (
              <>
                <RefreshCw className="animate-spin w-4 h-4" />
                Sincronizando Código com GitHub...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Sincronizar Código ViniMap Agora
              </>
            )}
          </button>
        </div>

        {/* Sync Success Card */}
        {syncResult && syncResult.success && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-900 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Sincronização Concluída com Sucesso!</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700">
                {syncResult.syncedAt && new Date(syncResult.syncedAt).toLocaleTimeString('pt-BR')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px] pt-1">
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-sans block">Arquivos Sincronizados:</span>
                <span className="font-bold text-slate-800">{syncResult.syncedFilesCount} arquivos</span>
              </div>

              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-sans block">Commit SHA:</span>
                <code className="font-bold text-blue-700">{syncResult.commitSha?.slice(0, 10)}</code>
              </div>

              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-700 font-sans block">Ver no GitHub:</span>
                  <a 
                    href={syncResult.commitUrl || syncResult.repoUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-bold text-blue-600 hover:underline flex items-center gap-1 text-[10px]"
                  >
                    Abrir Commit <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
