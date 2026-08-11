import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2, X, Search } from 'lucide-react';

export interface ViaCepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

export interface CepInputProps {
  value: string;
  onChange: (formattedValue: string, rawDigits: string) => void;
  onAddressFound?: (data: ViaCepData) => void;
  onError?: (errorMessage: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  autoLookup?: boolean;
  showAddressPreview?: boolean;
  showStatusIcons?: boolean;
  customError?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
}

/**
 * Format raw string or numbers into CEP format "00000-000"
 */
export function formatCep(value: string | number): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Check if CEP digits form a complete 8-digit CEP
 */
export function isValidCep(value: string): boolean {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 8;
}

// In-memory cache to avoid duplicate network calls
const viaCepCache = new Map<string, ViaCepData>();

export async function fetchViaCep(rawDigits: string): Promise<ViaCepData> {
  const clean = rawDigits.replace(/\D/g, '');
  if (clean.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos.');
  }

  if (viaCepCache.has(clean)) {
    const cached = viaCepCache.get(clean)!;
    if (cached.erro) throw new Error('CEP não encontrado.');
    return cached;
  }

  const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!response.ok) {
    throw new Error('Falha na consulta ao serviço ViaCEP.');
  }

  const data: ViaCepData = await response.json();
  if (data.erro) {
    viaCepCache.set(clean, data);
    throw new Error('CEP não encontrado na base de dados.');
  }

  viaCepCache.set(clean, data);
  return data;
}

export default function CepInput({
  value,
  onChange,
  onAddressFound,
  onError,
  label = 'CEP',
  placeholder = '00000-000',
  required = false,
  disabled = false,
  autoFocus = false,
  autoLookup = true,
  showAddressPreview = true,
  showStatusIcons = true,
  customError,
  className = '',
  inputClassName = '',
  size = 'md',
  id = 'cep-input-field'
}: CepInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [addressData, setAddressData] = useState<ViaCepData | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  
  const lastFetchedCepRef = useRef<string>('');

  const rawDigits = (value || '').replace(/\D/g, '').slice(0, 8);
  const formattedValue = formatCep(rawDigits);

  // Sync value formatting if caller gives unformatted value
  useEffect(() => {
    if (value && value !== formattedValue) {
      onChange(formattedValue, rawDigits);
    }
  }, [value, formattedValue, rawDigits, onChange]);

  // Execute lookup when 8 digits are entered
  useEffect(() => {
    if (!autoLookup) return;

    if (rawDigits.length === 8) {
      if (lastFetchedCepRef.current === rawDigits) {
        return;
      }
      
      lastFetchedCepRef.current = rawDigits;
      setIsSearching(true);
      setLocalError(null);
      if (onError) onError(null);

      fetchViaCep(rawDigits)
        .then((data) => {
          setAddressData(data);
          setLocalError(null);
          if (onAddressFound) onAddressFound(data);
          if (onError) onError(null);
        })
        .catch((err: Error) => {
          setAddressData(null);
          const errorMsg = err.message || 'CEP não encontrado';
          setLocalError(errorMsg);
          if (onError) onError(errorMsg);
        })
        .finally(() => {
          setIsSearching(false);
        });
    } else {
      lastFetchedCepRef.current = '';
      setAddressData(null);
      if (rawDigits.length === 0) {
        setLocalError(null);
        if (onError) onError(null);
      } else if (isTouched && rawDigits.length > 0 && rawDigits.length < 8) {
        const msg = `CEP incompleto (${rawDigits.length}/8 dígitos)`;
        setLocalError(msg);
        if (onError) onError(msg);
      }
    }
  }, [rawDigits, autoLookup, isTouched]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const cleanDigits = inputVal.replace(/\D/g, '').slice(0, 8);
    const masked = formatCep(cleanDigits);
    
    setIsTouched(true);
    if (localError && cleanDigits.length === 0) {
      setLocalError(null);
      if (onError) onError(null);
    }
    onChange(masked, cleanDigits);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setIsTouched(true);
    if (rawDigits.length > 0 && rawDigits.length < 8) {
      const msg = 'CEP incompleto (deve conter 8 dígitos)';
      setLocalError(msg);
      if (onError) onError(msg);
    }
  };

  const handleClear = () => {
    lastFetchedCepRef.current = '';
    setAddressData(null);
    setLocalError(null);
    setIsTouched(false);
    if (onError) onError(null);
    onChange('', '');
  };

  const activeError = customError || (isTouched || rawDigits.length === 8 ? localError : null);

  // Size styling maps
  const sizeClasses = {
    sm: 'py-1 px-2.5 text-xs rounded-lg',
    md: 'py-2 px-3 text-xs rounded-xl',
    lg: 'py-2.5 px-3.5 text-sm rounded-xl'
  };

  const iconSizes = {
    sm: 13,
    md: 15,
    lg: 18
  };

  const currentIconSize = iconSizes[size];

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`} id={`${id}-wrapper`}>
      {label && (
        <div className="flex justify-between items-center">
          <label htmlFor={id} className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          
          {/* Real-time status indicator tag */}
          {rawDigits.length > 0 && rawDigits.length < 8 && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              {rawDigits.length}/8 dígitos
            </span>
          )}
          {isSearching && (
            <span className="text-[10px] font-bold text-blue-600 animate-pulse flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Consultando ViaCEP...
            </span>
          )}
          {rawDigits.length === 8 && !isSearching && !activeError && addressData && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 size={10} /> Valido
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center w-full">
        <MapPin 
          size={currentIconSize} 
          className={`absolute left-3 pointer-events-none transition-colors ${
            activeError 
              ? 'text-rose-500' 
              : addressData 
                ? 'text-emerald-500' 
                : isFocused 
                  ? 'text-blue-600' 
                  : 'text-slate-400'
          }`} 
        />

        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={placeholder}
          value={formattedValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={9}
          className={`w-full pl-9 ${rawDigits ? 'pr-16' : 'pr-8'} ${sizeClasses[size]} font-mono font-bold tracking-wider bg-white border transition-all outline-none ${
            activeError
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900 bg-rose-50/30'
              : addressData
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900'
                : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800'
          } ${disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''} ${inputClassName}`}
        />

        {/* Status icon / Clear action */}
        <div className="absolute right-2.5 flex items-center gap-1">
          {showStatusIcons && (
            <>
              {isSearching && (
                <Loader2 size={currentIconSize} className="text-blue-500 animate-spin" />
              )}
              {!isSearching && activeError && (
                <AlertCircle size={currentIconSize} className="text-rose-500" />
              )}
              {!isSearching && !activeError && addressData && (
                <CheckCircle2 size={currentIconSize} className="text-emerald-500" />
              )}
            </>
          )}

          {formattedValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
              title="Limpar CEP"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Error feedback message */}
      {activeError && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-0.5 animate-fadeIn">
          <AlertCircle size={11} className="shrink-0" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Address preview badge when CEP is found */}
      {showAddressPreview && addressData && !activeError && (
        <div className="flex items-start gap-1.5 p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 mt-0.5 animate-fadeIn">
          <MapPin size={13} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">
              {addressData.logradouro ? `${addressData.logradouro}, ` : ''}
              {addressData.bairro || ''}
            </p>
            <p className="text-[10px] text-emerald-700 font-medium">
              {addressData.localidade} - {addressData.uf} {addressData.ddd ? `(DDD ${addressData.ddd})` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
