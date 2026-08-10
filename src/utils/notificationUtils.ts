/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, DeliveryRider } from '../types';

export interface SmtpLogEntry {
  id: string;
  timestamp: string;
  recipient: string;
  subject: string;
  orderCode?: string;
  status: 'success' | 'error';
  messageId?: string;
  errorDetails?: string;
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  security: 'tls' | 'ssl' | 'none';
  authRequired: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  testRecipientEmail?: string;
  logs?: SmtpLogEntry[];
}

export interface NotificationSettings {
  autoSendEmail: boolean;
  autoSendWhatsapp: boolean;
  emailSubjectTemplate: string;
  emailMessageTemplate: string;
  whatsappMessageTemplate: string;
  senderEmailName: string;
  smtpSettings?: SmtpSettings;
}

export const DEFAULT_SMTP_SETTINGS: SmtpSettings = {
  enabled: false,
  host: 'smtp.gmail.com',
  port: 587,
  security: 'tls',
  authRequired: true,
  user: '',
  pass: '',
  fromEmail: '',
  fromName: 'Vinimap Logística',
  replyTo: '',
  testRecipientEmail: '',
  logs: []
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  autoSendEmail: true,
  autoSendWhatsapp: true,
  senderEmailName: 'ViniMap Logística & Notificações',
  smtpSettings: DEFAULT_SMTP_SETTINGS,
  emailSubjectTemplate: 'Seu Pedido #{codigo} foi CONCLUÍDO com sucesso! - {parceiro}',
  emailMessageTemplate: `Olá {cliente}!

Gostaríamos de informar que o seu pedido #{codigo} foi CONCLUÍDO com sucesso pelo nosso serviço de entregas.

📦 DETALHES DA ENTREGA:
• Código do Pedido: #{codigo}
• Data e Horário: {data} às {horario}
• Recebedor Responsável: {recebedor}
• Protocolo de Conclusão: {protocolo}
• Entregador / Condutor: {entregador}
• Endereço de Entrega: {endereco}
• Parceiro / Loja: {parceiro}

Agradecemos a confiança e a preferência!
Atenciosamente,
{parceiro} & ViniMap Logística`,
  whatsappMessageTemplate: `Olá *{cliente}*! 👋

Seu pedido *#{codigo}* da loja *{parceiro}* foi *CONCLUÍDO* com sucesso! 🎉

📦 *COMPROVANTE DE ENTREGA:*
• *Data/Horário:* {data} às {horario}
• *Recebedor:* {recebedor}
• *Protocolo:* {protocolo}
• *Entregador:* {entregador}
• *Endereço:* {endereco}

Agradecemos a preferência! 🚀`,
};

const STORAGE_KEY = 'vinimap_notification_settings';

import { dbSaveNotificationSettings, dbGetNotificationSettings } from '../lib/dbService';

export function getNotificationSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...parsed,
        smtpSettings: {
          ...DEFAULT_SMTP_SETTINGS,
          ...(parsed.smtpSettings || {})
        }
      };
    }
  } catch (e) {
    console.warn('[NotificationSettings] Erro ao carregar configurações de notificação do localStorage:', e);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    dbSaveNotificationSettings(settings).catch(() => {});
  } catch (e) {
    console.warn('[NotificationSettings] Erro ao salvar configurações no localStorage:', e);
  }
}

export async function dbSyncNotificationSettings(): Promise<NotificationSettings> {
  try {
    const cloudSettings = await dbGetNotificationSettings();
    if (cloudSettings) {
      const merged: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...cloudSettings,
        smtpSettings: {
          ...DEFAULT_SMTP_SETTINGS,
          ...(cloudSettings.smtpSettings || {})
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn('[dbSyncNotificationSettings WARN]:', e);
  }
  return getNotificationSettings();
}

export function replaceNotificationPlaceholders(
  template: string,
  order: Order,
  riderName?: string
): string {
  if (!template) return '';

  const cleanCode = order.id.replace('ped-', '').toUpperCase();
  const dateStr = order.deliveryDate || order.dataConclusao || order.date || new Date().toLocaleDateString('pt-BR');
  const timeStr = order.deliveryTime || order.horarioFinal || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const recipient = order.recipientName || order.clientName || 'Recebedor Titular';
  const doc = order.recipientDoc ? order.recipientDoc : 'Não informado';
  const protocol = order.protocolNumber || `PROT-${cleanCode}`;
  const partner = order.partnerName || 'ViniMap Parceiro';
  const address = order.address || '';
  const client = order.clientName || 'Cliente';
  const driver = riderName || 'Condutor ViniMap';

  return template
    .replace(/\{cliente\}/gi, client)
    .replace(/\{pedido\}/gi, cleanCode)
    .replace(/\{codigo\}/gi, cleanCode)
    .replace(/\{parceiro\}/gi, partner)
    .replace(/\{entregador\}/gi, driver)
    .replace(/\{condutor\}/gi, driver)
    .replace(/\{data\}/gi, dateStr)
    .replace(/\{horario\}/gi, timeStr)
    .replace(/\{recebedor\}/gi, recipient)
    .replace(/\{documento_recebedor\}/gi, doc)
    .replace(/\{protocolo\}/gi, protocol)
    .replace(/\{endereco\}/gi, address);
}

export function getOrderContactInfo(order: Order): {
  phone: string;
  cleanPhoneDigits: string;
  email: string;
  hasPhone: boolean;
  hasEmail: boolean;
} {
  const rawData = order.rawData || {};
  const phone = order.phone || rawData.Telefone || rawData.telefone || rawData.Celular || rawData.celular || rawData.Phone || '';
  const email = (
    order.email ||
    rawData.Email || 
    rawData.email || 
    rawData['E-mail'] || 
    rawData['e-mail'] || 
    rawData.ClienteEmail || 
    rawData['Email Cliente'] || 
    rawData['EmailCliente'] || 
    rawData['Email Parceiro'] || 
    rawData['EmailParceiro'] || 
    (order as any).clientEmail || 
    (order as any).email || 
    ''
  ).toString().trim();

  const cleanPhoneDigits = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhoneDigits.length === 10 || cleanPhoneDigits.length === 11 ? `55${cleanPhoneDigits}` : cleanPhoneDigits;

  return {
    phone,
    cleanPhoneDigits: formattedPhone,
    email,
    hasPhone: cleanPhoneDigits.length >= 8,
    hasEmail: email.includes('@') && email.includes('.'),
  };
}

export function generateWhatsappUrl(phoneDigits: string, text: string): string {
  const clean = phoneDigits.replace(/\D/g, '');
  const targetPhone = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
  return `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`;
}

export function generateMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
