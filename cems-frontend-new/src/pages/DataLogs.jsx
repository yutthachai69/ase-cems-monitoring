import { useState, useEffect } from "react";
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
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import SystemAlertBar from "../components/SystemAlertBar";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function DataLogs() {
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [dateRange, setDateRange] = useState([]);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedFields, setSelectedFields] = useState([
    "SO2", "NOx", "CO", "O2", "Dust", "Temperature", "Velocity", "Flowrate", "Pressure",
  ]);
  const [downloadDates, setDownloadDates] = useState([]);

  const columns = [
    {
      title: "Timestamp",
      dataIndex: "Timestamp",
      sorter: (a, b) =>
        new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime(),
      render: (v) => (
        <Tag color="blue">{dayjs(v).format("YYYY-MM-DD HH:mm:ss")}</Tag>
      ),
      filteredValue: dateRange.length === 2 ? dateRange : null,
      onFilter: (value, record) => {
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
      sorter: (a, b) => (a.SO2 || 0) - (b.SO2 || 0),
      render: (v) => (
        <Tag color={v > 80 ? "red" : v > 50 ? "orange" : "green"}>{v || '-'}</Tag>
      ),
    },
    {
      title: "NOx (ppm)",
      dataIndex: "NOx",
      sorter: (a, b) => (a.NOx || 0) - (b.NOx || 0),
      render: (v) => (
        <Tag color={v > 200 ? "red" : v > 150 ? "orange" : "green"}>{v || '-'}</Tag>
      ),
    },
    {
      title: "O2 (%)",
      dataIndex: "O2",
      sorter: (a, b) => (a.O2 || 0) - (b.O2 || 0),
      render: (v) => <Tag color="geekblue">{v || '-'}</Tag>,
    },
    {
      title: "CO (ppm)",
      dataIndex: "CO",
      sorter: (a, b) => (a.CO || 0) - (b.CO || 0),
      render: (v) => (
        <Tag color={v > 50 ? "red" : v > 30 ? "orange" : "green"}>{v || '-'}</Tag>
      ),
    },
    {
      title: "Dust (mg/m3)",
      dataIndex: "Dust",
      sorter: (a, b) => (a.Dust || 0) - (b.Dust || 0),
      render: (v) => <Tag color="purple">{v || '-'}</Tag>,
    },
    {
      title: "Temperature (degC)",
      dataIndex: "Temperature",
      sorter: (a, b) => (a.Temperature || 0) - (b.Temperature || 0),
      render: (v) => <Tag color="cyan">{v || '-'}</Tag>,
    },
    {
      title: "Velocity (m/s)",
      dataIndex: "Velocity",
      sorter: (a, b) => (a.Velocity || 0) - (b.Velocity || 0),
      render: (v) => <Tag color="gold">{v || '-'}</Tag>,
    },
    {
      title: "Flowrate (m3/h)",
      dataIndex: "Flowrate",
      sorter: (a, b) => (a.Flowrate || 0) - (b.Flowrate || 0),
      render: (v) => <Tag color="lime">{v || '-'}</Tag>,
    },
    {
      title: "Pressure (Pa)",
      dataIndex: "Pressure",
      sorter: (a, b) => (a.Pressure || 0) - (b.Pressure || 0),
      render: (v) => <Tag color="volcano">{v || '-'}</Tag>,
    },
  ];

  // ✅ โหลด Preview ล่าสุด
  const fetchPreviewData = async (notify = false) => {
    setPreviewLoading(true);
    setLoadingOverlay(true);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${baseUrl}/log-preview`);
      if (!res.ok) throw new Error("Server Error");
      const data = await res.json();
      setPreviewData(data);
      if (notify) {
        notification.success({
          message: "✅ โหลดข้อมูลสำเร็จ",
          description: "ระบบโหลดข้อมูลตัวอย่างล่าสุดแล้ว",
        });
      }
    } catch (err) {
      notification.error({
        message: "❌ โหลดข้อมูลล้มเหลว",
        description: err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
      });
    } finally {
      setPreviewLoading(false);
      setLoadingOverlay(false);
    }
  };

  useEffect(() => {
    fetchPreviewData();
  }, []);

  // ✅ Download CSV
  const handleConfirmDownload = () => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
          let url = `${baseUrl}/download-logs`;
    if (downloadDates.length === 2) {
      const from = dayjs(downloadDates[0]).format("YYYY-MM-DD");
      const to = dayjs(downloadDates[1]).format("YYYY-MM-DD");
      url += `?from_date=${from}&to_date=${to}`;
    }
    console.log("Fields ที่เลือก:", selectedFields);
    window.open(url, "_blank");
    setDownloadModalVisible(false);
    notification.info({
      message: "📥 กำลังดาวน์โหลด Data Logs",
      description: "ระบบกำลังเตรียมไฟล์ กรุณารอสักครู่...",
    });
  };

  return (
    <div style={{ position: "relative", minHeight: 400, padding: 24 }}>
      <SystemAlertBar />
      <Spin
        spinning={loadingOverlay}
        tip="กำลังโหลดข้อมูล..."
        size="large"
        style={{
          position: "absolute",
          zIndex: 1000,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.7)",
        }}
      >
        <Title level={3} style={{ marginBottom: 24 }}>
          CEMS Data Logs
        </Title>

        <Space style={{ marginBottom: 24 }} wrap>
          <RangePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder={["เลือกวันเริ่มต้น", "เลือกวันสิ้นสุด"]}
            onChange={(val) =>
              setDateRange(
                val && val.length === 2
                  ? [val[0].startOf("second"), val[1].endOf("second")]
                  : []
              )
            }
            allowClear
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => setDownloadModalVisible(true)}
          >
            Download CSV
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchPreviewData(true)}
            loading={previewLoading}
          >
            Reload Preview
          </Button>
        </Space>

        <Title level={5} style={{ marginTop: 32 }}>
          🔎 Latest Data Preview (Stack 1)
        </Title>

        {previewData.length > 0 ? (
          <Table
            dataSource={previewData}
            columns={columns}
            pagination={{ pageSize: 10 }}
            size="middle"
            bordered
            loading={previewLoading}
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          />
        ) : (
          <Empty description="ไม่มีข้อมูลแสดงขณะนี้" style={{ marginTop: 24 }} />
        )}
      </Spin>

      <Modal
        title="Download Data Logs"
        open={downloadModalVisible}
        onCancel={() => setDownloadModalVisible(false)}
        onOk={handleConfirmDownload}
        okText="Confirm Download"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <RangePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            onChange={(val) => setDownloadDates(val)}
          />
          <Checkbox.Group
            options={[
              { label: "SO2", value: "SO2" },
              { label: "NOx", value: "NOx" },
              { label: "O2", value: "O2" },
              { label: "CO", value: "CO" },
              { label: "Dust", value: "Dust" },
              { label: "Temp", value: "Temp" },
              { label: "Velocity", value: "Velocity" },
              { label: "Flowrate", value: "Flowrate" },
              { label: "Pressure", value: "Pressure" },
            ]}
            value={selectedFields}
            onChange={setSelectedFields}
          />
        </Space>
      </Modal>
    </div>
  );
}
