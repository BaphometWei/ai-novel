import React from 'react';
import ReactDOM from 'react-dom/client';
import { resolveApiBaseUrl } from './api/client';
import { App } from './App';

const runtimeEnv = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App apiBaseUrl={resolveApiBaseUrl(runtimeEnv)} />
  </React.StrictMode>
);
