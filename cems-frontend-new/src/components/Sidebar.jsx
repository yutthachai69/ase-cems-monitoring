import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Layout, Menu, Typography, Tooltip } from "antd";
import {
  HomeOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SyncOutlined,
  GlobalOutlined,
  SettingOutlined,
  ExperimentOutlined,
  LineChartOutlined,
} from "@ant-design/icons";

// ✅ นำไฟล์ไปไว้ที่ src/assets/
import AseLogo from "../assets/Ase_logo.png";
import AseSmallLogo from "../assets/Ase.png";

const { Sider } = Layout;
const { Text } = Typography;

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // แปลงเป็นปี พ.ศ.
      const thaiYear = now.getFullYear() + 543;
      const thaiDate = `${now.getDate()}/${now.getMonth() + 1}/${thaiYear}`;
      setDate(thaiDate);
      setTime(now.toLocaleTimeString("th-TH", { hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const spinStyle = (
    <style>
      {`
        .spin-hover:hover {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
    </style>
  );

  const menuItems = [
    { key: "/", icon: <HomeOutlined />, label: <Link to="/">HOME</Link> },
    { key: "/status", icon: <DashboardOutlined />, label: <Link to="/status">STATUS</Link> },
    { key: "/logs", icon: <FileTextOutlined />, label: <Link to="/logs">DATA LOGS</Link> },
    { key: "/graph", icon: <LineChartOutlined />, label: <Link to="/graph">GRAPH</Link> },
    { 
      key: "/blowback", 
      icon: (
        <Tooltip title="🚧 To Be Continue..." placement="right">
          <SyncOutlined className="spin-hover" />
        </Tooltip>
      ), 
      label: (
        <Tooltip title="🚧 To Be Continue..." placement="right">
          <Link to="/blowback">BLOWBACK</Link>
        </Tooltip>
      ) 
    },
    { key: "/config", icon: <SettingOutlined />, label: <Link to="/config">CONFIG</Link> },
  ];

  return (
    <Sider
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint="lg"
      onBreakpoint={(broken) => setCollapsed(broken)}
      width={240}
      collapsedWidth={80}
      style={{
        background: "#001529",
        color: "white",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        left: 0,
        zIndex: 10,
      }}
    >
      {spinStyle}

      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* 🔼 TOP Section */}
        <div style={{ textAlign: "center", padding: collapsed ? 16 : 24 }}>
          <img
            src={AseLogo}
            alt="TPP Logo"
            style={{ width: collapsed ? 40 : 100, marginBottom: 8 }}
          />
          {!collapsed && (
            <>
              <div style={{ fontWeight: "bold", fontSize: 13, marginTop: 4 }}>
                TEST <br /> PRODUCTS
              </div>
              <hr style={{ margin: "8px 0", borderColor: "#2c3e50" }} />
              <Text style={{ fontSize: 12, color: "#f0f0f0" }}>{date}</Text>
              <br />
              <Text style={{ fontSize: 12, color: "#f0f0f0" }}>{time}</Text>
              <hr style={{ marginTop: 8, borderColor: "#2c3e50" }} />
            </>
          )}
        </div>

        {/* 📋 MENU */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ flexGrow: 1 }}
          />
        </div>

        {/* 🔽 Bottom ASE Logo + Web Portal */}
        <div
          style={{
            textAlign: "center",
            padding: collapsed ? "12px 0" : "12px 16px",
            marginTop: "auto",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#001529",
          }}
        >
          {/* Web Portal Button */}
          <div style={{ marginBottom: 16 }}>
            <Link to="/portal">
              <button
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#fadb14",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: "bold",
                  fontSize: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#faad14";
                  e.target.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#fadb14";
                  e.target.style.transform = "scale(1)";
                }}
              >
                <GlobalOutlined />
                {!collapsed && "WEB PORTAL"}
              </button>
            </Link>
          </div>
          
          <img
            src={AseSmallLogo}
            alt="ASE Logo"
            style={{ width: collapsed ? 40 : 80, transition: "width 0.3s" }}
          />
          {!collapsed && (
            <div style={{ fontSize: 12, color: "gray", marginTop: 4 }}>
              TEST PRODUCTS by ASE
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>
        </div>
      </div>
    </Sider>
  );
};

export default Sidebar;
