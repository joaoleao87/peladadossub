import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.peladadossub.app',
  appName: 'Pelada dos Sub',
  webDir: 'dist',
  backgroundColor: '#090a08',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
