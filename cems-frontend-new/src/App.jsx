import { Routes, Route } from "react-router-dom";
import SidebarLayout from "./components/SidebarLayout";
import Home from "./pages/Home";
import Status from "./pages/Status";
import DataLogs from "./pages/DataLogs";
import Graph from "./pages/Graph";
import Blowback from "./pages/Blowback";
import WebPortal from "./pages/WebPortal";
import Config from "./pages/Config";

function App() {
  return (
    <Routes>
      <Route element={<SidebarLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/status" element={<Status />} />
        <Route path="/logs" element={<DataLogs />} />
        <Route path="/graph" element={<Graph />} />
        <Route path="/blowback" element={<Blowback />} />
        <Route path="/webportal" element={<WebPortal />} />
        <Route path="/config" element={<Config />} />
      </Route>
    </Routes>
  );
}

export default App;
