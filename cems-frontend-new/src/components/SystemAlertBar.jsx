import { useState, useEffect, useRef } from "react";

export default function SystemAlertBar() {
  const [status, setStatus] = useState(null); // "server_error" | "modbus_error" | "connected"
  const [showSuccess, setShowSuccess] = useState(true);
  const successTimer = useRef(null);
  const lastStatusRef = useRef(null);

  useEffect(() => {
    // ฟังก์ชันตรวจสอบสถานะจาก window object
    const checkStatus = () => {
      try {
        // ตรวจสอบจาก window object ที่ Home page ส่งมา
        if (window.cemsStatus) {
          const { connection_status, has_real_data } = window.cemsStatus;
          
          let newStatus = "modbus_error";
          
          if (connection_status === "connected" || has_real_data === true) {
            newStatus = "connected";
          } else if (connection_status === "error") {
            newStatus = "modbus_error";
          }

          // ป้องกันการเปลี่ยนสถานะถี่เกินไป
          if (lastStatusRef.current !== newStatus) {
            lastStatusRef.current = newStatus;
            setStatus(newStatus);

            if (newStatus === "connected") {
              setShowSuccess(true);

              // ลบ timer เก่า (ถ้ามี)
              if (successTimer.current) {
                clearTimeout(successTimer.current);
              }

              // ตั้ง timer ให้ซ่อนข้อความสำเร็จหลังจาก 10 วินาที
              successTimer.current = setTimeout(() => {
                setShowSuccess(false);
              }, 10000);
            } else {
              setShowSuccess(false);
            }
          }
        } else {
          // ถ้ายังไม่มีข้อมูล ให้แสดง server_error
          if (lastStatusRef.current !== "server_error") {
            lastStatusRef.current = "server_error";
            setStatus("server_error");
            setShowSuccess(false);
          }
        }
      } catch (error) {
        console.warn("❌ SystemAlertBar Error:", error);
      }
    };

    // ตรวจสอบทุก 1 วินาที
    const interval = setInterval(checkStatus, 1000);
    
    // ตรวจสอบครั้งแรกทันที
    checkStatus();

    return () => {
      clearInterval(interval);
      if (successTimer.current) {
        clearTimeout(successTimer.current);
      }
    };
  }, []);

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
