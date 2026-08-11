/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ClientPartner, Order, OrderPriority, OrderStatus } from '../types';
import { getSaoPauloTime, getSaoPauloISODate } from '../utils/dateUtils';
import CepInput, { ViaCepData } from './CepInput';
import { 
  Calculator, 
  HelpCircle, 
  Package, 
  CheckCircle2, 
  Info, 
  Download, 
  Copy, 
  Check, 
  Truck, 
  Sparkles, 
  MapPin, 
  AlertTriangle,
  Layers,
  PlusCircle,
  TrendingUp,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

interface VolumeCalculatorProps {
  clientPartners: ClientPartner[];
  onCreateOrder?: (order: Omit<Order, 'id' | 'status' | 'createdAt'>) => void;
}

// Preset Package Sizes
const PACKAGING_PRESETS = [
  { id: 'custom', name: 'Personalizado', length: 20, width: 15, height: 10, weight: 1.0, icon: Package },
  { id: 'box-p', name: 'Caixa P (Correios 1)', length: 18, width: 13.5, height: 9, weight: 0.5, icon: Package },
  { id: 'box-m', name: 'Caixa M (Correios 2)', length: 27, width: 18, height: 13.5, weight: 1.5, icon: Package },
  { id: 'box-g', name: 'Caixa G (Correios 3)', length: 36, width: 27, height: 18, weight: 3.0, icon: Package },
  { id: 'box-gg', name: 'Caixa GG (Correios 4)', length: 48, width: 36, height: 27, weight: 6.0, icon: Package },
  { id: 'envelope', name: 'Envelope Saco', length: 25, width: 16, height: 2, weight: 0.1, icon: FileText }
];

export default function VolumeCalculator({ clientPartners, onCreateOrder }: VolumeCalculatorProps) {
  // Input states
  const [cepOrigem, setCepOrigem] = useState('01001-000'); // Default SP Capital
  const [cepDestino, setCepDestino] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('custom');
  
  // Dimensions
  const [length, setLength] = useState(20); // cm
  const [width, setWidth] = useState(15); // cm
  const [height, setHeight] = useState(10); // cm
  const [weight, setWeight] = useState(1.0); // kg
  
  // CEP Lookup States
  const [addressOrigem, setAddressOrigem] = useState('Praça da Sé - Centro, São Paulo/SP');
  const [addressDestino, setAddressDestino] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState('');
  const [calculatedZone, setCalculatedZone] = useState<'Local' | 'Estadual' | 'Regional' | 'Nacional'>('Local');
  
  // Additional Services
  const [maoPropria, setMaoPropria] = useState(false);
  const [avisoRecebimento, setAvisoRecebimento] = useState(false);
  const [valorDeclarado, setValorDeclarado] = useState(false);
  const [valorDeclaradoInput, setValorDeclaradoInput] = useState('100,00');

  // Order Creation fields
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [recipientComplement, setRecipientComplement] = useState('');
  const [selectedService, setSelectedService] = useState<'PAC' | 'SEDEX'>('SEDEX');
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState(false);

  // General utility states
  const [copiedText, setCopiedText] = useState(false);

  // Handle Preset Selection
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PACKAGING_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setLength(preset.length);
      setWidth(preset.width);
      setHeight(preset.height);
      setWeight(preset.weight);
    }
  };

  // Auto-lookup destination CEP
  useEffect(() => {
    const cleanCep = cepDestino.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      lookupCep(cleanCep);
    } else {
      setAddressDestino('');
      setCepError('');
    }
  }, [cepDestino]);

  const lookupCep = async (cep: string) => {
    setIsLoadingCep(true);
    setCepError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepError('CEP não encontrado.');
        setAddressDestino('');
      } else {
        const addressText = `${data.logradouro || 'Sem logradouro'} - ${data.bairro || 'Sem bairro'}, ${data.localidade}/${data.uf}`;
        setAddressDestino(addressText);

        // Determine destination pricing zone relative to SP Capital (01001-000)
        const isCapitalSP = data.localidade.toLowerCase() === 'são paulo' && data.uf === 'SP';
        const isStateSP = data.uf === 'SP';
        const isRegional = ['RJ', 'MG', 'PR', 'SC', 'RS', 'DF'].includes(data.uf);

        if (isCapitalSP) {
          setCalculatedZone('Local');
        } else if (isStateSP) {
          setCalculatedZone('Estadual');
        } else if (isRegional) {
          setCalculatedZone('Regional');
        } else {
          setCalculatedZone('Nacional');
        }
      }
    } catch (err) {
      console.error(err);
      setCepError('Erro ao buscar o CEP.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Dimensions Validation & Calculations
  const volumeCm3 = length * width * height;
  const volumeLiters = volumeCm3 / 1000;
  
  // Correios Cubing Calculation Formula: (L * W * H) / 6000
  // Correios applies cubing if the cubed weight exceeds 5kg. If <= 5kg, use physical weight.
  const cubicWeight = Math.round(((length * width * height) / 6000) * 100) / 100;
  const taxedWeight = cubicWeight > 5 ? Math.max(weight, cubicWeight) : weight;

  // Correios Constraints
  const sumOfDimensions = length + width + height;
  const isTooLarge = sumOfDimensions > 200 || length > 100 || width > 100 || height > 100;
  const isTooSmall = length < 16 || width < 11 || height < 2;
  const isOverweight = weight > 30;
  const hasDimensionWarning = isTooLarge || isTooSmall || isOverweight;

  // Surcharges
  // Correios applies a R$ 79,00 penalty surcharge if any single dimension exceeds 70cm
  const hasBigDimensionSurcharge = length > 70 || width > 70 || height > 70;
  const bigDimensionSurchargeValue = hasBigDimensionSurcharge ? 79.00 : 0.0;

  // Additional services cost
  const arCost = avisoRecebimento ? 7.00 : 0;
  const mpCost = maoPropria ? 8.50 : 0;
  
  const parsedValDeclarado = parseFloat(valorDeclaradoInput.replace('.', '').replace(',', '.')) || 0;
  const declaredValueCost = valorDeclarado 
    ? Math.max(0, (parsedValDeclarado - 25.0) * 0.015) // Correios charge 1.5% of value exceeding R$ 25
    : 0;

  // Price matrix based on Zones and Weight
  const calculateServicePrice = (service: 'PAC' | 'SEDEX') => {
    if (hasDimensionWarning) return 0;

    let basePrice = 0;
    let kgSurcharge = 0;

    if (service === 'SEDEX') {
      switch (calculatedZone) {
        case 'Local':
          basePrice = 20.50;
          kgSurcharge = 3.50;
          break;
        case 'Estadual':
          basePrice = 26.80;
          kgSurcharge = 4.20;
          break;
        case 'Regional':
          basePrice = 39.90;
          kgSurcharge = 5.50;
          break;
        case 'Nacional':
          basePrice = 68.20;
          kgSurcharge = 8.90;
          break;
      }
    } else { // PAC
      switch (calculatedZone) {
        case 'Local':
          basePrice = 14.90;
          kgSurcharge = 1.80;
          break;
        case 'Estadual':
          basePrice = 19.50;
          kgSurcharge = 2.40;
          break;
        case 'Regional':
          basePrice = 27.90;
          kgSurcharge = 3.80;
          break;
        case 'Nacional':
          basePrice = 41.50;
          kgSurcharge = 5.90;
          break;
      }
    }

    // Standard formula: Base price + (taxed weight - 1kg) * kgSurcharge + surcharges
    const excessWeight = Math.max(0, taxedWeight - 1.0);
    const weightPrice = excessWeight * kgSurcharge;

    const total = basePrice + weightPrice + bigDimensionSurchargeValue + arCost + mpCost + declaredValueCost;
    return Math.round(total * 100) / 100;
  };

  const pacTotal = calculateServicePrice('PAC');
  const sedexTotal = calculateServicePrice('SEDEX');

  // Mini Envios Availability
  // Sum of dimensions <= 90cm, length <= 35cm, weight <= 0.35kg (350g), thickness <= 4cm
  const isMiniEnviosAvailable = sumOfDimensions <= 90 && length <= 35 && weight <= 0.350 && height <= 4 && !hasDimensionWarning;
  const miniEnviosPrice = isMiniEnviosAvailable 
    ? (calculatedZone === 'Local' ? 9.90 : calculatedZone === 'Estadual' ? 12.50 : calculatedZone === 'Regional' ? 15.90 : 21.90) + arCost + declaredValueCost
    : 0;

  // Copy Summary text
  const handleCopySummary = () => {
    const activePrice = selectedService === 'SEDEX' ? sedexTotal : pacTotal;
    const text = `*Orçamento de Frete Logístico (Modelo Correios)*
----------------------------------------------
*Origem:* ${cepOrigem} (${addressOrigem})
*Destino:* ${cepDestino} (${addressDestino})
*Região:* ${calculatedZone}
----------------------------------------------
*Embalagem:* ${PACKAGING_PRESETS.find(p => p.id === selectedPreset)?.name || 'Personalizado'}
*Dimensões:* ${length}x${width}x${height} cm (Cubagem: ${volumeLiters.toFixed(2)}L)
*Peso Físico:* ${weight.toFixed(3)} kg | *Peso Tarifado:* ${taxedWeight.toFixed(3)} kg
----------------------------------------------
*Modalidade Selecionada:* ${selectedService}
*Serviços Extras:* ${maoPropria ? '[Mão Própria] ' : ''}${avisoRecebimento ? '[Aviso de Recebimento] ' : ''}${valorDeclarado ? `[Valor Declarado R$ ${valorDeclaradoInput}]` : 'Nenhum'}
----------------------------------------------
*Valor Total do Frete:* R$ ${activePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
*Prazo Estimado:* ${selectedService === 'SEDEX' ? '1 a 2 dias úteis' : '4 a 8 dias úteis'}`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Generate Receipt PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Elegant header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('VINIMAP LOGISTICS OS', 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('SIMULADOR PROFISSIONAL DE FRETE E EMBALAGENS', 15, 25);
    doc.setFontSize(8);
    doc.text(`Emitido em: ${getSaoPauloTime()} - SP`, 15, 32);

    // Box Decoration
    doc.setFillColor(253, 224, 71); // yellow-300 Correios-like accent
    doc.rect(0, 38, 210, 2, 'F');

    // Section 1: Dados da Carga
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Detalhes da Carga e Cubagem', 15, 52);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 54, 195, 54);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Embalagem: ${PACKAGING_PRESETS.find(p => p.id === selectedPreset)?.name || 'Personalizado'}`, 15, 62);
    doc.text(`Comprimento: ${length} cm`, 15, 68);
    doc.text(`Largura: ${width} cm`, 15, 74);
    doc.text(`Altura: ${height} cm`, 15, 80);

    doc.text(`Volume Total (Cubagem): ${volumeCm3.toLocaleString('pt-BR')} cm³ (${volumeLiters.toFixed(2)} Litros)`, 100, 62);
    doc.text(`Peso Físico Declarado: ${weight.toFixed(3)} kg`, 100, 68);
    doc.text(`Peso Cúbico Equivalente: ${cubicWeight.toFixed(3)} kg`, 100, 74);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`Peso Tarifado Final: ${taxedWeight.toFixed(3)} kg`, 100, 80);

    // Section 2: Origem e Destino
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);
    doc.text('2. Roteamento de Entrega', 15, 94);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 96, 195, 96);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`CEP Origem: ${cepOrigem}`, 15, 104);
    doc.text(`Endereço Origem: ${addressOrigem}`, 15, 110);
    doc.text(`CEP Destino: ${cepDestino}`, 15, 118);
    doc.text(`Endereço Destino: ${addressDestino || 'Não informado'}`, 15, 124);
    doc.setFont('helvetica', 'bold');
    doc.text(`Região Logística Base: ${calculatedZone}`, 15, 132);

    // Section 3: Comparativo de Tarifas
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);
    doc.text('3. Demonstrativo de Tarifas e Opções', 15, 146);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 148, 195, 148);

    // Draw comparative table
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 154, 180, 42, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Serviço', 20, 162);
    doc.text('Prazo Estimado', 75, 162);
    doc.text('Tarifa Total', 150, 162);
    doc.line(15, 166, 195, 166);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('PAC (Econômico)', 20, 173);
    doc.text('4 a 8 dias úteis', 75, 173);
    doc.text(`R$ ${pacTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, 173);

    doc.setFont('helvetica', 'bold');
    doc.text('SEDEX (Expresso)', 20, 181);
    doc.setFont('helvetica', 'normal');
    doc.text('1 a 2 dias úteis', 75, 181);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${sedexTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, 181);

    if (isMiniEnviosAvailable) {
      doc.setFont('helvetica', 'normal');
      doc.text('Mini Envios (Pequenos Volumes)', 20, 189);
      doc.text('6 a 12 dias úteis', 75, 189);
      doc.text(`R$ ${miniEnviosPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, 189);
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('Mini Envios (Incompatível)', 20, 189);
      doc.text('N/A', 75, 189);
      doc.text('-', 150, 189);
    }

    // Section 4: Detalhamento de Taxas (SEDEX)
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('4. Detalhamento Adicional da Modalidade Selecionada', 15, 210);
    doc.line(15, 212, 195, 212);

    const activeServiceLabel = selectedService;
    const activePriceTotal = selectedService === 'SEDEX' ? sedexTotal : pacTotal;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Serviço Selecionado: ${activeServiceLabel}`, 15, 220);
    doc.text(`Taxa Mão Própria: R$ ${mpCost.toFixed(2).replace('.', ',')}`, 15, 226);
    doc.text(`Taxa Aviso de Recebimento (AR): R$ ${arCost.toFixed(2).replace('.', ',')}`, 15, 232);
    doc.text(`Seguro Opcional (Valor Declarado): R$ ${declaredValueCost.toFixed(2).replace('.', ',')} (Declarado: R$ ${valorDeclaradoInput})`, 15, 238);
    
    if (hasBigDimensionSurcharge) {
      doc.setTextColor(220, 38, 38);
      doc.text(`Sobretaxa de Grandes Dimensões (C/L/A > 70cm): R$ ${bigDimensionSurchargeValue.toFixed(2).replace('.', ',')}`, 15, 244);
      doc.setTextColor(51, 65, 85);
    }

    // Grand total stamp box
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.rect(15, 254, 180, 18, 'FD');
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`VALOR INTEGRAL DO FRETE (${activeServiceLabel}):`, 22, 265);
    doc.setFontSize(14);
    doc.text(`R$ ${activePriceTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, 265);

    // Footer terms
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('Este documento é uma simulação de preços operacionais baseada nas regras de dimensões e cubagem dos Correios.', 15, 283);
    doc.text('Os preços reais podem variar de acordo com o contrato vigente e taxas adicionais de despacho.', 15, 288);

    doc.save(`vinimap-simulador-correios-${cepDestino || 'geral'}.pdf`);
  };

  // Create real order in Vinimap from this simulator
  const handleCreateRealOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateOrder) return;
    if (!selectedPartnerId) {
      alert('Por favor, selecione um Cliente Parceiro.');
      return;
    }
    if (!recipientName || !recipientPhone || !recipientNumber) {
      alert('Por favor, preencha todos os dados de entrega (Destinatário, Telefone e Número).');
      return;
    }

    const partner = clientPartners.find(p => p.id === selectedPartnerId);
    if (!partner) return;

    // Build the clean address
    const cleanBaseAddr = addressDestino ? addressDestino.split(' - ')[0] : 'Endereço Calculadora';
    const cleanBairro = addressDestino && addressDestino.includes(' - ') ? addressDestino.split(' - ')[1]?.split(',')[0] || '' : '';
    const fullAddress = `${cleanBaseAddr}, ${recipientNumber}${recipientComplement ? ` - ${recipientComplement}` : ''}${cleanBairro ? ` - ${cleanBairro}` : ''}`;

    const calculatedFreight = selectedService === 'SEDEX' ? sedexTotal : pacTotal;

    const nowTime = getSaoPauloTime();
    const nowDate = getSaoPauloISODate();

    // Create the order draft
    onCreateOrder({
      clientName: recipientName,
      phone: recipientPhone,
      address: fullAddress,
      region: partner.region || 'Centro',
      priority: 'Alta' as OrderPriority,
      value: parsedValDeclarado || 50,
      itemsCount: 1,
      date: nowDate,
      horarioInicial: nowTime,
      cep: cepDestino,
      partnerName: partner.name,
      deliveryValue: calculatedFreight,
      rawData: {
        'CubagemL': volumeLiters.toFixed(2),
        'PesoKg': weight.toFixed(3),
        'Servico': selectedService,
        'TipoEmbalagem': PACKAGING_PRESETS.find(p => p.id === selectedPreset)?.name || 'Personalizado',
        'HorarioInicio': nowTime,
        'HorarioAbertura': nowTime,
        'HoraLancamento': nowTime,
        'DataLancamento': nowDate
      }
    });

    setOrderCreatedSuccess(true);
    setTimeout(() => {
      setOrderCreatedSuccess(false);
      // Reset delivery fields
      setRecipientName('');
      setRecipientPhone('');
      setRecipientNumber('');
      setRecipientComplement('');
    }, 4000);
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="correios-calculator">
      {/* Header Banner */}
      <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-yellow-400 rounded-xl text-slate-900 shadow-md shadow-yellow-400/20">
            <Calculator size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight uppercase flex items-center gap-1.5">
              Cálculo de Volumes Profissional
              <span className="text-[9px] font-extrabold bg-yellow-400 text-slate-900 px-1.5 py-0.5 rounded">MODELO CORREIOS</span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Calcule cubagem, pesos tarifados, tarifas PAC/SEDEX e gere pedidos instantaneamente.</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[10px] font-mono text-slate-500 block">Tabela Vigente</span>
          <span className="text-[11px] font-bold text-yellow-400 block">Correios 2026</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* Left Side: Parameters Inputs (7 Cols) */}
        <div className="lg:col-span-7 p-6 space-y-6">
          {/* Preset Packing selection */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2.5">
              1. Selecionar Embalagem ou Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PACKAGING_PRESETS.map((p) => {
                const Icon = p.icon;
                const isSel = selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetChange(p.id)}
                    className={`flex items-center gap-2.5 p-2.5 border rounded-xl text-left transition-all text-xs cursor-pointer ${
                      isSel 
                        ? 'border-blue-600 bg-blue-50/40 text-blue-800 shadow-sm' 
                        : 'border-slate-150 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={14} className={isSel ? 'text-blue-600' : 'text-slate-400'} />
                    <div className="truncate">
                      <p className="font-bold truncate">{p.name}</p>
                      {p.id !== 'custom' && (
                        <p className="text-[10px] text-slate-400 font-medium font-mono mt-0.5">
                          {p.length}x{p.width}x{p.height}cm
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sizing Parameters sliders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                2. Dimensões do Pacote (cm)
              </label>
              {selectedPreset !== 'custom' && (
                <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                  Preset Ativo
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Comprimento */}
              <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span>Comprimento (C)</span>
                  <span className="font-mono text-slate-800 font-bold">{length} cm</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="100"
                  value={length}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setLength(parseInt(e.target.value));
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Mín: 16cm</span>
                  <span>Máx: 100cm</span>
                </div>
              </div>

              {/* Largura */}
              <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span>Largura (L)</span>
                  <span className="font-mono text-slate-800 font-bold">{width} cm</span>
                </div>
                <input
                  type="range"
                  min="11"
                  max="100"
                  value={width}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setWidth(parseInt(e.target.value));
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Mín: 11cm</span>
                  <span>Máx: 100cm</span>
                </div>
              </div>

              {/* Altura */}
              <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span>Altura (A)</span>
                  <span className="font-mono text-slate-800 font-bold">{height} cm</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="100"
                  value={height}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setHeight(parseInt(e.target.value));
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Mín: 2cm</span>
                  <span>Máx: 100cm</span>
                </div>
              </div>

              {/* Peso */}
              <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span>Peso Real (kg)</span>
                  <span className="font-mono text-slate-800 font-bold">{weight.toFixed(2)} kg</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="30"
                  step="0.1"
                  value={weight}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setWeight(parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Mín: 0.1kg</span>
                  <span>Máx: 30kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address routing CEP */}
          <div className="space-y-3.5 pt-2">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              3. Origem & Destino
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Origin */}
              <div>
                <CepInput
                  label="CEP Origem (Sede Vinimap)"
                  value={cepOrigem}
                  onChange={(formatted) => setCepOrigem(formatted)}
                  disabled={true}
                  autoLookup={false}
                  showAddressPreview={false}
                  size="sm"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-semibold truncate" title={addressOrigem}>
                  {addressOrigem}
                </p>
              </div>

              {/* Destination */}
              <div>
                <CepInput
                  label="CEP Destino"
                  value={cepDestino}
                  onChange={(formatted) => setCepDestino(formatted)}
                  onAddressFound={(data) => {
                    const logradouro = data.logradouro || '';
                    const bairro = data.bairro || '';
                    const localidade = data.localidade || '';
                    const uf = data.uf || '';
                    const fullAddr = [logradouro, bairro, localidade, uf].filter(Boolean).join(', ');
                    setAddressDestino(fullAddr);
                    setCepError('');
                  }}
                  onError={(err) => setCepError(err || '')}
                  customError={cepError || undefined}
                  showAddressPreview={true}
                  placeholder="00000-000"
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Additional Services Checklist */}
          <div className="space-y-2.5 pt-2">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              4. Serviços Adicionais Opcionais
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Mao Propria */}
              <label className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all ${
                maoPropria ? 'border-blue-200 bg-blue-50/30 text-blue-800' : 'border-slate-150 bg-white hover:bg-slate-50 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={maoPropria}
                    onChange={(e) => setMaoPropria(e.target.checked)}
                    className="rounded text-blue-600 border-slate-300 focus:ring-blue-400 w-3.5 h-3.5"
                  />
                  <div className="text-left">
                    <span className="text-[11px] font-bold block leading-none">Mão Própria</span>
                    <span className="text-[9px] text-slate-400 font-medium">Entrega em mãos</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono text-blue-600 shrink-0">+ R$ 8,50</span>
              </label>

              {/* Aviso Recebimento */}
              <label className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all ${
                avisoRecebimento ? 'border-blue-200 bg-blue-50/30 text-blue-800' : 'border-slate-150 bg-white hover:bg-slate-50 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={avisoRecebimento}
                    onChange={(e) => setAvisoRecebimento(e.target.checked)}
                    className="rounded text-blue-600 border-slate-300 focus:ring-blue-400 w-3.5 h-3.5"
                  />
                  <div className="text-left">
                    <span className="text-[11px] font-bold block leading-none">Aviso de Rec. (AR)</span>
                    <span className="text-[9px] text-slate-400 font-medium">Comprovante assinado</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-mono text-blue-600 shrink-0">+ R$ 7,00</span>
              </label>

              {/* Valor Declarado */}
              <div className={`p-2.5 border rounded-xl transition-all space-y-1.5 ${
                valorDeclarado ? 'border-blue-200 bg-blue-50/30 text-blue-800' : 'border-slate-150 bg-white text-slate-600'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={valorDeclarado}
                      onChange={(e) => setValorDeclarado(e.target.checked)}
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-400 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-bold block leading-none">Valor Declarado</span>
                  </label>
                  <span className="text-[9px] text-slate-400 font-bold shrink-0">1.5% excedente</span>
                </div>

                {valorDeclarado && (
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[9px] font-bold text-slate-400">R$</span>
                    <input
                      type="text"
                      value={valorDeclaradoInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const num = parseInt(raw, 10) || 0;
                        const formatted = (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        setValorDeclaradoInput(formatted);
                      }}
                      className="w-full text-right font-mono font-bold text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Outputs & Real Integrations (5 Cols) */}
        <div className="lg:col-span-5 p-6 bg-slate-50/30 flex flex-col justify-between space-y-6">
          {/* Sizing Alerts / Limits */}
          <div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3.5">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <Layers size={13} className="text-slate-500" />
                Resumo de Cubagem & Pesos
              </h3>

              <div className="grid grid-cols-2 gap-3 divide-x divide-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold block leading-none">Volume do Volume</span>
                  <span className="text-sm font-black text-slate-800 block">
                    {volumeCm3.toLocaleString('pt-BR')} <span className="text-[10px] text-slate-500 font-medium">cm³</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block">
                    = {volumeLiters.toFixed(2)} Litros / Decímetros³
                  </span>
                </div>

                <div className="pl-3 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold block leading-none">Peso para Cobrança</span>
                  <span className="text-sm font-black text-slate-800 block flex items-center gap-1">
                    {taxedWeight.toFixed(3)} kg
                    {cubicWeight > 5 && cubicWeight > weight && (
                      <span className="text-[8px] bg-violet-100 text-violet-700 px-1 py-0.5 rounded font-extrabold uppercase">
                        Peso Cúbico Aplicado
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block">
                    Físico: {weight.toFixed(3)}kg | Cúbico: {cubicWeight.toFixed(3)}kg
                  </span>
                </div>
              </div>

              {/* Dimensional warnings / messages */}
              {hasDimensionWarning ? (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-2 text-[10px] leading-relaxed">
                  <AlertTriangle size={14} className="shrink-0 text-red-500" />
                  <div>
                    <p className="font-bold">Dimensões Fora dos Padrões dos Correios</p>
                    <ul className="list-disc pl-4 mt-0.5 font-medium">
                      {isTooLarge && <li>Soma das dimensões excede 200cm, ou altura/largura excede 100cm.</li>}
                      {isTooSmall && <li>Menor que as dimensões mínimas (C:16cm, L:11cm, A:2cm).</li>}
                      {isOverweight && <li>O peso excede o limite contratual de 30kg.</li>}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-100/60 text-emerald-800 rounded-xl flex items-center gap-2 text-[10px] font-semibold leading-none">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>Dimensões em conformidade com o manual dos Correios.</span>
                  </div>

                  {hasBigDimensionSurcharge && (
                    <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl flex items-start gap-2 text-[10px] leading-relaxed">
                      <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-extrabold block">Soma Adicional de Grandes Dimensões (C/L/A &gt; 70cm)</strong>
                        <span>Acrescentado taxa de R$ 79,00 por tamanho excedente de face única.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pricing cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                5. Comparativo de Valores de Frete
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                Zona: {calculatedZone}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PAC Card */}
              <button
                type="button"
                onClick={() => !hasDimensionWarning && setSelectedService('PAC')}
                disabled={hasDimensionWarning}
                className={`p-3.5 border rounded-2xl text-left transition-all ${
                  hasDimensionWarning 
                    ? 'opacity-40 border-slate-100 bg-slate-50 cursor-not-allowed' 
                    : selectedService === 'PAC'
                      ? 'border-violet-600 bg-violet-50/40 text-violet-900 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase flex items-center gap-1">
                    <Truck size={13} className="text-slate-400" /> PAC
                  </span>
                  <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Econômico</span>
                </div>
                <span className="text-lg font-black block text-slate-800 font-mono">
                  {hasDimensionWarning ? 'N/A' : `R$ ${pacTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">
                  Prazo: 4 a 8 dias úteis
                </span>
              </button>

              {/* SEDEX Card */}
              <button
                type="button"
                onClick={() => !hasDimensionWarning && setSelectedService('SEDEX')}
                disabled={hasDimensionWarning}
                className={`p-3.5 border rounded-2xl text-left transition-all ${
                  hasDimensionWarning 
                    ? 'opacity-40 border-slate-100 bg-slate-50 cursor-not-allowed' 
                    : selectedService === 'SEDEX'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase flex items-center gap-1">
                    <Sparkles size={13} className="text-blue-500" /> SEDEX
                  </span>
                  <span className="text-[8px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Expresso</span>
                </div>
                <span className="text-lg font-black block text-slate-800 font-mono">
                  {hasDimensionWarning ? 'N/A' : `R$ ${sedexTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </span>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">
                  Prazo: 1 a 2 dias úteis
                </span>
              </button>
            </div>

            {/* Mini Envios available banner if matched */}
            {isMiniEnviosAvailable && (
              <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Package size={13} className="text-yellow-600 shrink-0" />
                  <span>Disponível para <strong className="font-extrabold">Mini Envios</strong> (Até 350g, espessura &lt; 4cm)</span>
                </div>
                <span className="font-black text-yellow-900 font-mono text-[11px]">
                  R$ {miniEnviosPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Action Tools & PDF/Copy */}
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {/* Copy summary button */}
              <button
                type="button"
                onClick={handleCopySummary}
                disabled={hasDimensionWarning}
                className="flex items-center justify-center gap-2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copiedText ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-slate-500" />
                    <span>Copiar Orçamento</span>
                  </>
                )}
              </button>

              {/* Download PDF button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={hasDimensionWarning}
                className="flex items-center justify-center gap-2 p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} className="text-blue-500" />
                <span>Baixar PDF</span>
              </button>
            </div>

            {/* 6. INTEGRATION FORM: CREATE REAL ORDER */}
            {onCreateOrder && (
              <div className="border-t border-slate-150 pt-4 space-y-3">
                <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <PlusCircle size={12} className="text-slate-400" />
                  Gerar Pedido no Sistema com este Frete
                </h3>

                <form onSubmit={handleCreateRealOrder} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Partner Select */}
                    <div>
                      <span className="text-[9px] text-slate-400 font-semibold block mb-0.5">Parceiro Emitente *</span>
                      <select
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        className="w-full px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                      >
                        <option value="">Selecione o Parceiro...</option>
                        {clientPartners.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.region})</option>
                        ))}
                      </select>
                    </div>

                    {/* Recipient Name */}
                    <div>
                      <span className="text-[9px] text-slate-400 font-semibold block mb-0.5">Destinatário/Cliente *</span>
                      <input
                        type="text"
                        placeholder="Nome Completo"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Phone */}
                    <div className="sm:col-span-1">
                      <span className="text-[9px] text-slate-400 font-semibold block mb-0.5">Telefone *</span>
                      <input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className="w-full px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 font-mono"
                      />
                    </div>

                    {/* Address Number */}
                    <div className="sm:col-span-1">
                      <span className="text-[9px] text-slate-400 font-semibold block mb-0.5">Número *</span>
                      <input
                        type="text"
                        placeholder="Ex: 450"
                        value={recipientNumber}
                        onChange={(e) => setRecipientNumber(e.target.value)}
                        className="w-full px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 font-bold"
                      />
                    </div>

                    {/* Complement */}
                    <div className="sm:col-span-1">
                      <span className="text-[9px] text-slate-400 font-semibold block mb-0.5">Complemento</span>
                      <input
                        type="text"
                        placeholder="Ex: Apto 12"
                        value={recipientComplement}
                        onChange={(e) => setRecipientComplement(e.target.value)}
                        className="w-full px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {orderCreatedSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[10px] font-bold flex items-center gap-2"
                      >
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span>Pedido gerado com sucesso na base administrativa! Pronto para alocação.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={hasDimensionWarning || !cepDestino || addressDestino === ''}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:shadow shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusCircle size={14} />
                    <span>Confirmar e Criar Pedido (Frete R$ {(selectedService === 'SEDEX' ? sedexTotal : pacTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
