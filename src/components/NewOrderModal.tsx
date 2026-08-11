/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Order, OrderPriority, ClientPartner } from '../types';
import { getSaoPauloISODate } from '../utils/dateUtils';
import { getCoordinatesFromCep, geocodeAddressBackend } from '../utils/locationUtils';
import CepInput, { ViaCepData } from './CepInput';
import { 
  X, 
  ShoppingBag, 
  User, 
  MapPin, 
  Phone, 
  DollarSign, 
  AlertCircle,
  Truck,
  CheckCircle2,
  Mail,
  Hash,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newOrder: Omit<Order, 'id' | 'status' | 'createdAt'>) => void;
  clientPartners: ClientPartner[];
}

export default function NewOrderModal({ isOpen, onClose, onSubmit, clientPartners }: NewOrderModalProps) {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [region, setRegion] = useState('Centro');
  const [value, setValue] = useState('0');
  const [priority, setPriority] = useState<OrderPriority>('Média');
  const [itemsCount, setItemsCount] = useState('1');
  const [isSuccess, setIsSuccess] = useState(false);
  
  // New Filterable fields
  const [date, setDate] = useState(getSaoPauloISODate());
  const [cep, setCep] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  const handleSearchCep = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsSearchingCep(true);
    setCepError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        const logradouro = data.logradouro || '';
        const bairro = data.bairro || '';
        const localidade = data.localidade || 'São Paulo';
        const uf = data.uf || 'SP';

        let streetAddress = '';
        if (logradouro) {
          streetAddress = logradouro;
          if (bairro) {
            streetAddress += ` - ${bairro}`;
          }
          streetAddress += `, ${localidade} - ${uf}`;
        } else {
          streetAddress = `${localidade} - ${uf}`;
        }

        setAddress(streetAddress);

        // Auto-assign region based on SP zones
        if (localidade.toLowerCase() === 'são paulo') {
          const prefix = parseInt(cleanCep.substring(0, 5)) || 0;
          if (prefix >= 4000 && prefix <= 4999) setRegion('Zona Sul');
          else if (prefix >= 5000 && prefix <= 5999) setRegion('Zona Oeste');
          else if (prefix >= 2000 && prefix <= 2999) setRegion('Zona Norte');
          else if (prefix >= 3000 && prefix <= 3999) setRegion('Zona Leste');
          else setRegion('Centro');
        }

        setCep(`${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`);
      } else {
        setCepError('CEP não encontrado.');
      }
    } catch (err) {
      console.error(err);
      setCepError('Erro ao consultar CEP.');
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Synchronize initial selection
  React.useEffect(() => {
    if (clientPartners && clientPartners.length > 0 && !partnerName) {
      setPartnerName(clientPartners[0].id);
    }
  }, [clientPartners, partnerName]);

  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientName || !address) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsGeocodingLoading(true);
    const orderValue = parseFloat(value.replace(',', '.')) || 0;
    const items = parseInt(itemsCount) || 1;
    const targetCep = cep || '01310-100';

    let fullAddress = address.trim();
    const cleanNum = number.trim();
    const cleanComp = complement.trim();
    const cleanEmail = email.trim();

    if (cleanNum && !fullAddress.toLowerCase().includes(cleanNum.toLowerCase())) {
      fullAddress = `${fullAddress}, Nº ${cleanNum}`;
    }
    if (cleanComp && !fullAddress.toLowerCase().includes(cleanComp.toLowerCase())) {
      fullAddress = `${fullAddress} (${cleanComp})`;
    }

    // Perform real backend geocoding via /api/geocode before saving
    let coords = getCoordinatesFromCep(targetCep, region, fullAddress);
    try {
      const backendGeo = await geocodeAddressBackend(fullAddress, targetCep, region);
      if (backendGeo && typeof backendGeo.lat === 'number' && typeof backendGeo.lng === 'number') {
        coords = { lat: backendGeo.lat, lng: backendGeo.lng };
      }
    } catch (geoErr) {
      console.warn("Backend geocode warning, using fallback:", geoErr);
    } finally {
      setIsGeocodingLoading(false);
    }

    onSubmit({
      clientName,
      phone: phone || '(11) 99999-9999',
      email: cleanEmail,
      address: fullAddress,
      number: cleanNum,
      complement: cleanComp,
      region,
      value: orderValue,
      priority,
      itemsCount: items,
      date: date || getSaoPauloISODate(),
      cep: targetCep,
      partnerName: partnerName || 'Outro',
      lat: coords.lat,
      lng: coords.lng,
      rawData: {
        'Email': cleanEmail,
        'E-mail': cleanEmail,
        'email': cleanEmail,
        'Número': cleanNum,
        'Numero': cleanNum,
        'Complemento': cleanComp
      }
    });

    setIsSuccess(true);
    setTimeout(() => {
      // Reset form states
      setClientName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNumber('');
      setComplement('');
      setRegion('Centro');
      setValue('0');
      setPriority('Média');
      setItemsCount('1');
      setCep('');
      setPartnerName(clientPartners?.[0]?.id || '');
      setDate(getSaoPauloISODate());
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" id="new-order-modal-overlay">
          
          {/* Backdrop blur click target */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Core Panel Content */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute top-0 bottom-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col justify-between"
            id="new-order-sidebar-panel"
          >
            {isSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4" id="new-order-success-pane">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-lg shadow-emerald-50">
                  <CheckCircle2 size={32} className="animate-bounce" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Pedido Despachado!</h3>
                <p className="text-xs text-slate-500 max-w-xs leading-normal">
                  O pedido foi inserido no fluxo de triagem e está disponível para vinculação imediata de entregadores.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-y-auto h-full">
                
                {/* Panel Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Criar Novo Pedido</h3>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Atendimento de Logística</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Form Fields */}
                <div className="p-6 space-y-4 flex-1 overflow-y-auto" id="new-order-form-fields">
                  
                  {/* Client Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nome do Cliente *</label>
                    <div className="relative group">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="text"
                        required
                        placeholder="Ex: Pedro de Alcantara"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Client Contact Info: Phone & Email Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Client Phone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Telefone de Contato</label>
                      <div className="relative group">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          placeholder="Ex: (11) 98888-7777"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    {/* Client Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">E-mail do Cliente</label>
                      <div className="relative group">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="email"
                          placeholder="Ex: cliente@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Endereço / Logradouro *</label>
                    <div className="relative group">
                      <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <textarea
                        required
                        rows={2}
                        placeholder="Av. Paulista, Rua Augusta, Bairro..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Number & Complement Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Number */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Número</label>
                      <div className="relative group">
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          placeholder="Ex: 1000"
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Complement */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Complemento</label>
                      <div className="relative group">
                        <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          placeholder="Ex: Apto 42, Bloco B"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Region Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Zona / Região</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Centro">Centro</option>
                      <option value="Zona Sul">Zona Sul</option>
                      <option value="Zona Oeste">Zona Oeste</option>
                      <option value="Zona Norte">Zona Norte</option>
                      <option value="Zona Leste">Zona Leste</option>
                    </select>
                  </div>

                  {/* CEP & Cliente Parceiro */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <CepInput
                        value={cep}
                        onChange={(formatted, raw) => setCep(formatted)}
                        onAddressFound={(data) => {
                          const logradouro = data.logradouro || '';
                          const bairro = data.bairro || '';
                          const localidade = data.localidade || 'São Paulo';
                          const uf = data.uf || 'SP';

                          let streetAddress = '';
                          if (logradouro) {
                            streetAddress = logradouro;
                            if (bairro) streetAddress += ` - ${bairro}`;
                            streetAddress += `, ${localidade} - ${uf}`;
                          } else {
                            streetAddress = `${localidade} - ${uf}`;
                          }

                          setAddress(streetAddress);

                          const cleanCep = (data.cep || '').replace(/\D/g, '');
                          if (localidade.toLowerCase() === 'são paulo') {
                            const prefix = parseInt(cleanCep.substring(0, 5)) || 0;
                            if (prefix >= 4000 && prefix <= 4999) setRegion('Zona Sul');
                            else if (prefix >= 5000 && prefix <= 5999) setRegion('Zona Oeste');
                            else if (prefix >= 2000 && prefix <= 2999) setRegion('Zona Norte');
                            else if (prefix >= 3000 && prefix <= 3999) setRegion('Zona Leste');
                            else setRegion('Centro');
                          }
                        }}
                        label="CEP"
                        required
                        showAddressPreview={true}
                        size="md"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cliente Parceiro</label>
                      <select
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                      >
                        {clientPartners && clientPartners.map((cp) => (
                          <option key={cp.id} value={cp.id}>
                            [{cp.id}] {cp.name}
                          </option>
                        ))}
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Data do Pedido *</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                    />
                  </div>

                  {/* Value / Price and Items Count */}
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Order Value */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Valor do Pedido (R$) *</label>
                      <div className="relative group">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          required
                          placeholder="0,00"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    {/* Items Count */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Quantidade de Itens</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={itemsCount}
                        onChange={(e) => setItemsCount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                  </div>

                  {/* Priority Checkbox list */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Prioridade</label>
                    <div className="flex flex-wrap gap-2.5" id="priority-selector">
                      {(['Baixa', 'Média', 'Alta', 'expresso'] as OrderPriority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 min-w-[70px] py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            priority === p
                              ? p === 'Alta' 
                                ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                                : p === 'Média'
                                ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                                : p === 'expresso'
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm font-black'
                                : 'bg-slate-100 border-slate-500 text-slate-800 shadow-sm'
                              : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {p === 'expresso' ? '⚡ Expresso' : p}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Bottom Trigger actions */}
                <div className="p-6 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 border border-slate-100 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 transition-colors cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isGeocodingLoading}
                    className={`flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-50 transition-all cursor-pointer text-center ${isGeocodingLoading ? 'opacity-70 cursor-wait' : ''}`}
                    id="submit-new-order-form"
                  >
                    {isGeocodingLoading ? '📍 Geocodificando Endereço...' : 'Salvar Pedido'}
                  </button>
                </div>

              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
