import { useState, useEffect, useMemo } from "react";
import {
  Typography,
  Button,
  DatePicker,
  Table,
  Space,
  Empty,
  notification,
  Tag,
  Spin,
  Modal,
  Checkbox,
  Tooltip,
  Dropdown,
  Card,
  Segmented,
  Divider,
  Badge,
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  DownOutlined,
  FilterOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import relativeTime from "dayjs/plugin/relativeTime";
import SystemAlertBar from "../components/SystemAlertBar";
import { useConnection } from "../context/ConnectionContext";

// dayjs plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function DataLogs() {
  const { visibleParams, syncWithConfig, setSyncWithConfig } = useConnection();
  /** =====================
   *   STATE
   *  ===================== */
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dataCache, setDataCache] = useState(new Map());
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [paramFilter, setParamFilter] = useState("");
  const [dateRange, setDateRange] = useState([]);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedFields, setSelectedFields] = useState([
    "SO2",
    "NOx",
    "CO",
    "O2",
    "Dust",
    "Temperature",
    "Velocity",
    "Flowrate",
    "Pressure",
  ]);
  // ถ้าเปิดซิงก์ ให้ใช้ visibleParams เป็นค่าเริ่มต้นของ selectedFields
  useEffect(() => {
    if (syncWithConfig && Array.isArray(visibleParams) && visibleParams.length) {
      setSelectedFields((prev) => {
        const set = new Set(visibleParams.concat(["Temperature","Velocity","Flowrate","Pressure"]));
        return Array.from(set);
      });
    }
  }, [syncWithConfig, JSON.stringify(visibleParams)]);

  const [downloadDates, setDownloadDates] = useState([]);

  /** =====================
   *   MEMO / HELPERS
   *  ===================== */
  const lastUpdatedText = useMemo(() => {
    if (!lastFetchTime) return "—";
    return dayjs(lastFetchTime).fromNow();
  }, [lastFetchTime]);

  const baseUrl = useMemo(
    () => import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
    []
  );

  // Local cache helpers for offline/last-known data
  const cacheKeyFor = (param) => `datalogs.preview:${param || "all"}`;
  const readLocalCache = (param) => {
    try {
      const raw = localStorage.getItem(cacheKeyFor(param));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const writeLocalCache = (param, payload) => {
    try {
      localStorage.setItem(cacheKeyFor(param), JSON.stringify(payload));
    } catch {
      // ignore quota/serialization errors
    }
  };

  // Parse CSV text (used when fetching exact date range via /download-logs)
  const parseCsvText = (text) => {
    try {
      const lines = text.trim().split(/\r?\n/);
      if (!lines.length) return [];
      const headers = lines[0].split(",").map((h) => h.trim());
      return lines
        .slice(1)
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const cols = line.split(",");
          const row = {};
          headers.forEach((h, i) => {
            const v = cols[i] ?? "";
            if (h.toLowerCase() === "timestamp") {
              row.Timestamp = v;
            } else {
              const n = Number(v);
              row[h] = Number.isFinite(n) ? n : v || null;
            }
          });
          return row;
        });
    } catch {
      return [];
    }
  };

  /** =====================
   *   TABLE COLUMNS
   *  ===================== */
  const columns = useMemo(
    () => [
      {
        title: "Timestamp",
        dataIndex: "Timestamp",
        width: 180,
        sorter: (a, b) =>
          new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime(),
        render: (v) => (
          <Tag color="blue">{dayjs(v).format("YYYY-MM-DD HH:mm:ss")}</Tag>
        ),
        filteredValue: dateRange.length === 2 ? dateRange : null,
        onFilter: (_value, record) => {
          if (dateRange.length !== 2) return true;
          const [start, end] = dateRange;
          const ts = dayjs(record.Timestamp);
          return (
            ts.isSameOrAfter(dayjs(start), "second") &&
            ts.isSameOrBefore(dayjs(end), "second")
          );
        },
      },
      {
        title: "SO2 (ppm)",
        dataIndex: "SO2",
        width: 120,
        sorter: (a, b) => (a.SO2 || 0) - (b.SO2 || 0),
        render: (v) => (
          <Tag color={v > 80 ? "red" : v > 50 ? "orange" : "green"}>
            {v || v === 0 ? Number(v).toFixed(1) : "-"}
          </Tag>
        ),
      },
      {
        title: "NOx (ppm)",
        dataIndex: "NOx",
        width: 120,
        sorter: (a, b) => (a.NOx || 0) - (b.NOx || 0),
        render: (v) => (
          <Tag color={v > 200 ? "red" : v > 150 ? "orange" : "green"}>
            {v || v === 0 ? Number(v).toFixed(1) : "-"}
          </Tag>
        ),
      },
      {
        title: "O2 (%)",
        dataIndex: "O2",
        width: 110,
        sorter: (a, b) => (a.O2 || 0) - (b.O2 || 0),
        render: (v) => (
          <Tag color="geekblue">{v || v === 0 ? Number(v).toFixed(1) : "-"}</Tag>
        ),
      },
      {
        title: "CO (ppm)",
        dataIndex: "CO",
        width: 120,
        sorter: (a, b) => (a.CO || 0) - (b.CO || 0),
        render: (v) => (
          <Tag color={v > 50 ? "red" : v > 30 ? "orange" : "green"}>
            {v || v === 0 ? Number(v).toFixed(1) : "-"}
          </Tag>
        ),
      },
      {
        title: "Dust (mg/m3)",
        dataIndex: "Dust",
        width: 140,
        sorter: (a, b) => (a.Dust || 0) - (b.Dust || 0),
        render: (v) => <Tag color="purple">{v ?? "-"}</Tag>,
      },
      {
        title: "Temperature (°C)",
        dataIndex: "Temperature",
        width: 160,
        sorter: (a, b) => (a.Temperature || 0) - (b.Temperature || 0),
        render: (v) => <Tag color="cyan">{v ?? "-"}</Tag>,
      },
      {
        title: "Velocity (m/s)",
        dataIndex: "Velocity",
        width: 140,
        sorter: (a, b) => (a.Velocity || 0) - (b.Velocity || 0),
        render: (v) => <Tag color="gold">{v ?? "-"}</Tag>,
      },
      {
        title: "Flowrate (m3/h)",
        dataIndex: "Flowrate",
        width: 150,
        sorter: (a, b) => (a.Flowrate || 0) - (b.Flowrate || 0),
        render: (v) => <Tag color="lime">{v ?? "-"}</Tag>,
      },
      {
        title: "Pressure (Pa)",
        dataIndex: "Pressure",
        width: 140,
        sorter: (a, b) => (a.Pressure || 0) - (b.Pressure || 0),
        render: (v) => <Tag color="volcano">{v ?? "-"}</Tag>,
      },
    ],
    [dateRange]
  );

  /** =====================
   *   DATA FETCHERS
   *  ===================== */
  const fetchPreviewData = async (notify = false, forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = "preview-data";
    const cacheTime = 3000; // 3s

    if (!forceRefresh && dataCache.has(cacheKey)) {
      const cached = dataCache.get(cacheKey);
      if (now - cached.timestamp < cacheTime) {
        setPreviewData(cached.data);
        return;
      }
    }

    setPreviewLoading(true);
    setLoadingOverlay(true);
    try {
      // ถ้ามีการเลือกช่วงวันที่ ให้ดึงข้อมูลตามช่วงจริงโดยใช้ /download-logs แล้ว parse CSV
      if (dateRange && dateRange.length === 2) {
        const auth = (() => { try { return JSON.parse(localStorage.getItem('auth')) || {}; } catch { return {}; } })();
        const from = dayjs(dateRange[0]).format("YYYY-MM-DD HH:mm:ss");
        const to = dayjs(dateRange[1]).format("YYYY-MM-DD HH:mm:ss");
        const chosenFields = paramFilter ? [paramFilter] : [
          "SO2","NOx","CO","O2","Dust","Temperature","Velocity","Flowrate","Pressure"
        ];
        const qs = `from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}&fields=${encodeURIComponent(chosenFields.join(","))}`;
        const res = await fetch(`${baseUrl}/download-logs?${qs}`, { headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {} });
        if (!res.ok) throw new Error("Server Error");
        const text = await res.text();
        const rows = parseCsvText(text);
        setPreviewData(rows);
        writeLocalCache(paramFilter || "__range__", { data: rows, timestamp: now });
        setDataCache((prev) => new Map(prev.set(cacheKey, { data: rows, timestamp: now })));
        setLastFetchTime(now);
        if (notify) {
          notification.success({ message: "✅ โหลดข้อมูลสำเร็จ", description: "ระบบโหลดข้อมูลตามช่วงวันที่ที่เลือกแล้ว" });
        }
        return; // จบการทำงานเมื่อโหลดช่วงเวลาโดยตรงแล้ว
      }

      // ไม่ได้เลือกช่วง → ใช้ log-preview หรือ logs/influxdb แบบเดิม
      const url = paramFilter
        ? `${baseUrl}/api/logs/influxdb?parameter=${encodeURIComponent(paramFilter)}&limit=200&hours=168`
        : `${baseUrl}/api/log-preview`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Server Error");
      const data = await res.json();
      setPreviewData(data);

      // persist to local cache for offline fallback
      writeLocalCache(paramFilter, { data, timestamp: now });

      setDataCache((prev) =>
        new Map(
          prev.set(cacheKey, {
            data,
            timestamp: now,
          })
        )
      );
      setLastFetchTime(now);

      if (notify) {
        notification.success({
          message: "✅ โหลดข้อมูลสำเร็จ",
          description: "ระบบโหลดข้อมูลล่าสุดจาก InfluxDB แล้ว",
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      notification.error({
        message: "❌ โหลดข้อมูลล้มเหลว",
        description: err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
      });

      // try fallback to last-known good data from local cache
      const cached = readLocalCache(paramFilter);
      if (cached && Array.isArray(cached.data)) {
        setPreviewData(cached.data);
        setLastFetchTime(cached.timestamp || 0);
        notification.info({
          message: "📦 แสดงข้อมูลล่าสุดที่บันทึกไว้ (ออฟไลน์)",
          description:
            cached.timestamp ? `ข้อมูลล่าสุดเมื่อ ${dayjs(cached.timestamp).fromNow()}` : undefined,
        });
      }
    } finally {
      setPreviewLoading(false);
      setLoadingOverlay(false);
    }
  };

  /** =====================
   *   EFFECTS
   *  ===================== */
  useEffect(() => {
    fetchPreviewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload from local cache immediately (for faster first paint / offline)
  useEffect(() => {
    const cached = readLocalCache(paramFilter);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      setPreviewData(cached.data);
      setLastFetchTime(cached.timestamp || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchPreviewData(false, true);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramFilter]);

  // refetch when dateRange changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => fetchPreviewData(false, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  /** =====================
   *   DOWNLOAD HANDLERS
   *  ===================== */
  const handleConfirmDownload = () => {
    const auth = (() => { try { return JSON.parse(localStorage.getItem('auth')) || {}; } catch { return {}; } })();
    let url = `${baseUrl}/api/download-logs`;

    // date params
    if (downloadDates && downloadDates.length === 2) {
      const from = dayjs(downloadDates[0]).startOf('day').format("YYYY-MM-DD HH:mm:ss");
      const to = dayjs(downloadDates[1]).endOf('day').format("YYYY-MM-DD HH:mm:ss");
      url += `?from_date=${from}&to_date=${to}`;
    } else {
      url += `?`;
    }

    // fields param
    if (selectedFields.length > 0) {
      const fieldsParam = selectedFields.join(",");
      url += url.includes("?") && !url.endsWith("?")
        ? `&fields=${fieldsParam}`
        : `fields=${fieldsParam}`;
    }

    const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
    fetch(url, { headers })
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement('a');
        const blobUrl = window.URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = 'CEMS_DataLog.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
      });
    setDownloadModalVisible(false);
    notification.success({
      message: "📥 กำลังดาวน์โหลด Data Logs (กำหนดเอง)",
      description: "ระบบกำลังเตรียมไฟล์จาก InfluxDB กรุณารอสักครู่...",
    });
  };

  const handleQuickDownload = (period) => {
    let fromDate, toDate;
    const now = dayjs();

    switch (period) {
      case "1month":
        fromDate = now.subtract(1, "month");
        toDate = now;
        break;
      case "3months":
        fromDate = now.subtract(3, "months");
        toDate = now;
        break;
      case "6months":
        fromDate = now.subtract(6, "months");
        toDate = now;
        break;
      case "1year":
        fromDate = now.subtract(1, "year");
        toDate = now;
        break;
      case "all":
        fromDate = null;
        toDate = null;
        break;
      default:
        return;
    }

    let url;
    if (period === "all") {
      url = `${baseUrl}/download-logs?download_all=true&fields=${selectedFields.join(",")}`;
    } else {
      url = `${baseUrl}/download-logs?from_date=${fromDate.startOf('day').format(
        "YYYY-MM-DD HH:mm:ss"
      )}&to_date=${toDate.endOf('day').format("YYYY-MM-DD HH:mm:ss")}&fields=${selectedFields.join(",")}`;
    }

    const auth = (() => { try { return JSON.parse(localStorage.getItem('auth')) || {}; } catch { return {}; } })();
    const headers = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
    fetch(url, { headers })
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement('a');
        const blobUrl = window.URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = 'CEMS_DataLog.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
      });
    notification.success({
      message: `📥 กำลังดาวน์โหลด Data Logs (${
        period === "1month"
          ? "1 เดือน"
          : period === "3months"
          ? "3 เดือน"
          : period === "6months"
          ? "6 เดือน"
          : period === "1year"
          ? "1 ปี"
          : "ทั้งหมด"
      })`,
      description: "ระบบกำลังเตรียมไฟล์จาก InfluxDB กรุณารอสักครู่...",
    });
  };

  /** =====================
   *   MENU ITEMS
   *  ===================== */
  const downloadMenuItems = [
    { key: "1month", label: "📅 1 เดือน", onClick: () => handleQuickDownload("1month") },
    { key: "3months", label: "📅 3 เดือน", onClick: () => handleQuickDownload("3months") },
    { key: "6months", label: "📅 6 เดือน", onClick: () => handleQuickDownload("6months") },
    { key: "1year", label: "📅 1 ปี", onClick: () => handleQuickDownload("1year") },
    { type: "divider" },
    { key: "all", label: "ดาวน์โหลดทั้งหมด", icon: <DownloadOutlined />, onClick: () => handleQuickDownload("all") },
    { type: "divider" },
    { key: "custom", label: "⚙️ กำหนดเอง", onClick: () => setDownloadModalVisible(true) },
  ];

  /** =====================
   *   RENDER
   *  ===================== */
  return (
    <div style={styles.pageWrapper}>
      {/* Background gradient & subtle grid */}
      <div style={styles.bgLayer} />

      <SystemAlertBar />

      <Spin
        spinning={loadingOverlay}
        tip="กำลังโหลดข้อมูล..."
        size="large"
        style={styles.spinner}
      >
        {/* Top Header */}
        <Card style={styles.headerCard} styles={{ body: { padding: 16 } }}>
          <div style={styles.headerRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={styles.logoDot} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  CEMS Data Logs
                </Title>
                <Space size="small">
                  <Badge status={previewLoading ? "processing" : "success"} />
                  <Text type="secondary">
                    อัปเดตล่าสุด: {lastUpdatedText}
                  </Text>
                </Space>
              </div>
            </div>

            <Space>
              <Tooltip title="รีเฟรชข้อมูล">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => fetchPreviewData(true, true)}
                  loading={previewLoading}
                >
                  รีเฟรช
                </Button>
              </Tooltip>

              <Dropdown menu={{ items: downloadMenuItems }} placement="bottomRight">
                <Button type="primary" icon={<DownloadOutlined />}>
                  ดาวน์โหลด <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </div>
        </Card>

        {/* Filter Card */}
        <Card
          size="small"
          style={styles.filterCard}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FilterOutlined style={{ color: "#1677ff" }} />
            <Title level={5} style={{ margin: 0, color: "#1677ff" }}>
              ตัวกรองข้อมูล (Data Filter)
            </Title>
          </div>

          <Divider style={{ margin: "12px 0" }} />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Segmented
              className="dl-seg"
              options={[
                { label: "ทั้งหมด", value: "" },
                "SO2",
                "NOx",
                "O2",
                "CO",
                "Dust",
                "Temperature",
                "Velocity",
                "Flowrate",
                "Pressure",
              ]}
              value={paramFilter}
              onChange={setParamFilter}
            />

            <Space size="middle" wrap>
              <Button className="pill-btn" onClick={() => setSyncWithConfig(!syncWithConfig)}>
                {syncWithConfig ? "Sync Config: On" : "Sync Config: Off"}
              </Button>
              <RangePicker
                format="YYYY-MM-DD"
                placeholder={["เลือกวันเริ่มต้น", "เลือกวันสิ้นสุด"]}
                onChange={(val) =>
                  setDateRange(
                    val && val.length === 2
                      ? [val[0].startOf("day"), val[1].endOf("day")]
                      : []
                  )
                }
                allowClear
              />
              <Text type="secondary">
                <FieldTimeOutlined /> คัดกรองตามช่วงเวลา
              </Text>
            </Space>
          </div>
        </Card>

        {/* Table / Empty State */}
        {previewData.length > 0 ? (
          <Card style={styles.tableCard} styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="Timestamp"
              dataSource={previewData}
              columns={columns}
              size="small"
              pagination={{ pageSize: 12, showSizeChanger: true }}
              bordered
              loading={previewLoading}
              sticky
              scroll={{ x: 'max-content' }}
              style={{ borderRadius: 12 }}
            />
          </Card>
        ) : (
          <Card style={styles.tableCard} styles={{ body: { padding: 32 } }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="ไม่มีข้อมูลแสดงขณะนี้"
            >
              <Button onClick={() => fetchPreviewData(true, true)} type="primary">
                ลองโหลดอีกครั้ง
              </Button>
            </Empty>
          </Card>
        )}
      </Spin>

      {/* Download Modal */}
      <Modal
        title="Download Data Logs"
        open={downloadModalVisible}
        onCancel={() => setDownloadModalVisible(false)}
        onOk={handleConfirmDownload}
        okText="Confirm Download"
        width={640}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              📅 ช่วงวันที่
            </Title>
            <RangePicker
              format="YYYY-MM-DD"
              onChange={(val) => setDownloadDates(val)}
              style={{ width: "100%" }}
              placeholder={["วันเริ่มต้น", "วันสิ้นสุด"]}
            />
          </div>
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              ข้อมูลที่ต้องการ
            </Title>
            <Checkbox.Group
              options={[
                { label: "SO2", value: "SO2" },
                { label: "NOx", value: "NOx" },
                { label: "O2", value: "O2" },
                { label: "CO", value: "CO" },
                { label: "Dust", value: "Dust" },
                { label: "Temperature", value: "Temperature" },
                { label: "Velocity", value: "Velocity" },
                { label: "Flowrate", value: "Flowrate" },
                { label: "Pressure", value: "Pressure" },
              ]}
              value={selectedFields}
              onChange={setSelectedFields}
              style={{ width: "100%" }}
            />
          </div>
        </Space>
      </Modal>

      {/* Local styles */}
      <style>{`
        /* subtle table zebra for better readability */
        .ant-table-wrapper .ant-table-tbody > tr:nth-child(odd) > td {
          background: rgba(0, 0, 0, 0.012);
        }
        .ant-table-wrapper .ant-table-tbody > tr:hover > td {
          background: rgba(22, 119, 255, 0.06) !important;
        }
        /* make Segmented wrap on small screens */
        .dl-seg { max-width: 100%; }
        .dl-seg .ant-segmented-group { flex-wrap: wrap; }
        .dl-seg .ant-segmented-item { margin-bottom: 6px; }
        .dl-seg .ant-segmented { border-radius: 999px; padding: 2px; box-shadow: 0 2px 8px rgba(31,59,140,0.06); }
        .dl-seg .ant-segmented-item { border-radius: 999px; }
        .dl-seg .ant-segmented-item-selected { background: #1f3b8c; color: #fff; }
        .pill-btn { border-radius: 999px !important; }
        .ant-btn-primary { background: #1f3b8c; border-color: #1f3b8c; }
        @media (max-width: 600px) {
          .ant-picker-range { width: 100% !important; }
        }
      `}</style>
    </div>
  );
}

/** =====================
 *   INLINE STYLES (design tokens friendly)
 *  ===================== */
const styles = {
  pageWrapper: {
    position: "relative",
    minHeight: 400,
    padding: 24,
    overflow: "hidden",
  },
  bgLayer: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(22,119,255,0.08), transparent 60%), radial-gradient(1200px 600px at 120% 10%, rgba(82,196,26,0.06), transparent 60%)",
    pointerEvents: "none",
  },
  spinner: {
    position: "relative",
    zIndex: 1,
    display: "block",
  },
  headerCard: {
    borderRadius: 14,
    borderColor: "#eef2f7",
    boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
    backdropFilter: "blur(4px)",
    marginBottom: 16,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background:
      "conic-gradient(from 180deg at 50% 50%, #1677ff, #52c41a, #faad14, #1677ff)",
    boxShadow: "0 0 0 4px rgba(22,119,255,0.1)",
  },
  filterCard: {
    borderRadius: 12,
    borderColor: "#eef2f7",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    marginBottom: 16,
  },
  tableCard: {
    borderRadius: 14,
    borderColor: "#eef2f7",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  },
};
