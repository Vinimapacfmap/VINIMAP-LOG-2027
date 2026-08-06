import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      smtpSettings,
      recipientEmail,
      subject,
      body,
      orderCode
    } = req.body || {};

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'E-mail de destino inválido.' });
    }

    if (!smtpSettings || !smtpSettings.enabled || !smtpSettings.host) {
      return res.status(400).json({ success: false, error: 'Servidor SMTP personalizado não está ativo ou configurado.' });
    }

    const numericPort = Number(smtpSettings.port) || 587;
    const isSecure = smtpSettings.security === 'ssl' || numericPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host.trim(),
      port: numericPort,
      secure: isSecure,
      auth: smtpSettings.authRequired && (smtpSettings.user || smtpSettings.pass) ? {
        user: smtpSettings.user?.trim(),
        pass: smtpSettings.pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 12000,
      socketTimeout: 12000
    });

    const sender = smtpSettings.fromName 
      ? `"${smtpSettings.fromName.replace(/"/g, '')}" <${smtpSettings.fromEmail || smtpSettings.user}>`
      : (smtpSettings.fromEmail || smtpSettings.user);

    const htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1;">
          <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #38bdf8;">${smtpSettings.fromName || 'ViniMap Logística'}</h1>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 600;">NOTIFICAÇÃO OFICIAL DE CONCLUSÃO DE PEDIDO</p>
          </div>
          <div style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">
            ${(body || '').replace(/\n/g, '<br/>')}
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b;">
            <p style="margin: 0;">Mensagem automática disparada via servidor de e-mail próprio do parceiro.</p>
            <p style="margin: 4px 0 0 0;">Pedido #${orderCode || 'N/A'} • ViniMap Logistics System</p>
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: sender,
      to: recipientEmail.trim(),
      replyTo: smtpSettings.replyTo?.trim() || undefined,
      subject: subject || `Notificação do Pedido #${orderCode}`,
      text: body,
      html: htmlBody
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      sentAt: new Date().toISOString(),
      recipient: recipientEmail
    });

  } catch (err: any) {
    console.error('[SMTP Completion Order Dispatch Vercel Error]:', err);

    let userFriendlyError = err.message || 'Falha no envio do e-mail de conclusão';
    const rawMsg = (err.message || '') + ' ' + (err.response || '');

    if (rawMsg.includes('535') || rawMsg.includes('Username and Password not accepted') || rawMsg.includes('Incorrect authentication data')) {
      userFriendlyError = `Autenticação Recusada (Erro 535): Usuário ou senha do SMTP do parceiro estão incorretos. Caso seja Gmail, é necessário usar Senha de Aplicativo.`;
    } else if (rawMsg.includes('Invalid greeting') || rawMsg.includes('IMAP4') || rawMsg.includes('Dovecot')) {
      userFriendlyError = `Porta Incorreta / Servidor IMAP: A porta informada é do protocolo IMAP. Altere para 587 (TLS) ou 465 (SSL).`;
    } else if (rawMsg.includes('550') || rawMsg.includes('SMTP AUTH is required')) {
      userFriendlyError = `Autenticação Obrigatória (Erro 550): O servidor exige que a autenticação esteja ativa.`;
    }

    return res.status(500).json({
      success: false,
      error: `Erro ao enviar e-mail via SMTP do parceiro: ${userFriendlyError}`,
      rawError: err.message
    });
  }
}
