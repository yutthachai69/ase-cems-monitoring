// 🚧 TO BE CONTINUE - Blowback Page
// This page is temporarily disabled for future development

import { useState, useEffect, useRef } from "react";
import {
  Typography,
  Row,
  Col,
  Button,
  Input,
  Space,
  message,
  Divider,
  notification,
  Spin,
  Modal,
  Card,
} from "antd";
import SystemAlertBar from "../components/SystemAlertBar";

const { Title, Text } = Typography;

// ✅ Pulse Dot
const StatusDot = ({ isOn }) => (
  <span
    style={{
      display: "inline-block",
      width: 14,
      height: 14,
      borderRadius: "50%",
      marginRight: 8,
      backgroundColor: isOn ? "#52c41a" : "#bfbfbf",
      boxShadow: isOn ? "0 0 6px 2px rgba(82, 196, 26, 0.5)" : "none",
      animation: isOn ? "pulse 1.5s infinite ease-in-out" : "none",
    }}
  />
);

// ✅ CSS Keyframe
const globalStyle = `
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.5); }
  70% { box-shadow: 0 0 0 10px rgba(82, 196, 26, 0); }
  100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
}
`;

export default function Blowback() {
  // 🚧 TO BE CONTINUE - Blowback functionality temporarily disabled
  return (
    <div style={{ padding: "24px", textAlign: "center" }}>
      <SystemAlertBar />
      <div style={{ 
        marginTop: "100px", 
        padding: "40px", 
        backgroundColor: "#f5f5f5", 
        borderRadius: "8px",
        border: "2px dashed #d9d9d9"
      }}>
        <Title level={2} style={{ color: "#666" }}>
          🚧 Blowback System
        </Title>
        <Title level={3} style={{ color: "#999", marginTop: "20px" }}>
          To Be Continue...
        </Title>
        <Text type="secondary" style={{ fontSize: "16px" }}>
          This feature is under development and will be available soon.
        </Text>
      </div>
    </div>
  );

  // 🚧 COMMENTED OUT - Original Blowback functionality
  /*
  const settingFields = [
    { label: "Blowback Every", unit: "Min.", id: "every" },
    { label: "Period", unit: "Min.", id: "period" },
    { label: "Hold Value", unit: "Sec.", id: "hold" },
    { label: "Pulse ON", unit: "Sec.", id: "pulseOn" },
    { label: "Pulse OFF", unit: "Sec.", id: "pulseOff" },
  ];

  const [settings, setSettings] = useState({
    every: "",
    period: "",
    hold: "",
    pulseOn: "",
    pulseOff: "",
  });
  const [statusValues, setStatusValues] = useState(Array(6).fill(false));
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [isBlowbackRunning, setIsBlowbackRunning] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [modbusStatus, setModbusStatus] = useState(null);

  const socketRef = useRef(null);

  // Load Settings
  const loadBlowbackSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/get-blowback-settings`);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("⚠️ Load settings error:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Save Settings
  const handleSave = async () => {
    const requiredFields = ["period", "hold", "pulseOn", "pulseOff"];
    const missingFields = requiredFields.filter(
      (field) =>
        !settings[field] ||
        settings[field] === "0" ||
        parseInt(settings[field]) <= 0
    );

    if (missingFields.length > 0) {
      notification.error({
        message: "❌ Invalid Settings",
        description: `กรุณากรอกค่าที่จำเป็น: ${missingFields.join(", ")}`,
        duration: 6,
      });
      return;
    }

    if (settings.every === "" || parseInt(settings.every) < 0) {
      notification.error({
        message: "❌ Invalid Settings",
        description: "ค่า 'Blowback Every' ต้องไม่เป็นลบ",
        duration: 6,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/write-blowback-settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }
      );
      const data = await res.json();
      if (data.success) {
        notification.success({
          message: "✅ Saved Successfully",
          description: data.message,
          duration: 4,
        });
        console.log("✅ Blowback settings saved:", settings);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      notification.error({
        message: "❌ Save Failed",
        description: err.message,
        duration: 6,
      });
      console.error("❌ Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Confirm Modal → Trigger Blowback
  const handleManualBlowback = async () => {
    setConfirmModalVisible(false);
    setTriggering(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/trigger-manual-blowback`,
        {
          method: "POST",
        }
      );
      const data = await res.json();
      if (data.success) {
        notification.success({
          message: "🚀 Blowback Started",
          description: "ระบบเริ่ม Blowback แล้ว",
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      notification.error({
        message: "❌ Blowback Failed",
        description: err.message,
      });
    } finally {
      setTriggering(false);
    }
  };

  // WebSocket Status
  const connectWebSocket = () => {
    const wsUrl = `${import.meta.env.VITE_BACKEND_URL.replace(/^http/, "ws")}/ws/blowback-status`;
    if (socketRef.current && socketRef.current.readyState <= 1) return;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.connection_status) {
        setModbusStatus(msg.connection_status);
      }
      if (msg.values) {
        setStatusValues(msg.values);
      }
      if (msg.alerts) {
        // Handle alerts if needed
      }
    };
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    ws.onclose = () => {
      console.log("WebSocket closed");
      setTimeout(connectWebSocket, 5000);
    };
  };

  const isSettingsValid = () => {
    return (
      settings.period &&
      settings.hold &&
      settings.pulseOn &&
      settings.pulseOff &&
      parseInt(settings.period) > 0 &&
      parseInt(settings.hold) > 0 &&
      parseInt(settings.pulseOn) > 0 &&
      parseInt(settings.pulseOff) > 0
    );
  };

  useEffect(() => {
    loadBlowbackSettings();
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <SystemAlertBar />
      <style>{globalStyle}</style>
      
      <Title level={2}>🧹 Blowback System</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="⚙️ Settings" size="small">
            <Space direction="vertical" style={{ width: "100%" }}>
              {settingFields.map((field) => (
                <div key={field.id}>
                  <Text strong>{field.label}:</Text>
                  <Input
                    type="number"
                    placeholder={`Enter ${field.label}`}
                    value={settings[field.id]}
                    onChange={(e) =>
                      setSettings({ ...settings, [field.id]: e.target.value })
                    }
                    addonAfter={field.unit}
                    style={{ marginTop: 4 }}
                  />
                </div>
              ))}
              
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!isSettingsValid()}
                style={{ marginTop: 16 }}
              >
                💾 Save Settings
              </Button>
            </Space>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="Status" size="small">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>Modbus Status: </Text>
                <Tag color={modbusStatus ? "green" : "red"}>
                  {modbusStatus ? "Connected" : "Disconnected"}
                </Tag>
              </div>
              
              <Divider />
              
              <div>
                <Text strong>Blowback Status:</Text>
                <div style={{ marginTop: 8 }}>
                  <div>
                    <StatusDot isOn={statusValues[0]} />
                    <Text>Blowback Every</Text>
                  </div>
                  <div>
                    <StatusDot isOn={statusValues[1]} />
                    <Text>Period</Text>
                  </div>
                  <div>
                    <StatusDot isOn={statusValues[2]} />
                    <Text>Hold Value</Text>
                  </div>
                  <div>
                    <StatusDot isOn={statusValues[3]} />
                    <Text>Pulse ON</Text>
                  </div>
                  <div>
                    <StatusDot isOn={statusValues[4]} />
                    <Text>Pulse OFF</Text>
                  </div>
                  <div>
                    <StatusDot isOn={statusValues[5]} />
                    <Text>Trigger</Text>
                  </div>
                </div>
              </div>
              
              <Button
                type="primary"
                danger
                onClick={() => setConfirmModalVisible(true)}
                loading={triggering}
                disabled={!modbusStatus}
                style={{ marginTop: 16 }}
              >
                🚀 Manual Blowback
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
      
      <Modal
        title="🚀 Confirm Manual Blowback"
        open={confirmModalVisible}
        onOk={handleManualBlowback}
        onCancel={() => setConfirmModalVisible(false)}
        okText="Start Blowback"
        cancelText="Cancel"
      >
        <p>Are you sure you want to start manual blowback?</p>
        <p>This will trigger the blowback sequence immediately.</p>
      </Modal>
    </div>
  );
  */
}
