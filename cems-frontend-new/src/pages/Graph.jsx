import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import wsManager from "../config/websocketManager";
import {
  Button,
  Checkbox,
  Space,
  Tag,
  Segmented,
  Typography,
  Badge,
  Modal,
  Tooltip,
  Divider,
  message,
  Card,
} from "antd";
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  ExpandOutlined,
  ReloadOutlined,
  CheckOutlined,
  ClearOutlined,
  PartitionOutlined,
} from "@ant-design/icons";
import ReactApexChart from "react-apexcharts";
import { useConnection } from "../context/ConnectionContext";

/**
 * Dashboard Graph — compactable layout
 * - เพิ่มโหมดความหนาแน่น (Comfort / Compact / Mini) ให้กราฟเตี้ยลง ไม่ยาว
 * - Sync เคอร์เซอร์/ซูม, Pause/Resume, Clear buffer, Export CSV ใน modal
 * - ปรับ perf: memo, จำกัดจุด, abort fetch
 */

/** =====================
 *   CONSTANTS
 *  ===================== */
const SERIES = [
  { key: "SO2", label: "SO2 (ppm)", color: "#ff6b6b", unit: "ppm", limit: 80 },
  { key: "NOx", label: "NOx (ppm)", color: "#4ecdc4", unit: "ppm", limit: 200 },
  { key: "O2", label: "O2 (%)", color: "#45b7d1", unit: "%" },
  { key: "CO", label: "CO (ppm)", color: "#96ceb4", unit: "ppm", limit: 50 },
  { key: "Dust", label: "Dust (mg/m³)", color: "#a78bfa", unit: "mg/m³" },
  { key: "Temperature", label: "Temperature (°C)", color: "#06b6d4", unit: "°C" },
  { key: "Velocity", label: "Velocity (m/s)", color: "#f59e0b", unit: "m/s" },
  { key: "Flowrate", label: "Flowrate (m³/h)", color: "#22c55e", unit: "m³/h" },
  { key: "Pressure", label: "Pressure (Pa)", color: "#ef4444", unit: "Pa" },
];
const DEFAULT_KEYS = ["SO2", "NOx", "O2", "CO"];
const LIVE_MAX_POINTS = 240; // เพิ่มจำนวนจุดเพื่อแสดงการเปลี่ยนแปลง
const HISTORY_MAX_POINTS = 600; // เพิ่มจำนวนจุดเพื่อแสดงการเปลี่ยนแปลง
const SUMMARY_BUCKETS = 60;     // buckets for summary view
const CHART_GROUP = "cems-sync"; // sync cursor/zoom across mini charts

/** =====================
 *   SMALL HOOKS
 *  ===================== */
function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore storage write errors */
    }
  }, [key, state]);
  return [state, setState];
}

/** =====================
 *   CHART PANEL
 *  ===================== */
