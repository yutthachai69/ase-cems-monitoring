import { useEffect, useState, useRef } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Space,
  Button,
  Divider,
  Tooltip,
  Spin,
  message,
} from "antd";
import { ReloadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import SystemAlertBar from "../components/SystemAlertBar";

const { Title, Text } = Typography;

const StatusDot = ({ isOn, color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: "50%",
      backgroundColor: isOn ? color : "#d9d9d9",
      boxShadow: isOn ? `0 0 4px 2px ${color}66` : "none",
      marginRight: 8,
    }}
    title={isOn ? "ON" : "OFF"}
  />
);

export default function Status() {
  const [alarmValues, setAlarmValues] = useState([]);
  const [statusValues, setStatusValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);



  // ใช้ static data แทนการเชื่อมต่อ PLC/Modbus โดยตรง
  const [mappingData] = useState([]);

  // รายการ Status และ Alarm ที่แสดงบนหน้า Status (เหมือนเต้าเสียบ)
  const getStatusAlarmItems = () => {
    const statusItems = [];
    const alarmItems = [];

    // รายการเริ่มต้น (เหมือนเต้าเสียบที่ว่าง)
    const defaultStatusItems = [
      "Maintenance Mode",
      "Calibration Through Probe",
      "Manual Blowback Button",
      "Analyzer Calibration",
      "Analyzer Holding Zero",
      "Analyzer Zero Indicator",
      "Sampling SOV",
      "Sampling Pump",
      "Direct Calibration SOV",
      "Blowback SOV",
      "Calibration Through Probe SOV",
      "Calibration Through Probe Light",
      "Blowback Light",
      "Blowback in Operation",
      "Hold Current Value",
    ];
    
    const defaultAlarmItems = [
      "Temperature Controller Alarm",
      "Analyzer Malfunction",
      "Sample Probe Alarm",
      "Alarm Light",
    ];

    // ตรวจสอบ mapping data เพื่อดูว่าเต้าไหนถูกเสียบแล้ว
    mappingData.forEach(mapping => {
      const name = mapping.name;
      const description = mapping.description || name;
      
      // ตรวจสอบว่าเป็น Status หรือ Alarm
      if (name.toLowerCase().includes("alarm") || description.toLowerCase().includes("alarm") || 
          name.toLowerCase().includes("error") || description.toLowerCase().includes("error") ||
          name.toLowerCase().includes("malfunction") || description.toLowerCase().includes("malfunction")) {
        // เป็น Alarm
        if (!alarmItems.includes(name)) {
          alarmItems.push(name);
        }
      } else if (name.toLowerCase().includes("maintenance") || description.toLowerCase().includes("maintenance") ||
                 name.toLowerCase().includes("calibration") || description.toLowerCase().includes("calibration") ||
                 name.toLowerCase().includes("sampling") || description.toLowerCase().includes("sampling") ||
                 name.toLowerCase().includes("blowback") || description.toLowerCase().includes("blowback") ||
                 name.toLowerCase().includes("pump") || description.toLowerCase().includes("pump") ||
                 name.toLowerCase().includes("sov") || description.toLowerCase().includes("sov") ||
                 name.toLowerCase().includes("light") || description.toLowerCase().includes("light") ||
                 name.toLowerCase().includes("operation") || description.toLowerCase().includes("operation") ||
                 name.toLowerCase().includes("hold") || description.toLowerCase().includes("hold") ||
                 name.toLowerCase().includes("indicator") || description.toLowerCase().includes("indicator") ||
                 name.toLowerCase().includes("controller") || description.toLowerCase().includes("controller") ||
                 name.toLowerCase().includes("probe") || description.toLowerCase().includes("probe")) {
        // เป็น Status
        if (!statusItems.includes(name)) {
          statusItems.push(name);
        }
      }
    });

    // เพิ่มรายการเริ่มต้นที่ยังไม่ถูกเสียบ
    defaultStatusItems.forEach(item => {
      if (!statusItems.includes(item)) {
        statusItems.push(item);
      }
    });

    defaultAlarmItems.forEach(item => {
      if (!alarmItems.includes(item)) {
        alarmItems.push(item);
      }
    });

    console.log("Status items (with mapping):", statusItems);
    console.log("Alarm items (with mapping):", alarmItems);

    return { statusItems, alarmItems };
  };

  const { statusItems, alarmItems } = getStatusAlarmItems();

  // อัปเดตค่าเริ่มต้นเมื่อ statusItems และ alarmItems เปลี่ยน
  useEffect(() => {
    setStatusValues(Array(statusItems.length).fill(false));
    setAlarmValues(Array(alarmItems.length).fill(false));
  }, [statusItems.length, alarmItems.length]);

  const notifyNewAlarms = (newValues) => {
    const prev = JSON.parse(localStorage.getItem("cems_alarmValues_prev") || "[]");
    newValues.forEach((val, idx) => {
      if (!prev[idx] && val) {
        message.warning(`⚠ Alarm Active: ${alarmItems[idx]}`);
      }
    });
    localStorage.setItem("cems_alarmValues_prev", JSON.stringify(newValues));
  };

  // ใช้ static data แทนการเชื่อมต่อ WebSocket
  const loadStaticData = () => {
    // สร้าง mock data สำหรับทดสอบ
    const mockStatusValues = Array(statusItems.length).fill(false);
    const mockAlarmValues = Array(alarmItems.length).fill(false);
    
    // ตั้งค่าบางตัวเป็น ON เพื่อทดสอบ
    mockStatusValues[0] = true;  // Maintenance Mode
    mockStatusValues[2] = true;  // Manual Blowback Button
    mockAlarmValues[0] = true;   // Temperature Controller Alarm
    
    setStatusValues(mockStatusValues);
    setAlarmValues(mockAlarmValues);
    setConnectionError(false);
  };

  useEffect(() => {
    loadStaticData();
  }, []);

  useEffect(() => {
    return () => {
      localStorage.removeItem("cems_alarmValues_prev");
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    loadStaticData();
    setTimeout(() => setLoading(false), 1000);
  };

  const renderSection = (title, items, values, color) => (
    <>
      <Title level={4} style={{ marginTop: 32, marginBottom: 12 }}>
        <Space>
          <StatusDot isOn={true} color={color} />
          {title}
        </Space>
      </Title>
      <Row gutter={[16, 12]}>
        {items.map((item, idx) => {
          const isOn = values[idx] || false;
          return (
            <Col xs={24} sm={24} md={12} lg={8} key={idx} style={{ minWidth: 0 }}>
              <Card
                size="small"
                style={{
                  borderLeft: `4px solid ${color}`,
                  borderRadius: 8,
                  backgroundColor: isOn ? `${color}10` : "#fff",
                  transition: "all 0.3s ease",
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                  marginBottom: 8
                }}
              >
                <Space>
                  <StatusDot isOn={isOn} color={color} />
                  <Text
                    id={`text${title}${idx}`}
                    style={{
                      fontSize: 13,
                      color: isOn ? "#000" : "#555",
                      fontWeight: isOn ? "bold" : "normal",
                      wordBreak: 'break-word',
                    }}
                  >
                    {item}: {isOn ? "ON" : "OFF"}
                  </Text>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </>
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh", padding: 0, background: "#f5f7fa" }}>
      {/* ✅ ป้ายสถานะ Modbus จาก Component กลาง */}
      <SystemAlertBar />

      <Spin
        spinning={loading}
        tip="กำลังโหลดข้อมูล..."
        size="large"
        style={{
          position: "absolute",
          zIndex: 1000,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.7)",
        }}
      >
        <div style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 4px 24px 0 rgba(0,0,0,0.07)",
          padding: 32,
          minHeight: 600
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Space>
              <Title level={3} style={{ margin: 0, letterSpacing: 1, color: "#22306b" }}>
                System Status
              </Title>
              <Tooltip title="Live status from Modbus">
                <InfoCircleOutlined style={{ color: "#1890ff" }} />
              </Tooltip>
            </Space>
            <Button
              icon={<ReloadOutlined />}
              type="primary"
              onClick={handleRefresh}
              loading={loading}
              style={{ borderRadius: 8, background: "#f0f5ff", color: "#22306b", border: "none", fontWeight: 600 }}
              size="large"
            >
              Refresh
            </Button>
          </div>
          {connectionError ? (
            <div
              style={{
                marginTop: 48,
                textAlign: "center",
                color: "#ff4d4f",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              <InfoCircleOutlined
                style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }}
              />
              <div>ไม่สามารถเชื่อมต่อข้อมูลได้</div>
              <div style={{ fontSize: 16, color: "#888", marginTop: 8 }}>
                กรุณาตรวจสอบการเชื่อมต่อหรือกด Refresh อีกครั้ง
              </div>
            </div>
          ) : (
            <>
              {alarmItems.length > 0 && renderSection("Alarm", alarmItems, alarmValues, "#ff4d4f")}
              {alarmItems.length > 0 && statusItems.length > 0 && <Divider style={{ margin: "32px 0 24px" }} />}
              {statusItems.length > 0 && renderSection("Status", statusItems, statusValues, "#1890ff")}
            </>
          )}
        </div>
      </Spin>
      <style>{`
        .ant-card {
          transition: box-shadow 0.2s, border-color 0.2s;
          max-width: 100%;
          min-width: 0;
        }
        .ant-card:hover {
          box-shadow: 0 6px 24px 0 rgba(24, 144, 255, 0.10);
          border-color: #91d5ff;
        }
        @media (max-width: 900px) {
          .ant-card { min-width: 0 !important; max-width: 100% !important; }
          div[style*='maxWidth: 1100px'] { padding: 12px !important; }
        }
        @media (max-width: 600px) {
          .ant-card { min-width: 0 !important; max-width: 100% !important; }
          div[style*='maxWidth: 1100px'] { padding: 2px !important; }
        }
      `}</style>
    </div>
  );
}
