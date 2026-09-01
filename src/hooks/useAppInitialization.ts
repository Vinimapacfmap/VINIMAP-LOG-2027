import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { db } from '../firebase';

export interface AppInitState {
  isInitializing: boolean;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  isFirebaseReady: boolean;
  isSupabaseReady: boolean;
  isNetworkHealthy: boolean;
  networkHealthError: string | null;
  initError: string | null;
}

/**
 * Hook assíncrono para inicialização de serviços (Firebase, Supabase e Autenticação).
 * Realiza health check de rede antes de conectar aos serviços externos para evitar telas em branco.
 */
export function useAppInitialization(): AppInitState {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [isNetworkHealthy, setIsNetworkHealthy] = useState(true);
  const [networkHealthError, setNetworkHealthError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isExplicitLogin = 
        params.get('login') === '1' ||
        params.get('login') === 'true' ||
        params.get('view') === 'login' ||
        params.get('view') === 'admin_login' ||
        params.get('admin') === 'login' ||
        params.get('mode') === 'login' ||
        window.location.hash === '#login';

      if (isExplicitLogin) {
        sessionStorage.removeItem('vinimap_admin_session');
        localStorage.removeItem('vinimap_admin_session');
        return false;
      }

      const loggedOut = localStorage.getItem('vinimap_logged_out');
      if (loggedOut === 'true') return false;

      // Only authenticated if active tab session explicitly has session token
      return sessionStorage.getItem('vinimap_admin_session') === 'true';
    }
    return false;
  });

  useEffect(() => {
    let isMounted = true;
    const startTime = performance.now();
    console.log('[useAppInitialization] [START] Iniciando verificação de saúde de rede e serviços...', {
      timestamp: new Date().toISOString()
    });

    const initializeServices = async () => {
      try {
        // 0. Health Check de Rede Prévia (evita travamentos se offline ou instável)
        const isOnlineNavigator = typeof navigator !== 'undefined' ? navigator.onLine : true;
        let pingSuccess = false;

        if (isOnlineNavigator) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch('/manifest.json', { 
              method: 'HEAD', 
              signal: controller.signal,
              cache: 'no-store'
            }).catch(() => null);
            clearTimeout(timeoutId);

            if (response && (response.ok || response.status < 500)) {
              pingSuccess = true;
            }
          } catch (_) {
            pingSuccess = false;
          }
        }

        const healthy = isOnlineNavigator && (pingSuccess || isOnlineNavigator);
        if (isMounted) {
          setIsNetworkHealthy(healthy);
          if (!healthy) {
            setNetworkHealthError('Conexão de rede limitada ou offline. A aplicação está operando com dados locais salvos.');
            console.warn('[useAppInitialization] [HEALTH CHECK WARN] Dispositivo offline ou servidor inacessível.');
          }
        }

        // 1. Verificação assíncrona do Firebase Firestore (não-bloqueante)
        console.log('[useAppInitialization] [FIREBASE INIT START]', {
          timestamp: new Date().toISOString(),
          dbAvailable: Boolean(db)
        });

        if (db) {
          if (isMounted) setIsFirebaseReady(true);
          console.log('[useAppInitialization] [FIREBASE INIT END] Instância do Firebase Firestore pronta.', {
            timestamp: new Date().toISOString()
          });
        } else {
          console.warn('[useAppInitialization] [FIREBASE INIT WARN] Firebase Firestore não está disponível.');
        }

        // 2. Verificação assíncrona do Supabase & Sessão de Autenticação
        console.log('[useAppInitialization] [SUPABASE INIT START]', {
          timestamp: new Date().toISOString(),
          isSupabaseConfigured,
          hasSupabaseClient: Boolean(supabase)
        });

        if (isSupabaseConfigured && supabase) {
          if (isMounted) setIsSupabaseReady(true);
          console.log('[useAppInitialization] [SUPABASE SESSION START] Checando sessão de usuário com timeout de segurança (1.5s)...', {
            timestamp: new Date().toISOString()
          });

          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
          const isExplicitLoginReq = 
            urlParams.get('login') === '1' ||
            urlParams.get('login') === 'true' ||
            urlParams.get('view') === 'login' ||
            urlParams.get('view') === 'admin_login' ||
            urlParams.get('admin') === 'login' ||
            urlParams.get('mode') === 'login' ||
            (typeof window !== 'undefined' && window.location.hash === '#login');

          const loggedOut = localStorage.getItem('vinimap_logged_out');
          if (loggedOut === 'true' || isExplicitLoginReq) {
            console.log('[useAppInitialization] [SUPABASE SESSION END] Login explícito ou usuário deslogado.');
            if (isMounted) setIsAdminAuthenticated(false);
          } else {
            try {
              let didTimeout = false;
              const sessionPromise = supabase.auth.getSession()
                .then((res) => ({ type: 'session' as const, res }))
                .catch((err) => {
                  console.warn('[useAppInitialization] [SUPABASE SESSION ERR] Rejeição na consulta de sessão:', err);
                  return { type: 'error' as const, err };
                });

              const timeoutPromise = new Promise<{ type: 'timeout' }>((resolve) =>
                setTimeout(() => {
                  didTimeout = true;
                  resolve({ type: 'timeout' });
                }, 1500)
              );

              const raceResult = await Promise.race([sessionPromise, timeoutPromise]);

              if (raceResult.type === 'timeout') {
                console.warn('[useAppInitialization] [SUPABASE SESSION TIMEOUT] A chamada supabase.auth.getSession() excedeu 1.5s e acionou timeout de segurança para não travar a UI.', {
                  timestamp: new Date().toISOString()
                });
                const hasLocalSession = sessionStorage.getItem('vinimap_admin_session') === 'true';
                if (isMounted) setIsAdminAuthenticated(hasLocalSession);
              } else if (raceResult.type === 'error') {
                console.warn('[useAppInitialization] [SUPABASE SESSION FAIL] Erro de rede ao buscar sessão Supabase.', raceResult.err);
                const hasLocalSession = sessionStorage.getItem('vinimap_admin_session') === 'true';
                if (isMounted) setIsAdminAuthenticated(hasLocalSession);
              } else {
                const session = raceResult.res.data.session;
                const hasLocalSession = sessionStorage.getItem('vinimap_admin_session') === 'true';
                console.log('[useAppInitialization] [SUPABASE SESSION END] Sessão consultada com sucesso:', {
                  timestamp: new Date().toISOString(),
                  hasRemoteSession: Boolean(session),
                  hasLocalSession,
                  didTimeout
                });

                if (isMounted) {
                  setIsAdminAuthenticated(Boolean((session && hasLocalSession) || hasLocalSession));
                }
              }
            } catch (authErr) {
              console.warn('[useAppInitialization] [SUPABASE SESSION CATCH] Exceção geral ao consultar sessão Supabase:', authErr);
              const hasLocalSession = sessionStorage.getItem('vinimap_admin_session') === 'true';
              if (isMounted) {
                setIsAdminAuthenticated(hasLocalSession);
              }
            }
          }
        } else {
          console.log('[useAppInitialization] [SUPABASE INIT SKIP] Supabase não configurado. Utilizando autenticação/banco local/Firebase.');
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
          const isExplicitLoginReq = 
            urlParams.get('login') === '1' ||
            urlParams.get('login') === 'true' ||
            urlParams.get('view') === 'login' ||
            urlParams.get('view') === 'admin_login' ||
            urlParams.get('admin') === 'login' ||
            urlParams.get('mode') === 'login' ||
            (typeof window !== 'undefined' && window.location.hash === '#login');

          const loggedOut = localStorage.getItem('vinimap_logged_out');
          const localSession = sessionStorage.getItem('vinimap_admin_session') === 'true';
          if (isMounted) {
            setIsSupabaseReady(false);
            if (loggedOut === 'true' || isExplicitLoginReq) {
              setIsAdminAuthenticated(false);
            } else {
              setIsAdminAuthenticated(localSession);
            }
          }
        }
      } catch (err) {
        console.error('[useAppInitialization] [INIT EXCEPTION] Falha ao inicializar serviços:', err);
        if (isMounted) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        const duration = Math.round(performance.now() - startTime);
        if (isMounted) {
          setIsInitializing(false);
          console.log(`[useAppInitialization] [FINISH] Inicialização de serviços concluída em ${duration}ms.`, {
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    // Executa a inicialização assíncrona sem interromper o fluxo de renderização
    initializeServices();

    // Registra listener do Supabase Auth caso configurado
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      console.log('[useAppInitialization] [SUPABASE AUTH LISTENER START] Registrando listener onAuthStateChange...');
      try {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return;
          console.log('[useAppInitialization] [SUPABASE AUTH EVENT]', {
            event: _event,
            hasSession: Boolean(session),
            timestamp: new Date().toISOString()
          });
          const isOut = localStorage.getItem('vinimap_logged_out') === 'true';
          const hasLocalSession = sessionStorage.getItem('vinimap_admin_session') === 'true';

          if (_event === 'SIGNED_OUT' && !hasLocalSession) {
            setIsAdminAuthenticated(false);
          } else if (isOut) {
            setIsAdminAuthenticated(false);
          } else if (session && hasLocalSession) {
            localStorage.removeItem('vinimap_logged_out');
            sessionStorage.setItem('vinimap_admin_session', 'true');
            setIsAdminAuthenticated(true);
          }
        });
        authSubscription = data.subscription;
        console.log('[useAppInitialization] [SUPABASE AUTH LISTENER READY] Listener ativo.');
      } catch (e) {
        console.warn('[useAppInitialization] [SUPABASE AUTH LISTENER ERR] Erro ao registrar escutador do Supabase Auth:', e);
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
    isNetworkHealthy,
    networkHealthError,
    initError
  };
}
