import React, { useState, useRef, useEffect } from 'react';
import CepInput, { ViaCepData } from './CepInput';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  MapPin, 
  CheckCircle2, 
  Upload, 
  Building2, 
  Phone, 
  FileText, 
  Compass, 
  Image as ImageIcon,
  AlertCircle,
  AlertTriangle,
  X,
  Sparkles,
  Info,
  Mail,
  LocateFixed,
  Maximize2,
  Minimize2,
  Crosshair,
  RefreshCw,
  Search
} from 'lucide-react';
import { CompanyHub } from '../types';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import SafeMapWrapper from './SafeMapWrapper';
import { geocodeCepAddress, getCoordinatesFromCep, validateGreaterSpCoordinates } from '../utils/locationUtils';

// Controller component to fix sizing issues and center the map inside the modal
function MiniMapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.setView(center, 15);
    }, 350);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
}

// Interactive map marker and click listener component for visual geolocation selection
function InteractiveLocationPickerMarker({ 
  position, 
  onChangePosition 
}: { 
  position: [number, number]; 
  onChangePosition: (lat: number, lng: number) => void; 
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (e.latlng && !isNaN(e.latlng.lat) && !isNaN(e.latlng.lng)) {
        onChangePosition(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    if (position && !isNaN(position[0]) && !isNaN(position[1])) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);

  return (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const marker = e.target;
          const pos = marker.getLatLng();
          if (pos && !isNaN(pos.lat) && !isNaN(pos.lng)) {
            onChangePosition(pos.lat, pos.lng);
          }
        },
      }}
      icon={L.divIcon({
        className: 'custom-interactive-hub-icon',
        html: `
          <div class="relative flex h-10 w-10 items-center justify-center">
            <span class="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-30 animate-ping"></span>
            <div class="relative h-7 w-7 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })}
    />
  );
}

// Helper functions for address/coordinate validation
const isCeroCoraAddress = (addr: string, zip?: string): boolean => {
  if (!addr && !zip) return false;
  const normAddr = (addr || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normZip = (zip || '').replace(/\D/g, '');
  return (
    normAddr.includes("cero cora") || 
    normAddr.includes("cerro cora") || 
    normZip === "05061050" || 
    normZip.startsWith("05061")
  );
};

const getCoordinateDiscrepancy = (latitude: number, longitude: number): string | null => {
  const targetLat = -23.5385556;
  const targetLng = -46.70118;
  const tolerance = 0.0001; // precise to within ~10 meters
  const latDiff = Math.abs(latitude - targetLat);
  const lngDiff = Math.abs(longitude - targetLng);
  if (latDiff > tolerance || lngDiff > tolerance) {
    return `As coordenadas cadastradas (Lat: ${latitude.toFixed(7)}, Lng: ${longitude.toFixed(7)}) não coincidem precisamente com o endereço 'Rua Cerro Corá, 385, Vila Romana, CEP 05061-050' (Lat: ${targetLat}, Lng: ${targetLng}).`;
  }
  return null;
};

interface HubRegistrationProps {
  hubs: CompanyHub[];
  onSaveHub: (hub: CompanyHub) => void;
  onDeleteHub: (hubId: string) => void;
  onSetActiveHub: (hubId: string) => void;
}

export default function HubRegistration({ 
  hubs, 
  onSaveHub, 
  onDeleteHub, 
  onSetActiveHub 
}: HubRegistrationProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<CompanyHub | null>(null);
  
  // Form States
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [lat, setLat] = useState(-23.5720);
  const [lng, setLng] = useState(-46.6336);
  const [latInput, setLatInput] = useState('-23.5720');
  const [lngInput, setLngInput] = useState('-46.6336');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [confirmedGspWarning, setConfirmedGspWarning] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateCoordinates = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setLatInput(newLat.toString());
    setLngInput(newLng.toString());
    setConfirmedGspWarning(false);
  };

  const handleGetCurrentGpsLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocalização não é suportada por este navegador.');
      return;
    }

    setIsGettingGps(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        updateCoordinates(currentLat, currentLng);
        setIsGettingGps(false);
        setSuccessMsg('Localização GPS capturada com sucesso!');
        setTimeout(() => setSuccessMsg(''), 3000);
      },
      (err) => {
        setIsGettingGps(false);
        console.warn('Erro ao obter GPS:', err);
        setErrorMsg('Não foi possível obter a geolocalização atual (verifique se a permissão de localização do navegador está concedida).');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const resetForm = () => {
    setName('');
    setCnpj('');
    setEmail('');
    setAddress('');
    setCep('');
    setCidade('');
    setEstado('');
    updateCoordinates(-23.5720, -46.6336);
    setPhone('');
    setLogoUrl('');
    setIsActive(false);
    setErrorMsg('');
    setWarningMsg('');
    setConfirmedGspWarning(false);
    setEditingHub(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsActive(hubs.length === 0); // Active by default if it's the first one
    setIsFormOpen(true);
  };

  const handleOpenEdit = (hub: CompanyHub) => {
    setEditingHub(hub);
    setName(hub.name);
    setCnpj(hub.cnpj || '');
    setEmail(hub.email || '');
    setAddress(hub.address);
    setCep(hub.cep);
    updateCoordinates(hub.lat, hub.lng);
    setPhone(hub.phone || '');
    setLogoUrl(hub.logoUrl || '');
    setIsActive(hub.active);
    setErrorMsg('');
    setIsFormOpen(true);

    const match = hub.address.match(/,\s*([^,]+)\s*-\s*([A-Za-z]{2})\s*$/) || hub.address.match(/,\s*([^,]+)\s*\/\s*([A-Za-z]{2})\s*$/);
    if (match) {
      setCidade(match[1].trim());
      setEstado(match[2].trim().toUpperCase());
    } else {
      setCidade('São Paulo');
      setEstado('SP');
    }
  };

  // CEP autofill / coordinate suggestion helper
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleSearchCep = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsSearchingCep(true);
    setErrorMsg('');
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
        setCidade(localidade);
        setEstado(uf);

        // Coordenadas geograficas precisas geocodificadas via algoritmo CEP/Nominatim
        const geocoded = await geocodeCepAddress(cleanCep, streetAddress);
        updateCoordinates(geocoded.lat, geocoded.lng);

        setCep(`${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`);
      } else {
        setErrorMsg('CEP não encontrado na base de dados.');
      }
    } catch (err) {
      setErrorMsg('Erro ao consultar o CEP.');
      console.error(err);
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Convert Logo to base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        setErrorMsg('O arquivo do logotipo deve ter menos de 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
          setErrorMsg('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('O nome da Sede é obrigatório.');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('O endereço é obrigatório.');
      return;
    }
    if (!cidade.trim()) {
      setErrorMsg('A cidade é obrigatória.');
      return;
    }
    if (!estado.trim() || estado.trim().length !== 2) {
      setErrorMsg('O estado é obrigatório e deve ter 2 caracteres (UF).');
      return;
    }
    if (!cep.trim()) {
      setErrorMsg('O CEP é obrigatório.');
      return;
    }

    const parsedLat = parseFloat(latInput);
    const parsedLng = parseFloat(lngInput);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setErrorMsg('Latitude inválida. Por favor, insira um valor numérico entre -90 e 90 (Ex: -23.5350257).');
      return;
    }

    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setErrorMsg('Longitude inválida. Por favor, insira um valor numérico entre -180 e 180 (Ex: -46.7022420).');
      return;
    }

    if (parsedLat === 0 && parsedLng === 0) {
      setErrorMsg('Coordenadas zeradas (0, 0) não são válidas. Por favor, informe as coordenadas GPS reais do Hub.');
      return;
    }

    let finalAddress = address.trim();
    const suffix = `, ${cidade.trim()} - ${estado.trim().toUpperCase()}`;
    if (!finalAddress.endsWith(suffix) && !finalAddress.toLowerCase().includes(cidade.trim().toLowerCase())) {
      finalAddress = `${finalAddress}${suffix}`;
    }

    const hubData: CompanyHub = {
      id: editingHub ? editingHub.id : `hub-${Date.now()}`,
      name: name.trim(),
      cnpj: cnpj.trim() || undefined,
      email: email.trim() || undefined,
      address: finalAddress,
      cep: cep.trim(),
      lat: parsedLat,
      lng: parsedLng,
      phone: phone.trim() || undefined,
      logoUrl: logoUrl || vinimapLogo,
      active: isActive
    };

    // Save active hub to localStorage for instant client-side persistence
    if (isActive || hubs.length === 0) {
      try {
        localStorage.setItem('vinimap_active_hub', JSON.stringify({
          ...hubData,
          active: true
        }));
      } catch (e) {
        console.warn('Erro ao salvar active hub no localStorage:', e);
      }
    }

    onSaveHub(hubData);
    
    // If we marked this hub as active, we update others to false in App state
    if (isActive) {
      onSetActiveHub(hubData.id);
    }

    setSuccessMsg(editingHub ? `Sede "${hubData.name}" atualizada com sucesso! Coordenadas (Lat: ${parsedLat.toFixed(6)}, Lng: ${parsedLng.toFixed(6)}) salvas em todo o sistema.` : `Sede "${hubData.name}" cadastrada com sucesso! Coordenadas (Lat: ${parsedLat.toFixed(6)}, Lng: ${parsedLng.toFixed(6)}) salvas.`);
    setTimeout(() => setSuccessMsg(''), 4000);

    setIsFormOpen(false);
    resetForm();
  };

  const activeHub = hubs.find(h => h.active);

  return (
    <div className="space-y-6" id="hub-registration-container">
      
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/60 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" id="hub-overview-banner">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight font-sans">Configuração da Sede da Empresa (ViniMap)</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
              Defina o ponto de origem real das entregas. Os trajetos, roteirizações e os simuladores de rotas utilizarão as coordenadas geográficas e informações desta Sede ativa.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
          id="btn-add-hub"
        >
          <Plus size={16} />
          <span>Nova Sede / Filial</span>
        </button>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-semibold"
        >
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Hub list / Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="hub-grid-layout">
        
        {/* Active Hub Showcase */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="active-hub-showcase">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100/50 flex items-center gap-1.5">
                <CheckCircle2 size={10} />
                Sede Ativa Atual
              </span>
              <Compass size={18} className="text-blue-500 animate-spin-slow" />
            </div>

            {activeHub ? (
              <div className="space-y-5 pt-2" id="active-hub-details">
                <div className="flex items-center gap-4">
                  <img 
                    src={activeHub.logoUrl || vinimapLogo} 
                    alt="Logotipo" 
                    className="w-16 h-16 rounded-xl object-contain border border-slate-100 bg-white p-1 shadow-sm shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                    }}
                  />
                  <div>
                    <h4 className="font-extrabold text-slate-800 tracking-tight text-base font-sans">{activeHub.name}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{activeHub.cnpj ? `CNPJ: ${activeHub.cnpj}` : 'CNPJ Não Cadastrado'}</p>
                  </div>
                </div>

                {/* Active Hub coordinate discrepancy alert */}
                {isCeroCoraAddress(activeHub.address, activeHub.cep) && getCoordinateDiscrepancy(activeHub.lat, activeHub.lng) && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 space-y-1.5 text-xs font-semibold" id="active-hub-discrepancy-warning">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-500 shrink-0 animate-pulse" />
                      <span className="font-bold text-rose-800">Discrepância de Coordenadas</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-600 font-medium">
                      {getCoordinateDiscrepancy(activeHub.lat, activeHub.lng)}
                    </p>
                  </div>
                )}

                <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-50 pt-4">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-700">{activeHub.address}</p>
                      <p className="text-slate-400 mt-0.5 font-mono">CEP: {activeHub.cep}</p>
                    </div>
                  </div>

                  {activeHub.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-700">{activeHub.phone}</span>
                    </div>
                  )}

                  {activeHub.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-700">{activeHub.email}</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2.5 border-t border-slate-50/50 pt-3 mt-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1 bg-slate-50 rounded text-slate-500">
                        <Compass size={12} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Coordenadas de Operação</span>
                        <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-500">
                          <span>Lat: <strong className="text-slate-700 font-semibold">{activeHub.lat.toFixed(6)}</strong></span>
                          <span className="text-slate-300">|</span>
                          <span>Lng: <strong className="text-slate-700 font-semibold">{activeHub.lng.toFixed(6)}</strong></span>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const hubGspCheck = validateGreaterSpCoordinates(activeHub.lat, activeHub.lng);
                      return hubGspCheck.isValidInGsp ? (
                        <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-mono uppercase shrink-0">
                          RMSP OK ({hubGspCheck.distanceFromSpCenterKm}km)
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-mono uppercase inline-flex items-center gap-1 shrink-0">
                          <AlertTriangle size={10} className="text-amber-600" />
                          Fora RMSP ({hubGspCheck.distanceFromSpCenterKm}km)
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3" id="no-active-hub">
                <AlertCircle size={32} className="text-amber-500 mx-auto" />
                <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                  Nenhuma sede configurada como ativa. Crie ou ative uma sede ao lado.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-blue-50/50 border border-blue-100/30 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-800 leading-relaxed">
            <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
            <span>
              O sistema sincroniza as entregas com base nesta Sede. O logotipo cadastrado será renderizado na interface e relatórios.
            </span>
          </div>
        </div>

        {/* Hubs Manager List */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col h-full" id="hubs-manager-list">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Sedes ViniMap Cadastradas ({hubs.length})</h4>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {hubs.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <Building2 size={36} className="text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400">Nenhuma Sede ViniMap cadastrada. Cadastre a primeira!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {hubs.map((hub) => (
                  <div 
                    key={hub.id} 
                    className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/40 ${hub.active ? 'bg-blue-50/10' : ''}`}
                    id={`hub-row-${hub.id}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <img 
                        src={hub.logoUrl || vinimapLogo} 
                        alt="Logo Hub" 
                        className="w-11 h-11 rounded-lg object-contain border border-slate-100 bg-white p-0.5 shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                        }}
                      />

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-800 text-xs tracking-tight">{hub.name}</span>
                          {hub.active && (
                            <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Ativo</span>
                          )}
                          {(() => {
                            const hubGspCheck = validateGreaterSpCoordinates(hub.lat, hub.lng);
                            return hubGspCheck.isValidInGsp ? (
                              <span className="text-[8.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono uppercase">
                                RMSP ({hubGspCheck.distanceFromSpCenterKm}km)
                              </span>
                            ) : (
                              <span className="text-[8.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-mono uppercase inline-flex items-center gap-0.5">
                                <AlertTriangle size={9} className="text-amber-600" />
                                Fora RMSP ({hubGspCheck.distanceFromSpCenterKm}km)
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{hub.address} - CEP {hub.cep}</p>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400 font-semibold items-center">
                          <span>Lat: {hub.lat.toFixed(4)} | Lng: {hub.lng.toFixed(4)}</span>
                          {hub.phone && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">Tel: {hub.phone}</span>
                            </>
                          )}
                          {hub.email && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">Email: {hub.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {!hub.active && (
                        <button
                          onClick={() => onSetActiveHub(hub.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          title="Tornar Sede Ativa"
                        >
                          Ativar
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(hub)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar Sede"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteHub(hub.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Sede"
                        disabled={hub.active && hubs.length > 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Slide-over or Modal for creation/edition */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="hub-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
              id="hub-modal-content"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight font-sans">
                      {editingHub ? 'Editar Sede ViniMap' : 'Nova Sede ViniMap / Base Operacional'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Cadastre ou configure os detalhes operacionais de saída.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {warningMsg && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl flex items-start gap-2.5 text-xs font-semibold shadow-xs">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{warningMsg}</span>
                  </div>
                )}

                {/* Name, CNPJ & Email */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Nome da Sede ViniMap *</label>
                    <input
                      type="text"
                      placeholder="Ex: Vinimap CD São Paulo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">CNPJ (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 00.000.000/0001-00"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">E-mail (Opcional)</label>
                    <input
                      type="email"
                      placeholder="Ex: contato@hub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Phone & CEP */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <CepInput
                      label="CEP"
                      required
                      value={cep}
                      onChange={(formatted) => setCep(formatted)}
                      onAddressFound={(data) => {
                        const clean = (data.cep || '').replace(/\D/g, '');
                        if (clean.length === 8) {
                          handleSearchCep(clean);
                        }
                      }}
                      showAddressPreview={true}
                      size="md"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Telefone (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Address, Cidade & Estado */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Endereço Completo *</label>
                    <input
                      type="text"
                      placeholder="Ex: Avenida Paulista, 1000 - Bela Vista"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-xs font-bold text-slate-700">Cidade *</label>
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-xs font-bold text-slate-700">Estado *</label>
                    <input
                      type="text"
                      placeholder="UF"
                      maxLength={2}
                      value={estado}
                      onChange={(e) => setEstado(e.target.value.toUpperCase())}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Lat & Lng with Interactive Map Geolocation Picker */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-3xs" id="geolocation-field-container">
                  
                  {/* Top Bar with GPS & Map Expand Controls */}
                  <div className="col-span-1 md:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                        <Crosshair size={15} />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                          Campo de Geolocalização Operacional da Base
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Clique no mapa ou arraste o marcador azul para definir a posição no mapa.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleGetCurrentGpsLocation}
                        disabled={isGettingGps}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-[10px] rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs uppercase tracking-wider"
                        title="Capturar localização atual do dispositivo via GPS"
                      >
                        {isGettingGps ? <RefreshCw size={12} className="animate-spin" /> : <LocateFixed size={12} />}
                        <span>{isGettingGps ? 'Obtendo GPS...' : 'Usar GPS Atual'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMapExpanded(!isMapExpanded)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[10px] rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs uppercase tracking-wider"
                        title="Expandir visualização do mapa para ajuste fino de posição"
                      >
                        {isMapExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        <span>{isMapExpanded ? 'Reduzir Mapa' : 'Expandir Mapa'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Left Column: Lat & Lng Input Fields & Info */}
                  <div className="col-span-1 space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">Latitude *</label>
                        <span className="text-[9px] font-mono text-slate-400">[-90 a +90]</span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        value={latInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLatInput(val);
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) setLat(parsed);
                        }}
                        placeholder="Ex: -23.5385556"
                        required
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">Longitude *</label>
                        <span className="text-[9px] font-mono text-slate-400">[-180 a +180]</span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        value={lngInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLngInput(val);
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) setLng(parsed);
                        }}
                        placeholder="Ex: -46.70118"
                        required
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                      />
                    </div>

                    <div className="p-2.5 bg-blue-50/90 border border-blue-100 rounded-xl text-[10.5px] text-blue-900 leading-tight space-y-1">
                      <div className="flex items-center gap-1 font-extrabold text-blue-950">
                        <Info size={12} className="text-blue-600 shrink-0" />
                        <span>Definição Visual no Mapa:</span>
                      </div>
                      <p className="text-slate-600 font-medium">
                        Clique em qualquer ponto do mapa ao lado ou arraste o pino azul para definir a geolocalização precisa da base operacional.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Interactive Geolocation Map */}
                  <div className={`col-span-1 md:col-span-2 transition-all duration-300 ${isMapExpanded ? 'h-72 md:h-80' : 'h-48 md:h-52'}`}>
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-blue-200 relative shadow-sm bg-slate-100 z-10" id="interactive-map-picker-container">
                      <SafeMapWrapper>
                        <LeafletMapContainer
                          center={[lat || -23.5385556, lng || -46.70118]}
                          zoom={15}
                          scrollWheelZoom={true}
                          style={{ width: '100%', height: '100%' }}
                        >
                          <MiniMapController center={[lat || -23.5385556, lng || -46.70118]} />
                          <TileLayer
                            attribution='&copy; CARTO / OpenStreetMap'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                          />
                          {/* Interactive Marker that can be dragged or clicked */}
                          <InteractiveLocationPickerMarker
                            position={[lat, lng]}
                            onChangePosition={(newLat, newLng) => updateCoordinates(newLat, newLng)}
                          />
                        </LeafletMapContainer>
                      </SafeMapWrapper>

                      {/* Live Coordinates Overlay Pill */}
                      <div className="absolute bottom-2 right-2 bg-slate-900/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[9.5px] font-mono font-extrabold z-[500] shadow-md flex items-center gap-2">
                        <span className="text-emerald-400">Lat: {lat.toFixed(6)}</span>
                        <span className="text-sky-400">Lng: {lng.toFixed(6)}</span>
                      </div>
                    </div>
                  </div>

                  {isCeroCoraAddress(address, cep) && getCoordinateDiscrepancy(lat, lng) && (
                    <div className="col-span-1 md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold space-y-2 mt-1" id="form-coor-discrepancy-warning">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                        <p className="text-[11px] leading-relaxed text-amber-700 font-medium">
                          As coordenadas atuais não coincidem precisamente com o endereço 'Rua Cerro Corá, 385, Vila Romana, CEP 05061-050'. Deseja ajustar?
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateCoordinates(-23.5385556, -46.70118)}
                        className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider"
                        id="adjust-to-official-hub-btn"
                      >
                        <Sparkles size={11} />
                        <span>Ajustar para Sede Oficial (Vila Romana)</span>
                      </button>
                    </div>
                  )}

                  {/* Live Grande SP (RMSP) Geographic Validation Status */}
                  {(!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) && (() => {
                    const liveGspCheck = validateGreaterSpCoordinates(lat, lng);
                    return (
                      <div className="col-span-1 md:col-span-3 mt-1">
                        {liveGspCheck.isValidInGsp ? (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-[11px] font-medium flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span><strong>Validação Geográfica:</strong> Ponto situado na Grande São Paulo ({liveGspCheck.distanceFromSpCenterKm} km do centro da RMSP).</span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white font-extrabold text-[9px] rounded-md font-mono uppercase shrink-0">RMSP OK</span>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[11px] font-medium space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-bold text-amber-950">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0 animate-pulse" />
                                <span>Aviso de Localização Externa (Fora da Grande SP)</span>
                              </div>
                              <span className="px-2 py-0.5 bg-amber-600 text-white font-extrabold text-[9px] rounded-md font-mono uppercase shrink-0">Distante ({liveGspCheck.distanceFromSpCenterKm} km)</span>
                            </div>
                            <p className="text-[10.5px] text-amber-800 leading-relaxed">
                              As coordenadas inseridas estão a {liveGspCheck.distanceFromSpCenterKm} km do centro da Grande SP, ultrapassando os limites típicos da Região Metropolitana.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Importar Logotipo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 block">Logotipo da Sede</label>
                    <button
                      type="button"
                      onClick={() => setLogoUrl(vinimapLogo)}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                      title="Usar o mesmo logotipo do Aplicativo do Condutor Vinimap"
                    >
                      <Sparkles size={11} className="text-blue-600" />
                      <span>Usar Logo do Condutor (Vinimap)</span>
                    </button>
                  </div>
                  
                  {logoUrl ? (
                    <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <img 
                        src={logoUrl} 
                        alt="Preview Logo" 
                        className="w-16 h-16 rounded-lg object-contain bg-white border border-slate-100 p-0.5 shadow-sm"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                        }}
                      />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-700 block">Logotipo Vinipack / Sede</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLogoUrl(vinimapLogo)}
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                          >
                            Restaurar Logo Padrão
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 size={10} />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={triggerFileInput}
                      className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/10 space-y-2"
                    >
                      <Upload size={20} className="text-slate-400 mx-auto" />
                      <div className="text-xs text-slate-500">
                        <span className="font-bold text-blue-600">Clique para importar</span> o logotipo ou use o padrão do condutor
                      </div>
                      <p className="text-[10px] text-slate-400">PNG, JPG, SVG de até 2MB</p>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Active Hub checkbox */}
                <div className="flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="is-active-checkbox"
                    checked={isActive}
                    disabled={editingHub?.active && hubs.length > 1}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="is-active-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Definir esta Sede como o ponto de saída Ativa principal.
                  </label>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>{editingHub ? 'Salvar Alterações' : 'Cadastrar Sede'}</span>
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
