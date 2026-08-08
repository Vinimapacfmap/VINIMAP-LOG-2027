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
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[ViniMap main.tsx] Erro crítico: Elemento #root não encontrado no DOM!');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}


