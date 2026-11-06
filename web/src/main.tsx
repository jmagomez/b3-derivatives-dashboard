import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Providers } from '@/app/providers';
import { App } from '@/app/App';
import '@/styles/globals.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('elemento #root nao encontrado no index.html');

createRoot(raiz).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
