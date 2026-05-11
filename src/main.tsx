import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import MikrositePage from './pages/MikrositePage.tsx';
import './index.css';
import './i18n';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const params = new URLSearchParams(window.location.search);
const micrositeToken = params.get('microsite');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {micrositeToken ? <MikrositePage token={micrositeToken} /> : <App />}
  </StrictMode>
);
