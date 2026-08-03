import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Validates whether a string is a valid HTTP or HTTPS URL.
 */
function isValidHttpUrl(urlString?: string | null): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (
    !trimmed || 
    trimmed === 'undefined' || 
    trimmed === 'null' || 
    trimmed.includes('your-project-id') || 
    trimmed.includes('YOUR_SUPABASE_URL') || 
    trimmed.includes('placeholder')
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function isValidAnonKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return (
    trimmed !== '' &&
    trimmed !== 'undefined' &&
    trimmed !== 'null' &&
    !trimmed.includes('your-anon-key') &&
    !trimmed.includes('YOUR_SUPABASE') &&
    !trimmed.includes('placeholder')
  );
}

// Retrieve environment variables safely across environments (Node process.env, Vite import.meta.env, window.localStorage)
const getRawSupabaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem('SUPABASE_URL');
      if (stored && isValidHttpUrl(stored)) {
        return stored.trim();
      }
    } catch (_) {}
  }
  if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL && isValidHttpUrl(process.env.SUPABASE_URL)) {
    return process.env.SUPABASE_URL.trim();
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL && isValidHttpUrl((import.meta as any).env.VITE_SUPABASE_URL)) {
    return (import.meta as any).env.VITE_SUPABASE_URL.trim();
  }
  return '';
};

const getRawSupabaseKey = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem('SUPABASE_ANON_KEY');
      if (stored && isValidAnonKey(stored)) {
        return stored.trim();
      }
    } catch (_) {}
  }
  if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY && isValidAnonKey(process.env.SUPABASE_ANON_KEY)) {
    return process.env.SUPABASE_ANON_KEY.trim();
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_ANON_KEY && isValidAnonKey((import.meta as any).env.VITE_SUPABASE_ANON_KEY)) {
    return (import.meta as any).env.VITE_SUPABASE_ANON_KEY.trim();
  }
  return '';
};

const rawUrl = getRawSupabaseUrl();
const rawAnonKey = getRawSupabaseKey();

export const supabaseUrl = isValidHttpUrl(rawUrl) ? rawUrl.trim() : '';
export const supabaseAnonKey = (rawAnonKey && rawAnonKey !== 'undefined' && rawAnonKey !== 'null' && !rawAnonKey.includes('your-anon-key')) ? rawAnonKey.trim() : '';

// Check if valid keys are configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function createCustomSupabaseClient(url: string, key: string): SupabaseClient | null {
  if (!isValidHttpUrl(url) || !key || key.trim() === '' || key.includes('your-anon-key')) {
    return null;
  }
  try {
    return createClient(url.trim(), key.trim());
  } catch (err) {
    console.warn('Failed to create custom Supabase client:', err);
    return null;
  }
}

// Safely initialize the default Supabase client or null if not configured
let clientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  clientInstance = createCustomSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = clientInstance;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase integration: SUPABASE_URL or SUPABASE_ANON_KEY is missing or invalid. ' +
    'The app will run using Firebase/local state and offer synchronization in the admin panel.'
  );
}

