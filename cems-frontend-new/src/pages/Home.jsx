// 👉 นำเข้าทุกอย่างตามเดิม
import { useEffect, useState, useRef } from "react";
import {
  Typography, Row, Col, Card, Divider, Button, Space, Select,
  Tooltip, Spin, notification
} from "antd";
import wsManager from "../config/websocketManager";
import {
  ExperimentOutlined, DashboardOutlined, FireOutlined, CloudOutlined,
  ThunderboltOutlined, ReloadOutlined, WarningOutlined, RocketOutlined,
} from "@ant-design/icons";
import { CEMS_THEME } from "../assets/theme";
import "../App.css";
import SystemAlertBar from "../components/SystemAlertBar";

// เพิ่ม CSS animation สำหรับสถานะการเชื่อมต่อ
const connectionStyles = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

// เพิ่ม style tag สำหรับ animation
if (!document.getElementById('connection-animation')) {
  const style = document.createElement('style');
  style.id = 'connection-animation';
  style.textContent = connectionStyles;
  document.head.appendChild(style);
}

const { Title, Text } = Typography;
const { Option } = Select;

const THEME_COLOR = CEMS_THEME.primary;
const stackOptions = ["Stack 1", "Stack 2"];

const defaultData = {
  SO2: 0, NOx: 0, O2: 0, CO: 0, Dust: 0,
  Temperature: 0, Velocity: 0, Flowrate: 0, Pressure: 0,
  SO2Corr: null, NOxCorr: null, COCorr: null, DustCorr: null,
};

