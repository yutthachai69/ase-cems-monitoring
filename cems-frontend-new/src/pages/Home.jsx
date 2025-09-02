import { useEffect, useState } from "react";
import {
  Typography, Row, Col, Card, Divider, Button, Space, Select,
  Tooltip, Spin, notification
} from "antd";
import wsManager from "../config/websocketManager";
import {
  ExperimentOutlined, DashboardOutlined, FireOutlined, CloudOutlined,
  ThunderboltOutlined, ReloadOutlined, WarningOutlined, RocketOutlined,
  BarChartOutlined, EnvironmentOutlined, CompressOutlined,
} from "@ant-design/icons";
import { CEMS_THEME } from "../assets/theme";
import "../App.css";
import SystemAlertBar from "../components/SystemAlertBar";
import { CONFIG } from "../config/config";



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
  const [isConnected, setIsConnected] = useState(false);
  const [dbData, setDbData] = useState(null);
  const [gasConfig, setGasConfig] = useState({
    default_gases: [
      { name: "SO2", display_name: "SO₂", unit: "ppm", enabled: true, alarm_threshold: 200 },
      { name: "NOx", display_name: "NOx", unit: "ppm", enabled: true, alarm_threshold: 300 },
      { name: "O2", display_name: "O₂", unit: "%", enabled: true, alarm_threshold: null },
      { name: "CO", display_name: "CO", unit: "ppm", enabled: true, alarm_threshold: 100 }
    ],
    additional_gases: [
      { name: "Dust", display_name: "Dust", unit: "mg/m³", enabled: true, alarm_threshold: 100 }
    ]
  });



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

  // สร้าง stackItems จาก gas config
  const getStackItems = () => {
    const items = [];
    
    // เพิ่มแก๊สเริ่มต้นที่ enabled
    gasConfig.default_gases?.forEach(gas => {
      if (gas.enabled) {
        items.push({
          label: gas.display_name,
          unit: gas.unit,
          icon: <CloudOutlined />,
          desc: gas.display_name,
          isGas: true
        });
      }
    });
    
    // เพิ่มแก๊สเพิ่มเติมที่ enabled
    gasConfig.additional_gases?.forEach(gas => {
      if (gas.enabled) {
        items.push({
          label: gas.display_name,
          unit: gas.unit,
          icon: <ExperimentOutlined />,
          desc: gas.display_name,
          isGas: true
        });
      }
    });
    
    // เพิ่มพารามิเตอร์อื่นๆ (ไม่ใช่แก๊ส)
    const nonGasItems = [
      { label: "Temperature", unit: "°C", icon: <FireOutlined />, desc: "Temperature" },
      { label: "Velocity", unit: "m/s", icon: <ThunderboltOutlined />, desc: "Gas Velocity" },
      { label: "Flowrate", unit: "m³/h", icon: <BarChartOutlined />, desc: "Gas Flow Rate" },
      { label: "Pressure", unit: "Pa", icon: <CompressOutlined />, desc: "Gas Pressure" }
    ];
    
    items.push(...nonGasItems);
    
    return items;
  };

  // สร้าง stackItems จาก gas config และอัปเดตเมื่อ gas config เปลี่ยน
  const stackItems = getStackItems();

  const correctedItems = [
    { label: "SO₂", unit: "ppm", icon: <CloudOutlined />, desc: "Corrected SO₂" },
    { label: "NOx", unit: "ppm", icon: <CloudOutlined />, desc: "Corrected NOx" },
    { label: "CO", unit: "ppm", icon: <CloudOutlined />, desc: "Corrected CO" },
    { label: "Dust", unit: "mg/m³", icon: <ExperimentOutlined />, desc: "Corrected Dust" }
  ];

  // ฟังก์ชันโหลด gas configuration
  const loadGasConfig = async () => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${baseUrl}/config/gas`);
      if (response.ok) {
        const data = await response.json();
        setGasConfig(data);
      }
    } catch (error) {
      console.log("ไม่สามารถโหลด gas config ได้:", error);
    }
  };

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

        // ใช้ useRef เพื่อป้องกันการ re-render ที่ไม่จำเป็น
        setData(prevData => {
          // ตรวจสอบว่าข้อมูลเปลี่ยนจริงหรือไม่
          const hasChanged = 
            prevData.SO2 !== data.SO2 ||
            prevData.NOx !== data.NOx ||
            prevData.O2 !== data.O2 ||
            prevData.CO !== data.CO ||
            prevData.Dust !== data.Dust ||
            prevData.Temperature !== data.Temperature ||
            prevData.Velocity !== data.Velocity ||
            prevData.Flowrate !== data.Flowrate ||
            prevData.Pressure !== data.Pressure ||
            prevData.SO2Corr !== data.SO2Corr ||
            prevData.NOxCorr !== data.NOxCorr ||
            prevData.COCorr !== data.COCorr ||
            prevData.DustCorr !== data.DustCorr;
          
          // อัปเดตเฉพาะเมื่อข้อมูลเปลี่ยนจริง
          return hasChanged ? { ...data } : prevData;
        });

        const now = new Date();
        const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
        if (lastUpdatedHour !== hourKey) {
          setLastUpdated(`${now.getHours().toString().padStart(2, "0")}:00`);
          setLastUpdatedHour(hourKey);
        }

        setConnectionError(false);
        setIsConnected(true);
        
      },
      () => {
        setConnectionError(true);
      },
      () => {
        setIsConnected(false);
      }
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
    
    // โหลด gas config และดึงข้อมูลจากฐานข้อมูล
    loadGasConfig();
    fetchLatestData();
    
    // ดึงข้อมูลจากฐานข้อมูลทุก 30 วินาที
    const dbInterval = setInterval(fetchLatestData, 30000);
    
    return () => {
      // ปิด WebSocket connections ผ่าน manager
      wsManager.disconnect('/ws/gas');
      wsManager.disconnect('/ws/status');
      clearInterval(dbInterval);
      localStorage.removeItem("cems_alarmValues_prev");
    };
  }, []);

  // โหลด gas config ใหม่ทุก 10 วินาที
  useEffect(() => {
    const gasConfigInterval = setInterval(loadGasConfig, 10000);
    return () => clearInterval(gasConfigInterval);
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

    // ใช้ alarm threshold จาก gas config
    const getAlarmThreshold = (gasName) => {
      // หาใน default_gases
      const defaultGas = gasConfig.default_gases?.find(gas => gas.name === gasName);
      if (defaultGas) return defaultGas.alarm_threshold;
      
      // หาใน additional_gases
      const additionalGas = gasConfig.additional_gases?.find(gas => gas.name === gasName);
      if (additionalGas) return additionalGas.alarm_threshold;
      
      // fallback ไปใช้ค่าเดิม
      const fallbackLimit = { SO2: 200, NOx: 300, CO: 100, Dust: 50 };
      return fallbackLimit[gasName] || 100;
    };
    
    const alarmThreshold = getAlarmThreshold(item.label);
    const isOverLimit = typeof value === "number" && alarmThreshold && value > alarmThreshold;
    
    // ✅ เพิ่มการตรวจสอบ Flowrate ที่ผิดปกติ
    const isFlowrateAbnormal = item.label === "Flowrate" && typeof value === "number" && value > 1000000;

    // ✅ เพิ่มการตรวจสอบค่า O₂
    const getO2Color = (value) => {
      if (typeof value !== "number") return THEME_COLOR;
      if (value > 21) return "#ff4d4f";        // 🔴 ผิดปกติแน่ (เกิน 21%)
      if (value > 15) return "#fa8c16";        // 🟡 สูงผิดปกติ (15-21%)
      if (value < 3) return "#ff4d4f";         // 🔴 ต่ำเกิน (น้อยกว่า 3%)
      if (value >= 6 && value <= 15) return THEME_COLOR; // 🔵 ปกติ (6-15%)
      return "#fa8c16";                        // 🟡 ต่ำ (3-6%)
    };

    const isAlarmActive =
      (item.label === "Temperature" && alarmValues[0]) ||
      (item.label === "CO" && alarmValues[1]) ||
      (item.label === "Dust" && alarmValues[2]) ||
      (item.label === "SO₂" && alarmValues[3]);

    // ✅ กำหนดสีตามค่าและระดับความรุนแรง
    let cardColor = THEME_COLOR;
    
    // ตรวจสอบ parameter threshold (Temperature, Pressure, Velocity)
    const getParameterThreshold = (paramName) => {
      const thresholds = {
        "Temperature": 80,
        "Pressure": 1000,
        "Velocity": 30
      };
      return thresholds[paramName];
    };
    
    const parameterThreshold = getParameterThreshold(item.label);
    const isParameterOverLimit = typeof value === "number" && parameterThreshold && value > parameterThreshold;
    
    if (isAlarmActive) {
      cardColor = CEMS_THEME.warning;
    } else if (isFlowrateAbnormal) {
      cardColor = CEMS_THEME.danger;
    } else if (item.label === "O₂") {
      cardColor = getO2Color(value);
    } else if (isOverLimit || isParameterOverLimit) {
      cardColor = CEMS_THEME.danger; // แดงเมื่อเกินค่าแจ้งเตือน
    } else if (typeof value === "number" && (alarmThreshold || parameterThreshold)) {
      // สีเหลืองเมื่อเข้าใกล้ค่าแจ้งเตือน (80% ของค่าแจ้งเตือน)
      const threshold = alarmThreshold || parameterThreshold;
      const warningThreshold = threshold * 0.8;
      if (value >= warningThreshold) {
        cardColor = CEMS_THEME.warning;
      } else {
        cardColor = THEME_COLOR; // สีน้ำเงินปกติ
      }
    } else {
      cardColor = THEME_COLOR; // สีน้ำเงินปกติ
    }

    return (
      <Col xs={12} sm={8} md={6} lg={6} xl={3} key={item.label}>
        <Card
          hoverable
          size="small"
          style={{
            borderLeft: `3px solid ${cardColor}`,
            borderRadius: "2px",
            textAlign: "center",
            height: "140px",
            backgroundColor: "white",
            boxShadow: "none",
            borderTop: "1px solid #ccc",
            borderRight: "1px solid #ccc",
            borderBottom: "1px solid #ccc",
            transition: "none",
            position: "relative",
            overflow: "visible"
          }}

        >
          {(isOverLimit || isAlarmActive || isFlowrateAbnormal || (item.label === "O₂" && typeof value === "number" && (value > 21 || value < 3))) && (
            <div style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              background: "#ff4d4f",
              color: "white",
              borderRadius: "1px",
              padding: "1px 4px",
              fontSize: "9px",
              fontWeight: "normal"
            }}>
              ALARM
            </div>
          )}
          
          <Tooltip title={item.desc}>
            <div style={{ 
              fontSize: "14px", 
              color: "#000",
              fontWeight: "bold",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}>
              <span style={{ 
                color: cardColor,
                fontSize: "14px",
                display: "flex",
                alignItems: "center"
              }}>
                {item.icon}
              </span>
              {item.label}
            </div>
          </Tooltip>
          
          <Tooltip title={typeof value === "number" ? value.toLocaleString() : value}>
            <div style={{ 
              fontSize: "26px", 
              fontWeight: "bold", 
              color: cardColor, 
              margin: "8px 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 8px",
              cursor: "help"
            }}>
              {typeof value === "number" ? 
                (value > 999999999 ? 
                  `${(value / 1000000000).toFixed(1)}B` :
                  value > 999999 ? 
                    `${(value / 1000000).toFixed(1)}M` : 
                    value > 999 ? 
                      `${(value / 1000).toFixed(1)}K` :
                      value.toFixed(1)
                ) : value}
            </div>
          </Tooltip>
          
          <Text style={{ 
            fontSize: "14px",
            color: "#666",
            fontWeight: "normal",
            textAlign: "center",
            display: "block",
            marginTop: "4px"
          }}>
            {item.label === "SO2" || item.label === "NOx" || item.label === "CO" ? "ppm" :
             item.label === "O2" ? "%" :
             item.label === "Dust" ? "mg/m³" :
             item.label === "Temperature" ? "°C" :
             item.label === "Velocity" ? "m/s" :
             item.label === "Flowrate" ? "m³/h" :
             item.label === "Pressure" ? "Pa" :
             item.unit || "N/A"}
          </Text>
        </Card>
      </Col>
    );
  };

    return (
    <div style={{ 
      position: "relative", 
      minHeight: "100vh", 
      background: "#f0f0f0"
    }}>
      <div className="cems-section" style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>
        
                {/* Header Section */}
        <div style={{ 
          marginBottom: "24px",
          padding: "0"
        }}>
          <div style={{ marginBottom: "16px" }}>
            <Title level={2} style={{ 
              margin: 0, 
              color: "#000",
              fontSize: "22px",
              fontWeight: "bold"
            }}>
              ระบบติดตามการปล่อยมลพิษ
            </Title>
            <Text style={{ 
              fontSize: "13px", 
              color: "#333",
              fontWeight: "normal"
            }}>
              Continuous Emission Monitoring System
            </Text>
          </div>
            
                      <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px",
            flexWrap: "wrap"
          }}>
            <div style={{
              padding: "8px 16px",
              background: "#52c41a",
              color: "white",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                background: "white",
                borderRadius: "50%"
              }}></div>
              ระบบเชื่อมต่อสำเร็จ
            </div>
            
            <div style={{
              padding: "8px 16px",
              background: "#f5f5f5",
              color: "#333",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "500",
              border: "1px solid #d9d9d9"
            }}>
              อัปเดต: {lastUpdated || "กำลังโหลด..."}
            </div>
            
            <div style={{
              padding: "8px 16px",
              background: "#f5f5f5",
              color: "#333",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "500",
              border: "1px solid #d9d9d9"
            }}>
              Stack: {stack}
            </div>
            
            {alarmValues.some(a => a) && (
              <div style={{
                padding: "8px 16px",
                background: "#ff4d4f",
                color: "white",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <div style={{
                  width: "0",
                  height: "0",
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderBottom: "10px solid white",
                  marginRight: "4px"
                }}></div>
                Alarm: {alarmValues.filter(a => a).length}
              </div>
            )}
          </div>
            
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginTop: "16px"
            }}>
              <Space>
                <Select 
                  value={stack} 
                  onChange={setStack} 
                  style={{ 
                    width: 160,
                    borderRadius: "8px"
                  }}
                >
                  {stackOptions.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Space>
              
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (isConnected && !loading) {
                    setLoading(true);
                    wsManager.disconnect('/ws/gas');
                    wsManager.disconnect('/ws/status');
                    setIsConnected(false);
                    setConnectionError(false);
                    setTimeout(() => {
                      connectGasWebSocket();
                      connectStatusWebSocket();
                      setLoading(false);
                    }, 500);
                  } else if (!isConnected) {
                    setLoading(true);
                    connectGasWebSocket();
                    connectStatusWebSocket();
                    setTimeout(() => setLoading(false), 1000);
                  }
                }}
                loading={loading}
                style={{
                  background: "#1890ff",
                  border: "1px solid #1890ff",
                  borderRadius: "3px",
                  fontWeight: "normal",
                  fontSize: "12px"
                }}
              >
                {isConnected ? 'รีเฟรช' : 'เชื่อมต่อใหม่'}
              </Button>
            </div>
          </div>

          {connectionError ? (
            <div style={{ 
              marginTop: "48px", 
              textAlign: "center", 
              background: "white",
              padding: "48px",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
            }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>❌</div>
              <Title level={3} style={{ color: "#ff4d4f", marginBottom: "8px" }}>
                ไม่สามารถเชื่อมต่อข้อมูลได้
              </Title>
              <Text type="secondary" style={{ fontSize: "16px" }}>
                กรุณาตรวจสอบการเชื่อมต่อหรือกดปุ่ม "เชื่อมต่อใหม่"
              </Text>
            </div>
          ) : (
            <>
              <div style={{
                marginBottom: "24px"
              }}>
                <div style={{ 
                  marginBottom: "16px"
                }}>
                  <Title level={4} style={{ margin: 0, color: "#000", fontSize: "18px", fontWeight: "bold" }}>
                    ข้อมูลการตรวจสอบแบบเรียลไทม์
                  </Title>
                  <Text type="secondary" style={{ fontSize: "12px", color: "#333" }}>
                    Real-time monitoring data from CEMS sensors
                  </Text>
                </div>
                
                <Row gutter={[16, 16]}>{stackItems.map((i) => renderCard(i))}</Row>
              </div>
              
              <div style={{
                marginBottom: "24px"
              }}>
                <div style={{ 
                  marginBottom: "16px"
                }}>
                  <Title level={4} style={{ margin: 0, color: "#1890ff" }}>
                    ค่าที่ปรับแก้ (Corrected to 7% Vol Oxygen)
                  </Title>
                  <Text type="secondary" style={{ fontSize: "14px" }}>
                    Calibrated values for standard oxygen concentration
                  </Text>
                </div>
                
                <Row gutter={[16, 16]}>{correctedItems.map((i) => renderCard(i, true))}</Row>
              </div>
            </>
          )}

                    {/* global version badge is handled in SidebarLayout */}
        </div>
      
 
    </div>
  );
}
