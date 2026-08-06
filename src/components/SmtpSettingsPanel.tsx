/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Server, 
  Key, 
  Mail, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Zap, 
  History, 
  HelpCircle, 
  Info,
  Terminal,
  Check,
  AlertTriangle,
  Lock,
  Globe
} from 'lucide-react';
import { SmtpSettings, SmtpLogEntry, DEFAULT_SMTP_SETTINGS } from '../utils/notificationUtils';

interface SmtpSettingsPanelProps {
  smtpSettings: SmtpSettings;
  onChange: (updated: SmtpSettings) => void;
}

export const SmtpSettingsPanel: React.FC<SmtpSettingsPanelProps> = ({
  smtpSettings,
  onChange,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
    error?: string;
    testedAt?: string;
  } | null>(null);

  const isImapPort = [993, 143, 995, 110].includes(Number(smtpSettings.port));
  const isInvalidPort = [535, 80, 443].includes(Number(smtpSettings.port));

  const updateField = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => {
    onChange({
      ...smtpSettings,
      [key]: value,
    });
  };

  const handleApplyPreset = (preset: 'gmail' | 'office365' | 'zoho' | 'locaweb') => {
    switch (preset) {
      case 'gmail':
        onChange({
          ...smtpSettings,
          host: 'smtp.gmail.com',
          port: 587,
          security: 'tls',
          authRequired: true,
          fromName: smtpSettings.fromName || 'Notificações ViniMap',
        });
        break;
      case 'office365':
        onChange({
          ...smtpSettings,
          host: 'smtp.office365.com',
          port: 587,
          security: 'tls',
          authRequired: true,
          fromName: smtpSettings.fromName || 'Notificações ViniMap',
        });
        break;
      case 'zoho':
        onChange({
          ...smtpSettings,
          host: 'smtp.zoho.com',
          port: 465,
          security: 'ssl',
          authRequired: true,
          fromName: smtpSettings.fromName || 'Notificações ViniMap',
        });
        break;
      case 'locaweb':
        onChange({
          ...smtpSettings,
          host: 'smtplw.com.br',
          port: 587,
          security: 'tls',
          authRequired: true,
          fromName: smtpSettings.fromName || 'Notificações ViniMap',
        });
        break;
    }
  };

  const handleTestConnection = async () => {
    if (!smtpSettings.host.trim()) {
      alert('Por favor, informe o Servidor SMTP (Host) antes de testar.');
      return;
    }

    const recipient = smtpSettings.testRecipientEmail?.trim() || smtpSettings.fromEmail?.trim() || smtpSettings.user?.trim();
    if (!recipient) {
      alert('Informe um e-mail de destino para envio do teste.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpSettings.host,
          port: smtpSettings.port,
          security: smtpSettings.security,
          authRequired: smtpSettings.authRequired,
          user: smtpSettings.user,
          pass: smtpSettings.pass,
          fromEmail: smtpSettings.fromEmail,
          fromName: smtpSettings.fromName,
          testRecipientEmail: recipient,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Conexão e envio de e-mail de teste realizados com sucesso!',
          messageId: data.messageId,
          testedAt: data.testedAt || new Date().toISOString(),
        });

        // Add to local logs
        const newLog: SmtpLogEntry = {
          id: `smtp-log-${Date.now()}`,
          timestamp: new Date().toLocaleString('pt-BR'),
          recipient,
          subject: '[ViniMap] Teste de Conexão SMTP',
          status: 'success',
          messageId: data.messageId,
        };

        const existingLogs = smtpSettings.logs || [];
        updateField('logs', [newLog, ...existingLogs].slice(0, 50));
      } else {
        setTestResult({
          success: false,
          message: 'Falha ao conectar ao servidor SMTP.',
          error: data.error || 'Verifique as credenciais, porta e criptografia.',
          testedAt: new Date().toISOString(),
        });

        const newLog: SmtpLogEntry = {
          id: `smtp-log-${Date.now()}`,
          timestamp: new Date().toLocaleString('pt-BR'),
          recipient,
          subject: '[ViniMap] Teste de Conexão SMTP',
          status: 'error',
          errorDetails: data.error,
        };

        const existingLogs = smtpSettings.logs || [];
        updateField('logs', [newLog, ...existingLogs].slice(0, 50));
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro ao conectar com o serviço backend de teste SMTP.',
        error: err.message || 'Erro de rede ou servidor indisponível.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearLogs = () => {
    if (confirm('Deseja limpar todo o histórico de disparos SMTP salvos neste navegador?')) {
      updateField('logs', []);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status & Toggle */}
      <div className={`p-5 rounded-2xl border transition-all ${
        smtpSettings.enabled 
          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-900' 
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              smtpSettings.enabled 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                : 'bg-slate-200 text-slate-600'
            }`}>
              <Server size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight">
                  Servidor de E-mail SMTP Próprio do Parceiro
                </h3>
                {smtpSettings.enabled ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Ativo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                    Desativado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Dispare e-mails diretos aos clientes utilizando o domínio e o servidor de e-mail oficial da sua empresa, garantindo maior entregabilidade e autenticidade.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 self-start sm:self-center">
            <input 
              type="checkbox" 
              checked={smtpSettings.enabled} 
              onChange={(e) => updateField('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Quick Provider Presets */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-amber-500" />
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Preenchimento Rápido com Provedor Conhecido:
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <HelpCircle size={14} />
            <span>{showHelpGuide ? 'Ocultar Guia de Ajuda' : 'Como obter credenciais (Gmail / Outlook)?'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset('gmail')}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Globe size={13} className="text-red-500" />
            <span>Gmail / Google Workspace</span>
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('office365')}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Globe size={13} className="text-blue-500" />
            <span>Microsoft Outlook / O365</span>
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('zoho')}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Globe size={13} className="text-yellow-600" />
            <span>Zoho Mail</span>
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('locaweb')}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Globe size={13} className="text-indigo-500" />
            <span>Locaweb / Hosting Custom</span>
          </button>
        </div>

        {showHelpGuide && (
          <div className="mt-3 p-4 bg-white rounded-xl border border-blue-200 text-xs text-slate-700 space-y-3 shadow-2xs">
            <h4 className="font-extrabold text-blue-900 flex items-center gap-1.5">
              <Info size={15} className="text-blue-600" />
              <span>Instruções de Configuração por Provedor</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-red-600 font-bold block mb-1">🔴 Gmail / Google Workspace:</strong>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Host: <code className="font-mono text-slate-800">smtp.gmail.com</code> | Porta: <code className="font-mono text-slate-800">587</code> (TLS)</li>
                  <li>Ative a <strong>Verificação em Duas Etapas</strong> na sua Conta Google.</li>
                  <li>Acesse: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">myaccount.google.com/apppasswords</a></li>
                  <li>Crie uma nova <strong>Senha de Aplicativo</strong> e cole os 16 caracteres no campo "Senha SMTP".</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-blue-600 font-bold block mb-1">🔵 Outlook / Office 365:</strong>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Host: <code className="font-mono text-slate-800">smtp.office365.com</code> | Porta: <code className="font-mono text-slate-800">587</code> (TLS)</li>
                  <li>Usuário: Seu e-mail completo do Outlook/Office365.</li>
                  <li>Caso possua 2FA ativo, gere uma Senha de Aplicativo no painel de Segurança da Microsoft.</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-amber-600 font-bold block mb-1">🟡 Zoho Mail:</strong>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Host: <code className="font-mono text-slate-800">smtp.zoho.com</code> | Porta: <code className="font-mono text-slate-800">465</code> (SSL) ou <code className="font-mono text-slate-800">587</code></li>
                  <li>No painel Zoho, ative o acesso SMTP e utilize a Senha de Aplicativo se 2FA estiver ligado.</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-indigo-600 font-bold block mb-1">🟣 cPanel / Locaweb / Hostinger:</strong>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Host: <code className="font-mono text-slate-800">mail.seu-dominio.com.br</code> ou <code className="font-mono text-slate-800">smtplw.com.br</code></li>
                  <li>Porta: <code className="font-mono text-slate-800">587</code> | Criptografia: TLS/STARTTLS</li>
                  <li>Usuário: Endereço de e-mail completo da caixa postal.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SMTP Server Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column: Server Credentials */}
        <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Server size={16} className="text-blue-600" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Conexão e Servidor (Host)
            </h4>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Servidor SMTP (Host) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={smtpSettings.host}
              onChange={(e) => updateField('host', e.target.value)}
              placeholder="ex: smtp.gmail.com ou mail.minhaempresa.com.br"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Porta SMTP
              </label>
              <input
                type="number"
                value={smtpSettings.port}
                onChange={(e) => updateField('port', Number(e.target.value) || 587)}
                placeholder="587"
                className={`w-full px-3.5 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 font-mono text-slate-800 ${
                  isImapPort || isInvalidPort 
                    ? 'border-amber-500 bg-amber-50 focus:ring-amber-500/20' 
                    : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Segurança / Criptografia
              </label>
              <select
                value={smtpSettings.security}
                onChange={(e) => updateField('security', e.target.value as 'tls' | 'ssl' | 'none')}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 cursor-pointer font-medium"
              >
                <option value="tls">TLS / STARTTLS (Porta 587)</option>
                <option value="ssl">SSL (Porta 465)</option>
                <option value="none">Nenhuma (Porta 25)</option>
              </select>
            </div>
          </div>

          {(isImapPort || isInvalidPort) && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção para a Porta {smtpSettings.port}:</strong>
                {isImapPort ? (
                  <p className="text-[11px] mt-0.5">
                    A porta {smtpSettings.port} é usada para recebimento IMAP/POP3. Para envio via SMTP, utilize a porta <strong>587</strong> (TLS) ou <strong>465</strong> (SSL).
                  </p>
                ) : (
                  <p className="text-[11px] mt-0.5">
                    Porta incomum para SMTP. As portas padrão de envio são <strong>587</strong> (TLS) ou <strong>465</strong> (SSL).
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpSettings.authRequired}
                onChange={(e) => updateField('authRequired', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700">
                Requer Autenticação (Usuário e Senha)
              </span>
            </label>
          </div>

          {smtpSettings.authRequired && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Usuário SMTP / Login
                </label>
                <input
                  type="text"
                  value={smtpSettings.user}
                  onChange={(e) => updateField('user', e.target.value)}
                  placeholder="ex: notificacoes@minhaempresa.com.br"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha SMTP / Senha de Aplicativo
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={smtpSettings.pass}
                    onChange={(e) => updateField('pass', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full pl-3.5 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 No Gmail / Outlook, use uma <strong>Senha de Aplicativo</strong> criada no painel da sua conta de e-mail.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sender Branding */}
        <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Mail size={16} className="text-emerald-600" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Identificação do Remetente (Exibição no Cliente)
            </h4>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Remetente (Exibido no e-mail)
            </label>
            <input
              type="text"
              value={smtpSettings.fromName}
              onChange={(e) => updateField('fromName', e.target.value)}
              placeholder="ex: Restaurante & Empório Vini - Entregas"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              E-mail do Remetente (From Address)
            </label>
            <input
              type="email"
              value={smtpSettings.fromEmail}
              onChange={(e) => updateField('fromEmail', e.target.value)}
              placeholder="ex: entregas@minhaempresa.com.br"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Caso deixado em branco, será utilizado o e-mail cadastrado no usuário SMTP.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              E-mail para Resposta (Reply-To) (Opcional)
            </label>
            <input
              type="email"
              value={smtpSettings.replyTo || ''}
              onChange={(e) => updateField('replyTo', e.target.value)}
              placeholder="ex: contato@minhaempresa.com.br"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Garantia de Antispam (SPF/DKIM):</span>
            </div>
            <p>
              Garantimos que o servidor SMTP próprio envia direto do seu domínio, evitando que os e-mails caiam na caixa de spam do seu cliente final.
            </p>
          </div>
        </div>
      </div>

      {/* Connection Test Section */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-400">
              <Terminal size={18} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Teste de Conexão e Disparo em Tempo Real
              </h4>
              <p className="text-[11px] text-slate-300">
                Valide a comunicação com o seu servidor SMTP e receba um e-mail de confirmação na sua caixa de entrada.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="flex-1">
            <input
              type="email"
              value={smtpSettings.testRecipientEmail || ''}
              onChange={(e) => updateField('testRecipientEmail', e.target.value)}
              placeholder="Digite o e-mail de destino para teste (ex: seuemail@empresa.com)"
              className="w-full px-4 py-2.5 text-xs bg-slate-800/90 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 shrink-0"
          >
            {isTesting ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Testando Servidor...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Testar Conexão e Enviar</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className={`p-4 rounded-xl border transition-all ${
            testResult.success
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/40 border-red-500/50 text-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 min-w-0">
                <div className="font-extrabold text-xs tracking-tight flex items-center gap-2">
                  <span>{testResult.message}</span>
                  {testResult.testedAt && (
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      ({new Date(testResult.testedAt).toLocaleTimeString('pt-BR')})
                    </span>
                  )}
                </div>
                {testResult.messageId && (
                  <p className="text-[11px] font-mono text-emerald-300 break-all">
                    Message-ID: {testResult.messageId}
                  </p>
                )}
                {testResult.error && (
                  <div className="text-[11px] font-mono bg-red-950/60 p-2.5 rounded-lg border border-red-800/40 text-red-300 break-words mt-2">
                    <strong>Erro Retornado:</strong> {testResult.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dispatch History / Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-600" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Histórico de Disparos via SMTP
            </h4>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
              {smtpSettings.logs?.length || 0} registros
            </span>
          </div>

          {(smtpSettings.logs?.length || 0) > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              Limpar Histórico
            </button>
          )}
        </div>

        {(!smtpSettings.logs || smtpSettings.logs.length === 0) ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            <Mail size={24} className="mx-auto mb-2 opacity-40" />
            <p>Nenhum disparo de e-mail efetuado até o momento.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Ao concluir um pedido com e-mail informado ou disparar um teste, os registros aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-2 px-3">Data e Hora</th>
                  <th className="py-2 px-3">Destinatário</th>
                  <th className="py-2 px-3">Assunto</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Detalhes / ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {smtpSettings.logs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {log.recipient}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]">
                      {log.subject}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold rounded-md border border-emerald-200">
                          <Check size={12} /> Enviado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-extrabold rounded-md border border-red-200">
                          <XCircle size={12} /> Falhou
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                      {log.messageId || log.errorDetails || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
