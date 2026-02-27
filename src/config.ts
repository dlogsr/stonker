// Dev: '/api' is proxied to localhost:3001 by Vite
// Production/Android: hits the deployed Railway server
export const API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? '/api' : 'https://stonker-production.up.railway.app/api');
