import React, { useState } from "react";
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Alert,
  message,
  Row,
  Col,
  Divider,
  Tag,
  Tooltip,
  Space,
  Popover,
  Progress,
  theme,
} from "antd";
import {
  LockOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext.jsx";

const { Title, Text } = Typography;

// ---------------- helpers ----------------
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const pick = () => letters[Math.floor(Math.random() * letters.length)];
function genPassword() {
  // รูปแบบจำง่าย: AA + ปี 2 หลัก + เลข 2 หลัก  (เช่น AB25 07)
  const year = new Date().getFullYear().toString().slice(-2);
  const n = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${pick()}${pick()}${year}${n}`;
}
// ประเมินความแข็งแรงของรหัสผ่านแบบง่าย
function scorePassword(pw = "") {
  let score = 0;
  if (pw.length >= 6) score += 25;
  if (pw.length >= 10) score += 15;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 25;
  if (/\d/.test(pw)) score += 15;
  if (/[!@#$%^&*()_\-+=[\]{};:'",.<>/?`~]/.test(pw)) score += 20;
  return Math.min(score, 100);
}
function strengthColor(score) {
  if (score >= 80) return { status: "success", text: "แข็งแรงมาก" };
  if (score >= 60) return { status: "normal", text: "แข็งแรง" };
  if (score >= 40) return { status: "exception", text: "พอใช้" };
  return { status: "exception", text: "อ่อน" };
}

