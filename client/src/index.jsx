import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

// ── Web-mode bootstrapping ─────────────────────────────────────────────────
// When running in a browser (cPanel / any web host) window.posAPI is NOT set
// by Electron's preload.js.  Inject the HTTP-based implementation instead so
// all existing components work without modification.
if (!window.posAPI) {
  // Dynamic import keeps the Electron bundle lean (tree-shaken in Electron
  // builds because the condition is always false there at runtime).
  import('./web-api.js').then(({ webPosAPI }) => {
    window.posAPI = webPosAPI;
    window.__webMode = true;
  });
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
