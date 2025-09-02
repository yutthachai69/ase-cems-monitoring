import { Routes, Route, Navigate } from "react-router-dom";
import SidebarLayout from "./components/SidebarLayout";
import Home from "./pages/Home";
import Status from "./pages/Status";
import DataLogs from "./pages/DataLogs";
import Graph from "./pages/Graph";
import Blowback from "./pages/Blowback";

import Config from "./pages/Config";
import { useAuth } from "./context/AuthContext.jsx";
import Account from "./pages/Account.jsx";
import { CONFIG } from "./config/config";

function Protected({ roles, element, authRequired = false }) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (authRequired && !role) return <Navigate to="/" replace />;
  // If route is admin-only, require admin
  if (roles && roles.length === 1 && roles[0] === "admin") {
    if (role !== "admin") return <Navigate to="/" replace />;
  }
  // If route allows user, allow even when not logged in (view-only)
  if (roles && roles.includes("admin") && roles.includes("user")) {
    if (role && !roles.includes(role)) return <Navigate to="/" replace />;
  }
  return element;
}

function App() {
  return (
    <Routes>
      <Route element={<SidebarLayout />}>
        <Route path="/" element={<Protected roles={["admin","user"]} element={<Home />} />} />
        <Route path="/status" element={<Protected roles={["admin","user"]} element={<Status />} />} />
        <Route path="/logs" element={<Protected roles={["admin","user"]} element={<DataLogs />} />} />
        <Route path="/graph" element={<Protected roles={["admin","user"]} element={<Graph />} />} />
        <Route path="/account" element={<Protected roles={["admin","user"]} authRequired={true} element={<Account />} />} />
        <Route path="/blowback" element={<Protected roles={["admin"]} element={<Blowback />} />} />

        <Route path="/config" element={<Protected roles={["admin"]} element={<Config />} />} />
      </Route>
    </Routes>
  );
}

export default App;
