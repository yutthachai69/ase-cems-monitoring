// API Service - จัดการ API calls ร่วมกัน
class ApiService {
  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
    this.getAuth = () => {
      try { return JSON.parse(localStorage.getItem('auth')) || {}; } catch { return {}; }
    };
  }

  // Generic fetch method
  async fetch(endpoint, options = {}) {
    const url = `${this.backendUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const { token } = this.getAuth();
    if (token) {
      defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Config APIs
  async getConfig() {
    return this.fetch('/config');
  }

  async updateConfig(configData) {
    return this.fetch('/config', {
      method: 'PUT',
      body: JSON.stringify(configData)
    });
  }

  async resetConfig() {
    return this.fetch('/reset-config', {
      method: 'POST'
    });
  }

  async reloadConfig() {
    return this.fetch('/reload-config', {
      method: 'POST'
    });
  }

  // Mapping APIs
  async getMapping() {
    return this.fetch('/mapping');
  }

  async updateMapping(mappingData) {
    return this.fetch('/mapping', {
      method: 'PUT',
      body: JSON.stringify(mappingData)
    });
  }

  // Status APIs
  async getStatus() {
    return this.fetch('/status');
  }

  async getDemoData() {
    return this.fetch('/demo-data');
  }

  // Blowback APIs
  async triggerManualBlowback() {
    return this.fetch('/trigger-manual-blowback', {
      method: 'POST'
    });
  }

  // Log APIs
  async getLogPreview() {
    return this.fetch('/log-preview');
  }

  async downloadLogs() {
    return this.fetch('/download-logs');
  }

  // Health check
  async healthCheck() {
    return this.fetch('/health');
  }

  // Device scan
  async scanDevices(scanRequest) {
    return this.fetch('/api/scan-devices', {
      method: 'POST',
      body: JSON.stringify(scanRequest)
    });
  }

  // Check backend connection
  async checkBackendConnection() {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// สร้าง instance เดียว
const apiService = new ApiService();

export default apiService;

