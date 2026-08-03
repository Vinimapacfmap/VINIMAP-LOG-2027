import './utils/leafletPatch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enforce America/Sao_Paulo timezone for all Intl and Date formatting operations across the system
const OriginalDateTimeFormat = Intl.DateTimeFormat;
// @ts-ignore
const CustomDateTimeFormat = function (this: any, locale?: string | string[], options?: any) {
  const mergedOptions = { timeZone: 'America/Sao_Paulo', ...options };
  if (new.target) {
    return Reflect.construct(OriginalDateTimeFormat, [locale, mergedOptions], new.target);
  }
  return OriginalDateTimeFormat(locale, mergedOptions);
};
// Copy prototype and static properties to maintain 100% transparency
CustomDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
Object.setPrototypeOf(CustomDateTimeFormat, OriginalDateTimeFormat);
// @ts-ignore
Intl.DateTimeFormat = CustomDateTimeFormat;

const originalToLocaleString = Date.prototype.toLocaleString;
// @ts-ignore
Date.prototype.toLocaleString = function(this: Date, locales?: any, options?: any) {
  return originalToLocaleString.call(this, locales || 'pt-BR', { timeZone: 'America/Sao_Paulo', ...options });
};

const originalToLocaleDateString = Date.prototype.toLocaleDateString;
// @ts-ignore
Date.prototype.toLocaleDateString = function(this: Date, locales?: any, options?: any) {
  return originalToLocaleDateString.call(this, locales || 'pt-BR', { timeZone: 'America/Sao_Paulo', ...options });
};

const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
// @ts-ignore
Date.prototype.toLocaleTimeString = function(this: Date, locales?: any, options?: any) {
  return originalToLocaleTimeString.call(this, locales || 'pt-BR', { timeZone: 'America/Sao_Paulo', ...options });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
