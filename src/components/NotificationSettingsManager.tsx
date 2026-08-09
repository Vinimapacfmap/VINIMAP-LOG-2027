/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Save, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Smartphone, 
  Tag, 
  BellRing,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Server
} from 'lucide-react';
import { 
  NotificationSettings, 
  getNotificationSettings, 
  saveNotificationSettings, 
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_SMTP_SETTINGS,
  replaceNotificationPlaceholders
} from '../utils/notificationUtils';
import { SmtpSettingsPanel } from './SmtpSettingsPanel';
import { Order } from '../types';

interface NotificationSettingsManagerProps {
  onSaveSuccess?: () => void;
}

const SAMPLE_ORDER: Order = {
  id: 'ped-8924',
  clientName: 'Ana Maria Silva',
  phone: '(11) 98765-4321',
  address: 'Av. Paulista, 1500 - Ap 42 - Bela Vista, São Paulo - SP',
  region: 'Paulista / Centro',
  status: 'Concluído',
  priority: 'Alta',
  value: 125.50,
  createdAt: '2026-07-31T10:30:00.000Z',
  itemsCount: 3,
  date: '2026-07-31',
  cep: '01310-200',
  partnerName: 'Restaurante & Empório Vini',
  recipientName: 'Carlos Eduardo Silva',
  recipientDoc: '42.189.002-8',
  protocolNumber: 'PROT-8924-SP',
  deliveryDate: '31/07/2026',
  deliveryTime: '14:25',
  rawData: {
    Email: 'anamaria.silva@exemplo.com.br',
    Telefone: '11987654321'
  }
};