export default function Account() {
  const { token } = theme.useToken();
  const { role, logout } = useAuth();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, text: "" });
  const [caps1, setCaps1] = useState(false);
  const [caps2, setCaps2] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  const auth = (() => {
    try {
      return JSON.parse(localStorage.getItem("auth")) || {};
    } catch {
      return {};
    }
  })();

  const newPw = Form.useWatch("new_password", form);
  const confirmPw = Form.useWatch("confirm_password", form);
  const match = !!newPw && !!confirmPw && newPw === confirmPw;
  const sc = scorePassword(newPw);
  const sInfo = strengthColor(sc);

  const onFinish = async (values) => {
    if (values.new_password !== values.confirm_password) {
      setFeedback({ type: "error", text: "รหัสผ่านใหม่ไม่ตรงกัน" });
      message.error("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({
          username: role === "admin" ? "admin" : "user",
          old_password: values.old_password,
          new_password: values.new_password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      setFeedback({
        type: "success",
        text: "เปลี่ยนรหัสผ่านสำเร็จ กำลังออกจากระบบ...",
      });
      message.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setTimeout(() => logout(), 1200);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ",
      });
      message.error(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const pwTips = (
    <div style={{ fontSize: 12 }}>
      <div style={{ marginBottom: 6 }}>
        <b>แนวทางตั้งรหัสผ่าน</b>
      </div>
      <ul style={{ paddingLeft: 16, margin: 0, lineHeight: 1.6 }}>
        <li>ยาวอย่างน้อย 6 ตัวอักษร (แนะนำ 10+)</li>
        <li>ผสมตัวใหญ่/ตัวเล็ก, ตัวเลข และอักขระพิเศษ</li>
        <li>หลีกเลี่ยงข้อมูลส่วนตัว เช่น วันเกิด/เบอร์โทร</li>
      </ul>
    </div>
  );

  return (
    <div
      className="account-page"
      style={{ maxWidth: 980, margin: "0 auto", padding: 24, position: "relative" }}
    >
      {/* --------- Modern UI + Animations (UI only) --------- */}
      <style>{`
        /* Aurora + subtle grid background */
        .account-page::before{
          content:''; position:absolute; inset:-80px; z-index:0;
          background:
            radial-gradient(50% 40% at 0% 0%, ${token.colorPrimary}26, transparent 60%),
            radial-gradient(45% 35% at 100% 0%, ${token.colorInfo}24, transparent 60%),
            radial-gradient(55% 45% at 50% 110%, ${token.colorSuccess}20, transparent 60%),
            linear-gradient(transparent 49px, ${token.colorBorderSecondary}22 50px) 0 0/ 24px 24px,
            linear-gradient(90deg, transparent 49px, ${token.colorBorderSecondary}22 50px) 0 0/ 24px 24px;
          /* animation disabled per request */
          /* animation: floatBg 16s ease-in-out infinite alternate; */
          pointer-events:none; filter: saturate(108%);
        }
        @keyframes floatBg{ from{ transform: translateY(0px);} to{ transform: translateY(14px);} }

        /* Main card with animated gradient border */
        .account-card{
          position:relative; z-index:1; border-radius:20px; overflow:hidden;
          background: ${token.colorBgElevated}cc; backdrop-filter: blur(8px);
          border:1px solid transparent;
          background-image:
             linear-gradient(${token.colorBgElevated}, ${token.colorBgElevated}) padding-box,
             conic-gradient(from 180deg, ${token.colorPrimary}, ${token.colorInfo}, ${token.colorSuccess}, ${token.colorPrimary}) border-box;
          /* animation: spinBorder 14s linear infinite; */
          box-shadow: 0 18px 42px rgba(0,0,0,.12);
        }
        @keyframes spinBorder { to{ filter:hue-rotate(360deg);} }

        .header-bar{
          position:relative;
          background: linear-gradient(100deg, ${token.colorPrimary}, ${token.colorInfo});
          color:#fff; padding: 18px 22px;
        }
        .header-bar .title{ margin:0; color:#fff; letter-spacing:.2px; }
        .header-bar .role-chip{
          font-size:12px; padding:4px 10px; border-radius:999px;
          background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35);
        }

        /* Inputs micro-interaction */
        .account-form .ant-input-affix-wrapper{
          transition: box-shadow .18s ease, transform .18s ease, background .18s ease;
          background: ${token.colorBgContainer};
        }
        .account-form .ant-input-affix-wrapper-focused{
          box-shadow: 0 0 0 4px ${token.colorPrimary}33; transform: translateY(-1px);
          background: linear-gradient(0deg, ${token.colorBgContainer}, ${token.colorBgContainer});
        }

        /* Gradient primary button */
        .btn-gradient{
          background: linear-gradient(90deg, ${token.colorPrimary}, ${token.colorInfo});
          border: none; color:#fff; box-shadow: 0 12px 20px rgba(0,0,0,.10);
        }
        .btn-gradient:hover{ filter: brightness(1.05) saturate(110%); }

        /* Compact progress */
        .pw-meter .ant-progress-outer{ width:160px; margin-inline-end:8px; }
        .hint{ color:${token.colorTextTertiary}; font-size:12px; }
      `}</style>

      <Card className="account-card" styles={{ body: { padding: 0 } }}>
        {/* Gradient header */}
        <div className="header-bar">
          <Space align="center" size={10}>
            <LockOutlined />
            <Title level={4} className="title">จัดการบัญชีผู้ใช้</Title>
            <span className="role-chip">บทบาท: {role || "-"}</span>
          </Space>
          <div className="hint">ปรับรหัสผ่านให้ปลอดภัยขึ้นได้ที่นี่</div>
        </div>

        <div style={{ padding: 22 }}>
          <Row gutter={[24, 24]}>
            {/* Left: form */}
            <Col xs={24} md={14}>

              {feedback.type && (
                <>
                  <div style={{ height: 12 }} />
                  <Alert
                    showIcon
                    closable
                    type={feedback.type}
                    message={feedback.type === "success" ? "สำเร็จ" : "ไม่สำเร็จ"}
                    description={feedback.text}
                    onClose={() => setFeedback({ type: null, text: "" })}
                  />
                </>
              )}

              <div style={{ height: 12 }} />
              <Form
                layout="vertical"
                form={form}
                onFinish={onFinish}
                className="account-form"
                validateTrigger={["onChange", "onBlur"]}
              >
                <Form.Item
                  label="รหัสผ่านเดิม"
                  name="old_password"
                  rules={[{ required: true, message: "กรุณากรอกรหัสผ่านเดิม" }]}
                >
                  <Input.Password
                    placeholder="••••••"
                    onKeyUp={(e) =>
                      setCaps1(e.getModifierState && e.getModifierState("CapsLock"))
                    }
                  />
                </Form.Item>
                {caps1 && <Tag color="warning" style={{ marginTop: -8, marginBottom: 8 }}>Caps Lock เปิดอยู่</Tag>}

                <Form.Item
                  label={
                    <Space>
                      รหัสผ่านใหม่
                      <Popover content={pwTips} trigger="hover">
                        <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
                      </Popover>
                    </Space>
                  }
                  name="new_password"
                  rules={[
                    { required: true, message: "กรุณากรอกรหัสผ่านใหม่" },
                    { min: 6, message: "ความยาวอย่างน้อย 6 ตัวอักษร" },
                    {
                      pattern: /^(?=.*[A-Za-z])(?=.*\d).{6,}$/,
                      message: "ควรมีตัวอักษรและตัวเลขอย่างน้อยอย่างละ 1 ตัว",
                    },
                  ]}
                >
                  <Input.Password
                    placeholder="อย่างน้อย 6 ตัวอักษร ผสมตัวอักษรและตัวเลข"
                    onKeyUp={(e) =>
                      setCaps2(e.getModifierState && e.getModifierState("CapsLock"))
                    }
                  />
                </Form.Item>

                {/* Strength meter & quick actions */}
                <div style={{ marginTop: -6, marginBottom: 12 }}>
                  <Space wrap className="pw-meter" align="center">
                    <Progress
                      percent={sc}
                      size="small"
                      strokeColor={
                        sInfo.status === "success"
                          ? token.colorSuccess
                          : sInfo.status === "normal"
                          ? token.colorPrimary
                          : token.colorError
                      }
                      showInfo={false}
                    />
                    <Text type={sInfo.status === "exception" ? "danger" : "secondary"}>
                      ความแข็งแรง: {sInfo.text}
                    </Text>
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={() => {
                        const pw = genPassword();
                        form.setFieldsValue({ new_password: pw, confirm_password: pw });
                        message.success("สร้างรหัสผ่านให้อัตโนมัติแล้ว");
                      }}
                    >
                      Generate
                    </Button>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        const pw = form.getFieldValue("new_password");
                        if (!pw) return;
                        navigator.clipboard.writeText(pw);
                        message.success("คัดลอกรหัสผ่านแล้ว");
                      }}
                    >
                      Copy
                    </Button>
                  </Space>
                </div>
                {caps2 && (
                  <Tag color="warning" style={{ marginTop: -4, marginBottom: 8 }}>
                    Caps Lock เปิดอยู่
                  </Tag>
                )}

                <Form.Item
                  label="ยืนยันรหัสผ่านใหม่"
                  name="confirm_password"
                  dependencies={["new_password"]}
                  rules={[
                    { required: true, message: "กรุณายืนยันรหัสผ่านใหม่" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("new_password") === value)
                          return Promise.resolve();
                        return Promise.reject(new Error("รหัสผ่านใหม่ไม่ตรงกัน"));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="พิมพ์ซ้ำอีกครั้ง" />
                </Form.Item>

                {/* match indicator */}
                {confirmPw ? (
                  match ? (
                    <Space size={6} style={{ marginTop: -6, marginBottom: 8 }}>
                      <CheckCircleTwoTone twoToneColor={token.colorSuccess} />
                      <Text type="success">รหัสผ่านตรงกัน</Text>
                    </Space>
                  ) : (
                    <Space size={6} style={{ marginTop: -6, marginBottom: 8 }}>
                      <CloseCircleTwoTone twoToneColor={token.colorError} />
                      <Text type="danger">รหัสผ่านยังไม่ตรงกัน</Text>
                    </Space>
                  )
                ) : null}

                <Button className="btn-gradient" type="primary" htmlType="submit" loading={loading} block>
                  บันทึกการเปลี่ยนแปลง
                </Button>
              </Form>
            </Col>

            {/* Right: tips */}
            <Col xs={24} md={10}>
              <Card size="small" variant="filled" style={{ borderRadius: 16, background: token.colorBgElevated }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <SafetyOutlined style={{ color: token.colorSuccess }} />
                  <b>คำแนะนำความปลอดภัย</b>
                </div>
                <ul style={{ paddingLeft: 18, marginBottom: 0, lineHeight: 1.8 }}>
                  <li>ใช้รหัสผ่านที่เดายากและไม่ซ้ำกับที่อื่น</li>
                  <li>ผสมตัวใหญ่/เล็ก ตัวเลข และอักขระพิเศษ</li>
                  <li>หลีกเลี่ยงข้อมูลส่วนตัว เช่น เบอร์โทร วันเกิด</li>
                </ul>
                <Divider style={{ margin: "14px 0" }} />
                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={() => form.resetFields()}>
                    ล้างแบบฟอร์ม
                  </Button>
                  <Button danger onClick={logout}>ออกจากระบบ</Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
}
