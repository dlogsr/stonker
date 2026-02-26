import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stonker.app',
  appName: 'Stonker',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  server: {
    // For local dev, point to your running server:
    // url: 'http://10.0.2.2:3001',
    // For production, remove `url` so it uses the bundled web assets
    androidScheme: 'https',
  },
};

export default config;
