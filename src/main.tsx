import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

console.log('[ViniMap] Iniciando aplicação...');

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn(
      '[ViniMap] Promise rejeitada:',
      event.reason
    );
  });

  window.addEventListener('error', (event) => {
    console.error(
      '[ViniMap] Erro global:',
      event.error || event.message
    );
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error(
    '[ViniMap] Erro crítico: elemento #root não encontrado.'
  );
} else {
  import('./utils/leafletPatch')
    .then(() => {
      console.log('[ViniMap] LeafletPatch carregado.');
    })
    .catch((error) => {
      console.warn(
        '[ViniMap] LeafletPatch não pôde ser carregado. A aplicação continuará:',
        error
      );
    });

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
