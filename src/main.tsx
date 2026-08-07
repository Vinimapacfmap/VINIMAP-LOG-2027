import './utils/leafletPatch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

console.log('[ViniMap main.tsx] Inicializando aplicação ViniMap...');

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


