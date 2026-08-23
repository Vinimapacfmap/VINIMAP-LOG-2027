/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinancialTransaction } from '../types';

export const INITIAL_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [
  // RECEIVABLES
  {
    id: 'rec-1',
    description: 'Faturamento Mensal - Burger House',
    type: 'receivable',
    amount: 5820.00,
    dueDate: '2026-07-05',
    actualPaymentDate: '2026-07-05',
    category: 'Faturamento',
    status: 'Pago',
    recipientOrPayer: 'Burger House Ltda',
    paymentMethod: 'Pix',
    costType: 'variable',
    notes: 'Referente a 582 entregas concluídas na faixa premium no mês de Junho/2026.'
  },
  {
    id: 'rec-2',
    description: 'Faturamento Quinzenal - Pizzaria Bella',
    type: 'receivable',
    amount: 3450.00,
    dueDate: '2026-07-10',
    category: 'Faturamento',
    status: 'Pendente',
    recipientOrPayer: 'Bella Pizza & Pasta S/A',
    paymentMethod: 'Boleto',
    costType: 'variable',
    notes: 'Ciclo de faturamento 16-30 de Junho.'
  },
  {
    id: 'rec-3',
    description: 'Créditos Pré-pagos - Farmácia Central',
    type: 'receivable',
    amount: 1200.00,
    dueDate: '2026-07-15',
    category: 'Faturamento',
    status: 'Pendente',
    recipientOrPayer: 'Farmácia Central Rede Sul',
    paymentMethod: 'Pix',
    costType: 'variable',
    notes: 'Carga de saldo preventivo para disparos prioritários de medicamentos.'
  },
  {
    id: 'rec-4',
    description: 'Taxa de Setup & Integração de API',
    type: 'receivable',
    amount: 450.00,
    dueDate: '2026-06-28',
    actualPaymentDate: '2026-06-28',
    category: 'Serviços',
    status: 'Pago',
    recipientOrPayer: 'Supermercado Silva',
    paymentMethod: 'Cartão',
    costType: 'variable',
    notes: 'Configuração inicial de roteamento e georreferenciamento de PDVs.'
  },
  {
    id: 'rec-5',
    description: 'Contrato de Frota Dedicada - Logística Hub',
    type: 'receivable',
    amount: 12000.00,
    dueDate: '2026-07-25',
    category: 'Faturamento',
    status: 'Pendente',
    recipientOrPayer: 'Express Dist. Logística Ltda',
    paymentMethod: 'Transferência',
    costType: 'fixed',
    notes: 'Locação mensal de 3 veículos com condutor fixo para malha Centro-Oeste.'
  },
  {
    id: 'rec-6',
    description: 'Faturamento Atrasado - Bella Massa',
    type: 'receivable',
    amount: 1800.00,
    dueDate: '2026-06-15',
    category: 'Faturamento',
    status: 'Atrasado',
    recipientOrPayer: 'Bella Massa Massas Frescas',
    paymentMethod: 'Boleto',
    costType: 'variable',
    notes: 'Boleto vencido. Cobrança enviada ao financeiro.'
  },

  // PAYABLES
  {
    id: 'pay-1',
    description: 'Repasse Quinzenal - Carlos Santos',
    type: 'payable',
    amount: 1450.00,
    dueDate: '2026-07-06',
    category: 'Repasses',
    status: 'Pendente',
    recipientOrPayer: 'Carlos Santos (Condutor ID: ent-1)',
    paymentMethod: 'Pix',
    costType: 'variable',
    notes: 'Repasse consolidado de corridas concluídas.'
  },
  {
    id: 'pay-2',
    description: 'Repasse Quinzenal - Roberto Lima',
    type: 'payable',
    amount: 1280.00,
    dueDate: '2026-07-06',
    category: 'Repasses',
    status: 'Pendente',
    recipientOrPayer: 'Roberto Lima (Condutor ID: ent-2)',
    paymentMethod: 'Pix',
    costType: 'variable',
    notes: 'Repasse consolidado de corridas concluídas.'
  },
  {
    id: 'pay-3',
    description: 'Servidores de Cloud Hosting - GCP & Firebase',
    type: 'payable',
    amount: 890.00,
    dueDate: '2026-07-05',
    actualPaymentDate: '2026-07-05',
    category: 'Infraestrutura',
    status: 'Pago',
    recipientOrPayer: 'Google Cloud Platform (Invoices)',
    paymentMethod: 'Cartão',
    costType: 'fixed',
    notes: 'Ambiente de produção do OS, WebSocket gateway e banco Firestore.'
  },
  {
    id: 'pay-4',
    description: 'Manutenção Preventiva - Moto Elétrica #03',
    type: 'payable',
    amount: 320.00,
    dueDate: '2026-07-12',
    category: 'Manutenção',
    status: 'Pendente',
    recipientOrPayer: 'Motopeças Express & Oficina',
    paymentMethod: 'Pix',
    costType: 'variable',
    notes: 'Substituição de pastilhas de freio e teste de bateria.'
  },
  {
    id: 'pay-5',
    description: 'Aluguel de Sede Administrativa & Hub Operacional',
    type: 'payable',
    amount: 2500.00,
    dueDate: '2026-07-01',
    actualPaymentDate: '2026-07-01',
    category: 'Administrativo',
    status: 'Pago',
    recipientOrPayer: 'Imobiliária Aliança Ltda',
    paymentMethod: 'Boleto',
    costType: 'fixed',
    notes: 'Ref. Aluguel da sala de despachadores e hub de carregamento.'
  },
  {
    id: 'pay-6',
    description: 'Licença Google Maps Platform API',
    type: 'payable',
    amount: 1150.00,
    dueDate: '2026-06-30',
    actualPaymentDate: '2026-06-30',
    category: 'Infraestrutura',
    status: 'Pago',
    recipientOrPayer: 'Google Maps API Billing',
    paymentMethod: 'Cartão',
    costType: 'fixed',
    notes: 'Licenciamento para mapas, rotas de entrega e geocodificação reversa.'
  },
  {
    id: 'pay-7',
    description: 'Mensalidade Plataforma Zenvia WhatsApp API',
    type: 'payable',
    amount: 450.00,
    dueDate: '2026-06-20',
    category: 'Serviços',
    status: 'Atrasado',
    recipientOrPayer: 'Zenvia Plataformas S/A',
    paymentMethod: 'Cartão',
    costType: 'fixed',
    notes: 'Vencimento pendente por expiração do cartão corporativo cadastrado.'
  }
];
