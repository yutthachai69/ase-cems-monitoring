// Basic configuration for CEMS system
import pkg from '../../package.json';

export const CONFIG = {
  // Backend URL
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
  
  // App version (single source from package.json; fallback env or hardcoded)
  APP_VERSION: import.meta.env.VITE_APP_VERSION || pkg.version || '1.1.0-beta.0',
  
  // App name
  APP_NAME: 'ASE CEMS',
  
  // Default settings
  DEFAULT_SETTINGS: {
    log_interval: 60,
    reconnect_interval: 60,
    alarm_threshold: {
      SO2: 200,
      CO: 100,
      Dust: 50
    }
  }
}; 