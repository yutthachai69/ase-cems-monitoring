import { useState } from "react"
import Sidebar from "./Sidebar"
import { Outlet } from "react-router-dom"
import TopBarUser from "./TopBarUser"
import { CONFIG } from "../config/config"

export default function SidebarLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* ส่ง setCollapsed ไป Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main
        style={{
          marginLeft: collapsed ? 80 : 240,
          padding: 24,
          background: "#f5f5f5",
          minHeight: "100vh",
          transition: "margin-left 0.3s ease",
        }}
      >
        {/* Top header with title and user control */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 12,
            marginBottom: 24,
            borderBottom: "2px solid #1890ff",
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: "bold", color: "#001529", margin: 0 }}>
            Continuous Emission Monitoring Systems (CEMS)
          </h1>
          <TopBarUser />
        </div>

        <Outlet />

        {/* Global version badge (bottom-right) */}
        <div style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 1000 }}>
          <span style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#666' }}>
            {`v${CONFIG.APP_VERSION}`}
          </span>
        </div>
      </main>
    </>
  )
}
