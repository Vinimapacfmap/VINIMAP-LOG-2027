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
      host,
      port = 587,
      security = 'tls',
      authRequired = true,
      user,
      pass,
      fromEmail,
      fromName = 'ViniMap Logística',
      testRecipientEmail
    } = req.body || {};

    if (!host || !host.trim()) {
      return res.status(400).json({ success: false, error: 'O endereço do servidor SMTP (Host) é obrigatório.' });
    }

    const targetEmail = testRecipientEmail?.trim() || fromEmail?.trim() || user?.trim();
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Informe um e-mail de destino válido para envio do e-mail de teste.' });
    }

    const numericPort = Number(port) || 587;
    const isSecure = security === 'ssl' || numericPort === 465;

    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: numericPort,
      secure: isSecure,
      auth: authRequired && (user || pass) ? {
        user: user?.trim(),
        pass: pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    await transporter.verify();

    const sender = fromName ? `"${fromName.replace(/"/g, '')}" <${fromEmail || user}>` : (fromEmail || user);
    
    const info = await transporter.sendMail({
      from: sender,
      to: targetEmail,
      subject: `[ViniMap] Teste de Conexão SMTP - ${new Date().toLocaleTimeString('pt-BR')}`,
      text: `Olá!\n\nEste é um e-mail de teste disparado pelo painel do ViniMap Logística utilizando as suas configurações de servidor SMTP próprio.\n\nServidor: ${host}\nPorta: ${numericPort}\nCriptografia: ${security.toUpperCase()}\nRemetente: ${sender}\n\nStatus: Conexão efetuada com sucesso!`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; border-radius: 12px; color: #1e293b;">
          <div style="background-color: #0f172a; padding: 16px 20px; border-radius: 8px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px;">✅ Conexão SMTP Estabelecida com Sucesso</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">ViniMap Logistics - Notificações do Parceiro</p>
          </div>
          <p>Olá,</p>
          <p>Este é um e-mail de teste gerado para validar as credenciais do seu <strong>Servidor SMTP Próprio</strong>.</p>
          <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 10px 0; color: #2563eb; font-size: 14px;">Parâmetros Configurados:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
              <li><strong>Servidor (Host):</strong> ${host}</li>
              <li><strong>Porta:</strong> ${numericPort}</li>
              <li><strong>Criptografia:</strong> ${security.toUpperCase()}</li>
              <li><strong>Autenticação:</strong> ${authRequired ? 'Ativa' : 'Desativada'}</li>
              <li><strong>Usuário:</strong> ${user || 'N/A'}</li>
              <li><strong>Remetente Oficial:</strong> ${sender}</li>
            </ul>
          </div>
          <p style="font-size: 12px; color: #64748b;">E-mail gerado automaticamente em ${new Date().toLocaleString('pt-BR')} (Horário de Brasília).</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: 'Conexão SMTP validada e e-mail de teste enviado com sucesso!',
      messageId: info.messageId,
      response: info.response,
      testedAt: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[SMTP Test Vercel Error]:', err);
    
    let userFriendlyError = err.message || 'Erro de conexão SMTP desconhecido';
    const rawMsg = (err.message || '') + ' ' + (err.response || '');

    if (rawMsg.includes('535') || rawMsg.includes('Username and Password not accepted') || rawMsg.includes('Incorrect authentication data')) {
      userFriendlyError = `Autenticação Recusada (Erro 535): Usuário ou senha incorretos.\n\n💡 DICAS PARA RESOLVER:\n• Gmail/Google Workspace: O Google exige uma 'Senha de Aplicativo' de 16 dígitos em vez da sua senha pessoal do e-mail. Ative a Verificação em Duas Etapas na sua Conta do Google > Segurança > Senhas de app.\n• cPanel / Locaweb / Hostinger: Certifique-se de preencher o endereço de e-mail COMPLETO como Usuário (ex: contato@suaempresa.com.br).`;
    } else if (rawMsg.includes('Invalid greeting') || rawMsg.includes('IMAP4') || rawMsg.includes('Dovecot') || [993, 143, 995, 110].includes(Number(req.body?.port))) {
      userFriendlyError = `Porta Incorreta / Servidor IMAP: A porta ${req.body?.port} informada pertence a um protocolo de RECEBIMENTO de e-mails (IMAP/POP3).\n\n💡 DICA: Para ENVIO SMTP, altere a porta para 587 (Criptografia TLS/STARTTLS) ou 465 (Criptografia SSL).`;
    } else if (rawMsg.includes('550') || rawMsg.includes('SMTP AUTH is required')) {
      userFriendlyError = `Autenticação Obrigatória (Erro 550): O servidor SMTP exige login para autorizar o disparo de e-mails.\n\n💡 DICA: Ative a chave 'Requer Autenticação' e informe usuário e senha válidos.`;
    } else if (rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ETIMEDOUT') || rawMsg.includes('ENOTFOUND')) {
      userFriendlyError = `Não foi possível conectar ao servidor SMTP (${req.body?.host}:${req.body?.port}).\n\n💡 DICAS:\n• Verifique se o Host está correto (ex: smtp.gmail.com, smtp.office365.com, smtplw.com.br).\n• Verifique se a porta (ex: 587 ou 465) não está bloqueada ou incorreta.`;
    }

    return res.status(500).json({
      success: false,
      error: userFriendlyError,
      rawError: err.message
    });
  }
}
