import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { App } from './App';
import './index.css';

// On native Android the WebView often reports env(safe-area-inset-top) as 0
// even in edge-to-edge mode. Detect native platform and expose a CSS fallback.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');

  // Try to read the actual status bar height dynamically.
  // StatusBar.getInfo() on Android (Capacitor 8) returns the height in pixels.
  (async () => {
    try {
      // Check for Capacitor-injected inset data first
      const win = window as unknown as Record<string, unknown>;
      if (
        win['androidInsets'] &&
        typeof (win['androidInsets'] as Record<string, unknown>)['top'] === 'number'
      ) {
        const top = (win['androidInsets'] as Record<string, number>)['top'];
        document.documentElement.style.setProperty('--safe-top', `${top}px`);
        return;
      }
      if (
        win['safeAreaInsets'] &&
        typeof (win['safeAreaInsets'] as Record<string, unknown>)['top'] === 'number'
      ) {
        const top = (win['safeAreaInsets'] as Record<string, number>)['top'];
        document.documentElement.style.setProperty('--safe-top', `${top}px`);
        return;
      }

      // Use StatusBar plugin to get the real height
      const info = await StatusBar.getInfo();
      if (typeof info.height === 'number' && info.height > 0) {
        document.documentElement.style.setProperty('--safe-top', `${info.height}px`);
      } else {
        document.documentElement.style.setProperty('--safe-top', '40px');
      }
    } catch {
      // Plugin unavailable or errored — use a safe fallback
      document.documentElement.style.setProperty('--safe-top', '40px');
    }
  })();
} else {
  document.documentElement.style.setProperty('--safe-top', '0px');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
