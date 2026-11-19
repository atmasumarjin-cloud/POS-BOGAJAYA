import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { StoreProvider } from './context/StoreContext.tsx';
import './index.css';

// Google Maps Platform Demo Key Specialization (Tier-1 early failure & quota listeners)
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  try {
    const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (/OverQuotaMapError|QuotaExceededError|RefererNotAllowedMapError|ApiNotActivatedMapError/i.test(joined)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  } catch {
    // ignore serialization error
  }
  origConsoleError(...args);
};

window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>
);
