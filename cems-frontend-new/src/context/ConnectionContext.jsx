import { createContext, useContext, useState, useEffect, useRef } from "react";
import wsManager from "../config/websocketManager";

const ConnectionContext = createContext();

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};

export const ConnectionProvider = ({ children }) => {
  const [status, setStatus] = useState(null); // "server_error" | "modbus_error" | "connected"
  const [showSuccess, setShowSuccess] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [gasData, setGasData] = useState({
    SO2: 0, NOx: 0, O2: 0, CO: 0, Dust: 0,
    Temperature: 0, Velocity: 0, Flowrate: 0, Pressure: 0,
    SO2Corr: null, NOxCorr: null, COCorr: null, DustCorr: null,
  });
  const [alarmValues, setAlarmValues] = useState([false, false, false, false]);
  const successTimer = useRef(null);
  const lastStatusRef = useRef(null);

  const connectWebSockets = () => {
    // เชื่อมต่อ WebSocket สำหรับ gas data
    wsManager.connect('/ws/gas', 
      (data) => {
        try {
          // จัดการข้อมูลที่อาจเป็น object หรือ string
          let msg;
          if (typeof data === 'string') {
            msg = JSON.parse(data);
          } else if (typeof data === 'object') {
            msg = data;
          } else {
            console.warn("❌ ConnectionContext: Unknown data format:", typeof data);
            return;
          }
          
          // ตรวจสอบ connection_status
          if (msg.connection_status) {
            const newStatus = (msg.connection_status === "connected" || msg.has_real_data) ? "connected" : "modbus_error";
            
            // ป้องกันการเปลี่ยนสถานะถี่เกินไป
            if (lastStatusRef.current !== newStatus) {
              lastStatusRef.current = newStatus;
              setStatus(newStatus);
              
              if (newStatus === "connected") {
                setShowSuccess(true);
                setIsConnected(true);
                setConnectionError(false);
                
                // ลบ timer เก่า (ถ้ามี)
                if (successTimer.current) {
                  clearTimeout(successTimer.current);
                }
                
                // ตั้ง timer ให้ซ่อนข้อความสำเร็จหลังจาก 12 วินาที
                successTimer.current = setTimeout(() => {
                  setShowSuccess(false);
                }, 12000);
              } else {
                setShowSuccess(false);
                setIsConnected(false);
                setConnectionError(true);
              }
            }
          }
          
          // จัดการ gas data
          if (msg.gas && Array.isArray(msg.gas)) {
            const safe = (val) => (val === null || val === undefined || isNaN(val) ? null : Number(val));
            const gasArray = msg.gas.map(safe);
            let newGasData = {};
            
            if (gasArray[0] !== null) newGasData.SO2 = gasArray[0];
            if (gasArray[1] !== null) newGasData.NOx = gasArray[1];
            if (gasArray[2] !== null) newGasData.O2 = gasArray[2];
            if (gasArray[3] !== null) newGasData.CO = gasArray[3];
            if (gasArray[4] !== null) newGasData.Dust = gasArray[4];
            if (gasArray[5] !== null) newGasData.Temperature = gasArray[5];
            if (gasArray[6] !== null) newGasData.Velocity = gasArray[6];
            if (gasArray[7] !== null) newGasData.Flowrate = gasArray[7];
            if (gasArray[8] !== null) newGasData.Pressure = gasArray[8];
            
            // รับ corrected values จาก backend
            if (msg.SO2Corr !== undefined) newGasData.SO2Corr = safe(msg.SO2Corr);
            if (msg.NOxCorr !== undefined) newGasData.NOxCorr = safe(msg.NOxCorr);
            if (msg.COCorr !== undefined) newGasData.COCorr = safe(msg.COCorr);
            if (msg.DustCorr !== undefined) newGasData.DustCorr = safe(msg.DustCorr);
            
            setGasData(prevData => {
              // ตรวจสอบว่าข้อมูลเปลี่ยนจริงหรือไม่
              const hasChanged = 
                prevData.SO2 !== newGasData.SO2 ||
                prevData.NOx !== newGasData.NOx ||
                prevData.O2 !== newGasData.O2 ||
                prevData.CO !== newGasData.CO ||
                prevData.Dust !== newGasData.Dust ||
                prevData.Temperature !== newGasData.Temperature ||
                prevData.Velocity !== newGasData.Velocity ||
                prevData.Flowrate !== newGasData.Flowrate ||
                prevData.Pressure !== newGasData.Pressure ||
                prevData.SO2Corr !== newGasData.SO2Corr ||
                prevData.NOxCorr !== newGasData.NOxCorr ||
                prevData.COCorr !== newGasData.COCorr ||
                prevData.DustCorr !== newGasData.DustCorr;
              
              // อัปเดตเฉพาะเมื่อข้อมูลเปลี่ยนจริง
              return hasChanged ? { ...prevData, ...newGasData } : prevData;
            });
          }
          
          // อัพเดทเวลาล่าสุด
          setLastUpdated(new Date().toLocaleTimeString('th-TH'));
        } catch (error) {
          console.warn("❌ ConnectionContext Parse Error:", error);
        }
      },
      (error) => {
        console.warn("❌ ConnectionContext Gas WebSocket Error:", error);
        setStatus("server_error");
        setShowSuccess(false);
        setIsConnected(false);
        setConnectionError(true);
      },
      () => {
        console.warn("🔌 ConnectionContext Gas WebSocket Closed");
        setStatus("server_error");
        setShowSuccess(false);
        setIsConnected(false);
        setConnectionError(true);
      }
    );

    // เชื่อมต่อ WebSocket สำหรับ status
    wsManager.connect('/ws/status',
      (data) => {
        try {
          // จัดการข้อมูลที่อาจเป็น object หรือ string
          let msg;
          if (typeof data === 'string') {
            msg = JSON.parse(data);
          } else if (typeof data === 'object') {
            msg = data;
          } else {
            console.warn("❌ ConnectionContext Status: Unknown data format:", typeof data);
            return;
          }
          
          if (msg.type === "status" && Array.isArray(msg.values)) {
            const alarms = msg.values.slice(15, 19).map((v) => v === 1);
            setAlarmValues(alarms);
          }
        } catch (error) {
          console.warn("❌ ConnectionContext Status Parse Error:", error);
        }
      },
      (error) => {
        console.warn("❌ ConnectionContext Status WebSocket Error:", error);
      },
      () => {
        console.warn("🔌 ConnectionContext Status WebSocket Closed");
      }
    );
  };

  const disconnectWebSockets = () => {
    wsManager.disconnect('/ws/gas');
    wsManager.disconnect('/ws/status');
    setStatus(null);
    setShowSuccess(true);
    setIsConnected(false);
    setConnectionError(false);
    setLastUpdated(null);
    
    if (successTimer.current) {
      clearTimeout(successTimer.current);
    }
  };

  const refreshConnection = () => {
    disconnectWebSockets();
    setTimeout(() => {
      connectWebSockets();
    }, 500);
  };

  useEffect(() => {
    // เชื่อมต่อครั้งแรก
    const timer = setTimeout(connectWebSockets, 1000);
    
    return () => {
      clearTimeout(timer);
      disconnectWebSockets();
    };
  }, []);

  const value = {
    status,
    showSuccess,
    isConnected,
    connectionError,
    lastUpdated,
    gasData,
    alarmValues,
    connectWebSockets,
    disconnectWebSockets,
    refreshConnection
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 