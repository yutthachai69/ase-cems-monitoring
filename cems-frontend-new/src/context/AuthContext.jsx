import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { message } from "antd";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(null); // 'admin' | 'user' | null
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRole(parsed.role || null);
        setToken(parsed.token || null);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (roleInput, password) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${backendUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleInput, password })
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({ error: "Login failed" }));
      message.error(msg.error || "เข้าสู่ระบบไม่สำเร็จ");
      throw new Error(msg.error || "Login failed");
    }
    const data = await res.json();
    setRole(data.role);
    setToken(data.token);
    localStorage.setItem("auth", JSON.stringify({ role: data.role, token: data.token }));
    message.success("เข้าสู่ระบบสำเร็จ");
  };

  const logout = () => {
    setRole(null);
    setToken(null);
    localStorage.removeItem("auth");
    message.info("ออกจากระบบแล้ว");
  };

  const value = useMemo(() => ({ role, token, loading, login, logout }), [role, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


