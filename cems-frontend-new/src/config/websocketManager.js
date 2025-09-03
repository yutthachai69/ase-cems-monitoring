// WebSocket Manager - จัดการ WebSocket connections ร่วมกัน
class WebSocketManager {
  constructor() {
    this.connections = new Map();
    this.reconnectTimers = new Map();
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  }

  // เชื่อมต่อ WebSocket
  connect(endpoint, onMessage, onError, onClose) {
    const wsUrl = `${this.backendUrl.replace(/^http/, "ws")}${endpoint}`;
    
    // ปิด connection เดิมถ้ามี
    if (this.connections.has(endpoint)) {
      const existingWs = this.connections.get(endpoint);
      if (existingWs.readyState === WebSocket.OPEN) {
        return existingWs; // Already connected and open
      }
      existingWs.close();
    }

    const ws = new WebSocket(wsUrl);
    
    // เพิ่ม connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn(`WebSocket connection timeout for ${endpoint}`);
        ws.close();
      }
    }, 10000); // 10 วินาที

    this.connections.set(endpoint, ws);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.debug(`✅ WebSocket Connected: ${endpoint}`);
      // ล้าง reconnect timer
      if (this.reconnectTimers.has(endpoint)) {
        clearTimeout(this.reconnectTimers.get(endpoint));
        this.reconnectTimers.delete(endpoint);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage && onMessage(data);
      } catch (error) {
        console.error(`WebSocket message parse error: ${error}`);
      }
    };

    ws.onerror = (error) => {
      console.warn(`⚠ WebSocket Error (${endpoint}):`, error);
      onError && onError(error);
    };

    ws.onclose = () => {
      console.debug(`🔌 WebSocket Closed: ${endpoint}`);
      this.connections.delete(endpoint);
      
      // Auto reconnect เฉพาะเมื่อไม่ได้ปิดด้วยตัวเอง
      if (!this.manualDisconnect) {
        const reconnectTimer = setTimeout(() => {
          console.debug(`🔄 Reconnecting to ${endpoint}...`);
          this.connect(endpoint, onMessage, onError, onClose);
        }, 10000); // เพิ่ม delay เป็น 10 วินาที
        
        this.reconnectTimers.set(endpoint, reconnectTimer);
      }
      onClose && onClose();
    };

    return ws;
  }

  // ปิด WebSocket
  disconnect(endpoint) {
    this.manualDisconnect = true;
    
    if (this.connections.has(endpoint)) {
      this.connections.get(endpoint).close();
      this.connections.delete(endpoint);
    }
    
    if (this.reconnectTimers.has(endpoint)) {
      clearTimeout(this.reconnectTimers.get(endpoint));
      this.reconnectTimers.delete(endpoint);
    }
    
    // รีเซ็ต flag หลังจากปิด
    setTimeout(() => {
      this.manualDisconnect = false;
    }, 1000);
  }

  // ปิดทั้งหมด
  disconnectAll() {
    this.connections.forEach((ws, endpoint) => {
      ws.close();
    });
    this.connections.clear();
    
    this.reconnectTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.reconnectTimers.clear();
  }

  // ตรวจสอบสถานะการเชื่อมต่อ
  isConnected(endpoint) {
    const ws = this.connections.get(endpoint);
    return ws && ws.readyState === WebSocket.OPEN;
  }

  // ส่งข้อความ
  send(endpoint, message) {
    const ws = this.connections.get(endpoint);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}

// สร้าง instance เดียว
const wsManager = new WebSocketManager();

export default wsManager;

