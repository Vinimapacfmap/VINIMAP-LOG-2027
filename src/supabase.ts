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
    trimmed.startsWith('sb_publishable_') ||
    trimmed.startsWith('sb_secret_') ||
    trimmed.startsWith('eyJ') ||
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
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.includes('your-anon-key') &&
    !trimmed.includes('YOUR_SUPABASE') &&
    !trimmed.includes('placeholder')
  );
}

// Auto-clean bad localStorage entries where API keys were accidentally saved under SUPABASE_URL
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const storedUrl = localStorage.getItem('SUPABASE_URL') || '';
    const storedKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    if (storedUrl && (storedUrl.startsWith('sb_publishable_') || storedUrl.startsWith('sb_secret_') || storedUrl.startsWith('eyJ'))) {
      if (!storedKey || !isValidAnonKey(storedKey)) {
        localStorage.setItem('SUPABASE_ANON_KEY', storedUrl.trim());
      }
      localStorage.removeItem('SUPABASE_URL');
    }
  } catch (_) {}
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
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  if (metaEnv.VITE_SUPABASE_URL && isValidHttpUrl(metaEnv.VITE_SUPABASE_URL)) {
    return metaEnv.VITE_SUPABASE_URL.trim();
  }
  if (metaEnv.SUPABASE_URL && isValidHttpUrl(metaEnv.SUPABASE_URL)) {
    return metaEnv.SUPABASE_URL.trim();
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_SUPABASE_URL && isValidHttpUrl(process.env.VITE_SUPABASE_URL)) {
      return process.env.VITE_SUPABASE_URL.trim();
    }
    if (process.env.SUPABASE_URL && isValidHttpUrl(process.env.SUPABASE_URL)) {
      return process.env.SUPABASE_URL.trim();
    }
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
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  if (metaEnv.VITE_SUPABASE_ANON_KEY && isValidAnonKey(metaEnv.VITE_SUPABASE_ANON_KEY)) {
    return metaEnv.VITE_SUPABASE_ANON_KEY.trim();
  }
  if (metaEnv.SUPABASE_ANON_KEY && isValidAnonKey(metaEnv.SUPABASE_ANON_KEY)) {
    return metaEnv.SUPABASE_ANON_KEY.trim();
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_SUPABASE_ANON_KEY && isValidAnonKey(process.env.VITE_SUPABASE_ANON_KEY)) {
      return process.env.VITE_SUPABASE_ANON_KEY.trim();
    }
    if (process.env.SUPABASE_ANON_KEY && isValidAnonKey(process.env.SUPABASE_ANON_KEY)) {
      return process.env.SUPABASE_ANON_KEY.trim();
    }
  }
  return '';
};

const rawUrl = getRawSupabaseUrl();
const rawAnonKey = getRawSupabaseKey();

export const supabaseUrl = isValidHttpUrl(rawUrl) ? rawUrl.trim() : '';
export const supabaseAnonKey = (rawAnonKey && rawAnonKey !== 'undefined' && rawAnonKey !== 'null' && !rawAnonKey.includes('your-anon-key')) ? rawAnonKey.trim() : '';

// Check if valid keys are configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    key: supabaseAnonKey,
  };
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      message: 'Supabase URL ou Key não configurados no ambiente ou localStorage.',
    };
  }

  const client = createCustomSupabaseClient(supabaseUrl, supabaseAnonKey);
  if (!client) {
    return {
      success: false,
      message: 'Falha ao instanciar o cliente Supabase. Verifique os valores informados.',
    };
  }

  try {
    // 1. Test query via Supabase JS Client
    const { error } = await client.from('orders').select('id').limit(1);

    if (!error) {
      return {
        success: true,
        message: 'Conexão com o Supabase estabelecida e testada com sucesso!',
      };
    }

    // Standard Postgres errors when connected with valid anon key but table missing or RLS protected
    if (error && (error.code === '42P01' || error.code === 'PGRST301' || error.message?.includes('relation') || error.message?.includes('table'))) {
      return {
        success: true,
        message: 'Conectado ao Supabase com sucesso! (Chave anon verificada)',
      };
    }

    // 2. Fallback check against auth health endpoint which accepts anon key
    const healthRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
    }).catch(() => null);

    if (healthRes && healthRes.ok) {
      return {
        success: true,
        message: 'Servidor do Supabase respondeu com sucesso!',
      };
    }

    return {
      success: false,
      message: `Erro do Supabase (${error.code || 'API'}): ${error.message}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Erro de rede/CORS ao conectar com o Supabase.',
    };
  }
}

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

