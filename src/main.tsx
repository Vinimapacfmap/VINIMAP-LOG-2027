import './utils/leafletPatch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

console.log('[ViniMap main.tsx] Inicializando aplicação ViniMap (Vercel Production Mode)...');

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[ViniMap Global Async Safety] Uncaught promise rejection:', event.reason);
  });
  
  // Limpa o sinalizador de recarregamento caso o aplicativo tenha carregado com sucesso
  setTimeout(() => {
    sessionStorage.removeItem('vinimap_reloaded_for_chunk_error');
  }, 1000);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[ViniMap main.tsx] Erro crítico: Elemento #root não encontrado no DOM!');
} else {
  // Assegura que o container do React esteja completamente limpo para evitar erros de hidratação (#418/#419)
  rootElement.innerHTML = '';
  
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (mountErr) {
    console.error('[ViniMap main.tsx] Exceção ao montar aplicação:', mountErr);
    if ((window as any).__vinimapPurgeCachesAndReload) {
      (window as any).__vinimapPurgeCachesAndReload();
    }
  }
}


