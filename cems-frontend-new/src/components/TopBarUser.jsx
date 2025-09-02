import { useState } from "react";
import { Avatar, Button, Dropdown, Modal, Select, Input, Space, Typography, Alert } from "antd";
import { UserOutlined, LoginOutlined, LogoutOutlined, SettingOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const { Text } = Typography;

export default function TopBarUser() {
  const navigate = useNavigate();
  const { role, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ role: "user", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(form.role, form.password);
      setOpen(false);
    } catch (e) {
      // แสดงข้อความผิดพลาดแบบมองเห็นได้ในโมดัล
      setError(e?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (role) {
    const items = [
      { key: "account", icon: <SettingOutlined />, label: "Account", onClick: () => navigate("/account") },
      { type: "divider" },
      { key: "logout", icon: <LogoutOutlined />, label: "Logout", danger: true, onClick: logout },
    ];
    return (
      <Dropdown menu={{ items }} placement="bottomRight">
        <Space style={{ cursor: "pointer" }}>
          <Avatar size={28} icon={<UserOutlined />} />
          <Text strong>{role}</Text>
        </Space>
      </Dropdown>
    );
  }

  return (
    <>
      <Button type="primary" size="small" icon={<LoginOutlined />} onClick={() => setOpen(true)}>
        Login
      </Button>
      <Modal
        title="เข้าสู่ระบบ"
        open={open}
        onOk={onSubmit}
        okButtonProps={{ loading, disabled: !form.password }}
        onCancel={() => { setOpen(false); setError(null); }}
        okText="เข้าสู่ระบบ"
        cancelText="ยกเลิก"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {error && (
            <Alert type="error" showIcon message={error} />
          )}
          <div>
            <Text>Role</Text>
            <Select
              style={{ width: "100%" }}
              value={form.role}
              onChange={(v) => setForm((s) => ({ ...s, role: v }))}
              options={[{ value: "user", label: "User" }, { value: "admin", label: "Admin" }]}
            />
          </div>
          <div>
            <Text>Password</Text>
            <Input.Password
              placeholder="••••••"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              status={error ? "error" : undefined}
              onPressEnter={onSubmit}
            />
            {error && (
              <Text type="danger" style={{ display: "block", marginTop: 6 }}>{error}</Text>
            )}
          </div>
        </Space>
      </Modal>
    </>
  );
}