export default function Home() {
  const [stack, setStack] = useState("Stack 1");
  const [data, setData] = useState(defaultData);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [alarmValues, setAlarmValues] = useState([false, false, false, false]);
  const [lastUpdatedHour, setLastUpdatedHour] = useState(null);
  const [isConnected, setIsConnected] = useState(false); // เพิ่ม state ตรวจสอบการเชื่อมต่อ
  const [dbData, setDbData] = useState(null); // เพิ่ม state สำหรับข้อมูลจากฐานข้อมูล



  const alarmItems = [
    "Temperature Controller Alarm",
    "Analyzer Malfunction",
    "Sample Probe Alarm",
    "Alarm Light"
  ];

  const notifyNewAlarms = (newValues) => {
    const prev = JSON.parse(localStorage.getItem("cems_alarmValues_prev") || "[]");
    let newAlarmList = [];
    newValues.forEach((val, idx) => {
      if (!prev[idx] && val) newAlarmList.push(idx);
    });
    if (newAlarmList.length > 0) {
      notification.open({
        message: `⚠️ พบ Alarm ใหม่ (${newAlarmList.length} จุด)`,
        description: (
          <div>
            {newAlarmList.map(idx => (
              <div key={idx}>
                <WarningOutlined style={{ color: CEMS_THEME.warning, marginRight: 6 }} />
                <b>{alarmItems[idx]}</b>
              </div>
            ))}
          </div>
        ),
        duration: 3,
        placement: "topRight",
      });
    }
    localStorage.setItem("cems_alarmValues_prev", JSON.stringify(newValues));
  };

  const stackItems = [
    { label: "SO₂", unit: "ppm", icon: <CloudOutlined />, desc: "Sulfur Dioxide" },
    { label: "NOx", unit: "ppm", icon: <FireOutlined />, desc: "Nitrogen Oxides" },
    { label: "O₂", unit: "%", icon: <DashboardOutlined />, desc: "Oxygen" },
    { label: "CO", unit: "ppm", icon: <CloudOutlined />, desc: "Carbon Monoxide" },
    { label: "Dust", unit: "mg/m³", icon: <ExperimentOutlined />, desc: "Particulate Matter" },
    { label: "Temperature", unit: "°C", icon: <FireOutlined />, desc: "Temperature" },
    { label: "Velocity", unit: "m/s", icon: <RocketOutlined />, desc: "Gas Velocity" },
    { label: "Flowrate", unit: "m³/h", icon: <ThunderboltOutlined />, desc: "Gas Flow Rate" },
    { label: "Pressure", unit: "Pa", icon: <DashboardOutlined />, desc: "Gas Pressure" }
  ];

  const correctedItems = [
    { label: "SO₂", unit: "ppm", icon: <CloudOutlined />, desc: "Corrected SO₂" },
    { label: "NOx", unit: "ppm", icon: <FireOutlined />, desc: "Corrected NOx" },
    { label: "CO", unit: "ppm", icon: <CloudOutlined />, desc: "Corrected CO" },
    { label: "Dust", unit: "mg/m³", icon: <ExperimentOutlined />, desc: "Corrected Dust" }
  ];

  // ฟังก์ชันดึงข้อมูลจากฐานข้อมูล
  const fetchLatestData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${baseUrl}/log-preview`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setDbData(data[0]); // ใช้ข้อมูลล่าสุด
        }
      }
    } catch (error) {
      console.log("ไม่สามารถดึงข้อมูลจากฐานข้อมูลได้:", error);
    }
  };

  const connectGasWebSocket = () => {
    setConnectionError(false);
    
    wsManager.connect('/ws/gas', 
      (msg) => {
        if (!msg || !msg.gas || !Array.isArray(msg.gas)) return;

        const safe = (val) => (val === null || val === undefined || isNaN(val) ? null : Number(val));
        const gasData = msg.gas.map(safe);
        let data = {};

        if (gasData[0] !== null) data.SO2 = gasData[0];
        if (gasData[1] !== null) data.NOx = gasData[1];
        if (gasData[2] !== null) data.O2 = gasData[2];
        if (gasData[3] !== null) data.CO = gasData[3];
        if (gasData[4] !== null) data.Dust = gasData[4];
        if (gasData[5] !== null) data.Temperature = gasData[5];
        if (gasData[6] !== null) data.Velocity = gasData[6];
        if (gasData[7] !== null) data.Flowrate = gasData[7];
        if (gasData[8] !== null) data.Pressure = gasData[8];

        // รับ corrected values จาก backend
        if (msg.SO2Corr !== undefined) data.SO2Corr = safe(msg.SO2Corr);
        if (msg.NOxCorr !== undefined) data.NOxCorr = safe(msg.NOxCorr);
        if (msg.COCorr !== undefined) data.COCorr = safe(msg.COCorr);
        if (msg.DustCorr !== undefined) data.DustCorr = safe(msg.DustCorr);
        
        // ใช้ corrected values จาก backend เท่านั้น (ไม่คำนวณซ้ำ)

        setData({ ...data });

        const now = new Date();
        const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
        if (lastUpdatedHour !== hourKey) {
          setLastUpdated(`${now.getHours().toString().padStart(2, "0")}:00`);
          setLastUpdatedHour(hourKey);
        }

        setConnectionError(false);
        setIsConnected(true);
      },
      () => setConnectionError(true),
      () => setIsConnected(false)
    );
  };

  const connectStatusWebSocket = () => {
    wsManager.connect('/ws/status',
      (msg) => {
        if (msg.type === "status" && Array.isArray(msg.values)) {
          const alarms = msg.values.slice(15, 19).map((v) => v === 1);
          setAlarmValues(alarms);
          notifyNewAlarms(alarms);
        }
        setIsConnected(true);
      },
      () => console.warn("⚠ Status WebSocket Error"),
      () => setIsConnected(false)
    );
  };

  useEffect(() => {
    connectGasWebSocket();
    connectStatusWebSocket();
    
    // ดึงข้อมูลจากฐานข้อมูลทุก 30 วินาที
    fetchLatestData();
    const dbInterval = setInterval(fetchLatestData, 30000);
    
    return () => {
      // ปิด WebSocket connections ผ่าน manager
      wsManager.disconnect('/ws/gas');
      wsManager.disconnect('/ws/status');
      clearInterval(dbInterval);
      localStorage.removeItem("cems_alarmValues_prev");
    };
  }, []);

  const renderCard = (item, isCorrected = false) => {
    const id = item.label.replace("₂", "2").replace(/[^a-zA-Z0-9]/g, "") + (isCorrected ? "Corr" : "");
    let rawValue = data[id];
    
    // ใช้ข้อมูลจากฐานข้อมูลเป็นหลัก ถ้าไม่มีให้ใช้จาก WebSocket
    if (dbData) {
      const dbKey = item.label.replace("₂", "2").replace(/[^a-zA-Z0-9]/g, "");
      
      // สำหรับ corrected values
      if (isCorrected) {
        const correctedKey = dbKey + "_corrected";
        // ถ้า corrected value เป็น null ให้คำนวณเอง
        if (dbData[correctedKey] === null || dbData[correctedKey] === 0) {
          const baseValue = dbData[dbKey] || 0;
          const o2Value = dbData['O2'] || 0;
          const o2Ref = 7.0;
          let correctionFactor = 1.0;
          
          if (o2Value > 0 && o2Value < 21) {
            correctionFactor = (21 - o2Ref) / (21 - o2Value);
          }
          
          rawValue = (baseValue * correctionFactor).toFixed(2);
        } else {
          rawValue = dbData[correctedKey];
        }
      } else {
        // สำหรับค่าปกติ
        rawValue = dbData[dbKey] || rawValue;
      }
    }
    
    const parsed = Number(rawValue);
    const value = isNaN(parsed) ? "--" : parsed;

    const limit = { SO2: 200, NOx: 300, CO: 100, Dust: 50 };
    const isOverLimit = typeof value === "number" && limit[item.label] && value > limit[item.label];
    
    // ✅ เพิ่มการตรวจสอบ Flowrate ที่ผิดปกติ
    const isFlowrateAbnormal = item.label === "Flowrate" && typeof value === "number" && value > 1000000;

    // ✅ เพิ่มการตรวจสอบค่า O₂
    const getO2Color = (value) => {
      if (typeof value !== "number") return THEME_COLOR;
      if (value > 21) return "#ff4d4f";        // 🔴 ผิดปกติแน่ (เกิน 21%)
      if (value > 15) return "#fa8c16";        // 🟡 สูงผิดปกติ (15-21%)
      if (value < 3) return "#ff4d4f";         // 🔴 ต่ำเกิน (น้อยกว่า 3%)
      if (value >= 6 && value <= 15) return "#52c41a"; // 🟢 ปกติ (6-15%)
      return "#fa8c16";                        // 🟡 ต่ำ (3-6%)
    };

    const isAlarmActive =
      (item.label === "Temperature" && alarmValues[0]) ||
      (item.label === "CO" && alarmValues[1]) ||
      (item.label === "Dust" && alarmValues[2]) ||
      (item.label === "SO₂" && alarmValues[3]);

    // ✅ กำหนดสีตามประเภทข้อมูล
    let cardColor = THEME_COLOR;
    if (isAlarmActive) {
      cardColor = CEMS_THEME.warning;
    } else if (isOverLimit || isFlowrateAbnormal) {
      cardColor = CEMS_THEME.danger;
    } else if (item.label === "O₂") {
      cardColor = getO2Color(value);
    }

    return (
      <Col xs={12} sm={8} md={6} lg={6} xl={3} key={item.label}>
        <Card
          hoverable
          size="small"
          style={{
            borderLeft: `6px solid ${cardColor}`,
            borderRadius: 16,
            textAlign: "center",
            height: 120,
            backgroundColor: isAlarmActive ? "#fffbe7" : isOverLimit ? "#fff0f0" : "white",
            boxShadow: isAlarmActive ? "0 2px 16px 0 #ffd60033" : undefined,
          }}
        >
          {(isOverLimit || isAlarmActive || isFlowrateAbnormal || (item.label === "O₂" && typeof value === "number" && (value > 21 || value < 3))) && (
            <WarningOutlined style={{ color: cardColor, position: "absolute", top: 8, left: 10, fontSize: 20 }} />
          )}
          <Tooltip title={item.desc}>
            <div style={{ fontSize: 13, color: THEME_COLOR }}>{item.icon} {item.label}</div>
          </Tooltip>
          <div style={{ fontSize: 26, fontWeight: 700, color: cardColor, margin: "6px 0" }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>{item.unit}</Text>
        </Card>
      </Col>
    );
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: CEMS_THEME.background }}>
      <SystemAlertBar />
      <Spin spinning={loading} tip="กำลังโหลดข้อมูล...">
        <div className="cems-section" style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Title level={4} style={{ color: THEME_COLOR, marginBottom: 0 }}>Stack Value Monitoring Dashboard</Title>
            <Space direction="vertical" size={4} align="end">
              {alarmValues.some(a => a) && (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span className="cems-alarm-badge">
                    <WarningOutlined style={{ marginRight: 4 }} />
                    Alarm {alarmValues.filter(a => a).length}
                  </span>
                  <span style={{ fontSize: 12, color: CEMS_THEME.text, marginLeft: 8 }}>
                    {alarmValues.map((a, i) => a ? alarmItems[i] : null).filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              <Space>
                <Select value={stack} onChange={setStack} style={{ width: 160 }}>
                  {stackOptions.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    // ตรวจสอบว่ากำลังเชื่อมต่ออยู่หรือไม่
                    if (isConnected && !loading) {
                      setLoading(true);
                      // ปิดการเชื่อมต่อปัจจุบัน
                      wsManager.disconnect('/ws/gas');
                      wsManager.disconnect('/ws/status');
                      // รีเซ็ตสถานะ
                      setIsConnected(false);
                      setConnectionError(false);
                      // เชื่อมต่อใหม่
                      setTimeout(() => {
                        connectGasWebSocket();
                        connectStatusWebSocket();
                        setLoading(false);
                      }, 500);
                    } else if (!isConnected) {
                      // ถ้าไม่ได้เชื่อมต่อ ให้เชื่อมต่อใหม่
                      setLoading(true);
                      connectGasWebSocket();
                      connectStatusWebSocket();
                      setTimeout(() => setLoading(false), 1000);
                    }
                  }}
                  loading={loading}
                  className="cems-btn-warning"
                  style={{
                    backgroundColor: isConnected ? CEMS_THEME.success : CEMS_THEME.warning,
                    borderColor: isConnected ? CEMS_THEME.success : CEMS_THEME.warning,
                    color: 'white'
                  }}
                >
                  {isConnected ? 'Connected' : 'Refresh'}
                </Button>
              </Space>
              {lastUpdated && (
                <Text type="secondary" style={{ fontSize: 11 }}>Last updated: {lastUpdated}</Text>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isConnected ? CEMS_THEME.success : CEMS_THEME.danger,
                  animation: isConnected ? 'none' : 'pulse 2s infinite'
                }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Text>
              </div>
            </Space>
          </div>

          {connectionError ? (
            <div style={{ marginTop: 48, textAlign: "center", color: CEMS_THEME.danger, fontSize: 18 }}>
              ❌ ไม่สามารถเชื่อมต่อข้อมูลได้ กรุณาตรวจสอบหรือกด Refresh
            </div>
          ) : (
            <>
              <Row gutter={[16, 16]}>{stackItems.map((i) => renderCard(i))}</Row>
              <Divider style={{ margin: "40px 0 32px" }} />
              <Title level={4} style={{ color: THEME_COLOR }}>Corrected to 7% Vol Oxygen</Title>
              <Row gutter={[16, 16]}>{correctedItems.map((i) => renderCard(i, true))}</Row>
            </>
          )}

          <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#666',
            border: '1px solid #e0e0e0',
            zIndex: 1000
          }}>
            v1.0.1 - {new Date().toLocaleDateString('th-TH')}
          </div>
        </div>
      </Spin>
    </div>
  );
}
