// In dev (Vite proxy): defaults to '/api'
// For Android APK: set VITE_API_URL at build time, e.g.
//   VITE_API_URL=https://your-server.com/api npm run build
export const API_BASE = import.meta.env.VITE_API_URL || '/api';
