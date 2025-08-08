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
import SystemAlertBar from "../components/SystemAlertBar"; // ✅ เพิ่มการ import

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
  const [alarmValues, setAlarmValues] = useState([false, false, false, false]);
  const [statusValues, setStatusValues] = useState(Array(15).fill(false));
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);

  const alarmItems = [
    "Temperature Controller Alarm",
    "Analyzer Malfunction",
    "Sample Probe Alarm",
    "Alarm Light",
  ];
  const statusItems = [
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

  const notifyNewAlarms = (newValues) => {
    const prev = JSON.parse(localStorage.getItem("cems_alarmValues_prev") || "[]");
    newValues.forEach((val, idx) => {
      if (!prev[idx] && val) {
        message.warning(`⚠ Alarm Active: ${alarmItems[idx]}`);
      }
    });
    localStorage.setItem("cems_alarmValues_prev", JSON.stringify(newValues));
  };

  const connectWebSocket = () => {
    setConnectionError(false);
    let gotData = false;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
    const wsUrl = `${backendUrl.replace(/^http/, "ws")}/ws/status`;

    if (socketRef.current && socketRef.current.readyState <= 1) {
      console.debug("🟡 WebSocket already connecting or open");
      return;
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => console.debug("✅ WebSocket for Status opened");

    ws.onmessage = (event) => {
      gotData = true;
      setConnectionError(false);
      const msg = JSON.parse(event.data);

      if (msg.type === "status" && Array.isArray(msg.values)) {
        const values = msg.values.map((v) => v === 1);
        const alarms = values.slice(15, 19);
        setStatusValues(values.slice(0, 15));
        setAlarmValues(alarms);
        notifyNewAlarms(alarms);
      }
    };

    ws.onerror = () => {
      setConnectionError(true);
      console.warn("⚠ WebSocket error");
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (!gotData) {
          setConnectionError(true);
          localStorage.removeItem("cems_alarmValues");
        }
      }, 2000);
      console.debug("🔌 WebSocket closed, reconnecting...");
      reconnectRef.current = setTimeout(connectWebSocket, 3000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      clearTimeout(reconnectRef.current);
      try {
        socketRef.current?.close();
      } catch (err) {
        console.warn("⚠ WebSocket close cleanup failed:", err);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      localStorage.removeItem("cems_alarmValues_prev");
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (err) {
        console.warn("⚠ Error closing WebSocket:", err);
      }
    } else {
      connectWebSocket();
    }
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
          const isOn = values[idx];
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
              {renderSection("Alarm", alarmItems, alarmValues, "#ff4d4f")}
              <Divider style={{ margin: "32px 0 24px" }} />
              {renderSection("Status", statusItems, statusValues, "#1890ff")}
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