export default function NotificationSettingsManager({ onSaveSuccess }: NotificationSettingsManagerProps) {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'smtp' | 'preview'>('whatsapp');
  const [isSaved, setIsSaved] = useState(false);
  const [focusedField, setFocusedField] = useState<'subject' | 'emailBody' | 'waBody'>('waBody');

  useEffect(() => {
    setSettings(getNotificationSettings());
  }, []);

  const handleSave = () => {
    saveNotificationSettings(settings);
    setIsSaved(true);
    if (onSaveSuccess) onSaveSuccess();
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar as mensagens e configurações de notificação padrão do sistema?')) {
      setSettings(DEFAULT_NOTIFICATION_SETTINGS);
      saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const insertVariable = (tag: string) => {
    if (focusedField === 'subject') {
      setSettings(prev => ({ ...prev, emailSubjectTemplate: prev.emailSubjectTemplate + ` ${tag}` }));
    } else if (focusedField === 'emailBody') {
      setSettings(prev => ({ ...prev, emailMessageTemplate: prev.emailMessageTemplate + ` ${tag}` }));
    } else {
      setSettings(prev => ({ ...prev, whatsappMessageTemplate: prev.whatsappMessageTemplate + ` ${tag}` }));
    }
  };

  const availableTags = [
    { tag: '{cliente}', label: 'Nome do Cliente' },
    { tag: '{codigo}', label: 'Código do Pedido' },
    { tag: '{parceiro}', label: 'Nome da Loja/Parceiro' },
    { tag: '{entregador}', label: 'Nome do Condutor' },
    { tag: '{recebedor}', label: 'Nome do Recebedor' },
    { tag: '{documento_recebedor}', label: 'Documento do Recebedor' },
    { tag: '{protocolo}', label: 'Número do Protocolo' },
    { tag: '{data}', label: 'Data de Entrega' },
    { tag: '{horario}', label: 'Horário de Conclusão' },
    { tag: '{endereco}', label: 'Endereço Completo' },
  ];

  const previewWaText = replaceNotificationPlaceholders(settings.whatsappMessageTemplate, SAMPLE_ORDER, 'Marcos Oliveira');
  const previewEmailSubject = replaceNotificationPlaceholders(settings.emailSubjectTemplate, SAMPLE_ORDER, 'Marcos Oliveira');
  const previewEmailBody = replaceNotificationPlaceholders(settings.emailMessageTemplate, SAMPLE_ORDER, 'Marcos Oliveira');

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6" id="notification-settings-panel">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <BellRing size={20} />
            </span>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">
              Mensagens Padrão & Notificações de Conclusão
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure as mensagens automáticas enviadas por E-mail e WhatsApp/SMS para os clientes ao finalizar entregas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            type="button"
            className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Restaurar mensagens originais"
          >
            <RotateCcw size={14} />
            <span>Restaurar Padrões</span>
          </button>

          <button
            onClick={handleSave}
            type="button"
            className={`px-5 py-2 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              isSaved 
                ? 'bg-emerald-600 text-white shadow-emerald-200' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
            }`}
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            <span>{isSaved ? 'Configurações Salvas!' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* Info Banner on SMTP & WhatsApp Functionality */}
      <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-extrabold text-amber-950">
          <Info size={16} className="text-amber-600 shrink-0" />
          <span>Como funcionam os envios de Notificação:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 leading-relaxed font-medium">
          <li>
            <strong>E-mail Automático:</strong> Os e-mails reais de comprovante só chegam ao cliente se o <strong>Servidor SMTP Próprio</strong> estiver <u>ATIVO e configurado</u> na aba "Servidor SMTP" (com Host, Porta e Senha de App). Caso o SMTP não esteja configurado, o histórico do pedido registrará <em>"E-mail Não Enviado (SMTP Inativo)"</em>.
          </li>
          <li>
            <strong>WhatsApp:</strong> Ao concluir o pedido com WhatsApp ativo, o navegador abre a janela oficial do WhatsApp Web com a mensagem de comprovante já preenchida para o cliente.
          </li>
        </ul>
      </div>

      {/* Global Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WhatsApp Dispatch Switch */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <MessageSquare size={18} />
            </span>
            <div>
              <h4 className="font-extrabold text-xs text-slate-800">Notificação via WhatsApp / SMS</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Exibir link/ação instantânea de envio de WhatsApp com o comprovante no encerramento.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={settings.autoSendWhatsapp}
              onChange={(e) => setSettings(prev => ({ ...prev, autoSendWhatsapp: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Email Dispatch Switch */}
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <Mail size={18} />
            </span>
            <div>
              <h4 className="font-extrabold text-xs text-slate-800">Notificação Automática por E-mail</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Disparar comprovante oficial em HTML para o e-mail cadastrado no pedido ao concluir.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={settings.autoSendEmail}
              onChange={(e) => setSettings(prev => ({ ...prev, autoSendEmail: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Dynamic Placeholder Insertion Bar */}
      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={14} className="text-blue-500" />
            Variáveis Dinâmicas Disponíveis (Clique para Inserir):
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Serão substituídas pelos dados reais do pedido no momento do envio.
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => insertVariable(item.tag)}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-mono font-bold rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
              title={`Inserir ${item.label}`}
            >
              <span>{item.tag}</span>
              <span className="text-[9px] text-slate-400 font-sans font-normal">({item.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Selector for Template Editor */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2.5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'whatsapp'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare size={16} />
          <span>Modelo WhatsApp / SMS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2.5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'email'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail size={16} />
          <span>Modelo E-mail</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('smtp')}
          className={`px-4 py-2.5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'smtp'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server size={16} />
          <span>Servidor SMTP Próprio</span>
          {settings.smtpSettings?.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2.5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'preview'
              ? 'border-violet-600 text-violet-700 bg-violet-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles size={16} />
          <span>Visualizar Prévia em Tempo Real</span>
        </button>
      </div>

      {/* TAB SMTP: CUSTOM SMTP CONFIGURATION */}
      {activeTab === 'smtp' && (
        <SmtpSettingsPanel
          smtpSettings={settings.smtpSettings || DEFAULT_SMTP_SETTINGS}
          onChange={(updatedSmtp) => setSettings(prev => ({ ...prev, smtpSettings: updatedSmtp }))}
          onSave={handleSave}
          isSaved={isSaved}
        />
      )}

      {/* TAB 1: WHATSAPP TEMPLATE EDITOR */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mensagem de Conclusão para WhatsApp & SMS
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Suporta formatação do WhatsApp: <code className="bg-slate-100 px-1 rounded">*negrito*</code>, <code className="bg-slate-100 px-1 rounded">_itálico_</code>, emojis e quebras de linha.
            </p>
            <textarea
              rows={8}
              value={settings.whatsappMessageTemplate}
              onFocus={() => setFocusedField('waBody')}
              onChange={(e) => setSettings(prev => ({ ...prev, whatsappMessageTemplate: e.target.value }))}
              placeholder="Digite aqui o modelo de mensagem do WhatsApp..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      )}

      {/* TAB 2: EMAIL TEMPLATE EDITOR */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Remetente do E-mail
            </label>
            <input
              type="text"
              value={settings.senderEmailName}
              onChange={(e) => setSettings(prev => ({ ...prev, senderEmailName: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assunto do E-mail
            </label>
            <input
              type="text"
              value={settings.emailSubjectTemplate}
              onFocus={() => setFocusedField('subject')}
              onChange={(e) => setSettings(prev => ({ ...prev, emailSubjectTemplate: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Corpo da Mensagem de E-mail
            </label>
            <textarea
              rows={9}
              value={settings.emailMessageTemplate}
              onFocus={() => setFocusedField('emailBody')}
              onChange={(e) => setSettings(prev => ({ ...prev, emailMessageTemplate: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      )}

      {/* TAB 3: REAL-TIME PREVIEW */}
      {activeTab === 'preview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* WhatsApp Preview Card */}
          <div className="bg-[#efeae2] border border-slate-300 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-800/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xs">
                  VM
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">ViniMap Notificações</h5>
                  <p className="text-[10px] text-emerald-700 font-semibold">Conta Comercial Verificada</p>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">14:25</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl shadow-2xs max-w-[90%] text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100">
              {previewWaText}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-semibold">Exemplo de mensagem gerada para o cliente Ana Maria Silva</span>
            </div>
          </div>

          {/* Email Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="border-b border-slate-100 pb-2 space-y-1">
                <p className="text-[11px] text-slate-500">
                  <strong className="text-slate-700">De:</strong> {settings.senderEmailName} &lt;notificacoes@vinimap.com.br&gt;
                </p>
                <p className="text-[11px] text-slate-500">
                  <strong className="text-slate-700">Para:</strong> anamaria.silva@exemplo.com.br
                </p>
                <p className="text-xs font-bold text-blue-900 pt-1">
                  {previewEmailSubject}
                </p>
              </div>

              <div className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed pt-1">
                {previewEmailBody}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-semibold">Exemplo de e-mail gerado automaticamente</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save Action Bar */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          As alterações feitas nas mensagens e credenciais SMTP são salvas para todos os disparos de e-mail e WhatsApp.
        </p>

        <button
          onClick={handleSave}
          type="button"
          className={`px-6 py-2.5 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer ${
            isSaved 
              ? 'bg-emerald-600 text-white shadow-emerald-200' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
          }`}
        >
          {isSaved ? <Check size={16} /> : <Save size={16} />}
          <span>{isSaved ? 'Configurações Salvas!' : 'Salvar Todas as Configurações'}</span>
        </button>
      </div>
    </div>
  );
}