function ChartPanel({
  s, // series meta
  value,
  paused,
  resetToken,
  externalSeries, // history array [{t,v}]
  onExpand,
  density, // 'comfort' | 'compact' | 'mini'
}) {
  const bufferRef = useRef([]);

  // reset buffer when resetToken changes
  useEffect(() => {
    bufferRef.current = [];
  }, [resetToken]);

  // append live value into local buffer
  useEffect(() => {
    if (paused) return;
    const v = Number(value) || 0;
    const now = Date.now();
    const buf = bufferRef.current;
    if (buf.length === 0) buf.push({ t: now - 1000, v });
    buf.push({ t: now, v });
    while (buf.length > LIVE_MAX_POINTS) buf.shift();
  }, [value, paused]);

  // choose data source
  const dataArr = useMemo(() => {
    const src = externalSeries && externalSeries.length ? externalSeries : bufferRef.current;
    return src;
  }, [externalSeries, value, paused]);

  // stats & y padding
  const stats = useMemo(() => {
    const vals = dataArr.map((p) => p.v).filter((n) => Number.isFinite(n));
    if (!vals.length) return { min: 0, max: 0, avg: 0, yMin: undefined, yMax: undefined };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const pad = (max - min) * 0.2 || Math.max(Math.abs(max) * 0.2, 1);
    return { min, max, avg, yMin: min - pad, yMax: max + pad };
  }, [dataArr]);

  const annotations = useMemo(() => {
    const base = { yaxis: [], xaxis: [], points: [], images: [] };
    if (!s.limit) return base;
    base.yaxis.push({
      y: s.limit,
      borderColor: "#ff7875",
      strokeDashArray: 6,
      label: {
        text: `limit ${s.limit} ${s.unit || ""}`,
        borderColor: "#ff7875",
        style: { background: "#fff1f0", color: "#cf1322" },
      },
    });
    return base;
  }, [s.limit, s.unit]);

  const isMini = density === "mini";
  const chartHeight = density === "comfort" ? 220 : density === "compact" ? 160 : 120;
  const pillStyle = {
    fontSize: density === "comfort" ? 12 : density === "compact" ? 11 : 10,
    height: density === "comfort" ? 22 : density === "compact" ? 20 : 18,
    lineHeight: `${density === "comfort" ? 22 : density === "compact" ? 20 : 18}px`,
    padding: "0 8px",
  };

  const chartOptions = useMemo(
    () => ({
      chart: {
        id: `chart-${s.key}`,
        group: CHART_GROUP,
        animations: { enabled: false },
        toolbar: { show: false },
        zoom: { enabled: false },
        foreColor: "#6b7280",
        sparkline: { enabled: false },
      },
      title: { text: undefined },
      subtitle: { text: undefined },
      stroke: { curve: "straight", width: 2, colors: [s.color] },
      colors: [s.color],
      fill: { type: "gradient", gradient: { shadeIntensity: 0.3, opacityFrom: 0.4, opacityTo: 0.1, stops: [0, 90, 100] } },
      dataLabels: { enabled: false },
      markers: { size: 3, hover: { size: 6 }, colors: [s.color] },
      tooltip: {
        enabled: true,
        followCursor: true,
        intersect: false,
        shared: false,
        theme: "light",
        x: { format: "dd MMM HH:mm" },
        y: { formatter: (val) => (typeof val === "number" ? val.toFixed(2) : val) },
      },
      xaxis: { type: "datetime", labels: { datetimeUTC: false, show: true } },
      yaxis: { decimalsInFloat: 2, min: stats.yMin, max: stats.yMax, show: true },
      grid: { borderColor: "#eef2f7", strokeDashArray: 2, show: true, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } } },
      annotations,
    }),
    [s.key, s.color, stats.yMin, stats.yMax, annotations, isMini]
  );

  const chartSeries = useMemo(
    () => [{ name: s.label, data: dataArr.map((p) => [p.t, p.v]) }],
    [s.label, dataArr]
  );

  const latest = dataArr.length ? dataArr[dataArr.length - 1].v : value ?? 0;
  const rangeLabel = useMemo(() => {
    if (Array.isArray(externalSeries) && externalSeries.length >= 2) {
      const f = (ms) => new Date(ms).toLocaleString();
      return `${f(externalSeries[0].t)} - ${f(externalSeries[externalSeries.length - 1].t)}`;
    }
    return "";
  }, [externalSeries]);

  const containerHeight = (density === "comfort" ? 220 : density === "compact" ? 160 : 120) + 56;
  return (
    <Card
      size="small"
      hoverable
      onClick={onExpand}
      style={{ borderRadius: 12, cursor: "zoom-in", overflow: "hidden", width: "100%", height: containerHeight, display: "flex", flexDirection: "column" }}
      styles={{ body: { padding: density === "comfort" ? 10 : density === "compact" ? 8 : 6 } }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, minHeight: 24, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 600 }}>{s.label}</span>
        <Tag color="blue" style={{ marginInlineStart: 0, ...pillStyle }}>{Number(latest).toFixed(2)} {s.unit || ""}</Tag>
        <Tag color="green" style={pillStyle}>min {stats.min.toFixed(2)}</Tag>
        <Tag color="volcano" style={pillStyle}>max {stats.max.toFixed(2)}</Tag>
        {rangeLabel && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{rangeLabel}</span>
        )}
      </div>
      <div className="mini-chart">
        {dataArr.length > 0 ? (
          <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={chartHeight} />
        ) : (
          <div style={{ height: chartHeight, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
            ไม่มีข้อมูล
          </div>
        )}
      </div>
      <Tooltip title="ขยายกราฟ">
        <Button
          size="small"
          shape="circle"
          icon={<ExpandOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onExpand && onExpand();
          }}
          style={{ position: "absolute", right: 8, top: 8 }}
        />
      </Tooltip>
    </Card>
  );
}

