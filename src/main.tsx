import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App } from './App';
import './index.css';

// On native Android the WebView often reports env(safe-area-inset-top) as 0
// even in edge-to-edge mode. Detect native platform and expose a CSS fallback.
if (Capacitor.isNativePlatform()) {
  document.documentElement.style.setProperty('--safe-top', '30px');
  document.documentElement.classList.add('native-app');
} else {
  document.documentElement.style.setProperty('--safe-top', '0px');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
