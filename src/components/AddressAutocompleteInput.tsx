/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Search, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  Building2, 
  Navigation,
  X
} from 'lucide-react';
import { 
  searchCepByAddress, 
  fetchAddressSuggestions, 
  AddressLookupResult, 
  AddressSuggestionItem 
} from '../utils/addressLookupService';

export interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onCepFound?: (result: AddressLookupResult) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  isTextarea?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
  defaultCity?: string;
  defaultState?: string;
  showCepBadge?: boolean;
  showSuggestions?: boolean;
  id?: string;
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  onCepFound,
  label = 'Endereço / Logradouro',
  placeholder = 'Digite a rua, avenida, número e bairro...',
  required = false,
  disabled = false,
  isTextarea = false,
  rows = 2,
  className = '',
  inputClassName = '',
  defaultCity = 'São Paulo',
  defaultState = 'SP',
  showCepBadge = true,
  showSuggestions = true,
  id = 'address-autocomplete-field'
}: AddressAutocompleteInputProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [lastFoundResult, setLastFoundResult] = useState<AddressLookupResult | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestionItem[]>([]);
  const [isOpenSuggestions, setIsOpenSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueriedAddressRef = useRef<string>('');

  // Perform CEP search based on address text
  const performLookup = async (text: string, isManual = false) => {
    const trimmed = (text || '').trim();
    if (trimmed.length < 4) {
      setSuggestions([]);
      setIsOpenSuggestions(false);
      return;
    }

    if (lastQueriedAddressRef.current === trimmed && !isManual) {
      return;
    }
    lastQueriedAddressRef.current = trimmed;

    setIsSearching(true);

    try {
      // 1. Fetch direct CEP result
      const lookup = await searchCepByAddress(trimmed, defaultCity, defaultState);
      if (lookup && lookup.cep) {
        setLastFoundResult(lookup);
        if (onCepFound) {
          onCepFound(lookup);
        }
      }

      // 2. Fetch multi-suggestions for dropdown if enabled
      if (showSuggestions) {
        const items = await fetchAddressSuggestions(trimmed, defaultCity, defaultState);
        setSuggestions(items);
        if (items.length > 0) {
          setIsOpenSuggestions(true);
        }
      }
    } catch (e) {
      console.warn('[AddressAutocompleteInput] lookup error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced effect on typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value && value.trim().length >= 4) {
      debounceTimerRef.current = setTimeout(() => {
        performLookup(value);
      }, 500);
    } else {
      setSuggestions([]);
      setIsOpenSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, defaultCity, defaultState]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpenSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectSuggestion = (item: AddressSuggestionItem) => {
    const fullAddress = `${item.logradouro}${item.bairro ? ` - ${item.bairro}` : ''}, ${item.localidade} - ${item.uf}`;
    onChange(fullAddress);
    setIsOpenSuggestions(false);
    setSuggestions([]);

    const lookupRes: AddressLookupResult = {
      cep: item.cep,
      cleanCep: item.cep.replace(/\D/g, ''),
      logradouro: item.logradouro,
      bairro: item.bairro,
      localidade: item.localidade,
      uf: item.uf,
      region: item.region,
      formattedAddress: fullAddress,
      lat: item.lat,
      lng: item.lng,
      source: 'viacep'
    };

    setLastFoundResult(lookupRes);
    if (onCepFound) {
      onCepFound(lookupRes);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpenSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && suggestions[selectedIndex]) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpenSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[10px] font-medium text-blue-600 flex items-center gap-1">
            <Sparkles size={11} className="text-amber-500 animate-pulse" />
            Auto-completa CEP
          </span>
        </div>
      )}

      <div className="relative group">
        <MapPin 
          size={14} 
          className={`absolute left-3 ${isTextarea ? 'top-3' : 'top-1/2 -translate-y-1/2'} text-slate-400 group-focus-within:text-blue-500 transition-colors z-10`} 
        />

        {isTextarea ? (
          <textarea
            id={id}
            rows={rows}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => performLookup(value, true)}
            onKeyDown={handleKeyDown}
            className={`w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all resize-none ${inputClassName}`}
          />
        ) : (
          <input
            id={id}
            type="text"
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => performLookup(value, true)}
            onKeyDown={handleKeyDown}
            className={`w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all ${inputClassName}`}
          />
        )}

        {/* Right Status Indicator */}
        <div className={`absolute right-3 ${isTextarea ? 'top-3' : 'top-1/2 -translate-y-1/2'} flex items-center gap-1.5 z-10`}>
          {isSearching ? (
            <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
              <Loader2 size={11} className="animate-spin text-blue-600" />
              <span>CEP...</span>
            </div>
          ) : lastFoundResult ? (
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
              <CheckCircle2 size={11} className="text-emerald-600" />
              <span>{lastFoundResult.cep}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Auto-completed CEP badge / confirmation strip */}
      {showCepBadge && lastFoundResult && (
        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1 text-[10px] text-emerald-800 animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            <span>
              <strong>CEP Auto-identificado:</strong> <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-emerald-300 text-emerald-900">{lastFoundResult.cep}</span>
              {lastFoundResult.bairro && <span className="text-emerald-700 ml-1.5 font-medium">({lastFoundResult.bairro} - {lastFoundResult.localidade})</span>}
            </span>
          </div>
          {lastFoundResult.region && (
            <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
              {lastFoundResult.region}
            </span>
          )}
        </div>
      )}

      {/* Interactive suggestions dropdown */}
      {isOpenSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles size={10} className="text-blue-500" />
              Endereços & CEPs Encontrados (Clique para auto-preencher)
            </span>
            <button 
              type="button" 
              onClick={() => setIsOpenSuggestions(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={12} />
            </button>
          </div>

          {suggestions.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2.5 transition-colors ${
                selectedIndex === idx ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="p-1 bg-blue-100 rounded-lg text-blue-600 mt-0.5 shrink-0">
                <Navigation size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{item.logradouro}</span>
                  <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                    CEP {item.cep}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                  {item.bairro && <span>{item.bairro}</span>}
                  {item.bairro && <span>•</span>}
                  <span>{item.localidade} - {item.uf}</span>
                  {item.region && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-slate-500">{item.region}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
