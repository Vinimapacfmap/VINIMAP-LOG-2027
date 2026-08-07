import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { db } from '../firebase';

export interface AppInitState {
  isInitializing: boolean;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  isFirebaseReady: boolean;
  isSupabaseReady: boolean;
  initError: string | null;
}

/**
 * Hook assíncrono para inicialização de serviços (Firebase, Supabase e Autenticação).
 * Previne bloqueios na renderização principal do aplicativo.
 */
export function useAppInitialization(): AppInitState {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const loggedOut = localStorage.getItem('vinimap_logged_out');
      if (loggedOut === 'true') return false;
      const localSession = localStorage.getItem('vinimap_admin_session');
      if (localSession === 'true') return true;
    }
    return false;
  });

  useEffect(() => {
    let isMounted = true;
    console.log('[useAppInitialization] Iniciando verificação e inicialização assíncrona dos serviços...');

    const initializeServices = async () => {
      try {
        // 1. Verificação assíncrona do Firebase Firestore (não-bloqueante)
        if (db) {
          if (isMounted) setIsFirebaseReady(true);
          console.log('[useAppInitialization] Instância do Firebase Firestore pronta.');
        } else {
          console.warn('[useAppInitialization] Firebase Firestore não está disponível.');
        }

        // 2. Verificação assíncrona do Supabase & Sessão de Autenticação
        if (isSupabaseConfigured && supabase) {
          if (isMounted) setIsSupabaseReady(true);
          console.log('[useAppInitialization] Supabase verificado. Checando sessão de usuário com timeout de segurança...');

          const loggedOut = localStorage.getItem('vinimap_logged_out');
          if (loggedOut === 'true') {
            if (isMounted) setIsAdminAuthenticated(false);
          } else {
            try {
              // Safety timeout for Supabase getSession (max 1.5s) to avoid blocking rendering on Vercel
              const sessionPromise = supabase.auth.getSession();
              const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null } }), 1500)
              );

              const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
              const hasLocalSession = localStorage.getItem('vinimap_admin_session') === 'true';
              if (isMounted) {
                if (session || hasLocalSession) {
                  setIsAdminAuthenticated(true);
                } else {
                  setIsAdminAuthenticated(false);
                }
              }
            } catch (authErr) {
              console.warn('[useAppInitialization] Aviso ao consultar sessão Supabase:', authErr);
              const hasLocalSession = localStorage.getItem('vinimap_admin_session') === 'true';
              if (isMounted) {
                setIsAdminAuthenticated(hasLocalSession);
              }
            }
          }
        } else {
          console.log('[useAppInitialization] Supabase não configurado. Utilizando autenticação/banco local/Firebase.');
          const loggedOut = localStorage.getItem('vinimap_logged_out');
          const localSession = localStorage.getItem('vinimap_admin_session') === 'true';
          if (isMounted) {
            setIsSupabaseReady(false);
            if (loggedOut === 'true') {
              setIsAdminAuthenticated(false);
            } else {
              setIsAdminAuthenticated(localSession);
            }
          }
        }
      } catch (err) {
        console.error('[useAppInitialization] Falha ao inicializar serviços:', err);
        if (isMounted) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
          console.log('[useAppInitialization] Inicialização de serviços finalizada com sucesso.');
        }
      }
    };

    // Executa a inicialização assíncrona sem interromper o fluxo de renderização
    initializeServices();

    // Registra listener do Supabase Auth caso configurado
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return;
          const isOut = localStorage.getItem('vinimap_logged_out') === 'true';
          const hasLocalSession = localStorage.getItem('vinimap_admin_session') === 'true';

          if (_event === 'SIGNED_OUT' && !hasLocalSession) {
            setIsAdminAuthenticated(false);
          } else if (isOut) {
            setIsAdminAuthenticated(false);
          } else if (session || hasLocalSession) {
            localStorage.removeItem('vinimap_logged_out');
            localStorage.setItem('vinimap_admin_session', 'true');
            setIsAdminAuthenticated(true);
          }
        });
        authSubscription = data.subscription;
      } catch (e) {
        console.warn('[useAppInitialization] Erro ao registrar escutador do Supabase Auth:', e);
      }
    }

    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  return {
    isInitializing,
    isAdminAuthenticated,
    setIsAdminAuthenticated,
    isFirebaseReady,
    isSupabaseReady,
    initError
  };
}
