import { useState, useEffect, useRef } from "react";
import { useConnection } from "../context/ConnectionContext.jsx";

export default function SystemAlertBar() {
  const { status, showSuccess } = useConnection();

  // ✅ ไม่แสดงอะไรถ้า status ยังเป็น null (กำลังโหลด)
  if (status === null) {
    return null;
  }

  // แสดงข้อความสำเร็จเมื่อเชื่อมต่อได้และยังไม่หมดเวลา
  if (status === "connected" && showSuccess) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: "#f6ffed",
          color: "#389e0d",
          padding: "8px 12px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ✅ เชื่อมต่อกับ Modbus สำเร็จ
      </div>
    );
  }

  // เมื่อเชื่อมต่อได้แล้วแต่หมดเวลาแสดงข้อความสำเร็จแล้ว - ไม่แสดงอะไร
  if (status === "connected" && !showSuccess) {
    return null;
  }

  if (status === "modbus_error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          background: "#fffbe6",
          color: "#d48806",
          padding: "8px 12px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ⚠ Server ทำงาน แต่เชื่อมต่อ Modbus ไม่ได้ กรุณาตรวจสอบการตั้งค่าหรือการเชื่อมต่อ Modbus ว่าถูกต้องหรือไม่
      </div>
    );
  }

  if (status === "server_error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          background: "#fff2f0",
          color: "#cf1322",
          padding: "8px 12px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ❌ ไม่สามารถเชื่อมต่อ Server ได้
      </div>
    );
  }

  return null;
}
