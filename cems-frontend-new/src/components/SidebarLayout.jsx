import { useState } from "react"
import Sidebar from "./Sidebar"
import { Outlet } from "react-router-dom"

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
        {/* ✅ หัวข้อกลางหน้าแบบเด่น */}
        <div
          style={{
            textAlign: "center",
            paddingBottom: 16,
            marginBottom: 32,
            borderBottom: "2px solid #1890ff",
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: "bold", color: "#001529", margin: 0 }}>
            Continuous Emission Monitoring Systems (CEMS)
          </h1>
        </div>

        <Outlet />
      </main>
    </>
  )
}
