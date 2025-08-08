import { Routes, Route } from "react-router-dom";
import SidebarLayout from "../src/components/SidebarLayout";
import Home from "../src/pages/Home";
import Status from "../src/pages/Status";
import DataLogs from "../src/pages/DataLogs";
import Blowback from "../src/pages/Blowback";
import WebPortal from "../src/pages/WebPortal";
import Config from "../src/pages/Config";

function App() {
  return (
    <Routes>
      <Route element={<SidebarLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/status" element={<Status />} />
        <Route path="/logs" element={<DataLogs />} />
        <Route path="/blowback" element={<Blowback />} />
        <Route path="/portal" element={<WebPortal />} />
        <Route path="/config" element={<Config />} />
      </Route>
    </Routes>
  );
}

export default App;
