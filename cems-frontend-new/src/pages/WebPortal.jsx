import { useState, useEffect, useRef } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Statistic,
  Button,
  Space,
  Tabs,
  Table,
  Tag,
  notification,
  Spin,
  Tooltip,
  Modal,
  DatePicker,
  Radio,
  Alert,
} from "antd";
import {
  DashboardOutlined,
  BarChartOutlined,
  SettingOutlined,
  CloudOutlined,
  FireOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function WebPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [gasData, setGasData] = useState({});
  const [statusData, setStatusData] = useState({});
  const [systemStatus, setSystemStatus] = useState("online");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState({});
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadDates, setDownloadDates] = useState([]);
  const [fileType, setFileType] = useState("excel");
  const [modbusStatus, setModbusStatus] = useState(null); // เพิ่ม state

  const gasSocketRef = useRef(null);
  const statusSocketRef = useRef(null);

  // ✅ Check API health
  const checkApiHealth = async () => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        setApiStatus({ status: "healthy", timestamp: data.time });
        setSystemStatus("online");
      } else {
        setApiStatus({ status: "unhealthy", error: "Health check failed" });
        setSystemStatus("offline");
      }
    } catch (error) {
      console.error("API health check error:", error);
      setApiStatus({ status: "error", error: error.message });
      setSystemStatus("offline");
    }
  };

  // ✅ WebSocket connections
  const connectWebSockets = () => {
    const wsBase = import.meta.env.VITE_BACKEND_URL?.replace(/^http/, "ws") || "ws://localhost:8000";

    // Gas WebSocket
    const gasWs = new WebSocket(`${wsBase}/ws/gas`);
    gasSocketRef.current = gasWs;
    gasWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.connection_status) {
        setModbusStatus(msg.connection_status);
      }
      if ((msg.type === "gas" || msg.type === "all") && msg.gas) {
        const [so2, nox, o2, co, dust, temp, velocity, flowrate, pressure] = msg.gas;
        setGasData({
          SO2: so2,
          NOx: nox,
          O2: o2,
          CO: co,
          Dust: dust,
          Temperature: temp,
          Velocity: velocity,
          Flowrate: flowrate,
          Pressure: pressure,
        });
        setLastUpdated(dayjs().format("YYYY-MM-DD HH:mm:ss"));
      }
    };

    // Status WebSocket
    const statusWs = new WebSocket(`${wsBase}/ws/status`);
    statusSocketRef.current = statusWs;
    statusWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.connection_status) {
        setModbusStatus(msg.connection_status);
      }
      if (msg.type === "status" && msg.values) {
        setStatusData(msg.values);
      }
    };

    // Error handling
    [gasWs, statusWs].forEach((ws) => {
      ws.onerror = () => {
        console.warn("⚠ WebSocket error");
        setSystemStatus("offline");
      };
      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        setSystemStatus("offline");
      };
    });
  };

  useEffect(() => {
    checkApiHealth();
    connectWebSockets();

    const healthInterval = setInterval(checkApiHealth, 30000);

    return () => {
      clearInterval(healthInterval);
      gasSocketRef.current?.close();
      statusSocketRef.current?.close();
    };
  }, []);

  // ✅ Download Confirm
  const handleConfirmDownload = () => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    let url = `${baseUrl}/download-logs`;
    if (downloadDates.length === 2) {
      const from = dayjs(downloadDates[0]).format("YYYY-MM-DD");
      const to = dayjs(downloadDates[1]).format("YYYY-MM-DD");
      url += `?from_date=${from}&to_date=${to}`;
    }
    url += (url.includes("?") ? "&" : "?") + `type=${fileType}`;
    window.open(url, "_blank");
    notification.success({
      message: "📥 Download Started",
      description: `กำลังดาวน์โหลดไฟล์ Data Logs (${fileType.toUpperCase()}) จากเซิร์ฟเวอร์...`,
    });
    setDownloadModalVisible(false);
  };

  // ✅ Dashboard Card (with Threshold Colors)
  const getThresholdColor = (param, value) => {
    if (value === "--") return "#bfbfbf";
    const v = parseFloat(value);
    switch (param) {
      case "SO2": return v > 80 ? "#ff4d4f" : v > 50 ? "#faad14" : "#52c41a";
      case "NOx": return v > 200 ? "#ff4d4f" : v > 150 ? "#faad14" : "#52c41a";
      case "CO": return v > 50 ? "#ff4d4f" : v > 30 ? "#faad14" : "#52c41a";
      case "Dust": return v > 50 ? "#ff4d4f" : v > 30 ? "#faad14" : "#52c41a";
      default: return "#1890ff";
    }
  };

  const renderDashboardCard = (title, value, unit, icon, paramKey) => {
    const color = getThresholdColor(paramKey, value);
    return (
      <Col xs={24} sm={12} md={8} lg={6} key={title}>
        <Card
          hoverable
          style={{
            borderLeft: `4px solid ${color}`,
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Statistic
            title={<Space>{icon}<span>{title}</span></Space>}
            value={value}
            suffix={unit}
            valueStyle={{ color }}
          />
        </Card>
      </Col>
    );
  };

  const renderSystemStatus = () => (
    <Card
      title={<Space><GlobalOutlined /> System Status</Space>}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Alert
            message="Connection Status"
            description={
              <Space>
                <CheckCircleOutlined style={{ color: systemStatus === "online" ? "#52c41a" : "#ff4d4f" }} />
                {systemStatus === "online" ? "Online" : "Offline"}
              </Space>
            }
            type={systemStatus === "online" ? "success" : "error"}
          />
        </Col>
        <Col span={12}>
          <Alert
            message="Last Updated"
            description={<Space><ClockCircleOutlined />{lastUpdated || "No data"}</Space>}
            type="info"
          />
        </Col>
      </Row>
    </Card>
  );

  const renderQuickActions = () => (
    <Card title="Quick Actions" style={{ marginBottom: 16 }}>
      <Space wrap>
        <Button type="primary" icon={<DownloadOutlined />} onClick={() => setDownloadModalVisible(true)}>
          Download Report
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1000);
            notification.success({ message: "Data Refreshed", description: "All data has been updated" });
          }}
        >
          Refresh Data
        </Button>
        <Button icon={<SettingOutlined />} onClick={() => setActiveTab("control")}>
          System Settings
        </Button>
      </Space>
    </Card>
  );

  const dataColumns = [
    { title: "Parameter", dataIndex: "parameter", key: "parameter" },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (v, record) => <Tag color={getThresholdColor(record.parameter, v)}>{v}</Tag>,
    },
    { title: "Unit", dataIndex: "unit", key: "unit" },
  ];

  const dataSource = [
    { key: "so2", parameter: "SO2", value: gasData.SO2 || "--", unit: "ppm" },
    { key: "nox", parameter: "NOx", value: gasData.NOx || "--", unit: "ppm" },
    { key: "o2", parameter: "O2", value: gasData.O2 || "--", unit: "%" },
    { key: "co", parameter: "CO", value: gasData.CO || "--", unit: "ppm" },
    { key: "dust", parameter: "Dust", value: gasData.Dust || "--", unit: "mg/m³" },
    { key: "temperature", parameter: "Temperature", value: gasData.Temperature || "--", unit: "°C" },
  ];

  return (
    <div style={{ padding: 24, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      {/* แจ้งเตือนสถานะ Modbus */}
      {modbusStatus === "error" && (
        <div style={{ background: '#fff2f0', color: '#cf1322', padding: 12, textAlign: 'center', fontWeight: 600 }}>
          ❌ ไม่สามารถเชื่อมต่อกับ Modbus ได้ กรุณาตรวจสอบการตั้งค่า/สายสัญญาณ
        </div>
      )}
      {modbusStatus === "connected" && (
        <div style={{ background: '#f6ffed', color: '#389e0d', padding: 12, textAlign: 'center', fontWeight: 600 }}>
          ✅ เชื่อมต่อกับ Modbus สำเร็จ
        </div>
      )}
      <Spin spinning={loading}>
        <div style={{ marginBottom: 24 }}>
          <Title level={2}><GlobalOutlined style={{ marginRight: 8 }} />CEMS Management Portal</Title>
          <Text type="secondary">จุดศูนย์รวมการจัดการระบบ CEMS แบบครบวงจร</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: "dashboard",
              label: <span><DashboardOutlined /> Dashboard Hub</span>,
              children: (
                <>
                  {renderSystemStatus()}
                  {renderQuickActions()}
                  <Row gutter={[16, 16]}>
                    {renderDashboardCard("SO₂", gasData.SO2 || "--", "ppm", <CloudOutlined />, "SO2")}
                    {renderDashboardCard("NOx", gasData.NOx || "--", "ppm", <FireOutlined />, "NOx")}
                    {renderDashboardCard("O₂", gasData.O2 || "--", "%", <DashboardOutlined />, "O2")}
                    {renderDashboardCard("CO", gasData.CO || "--", "ppm", <CloudOutlined />, "CO")}
                    {renderDashboardCard("Dust", gasData.Dust || "--", "mg/m³", <ExperimentOutlined />, "Dust")}
                    {renderDashboardCard("Temperature", gasData.Temperature || "--", "°C", <FireOutlined />, "Temperature")}
                  </Row>
                </>
              ),
            },
            {
              key: "data",
              label: <span><BarChartOutlined /> Data Management</span>,
              children: (
                <Card title="Real-time Data">
                  <Table dataSource={dataSource} columns={dataColumns} pagination={false} size="small" />
                </Card>
              ),
            },
            {
              key: "control",
              label: <span><SettingOutlined /> System Control</span>,
              children: (
                <Card title="System Status Overview">
                  <Row gutter={[16, 16]}>
                    <Col span={8}><Statistic title="Active Connections" value={3} prefix={<CheckCircleOutlined />} /></Col>
                    <Col span={8}><Statistic title="Alarms" value={0} prefix={<WarningOutlined />} /></Col>
                    <Col span={8}><Statistic title="System Health" value={95} suffix="%" prefix={<CheckCircleOutlined />} /></Col>
                  </Row>
                </Card>
              ),
            },
          ]}
        />
      </Spin>

      {/* ✅ Download Modal */}
      <Modal
        title="📥 เลือกวันที่และประเภทไฟล์สำหรับดาวน์โหลด"
        open={downloadModalVisible}
        onCancel={() => setDownloadModalVisible(false)}
        onOk={handleConfirmDownload}
        okText="Download"
      >
        <Radio.Group
          value={fileType}
          onChange={e => setFileType(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="excel">Excel (.xlsx)</Radio.Button>
          <Radio.Button value="pdf">PDF (.pdf)</Radio.Button>
          <Radio.Button value="csv">CSV (.csv)</Radio.Button>
        </Radio.Group>
        <RangePicker onChange={val => setDownloadDates(val)} />
      </Modal>
    </div>
  );
}
