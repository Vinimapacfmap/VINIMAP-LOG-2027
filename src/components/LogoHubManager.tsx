import React, { useState } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Building2, 
  Eye, 
  Link as LinkIcon, 
  FileText, 
  Smartphone, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ShieldCheck,
  Save,
  Download
} from 'lucide-react';
import { CompanyHub } from '../types';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import { motion, AnimatePresence } from 'motion/react';

interface LogoHubManagerProps {
  hubs: CompanyHub[];
  onSaveHub: (hub: CompanyHub) => void;
}

export default function LogoHubManager({ hubs, onSaveHub }: LogoHubManagerProps) {
  // Select active hub or first hub
  const activeHub = hubs.find(h => h.active) || hubs[0] || {
    id: 'hub-main',
    name: 'Sede Principal Vinimap',
    address: 'Av. Dr. Gastão Vidigal, 1946 - Vila Leopoldina, São Paulo - SP',
    cep: '05314-000',
    lat: -23.5385556,
    lng: -46.70118,
    active: true,
    logoUrl: vinimapLogo
  };

  const [selectedHubId, setSelectedHubId] = useState<string>(activeHub.id);
  const currentHub = hubs.find(h => h.id === selectedHubId) || activeHub;

  // Form states
  const [logoInputMode, setLogoInputMode] = useState<'upload' | 'url'>('upload');
  const [tempLogoUrl, setTempLogoUrl] = useState<string>(currentHub.logoUrl || vinimapLogo);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fileDetails, setFileDetails] = useState<{ name?: string; size?: string; type?: string } | null>(null);

  // Update temp state when selected hub changes
  const handleHubChange = (hubId: string) => {
    setSelectedHubId(hubId);
    const target = hubs.find(h => h.id === hubId);
    if (target) {
      setTempLogoUrl(target.logoUrl || vinimapLogo);
      setCustomUrl(target.logoUrl && !target.logoUrl.startsWith('data:') ? target.logoUrl : '');
      setErrorMsg('');
      setSuccessMsg('');
      setFileDetails(null);
    }
  };

  // Handle File Upload (Convert to Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('O arquivo do logotipo deve ter menos de 2MB para garantir alta velocidade.');
      return;
    }

    const formattedSize = (file.size / 1024).toFixed(1) + ' KB';
    setFileDetails({
      name: file.name,
      size: formattedSize,
      type: file.type
    });

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTempLogoUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Erro ao ler o arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  };

  // Apply custom URL
  const handleApplyUrl = () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!customUrl.trim()) {
      setErrorMsg('Digite um link de imagem válido.');
      return;
    }
    setTempLogoUrl(customUrl.trim());
    setFileDetails({
      name: 'Imagem via URL Web',
      type: 'Link Externo'
    });
  };

  // Restore Default App Logo
  const handleRestoreDefault = () => {
    setTempLogoUrl(vinimapLogo);
    setCustomUrl('');
    setFileDetails({
      name: 'Logotipo Oficial Vinimap Condutor',
      type: 'Ativo Interno (.jpg)'
    });
    setErrorMsg('');
    setSuccessMsg('Logotipo do aplicativo do condutor selecionado.');
  };

  // Delete / Clear custom logo
  const handleRemoveLogo = () => {
    setTempLogoUrl(vinimapLogo);
    setCustomUrl('');
    setFileDetails(null);
    setErrorMsg('');
    setSuccessMsg('Logotipo personalizado removido. Restaurado para a logo padrão.');
  };

  // Save changes to database and context
  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    try {
      const updatedHub: CompanyHub = {
        ...currentHub,
        logoUrl: tempLogoUrl || vinimapLogo
      };

      await onSaveHub(updatedHub);
      setSuccessMsg(`Logotipo da "${currentHub.name}" atualizado e salvo com sucesso em todo o sistema!`);
    } catch (err: any) {
      console.error('Erro ao salvar logo:', err);
      setErrorMsg('Erro ao salvar logotipo no banco de dados: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const isDefaultLogo = tempLogoUrl === vinimapLogo;
  const isChanged = tempLogoUrl !== (currentHub.logoUrl || vinimapLogo);

  return (
    <div className="space-y-6 max-w-6xl mx-auto" id="logo-hub-manager-view">
      
      {/* Top Banner Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={11} className="text-blue-400" />
              Gestão de Identidade Visual
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ImageIcon className="text-blue-400" size={24} />
            Edição de Logotipo da Sede Operacional
          </h2>
          <p className="text-xs text-slate-300 font-medium max-w-2xl leading-relaxed">
            Configure e atualize a logomarca da sua Sede ViniMap. Esta imagem será sincronizada automaticamente no Menu Lateral, Mapa ao Vivo, Relatórios em PDF e no App do Condutor.
          </p>
        </div>

        {/* Quick Action: Save Button in Header */}
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            type="button"
            onClick={handleRestoreDefault}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Usar a logo padrão do App do Condutor Vinimap"
          >
            <RotateCcw size={14} className="text-blue-400" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-5 py-2.5 text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
              isChanged
                ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-600/30 ring-2 ring-blue-400/50'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            <Save size={15} />
            <span>{isSaving ? 'Salvando...' : isChanged ? 'Salvar Alterações *' : 'Logotipo Salvo'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-800 text-xs font-bold">Fechar</button>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800 text-xs font-bold">Fechar</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Sede Selector & CRUD Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Sede Selection Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Building2 size={15} className="text-blue-600" />
                Sede Operacional Selecionada
              </label>
              {currentHub.active && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold rounded-md uppercase">
                  Sede Ativa Principal
                </span>
              )}
            </div>

            <select
              value={selectedHubId}
              onChange={(e) => handleHubChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {hubs.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.active ? '(Ativa)' : ''} - {h.cep}
                </option>
              ))}
            </select>

            <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <div className="font-bold text-slate-700">{currentHub.name}</div>
              <div className="truncate">{currentHub.address}</div>
              {currentHub.cnpj && <div className="font-mono text-[10px] text-slate-400">CNPJ: {currentHub.cnpj}</div>}
            </div>
          </div>

          {/* CRUD Editor Card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Upload size={16} className="text-blue-600" />
                  Atualizar / Importar Novo Logotipo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Selecione uma imagem do seu computador ou informe um link seguro.</p>
              </div>

              {/* Mode Switcher: File Upload vs URL */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLogoInputMode('upload')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    logoInputMode === 'upload' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Arquivo Local
                </button>
                <button
                  type="button"
                  onClick={() => setLogoInputMode('url')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    logoInputMode === 'url' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  URL Web
                </button>
              </div>
            </div>

            {/* Mode 1: File Upload (Base64) */}
            {logoInputMode === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-blue-200 bg-blue-50/30 hover:bg-blue-50/60 transition-all rounded-2xl p-6 text-center cursor-pointer relative group">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto group-hover:scale-110 transition-transform">
                      <Upload size={22} />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-blue-700">Clique aqui para selecionar a imagem</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">ou arraste e solte o arquivo nesta área</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold">Suporta PNG, JPG, WEBP e SVG (Máximo 2MB)</p>
                  </div>
                </div>

                {/* Quick Preset Button */}
                <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-600" />
                    <span className="text-xs font-bold text-slate-700">Atalho Rápido:</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreDefault}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Check size={13} />
                    <span>Usar Logo do App do Condutor</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mode 2: External Image URL */}
            {logoInputMode === 'url' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">Link Direto da Imagem (HTTPS)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="url"
                      placeholder="https://exemplo.com/logotipo.png"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    Aplicar URL
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Certifique-se de que a URL seja pública e termine com extensões de imagem comuns (.png, .jpg, .svg).
                </p>
              </div>
            )}

            {/* Active Logo Status & CRUD Action Toolbar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Status do Arquivo:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    isDefaultLogo
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-violet-50 text-violet-700 border border-violet-200'
                  }`}>
                    {isDefaultLogo ? 'Logo Padrão Condutor' : 'Logotipo Personalizado'}
                  </span>
                </div>
                {fileDetails?.name && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    {fileDetails.name} {fileDetails.size ? `(${fileDetails.size})` : ''}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isDefaultLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-rose-200"
                  >
                    <Trash2 size={13} />
                    <span>Excluir Logo Personalizado</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Salvando...' : 'Salvar no Banco'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* Info Card: Visual Specs */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info size={14} className="text-blue-600" />
              Recomendações para Melhor Visualização:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 font-medium">
              <li>Use imagens com **fundo transparente (PNG)** ou fundo branco para melhor contraste no tema claro.</li>
              <li>Proporção quadrada ou circular (1:1) funciona de maneira otimizada nos ícones do mapa e cabeçalho.</li>
              <li>A imagem é salva em sincronização direta no Firestore, disponível instantaneamente em todos os smartphones conectados.</li>
            </ul>
          </div>

        </div>

        {/* Right Column: Real-time Live Render Previews (5 cols) */}
        <div className="lg:col-span-5 space-y-6">

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Eye size={16} className="text-blue-600" />
                Pré-visualizações em Tempo Real
              </h3>
              <span className="text-[10px] font-extrabold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Ao Vivo
              </span>
            </div>

            {/* Main Big Logo Showcase */}
            <div className="bg-slate-900 rounded-2xl p-6 text-center space-y-3 relative overflow-hidden border border-slate-800 shadow-md">
              <div className="w-28 h-28 mx-auto bg-white rounded-2xl p-2 shadow-2xl border-2 border-slate-100 flex items-center justify-center overflow-hidden">
                <img
                  src={tempLogoUrl}
                  alt="Pré-visualização do Logotipo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => setErrorMsg('Não foi possível carregar a imagem. Verifique a URL ou o arquivo.')}
                />
              </div>
              <div>
                <h4 className="text-sm font-black text-white tracking-tight">{currentHub.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Logotipo Principal de Operações</p>
              </div>
            </div>

            {/* Rendering Context 1: Menu Lateral (Sidebar) Header */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                1. No Menu Lateral (Sidebar Navigation)
              </span>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <img
                    src={tempLogoUrl}
                    alt="Logo Sidebar"
                    className="w-9 h-9 rounded-xl object-contain border border-slate-100 bg-white p-0.5 shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="font-bold text-xs text-slate-800">{currentHub.name}</div>
                    <div className="text-[9px] text-blue-600 font-extrabold uppercase">Sede Ativa • Vinimap</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">OK</span>
              </div>
            </div>

            {/* Rendering Context 2: App do Condutor (PWA Mobile) */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Smartphone size={12} className="text-slate-500" />
                2. No Aplicativo Móvel do Condutor (PWA)
              </span>
              <div className="p-3 bg-slate-900 rounded-xl text-white flex items-center justify-between shadow-2xs border border-slate-800">
                <div className="flex items-center gap-3">
                  <img
                    src={tempLogoUrl}
                    alt="Logo Driver App"
                    className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-white shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="font-bold text-xs text-white">App do Condutor</div>
                    <div className="text-[9px] text-slate-400">Identificador da frota em trânsito</div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">Sincronizado</span>
              </div>
            </div>

            {/* Rendering Context 3: PDF Document Header */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <FileText size={12} className="text-slate-500" />
                3. Relatórios Financeiros e Faturas PDF
              </span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center">
                    <img
                      src={tempLogoUrl}
                      alt="Logo PDF"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <div className="font-extrabold text-[11px] text-slate-800">Documento de Repasse / Extrato</div>
                    <div className="text-[9px] text-slate-400">Cabeçalho com logo da empresa</div>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">PDF Header</span>
              </div>
            </div>

            {/* Rendering Context 4: Live Map Pin Marker */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <MapPin size={12} className="text-slate-500" />
                4. Marcador do Mapa de Entregas (Base Sede)
              </span>
              <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white shadow-md overflow-hidden flex items-center justify-center p-0.5">
                      <img
                        src={tempLogoUrl}
                        alt="Logo Map Marker"
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-[11px] text-slate-800">Pin de Origem do Mapa</div>
                    <div className="text-[9px] text-slate-500">Exibido na Sede do Otimizador e Rastreador</div>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Mapa GPS</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