/** =====================
 *   SUMMARY PANEL (range band + mean + alarm bar)
 *  ===================== */
function SummaryPanel({ s, summary }) {
  const color = s.color;
  const rangeSeries = useMemo(() => {
    const data = Array.isArray(summary?.range) ? summary.range : [];
    return [{ name: `${s.label} (min-max)`, data }];
  }, [summary?.range, s.label]);

  const avgSeries = useMemo(() => {
    const data = Array.isArray(summary?.avg) ? summary.avg : [];
    return [{ name: `${s.label} avg`, data }];
  }, [summary?.avg, s.label]);

  const alarmsSeries = useMemo(() => {
    const data = Array.isArray(summary?.alarms) ? summary.alarms : [];
    return [{ name: "alarms", data }];
  }, [summary?.alarms]);

  return (
    <Card size="small" style={{ borderRadius: 12, overflow: "hidden" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.label} (Summary)</div>
      {/* Range area chart */}
      <ReactApexChart
        options={{
          chart: { type: "rangeArea", animations: { enabled: false }, toolbar: { show: false }, foreColor: "#6b7280" },
          xaxis: { type: "datetime", labels: { datetimeUTC: false } },
          yaxis: { decimalsInFloat: 2 },
          colors: [color],
          dataLabels: { enabled: false },
          stroke: { curve: "straight", width: 2 },
          fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
          grid: { borderColor: "#eef2f7", strokeDashArray: 2 },
        }}
        series={rangeSeries}
        type="rangeArea"
        height={180}
      />
      {/* Mean line overlay */}
      <ReactApexChart
        options={{
          chart: { animations: { enabled: false }, toolbar: { show: false }, foreColor: "#6b7280" },
          xaxis: { type: "datetime", labels: { datetimeUTC: false } },
          yaxis: { decimalsInFloat: 2 },
          colors: [color],
          stroke: { curve: "straight", width: 2 },
          dataLabels: { enabled: false },
          grid: { show: false },
        }}
        series={avgSeries}
        type="line"
        height={130}
      />
      {/* Alarm bar */}
      <ReactApexChart
        options={{
          chart: { animations: { enabled: false }, toolbar: { show: false }, foreColor: "#6b7280" },
          xaxis: { type: "datetime", labels: { datetimeUTC: false } },
          yaxis: { decimalsInFloat: 0 },
          colors: ["#ef4444"],
          dataLabels: { enabled: false },
          grid: { borderColor: "#eef2f7", strokeDashArray: 2 },
        }}
        series={alarmsSeries}
        type="bar"
        height={90}
      />
    </Card>
  );
}

/** =====================
 *   PAGE
 *  ===================== */
export default function Graph() {
  const [connected, setConnected] = useState(false);
  const [vals, setVals] = useState({ SO2: 0, NOx: 0, O2: 0, CO: 0, Dust: 0, Temperature: 0, Velocity: 0, Flowrate: 0, Pressure: 0 });
  const { visibleParams, syncWithConfig, setSyncWithConfig } = useConnection();
  const [selectedKeys, setSelectedKeys] = useLocalStorage("graph.selectedKeys", DEFAULT_KEYS);
  const [paused, setPaused] = useLocalStorage("graph.paused", false);
  const [resetToken, setResetToken] = useState(0);
  const [mode, setMode] = useLocalStorage("graph.mode", "live"); // 'live' | 'history' | 'summary'
  const [hours, setHours] = useLocalStorage("graph.hours", 24);
  const [density, setDensity] = useLocalStorage("graph.density", "compact"); // 'comfort' | 'compact' | 'mini'
  const [history, setHistory] = useState({});
  const [summary, setSummary] = useState({}); // { key: { range: [{x,y:[min,max]}], avg: [[t,val]], alarms: [[t,count]] } }
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [liveSeriesMap, setLiveSeriesMap] = useState({});
  const [expandedKey, setExpandedKey] = useState(null);
  const expandedRef = useRef(null);
  const abortRef = useRef(null);
  const [, startTransition] = useTransition();
  const [cols, setCols] = useState(3);
  
  // เมื่อปิด modal ให้รีซูมแสดงผล: เติมจุดล่าสุดลงซีรีส์ที่ถูก freeze เพื่อไม่ให้กราฟแบน
  useEffect(() => {
    if (!expandedKey) {
      setLiveSeriesMap((prev) => {
        const now = Date.now();
        const draft = { ...prev };
        Object.keys(vals).forEach((k) => {
          const arr = Array.isArray(draft[k]) ? draft[k].slice() : [];
          if (!arr.length || now - arr[arr.length - 1].t > 500) {
            arr.push({ t: now, v: Number(vals[k]) || 0 });
            while (arr.length > LIVE_MAX_POINTS) arr.shift();
            draft[k] = arr;
          }
        });
        return draft;
      });
    }
  }, [expandedKey, vals]);

  // คงจำนวนคอลัมน์ตามขนาดหน้าจอ ไม่ขยายเต็มเมื่อเหลือกราฟน้อยลง
  useEffect(() => {
    const computeCols = () => {
      const w = window.innerWidth || 1200;
      if (w >= 1280) setCols(3);
      else if (w >= 900) setCols(2);
      else setCols(1);
    };
    computeCols();
    window.addEventListener("resize", computeCols);
    return () => window.removeEventListener("resize", computeCols);
  }, []);
  useEffect(() => { expandedRef.current = expandedKey; }, [expandedKey]);

  // WebSocket connect
  useEffect(() => {
    wsManager.connect(
      "/ws/gas",
      (data) => {
        const gas = Array.isArray(data?.gas) ? data.gas : [];
        const nextVals = {
          SO2: gas[0] ?? 0,
          NOx: gas[1] ?? 0,
          O2: gas[2] ?? 0,
          CO: gas[3] ?? 0,
          Dust: gas[4] ?? 0,
          Temperature: gas[5] ?? 0,
          Velocity: gas[6] ?? 0,
          Flowrate: gas[7] ?? 0,
          Pressure: gas[8] ?? 0,
        };
        setVals(nextVals);
        setConnected(true);
        // ระหว่างเปิด modal ให้หยุดอัปเดตเฉพาะซีรีส์ที่กำลังขยายอยู่ ส่วนอื่นยังอัปเดตต่อเนื่อง
        const expanded = expandedRef.current;
        setLiveSeriesMap((prev) => {
          const now = Date.now();
          const keys = Object.keys(nextVals);
          const draft = { ...prev };
          keys.forEach((k) => {
            if (expanded && k === expanded) return; // freeze only expanded series
            const arr = Array.isArray(draft[k]) ? draft[k].slice() : [];
            arr.push({ t: now, v: Number(nextVals[k]) || 0 });
            while (arr.length > LIVE_MAX_POINTS) arr.shift();
            draft[k] = arr;
          });
          return draft;
        });
      },
      () => setConnected(false),
      () => setConnected(false)
    );
    return () => wsManager.disconnect("/ws/gas");
  }, []);

  // const selectOptions = useMemo(() => SERIES.map((s) => ({ label: s.label, value: s.key })), []);

  // History fetch (with abort)
  useEffect(() => {
    if (!["history", "summary"].includes(mode)) return;
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
    const keysToLoad = selectedKeys.length ? selectedKeys : SERIES.map((s) => s.key);
    setLoadingHistory(true);
    setStatusMsg("");
    setPaused(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const maxPoints = HISTORY_MAX_POINTS;

    Promise.all(
      keysToLoad.map(async (k) => {
        try {
          const url = `${baseUrl}/logs/influxdb?parameter=${encodeURIComponent(k)}&hours=${hours}&max_points=${maxPoints}`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`${res.status}`);
          const data = await res.json();
          const series = Array.isArray(data)
            ? data
                .map((row) => {
                  const ts = new Date(row.Timestamp).getTime();
                  const val = Number(row[k] ?? row[`${k}_corrected`] ?? 0) || 0;
                  return { t: ts, v: val };
                })
                .filter((p) => isFinite(p.v))
                .reverse()
            : [];
          return [k, series];
        } catch (err) {
          if (controller.signal.aborted) return [k, []];
          console.warn("history fetch error", k, err);
          return [k, []];
        }
      })
    )
      .then((entries) => {
        const map = {};
        for (const [k, s] of entries) map[k] = s;
        startTransition(() => setHistory(map));
        const total = Object.values(map).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
        if (total === 0) {
          setStatusMsg("ไม่มีข้อมูลย้อนหลัง / InfluxDB ไม่พร้อม - กลับสู่โหมดสด");
          setMode("live");
          setPaused(false);
        }
        // compute summary immediately if required
        if (total > 0) {
          try {
            const metaByKey = {};
            SERIES.forEach((m) => (metaByKey[m.key] = m));
            const result = {};
            const buckets = SUMMARY_BUCKETS;
            Object.keys(map).forEach((k) => {
              const arr = map[k] || [];
              if (!arr.length) return;
              const startT = arr[0].t;
              const endT = arr[arr.length - 1].t;
              const step = Math.max(1, Math.floor((endT - startT) / buckets));
              const bins = new Array(buckets).fill(0).map((_, i) => ({
                t: startT + i * step,
                min: Infinity,
                max: -Infinity,
                sum: 0,
                n: 0,
                alarm: 0,
              }));
              const limit = metaByKey[k]?.limit;
              arr.forEach(({ t, v }) => {
                const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - startT) / step)));
                const b = bins[idx];
                if (!Number.isFinite(v)) return;
                b.min = Math.min(b.min, v);
                b.max = Math.max(b.max, v);
                b.sum += v;
                b.n += 1;
                if (typeof limit === "number" && v > limit) b.alarm += 1;
              });
              const range = [];
              const avg = [];
              const alarms = [];
              bins.forEach((b) => {
                if (b.n === 0) return; // skip empty
                const x = b.t;
                const a = b.sum / b.n;
                range.push({ x, y: [b.min === Infinity ? 0 : b.min, b.max === -Infinity ? 0 : b.max] });
                avg.push([x, a]);
                alarms.push([x, b.alarm]);
              });
              result[k] = { range, avg, alarms };
            });
            setSummary(result);
          } catch (err) {
            console.warn("summary compute error", err);
          }
        }
      })
      .finally(() => setLoadingHistory(false));

    return () => controller.abort();
  }, [mode, hours, selectedKeys]);

  const setRange = (label) => {
    setMode("history");
    const now = new Date();
    switch (label) {
      case "1d":
        setHours(24);
        break;
      case "5d":
        setHours(24 * 5);
        break;
      case "1m":
        setHours(24 * 30);
        break;
      case "6m":
        setHours(24 * 30 * 6);
        break;
      case "1y":
        setHours(24 * 365);
        break;
      case "5y":
        setHours(24 * 365 * 5);
        break;
      case "ytd": {
        const start = new Date(now.getFullYear(), 0, 1);
        const diffH = Math.max(24, Math.floor((now - start) / 3600000));
        setHours(diffH);
        break;
      }
      case "max":
        setHours(24 * 365 * 10);
        break;
      default:
        setHours(24);
    }
  };

  // Sync with config when enabled
  useEffect(() => {
    if (syncWithConfig && Array.isArray(visibleParams) && visibleParams.length) {
      const valid = SERIES.map((s) => s.key);
      const next = visibleParams.filter((k) => valid.includes(k));
      setSelectedKeys(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncWithConfig, JSON.stringify(visibleParams)]);

  const selectedMeta = useMemo(() => SERIES.filter((s) => selectedKeys.includes(s.key)), [selectedKeys]);

  // Layout helpers
  const minWidth = density === "mini" ? 280 : density === "compact" ? 320 : 360;
  const gridGap = density === "mini" ? 8 : density === "compact" ? 10 : 12;

  return (
    <div style={{ padding: 16 }}>
      {/* Sticky header */}
      <div
        className="graph-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(6px)",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #eef2f7",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          flexWrap: "wrap",
        }}
      >
        <Typography.Title level={3} className="graph-header-title" style={{ margin: 0, whiteSpace: "nowrap" }}>
          CEMS Graph
        </Typography.Title>
        <Badge
          status={connected ? "success" : "default"}
          text={connected ? "WebSocket: Connected" : "WebSocket: Disconnected"}
        />
        <div className="graph-toolbar" style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Segmented
            className="seg-mode"
            size="small"
            value={mode}
            options={[
              { label: "Live", value: "live" },
              { label: "History", value: "history" },
              { label: "Summary", value: "summary" },
            ]}
            onChange={(val) => {
              setMode(val);
              if (val === "live") setPaused(false);
              if (val !== "live") setPaused(true);
            }}
          />
          <Tooltip title="ซิงก์กับ Config/Home">
            <Button className="pill-btn" type={syncWithConfig ? "primary" : "default"} onClick={() => setSyncWithConfig(!syncWithConfig)}>
              {syncWithConfig ? "Sync: On" : "Sync: Off"}
            </Button>
          </Tooltip>
          <Segmented
            className="seg-density"
            size="small"
            value={density}
            options={[
              { label: "Comfort", value: "comfort" },
              { label: "Compact", value: "compact" },
              { label: "Mini", value: "mini" },
            ]}
            onChange={setDensity}
          />
          <Tooltip title={paused ? "Resume live" : "Pause live"}>
            <Button
              className="pill-btn"
              onClick={() => setPaused((p) => !p)}
              icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
          </Tooltip>
          <Tooltip title="Clear live buffers">
            <Button className="pill-btn" onClick={() => setResetToken((x) => x + 1)} icon={<ReloadOutlined />}>Clear</Button>
          </Tooltip>
        </div>
      </div>

      {/* Row 1: selection */}
      <Card size="small" style={{ marginBottom: 10, borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <PartitionOutlined style={{ color: "#1677ff" }} />
          <b>เลือกพารามิเตอร์</b>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <Tooltip title="เลือกทั้งหมด">
              <Button size="small" onClick={() => setSelectedKeys(SERIES.map((s) => s.key))} icon={<CheckOutlined />}>ทั้งหมด</Button>
            </Tooltip>
            <Tooltip title="เลือกชุดเริ่มต้น">
              <Button size="small" onClick={() => setSelectedKeys(DEFAULT_KEYS)}>Default</Button>
            </Tooltip>
            <Tooltip title="ล้างการเลือก">
              <Button size="small" onClick={() => setSelectedKeys([])} icon={<ClearOutlined />}>None</Button>
            </Tooltip>
          </div>
        </div>
        <Divider style={{ margin: "8px 0" }} />
        <Space wrap size={[8, 8]}>
          <Checkbox.Group options={SERIES.map((s) => ({ label: s.label, value: s.key }))} value={selectedKeys} onChange={setSelectedKeys} />
        </Space>
      </Card>

      {/* Row 2: range (disabled in Live) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Segmented
          options={["สด", "1 วัน", "5 วัน", "1 เดือน", "6 เดือน", "YTD", "1 ปี", "5 ปี", "สูงสุด"]}
          size="large"
          value={
            mode === "live"
              ? "สด"
              : hours === 24
              ? "1 วัน"
              : hours === 24 * 5
              ? "5 วัน"
              : hours === 24 * 30
              ? "1 เดือน"
              : hours === 24 * 30 * 6
              ? "6 เดือน"
              : hours === 24 * 365
              ? "1 ปี"
              : hours === 24 * 365 * 5
              ? "5 ปี"
              : "YTD"
          }
          onChange={(val) => {
            if (val === "สด") {
              setMode("live");
              setPaused(false);
              setStatusMsg("");
              return;
            }
            const mapping = { "1 วัน": "1d", "5 วัน": "5d", "1 เดือน": "1m", "6 เดือน": "6m", YTD: "ytd", "1 ปี": "1y", "5 ปี": "5y", "สูงสุด": "max" };
            setRange(mapping[val]);
          }}
          disabled={loadingHistory || mode === "live"}
        />
      </div>

      {/* Mode label */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, marginBottom: 4 }}>
        <Tag color={mode === "live" ? "green" : "geekblue"}>{mode === "live" ? "LIVE" : `HISTORY ${hours}h`}</Tag>
      </div>
      {statusMsg && <div style={{ marginBottom: 8, color: "#faad14" }}>{statusMsg}</div>}

      {/* Grid charts (dense layout) */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(${minWidth}px, 1fr))`, gap: gridGap, alignItems: "start" }}>
        {selectedMeta.length ? (
          mode === "summary"
            ? selectedMeta.map((s) => (
                <SummaryPanel key={s.key} s={s} summary={summary[s.key]} />
              ))
            : selectedMeta.map((s) => (
                <ChartPanel
                  key={s.key}
                  s={s}
                  value={vals[s.key]}
                  resetToken={resetToken}
                  paused={paused || mode === "history"}
                  externalSeries={mode === "history" ? history[s.key] || [] : []}
                  onExpand={() => setExpandedKey(s.key)}
                  density={density}
                />
              ))
        ) : (
          <div style={{ color: "#94a3b8" }}>โปรดเลือกพารามิเตอร์อย่างน้อย 1 รายการ</div>
        )}
      </div>

      {/* Styles: hide toolbar on mini charts to prevent layout jump */}
      <style>{`
        .mini-chart { overflow: hidden; }
        .mini-chart .apexcharts-toolbar { display: none !important; }
      `}</style>

      {/* Expanded modal */}
      <Modal
        open={!!expandedKey}
        centered
        maskClosable={false}
        keyboard={false}
        onCancel={() => setExpandedKey(null)}
        footer={null}
        width={"90vw"}
        styles={{ body: { padding: 16, background: "linear-gradient(180deg,#ffffff 0%, #f7f9fc 100%)", borderRadius: 16 } }}
        destroyOnHidden
        title={expandedKey ? SERIES.find((x) => x.key === expandedKey)?.label || expandedKey : ""}
      >
        {expandedKey && (() => {
          const meta = SERIES.find((x) => x.key === expandedKey) || {};
          const color = meta.color || "#4096ff";
          const dataArr = mode === "history" ? history[expandedKey] || [] : liveSeriesMap[expandedKey] || [];
          const values = dataArr.map((p) => p.v).filter((v) => Number.isFinite(v));
          const last = values.length ? values[values.length - 1] : 0;
          const min = values.length ? Math.min(...values) : 0;
          const max = values.length ? Math.max(...values) : 0;
          const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

          const series = dataArr.length ? [{ name: meta.label || expandedKey, data: dataArr.map((p) => [p.t, p.v]) }] : [{ name: meta.label || expandedKey, data: [] }];
          const startTs = dataArr.length ? dataArr[0].t : null;
          const endTs = dataArr.length ? dataArr[dataArr.length - 1].t : null;
          const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : "-");
          const subtitleText = startTs && endTs
            ? `${fmt(startTs)} - ${fmt(endTs)}  •  min ${min.toFixed(2)}  •  max ${max.toFixed(2)}  •  avg ${avg.toFixed(2)} ${meta.unit || ""}`
            : "";
          const exportName = `${meta.key || expandedKey || "series"}-${mode === "history" ? `${hours}h` : "live"}-${new Date().toISOString().slice(0,10)}`;

          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Tag color={color} style={{ color: "#fff" }}>ล่าสุด {last.toFixed(2)} {meta.unit || ""}</Tag>
                <Tag color="green">min {min.toFixed(2)}</Tag>
                <Tag color="red">max {max.toFixed(2)}</Tag>
                <Tag color="blue">avg {avg.toFixed(2)}</Tag>
                <div style={{ marginLeft: "auto", color: "#64748b", fontSize: 12 }}>
                  {mode === "history" ? `HISTORY ${hours}h` : "LIVE"}
                </div>
              </div>

              {/* Summary line outside chart to avoid overlay */}
              <div style={{ textAlign: "right", color: "#64748b", fontSize: 12, marginBottom: 4 }}>{subtitleText}</div>

              <ReactApexChart
                options={{
                  chart: {
                    id: `expanded-${expandedKey}`,
                    group: CHART_GROUP,
                    toolbar: {
                      show: true,
                      tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true },
                      export: {
                        csv: { filename: exportName },
                        svg: { filename: exportName },
                        png: { filename: exportName },
                      },
                  },
                    zoom: { enabled: true },
                    foreColor: "#6b7280",
                  },
                  // avoid title/subtitle inside chart to prevent overlap
                  title: { text: undefined },
                  subtitle: { text: undefined },
                  stroke: { curve: "smooth", width: 3, colors: [color] },
                  colors: [color],
                  fill: { type: "gradient", gradient: { shadeIntensity: 0.6, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] } },
                  dataLabels: { enabled: false },
                  markers: { size: 0, hover: { size: 5 } },
                  tooltip: { enabled: true, shared: false, followCursor: true, intersect: false, fixed: { enabled: true, position: "topLeft", offsetX: 8, offsetY: 8 }, x: { format: "dd MMM HH:mm" }, y: { formatter: (v) => (typeof v === "number" ? v.toFixed(2) : v) } },
                  xaxis: { type: "datetime", labels: { datetimeUTC: false } },
                  yaxis: { decimalsInFloat: 2 },
                  grid: { borderColor: "#eef2f7", strokeDashArray: 3 },
                  annotations: (() => {
                    const baseAnn = { yaxis: [], xaxis: [], points: [], images: [] };
                    if (meta.limit) {
                      baseAnn.yaxis.push({ y: meta.limit, borderColor: "#ff7875", strokeDashArray: 6, label: { text: `limit ${meta.limit} ${meta.unit || ""}`, borderColor: "#ff7875", style: { background: "#fff1f0", color: "#cf1322" } } });
                    }
                    return baseAnn;
                  })(),
                }}
                series={series}
                type="area"
                height={Math.min(700, Math.round(window.innerHeight * 0.75))}
              />

              {/* Quick CSV export */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <Button
                  onClick={() => {
                    if (!dataArr.length) return message.info("ไม่มีข้อมูลสำหรับส่งออก");
                    const header = "timestamp,value";
                    const rows = dataArr.map((p) => `${new Date(p.t).toISOString()},${p.v}`);
                    const csv = [header, ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${meta.key || expandedKey || "series"}-${mode === "history" ? `${hours}h` : "live"}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV (current)
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Minor styles */}
      <style>{`
        .apexcharts-tooltip { box-shadow: 0 6px 24px rgba(0,0,0,0.12); border-radius: 8px; }
        @media (max-width: 768px) {
          .graph-toolbar { margin-left: 0 !important; width: 100%; justify-content: flex-start; }
          .graph-header { padding: 8px 10px !important; }
          .graph-header-title { font-size: 18px !important; }
        }
        /* Pretty toolbar */
        .graph-toolbar .ant-segmented { border-radius: 999px; padding: 2px; box-shadow: 0 2px 8px rgba(31,59,140,0.08); }
        .graph-toolbar .ant-segmented-item { border-radius: 999px; }
        .graph-toolbar .ant-segmented-item-selected { background: #1f3b8c; color: #fff; }
        .graph-toolbar .pill-btn { border-radius: 999px !important; }
        .graph-toolbar .ant-btn-primary { background: #1f3b8c; border-color: #1f3b8c; }
        .graph-toolbar .ant-btn { height: 32px; }
      `}</style>
    </div>
  );
}
