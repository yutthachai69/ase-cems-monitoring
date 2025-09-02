import React, { useState } from "react";
import { Card, Button, Select, Input, Typography, Alert } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const { Title, Text } = Typography;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("user");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(role, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f5f5" }}>
      <Card style={{ width: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>CEMS Login</Title>
          <Text type="secondary">เลือกบทบาทและใส่รหัสผ่าน</Text>
        </div>
        {error && (
          <Alert showIcon type="error" message={error} style={{ marginBottom: 12 }} />
        )}
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <Text>Role</Text>
            <Select value={role} onChange={setRole} style={{ width: "100%" }} options={[{ value: "user", label: "User" }, { value: "admin", label: "Admin" }]} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>Password</Text>
            <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <Button type="primary" htmlType="submit" loading={loading} block>
            เข้าสู่ระบบ
          </Button>
        </form>
      </Card>
    </div>
  );
}











