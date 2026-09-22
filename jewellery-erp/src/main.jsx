import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/Auth';
import { ToastProvider } from './context/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

async function start() {
  // Demo mode (npm run demo): in-memory Firebase pre-filled with a sample shop.
  if (import.meta.env.VITE_DEMO) await (await import('./demo/seed')).seedDemo();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

start();
