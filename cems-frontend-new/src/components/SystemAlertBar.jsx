import { useEffect, useState, useRef } from "react";

export default function SystemAlertBar() {
  const [status, setStatus] = useState(null); // "server_error" | "modbus_error" | "connected"
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connectWebSocket = () => {
    // ✅ ใช้ backend URL ที่ถูกต้องสำหรับ standalone app
    const backendUrl = window.isElectron ? "http://127.0.0.1:8000" : (import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000");
    const wsUrl = `${backendUrl.replace(/^http/, "ws")}/ws/status`;

    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.debug("✅ SystemAlertBar Connected to Server");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.connection_status === "connected") {
        setStatus("connected"); // ✅ Modbus เชื่อมได้
      } else if (msg.connection_status === "error") {
        setStatus("modbus_error"); // ⚠ Server ติด แต่ Modbus เชื่อมไม่ได้
      }
    };

    ws.onerror = () => {
      console.warn("❌ SystemAlertBar Server Error");
      setStatus("server_error");
    };

    ws.onclose = () => {
      console.warn("🔌 SystemAlertBar Closed - Retry in 5s");
      setStatus("server_error");
      reconnectTimer.current = setTimeout(connectWebSocket, 5000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimer.current);
    };
  }, []);

  if (status === "connected") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: "#f6ffed",
          color: "#389e0d",
          padding: "8px 12px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ✅ เชื่อมต่อกับ Modbus สำเร็จ
      </div>
    );
  }

  if (status === "modbus_error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          background: "#fffbe6",
          color: "#d48806",
          padding: "8px 12px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ⚠ Server ทำงาน แต่เชื่อมต่อ Modbus ไม่ได้ กรุณาตรวจสอบการตั้งค่าหรือการเชื่อมต่อ Modbus ว่าถูกต้องหรือไม่
      </div>
    );
  }

  if (status === "server_error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          background: "#fff2f0",
          color: "#cf1322",
          padding: "8px 12px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ❌ ไม่สามารถเชื่อมต่อ Server ได้
      </div>
    );
  }

  return null;
}
