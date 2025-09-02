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
  Switch,
  Tooltip,
  Dropdown,
} from "antd";
import { DownloadOutlined, ReloadOutlined, SyncOutlined, DownOutlined } from "@ant-design/icons";
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
  const [dataCache, setDataCache] = useState(new Map()); // เพิ่ม cache
  const [lastFetchTime, setLastFetchTime] = useState(0);



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
        <Tag color={v > 80 ? "red" : v > 50 ? "orange" : "green"}>
          {v ? Number(v).toFixed(1) : '-'}
        </Tag>
      ),
    },
    {
      title: "NOx (ppm)",
      dataIndex: "NOx",
      sorter: (a, b) => (a.NOx || 0) - (b.NOx || 0),
      render: (v) => (
        <Tag color={v > 200 ? "red" : v > 150 ? "orange" : "green"}>
          {v ? Number(v).toFixed(1) : '-'}
        </Tag>
      ),
    },
    {
      title: "O2 (%)",
      dataIndex: "O2",
      sorter: (a, b) => (a.O2 || 0) - (b.O2 || 0),
      render: (v) => <Tag color="geekblue">{v ? Number(v).toFixed(1) : '-'}</Tag>,
    },
    {
      title: "CO (ppm)",
      dataIndex: "CO",
      sorter: (a, b) => (a.CO || 0) - (b.CO || 0),
      render: (v) => (
        <Tag color={v > 50 ? "red" : v > 30 ? "orange" : "green"}>
          {v ? Number(v).toFixed(1) : '-'}
        </Tag>
      ),
    },
    {
      title: "Dust (mg/m3)",
      dataIndex: "Dust",
      sorter: (a, b) => (a.Dust || 0) - (b.Dust || 0),
      render: (v) => <Tag color="purple">{v ? v : '-'}</Tag>,
    },
    {
      title: "Temperature (degC)",
      dataIndex: "Temperature",
      sorter: (a, b) => (a.Temperature || 0) - (b.Temperature || 0),
      render: (v) => <Tag color="cyan">{v ? v : '-'}</Tag>,
    },
    {
      title: "Velocity (m/s)",
      dataIndex: "Velocity",
      sorter: (a, b) => (a.Velocity || 0) - (b.Velocity || 0),
      render: (v) => <Tag color="gold">{v ? v : '-'}</Tag>,
    },
    {
      title: "Flowrate (m3/h)",
      dataIndex: "Flowrate",
      sorter: (a, b) => (a.Flowrate || 0) - (b.Flowrate || 0),
      render: (v) => <Tag color="lime">{v ? v : '-'}</Tag>,
    },
    {
      title: "Pressure (Pa)",
      dataIndex: "Pressure",
      sorter: (a, b) => (a.Pressure || 0) - (b.Pressure || 0),
      render: (v) => <Tag color="volcano">{v ? v : '-'}</Tag>,
    },
  ];

  // ✅ โหลด Preview ล่าสุด - ใช้ API ใหม่
  const fetchPreviewData = async (notify = false, forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = 'preview-data';
    const cacheTime = 3000; // 3 วินาที

    // ใช้ cache ถ้าไม่เกินเวลา
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
      const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
      // ใช้ API เดิมก่อนเพื่อทดสอบ
      const res = await fetch(`${baseUrl}/log-preview`);
      if (!res.ok) throw new Error("Server Error");
      const data = await res.json();
      setPreviewData(data);
      
      // บันทึก cache
      setDataCache(prev => new Map(prev.set(cacheKey, {
        data,
        timestamp: now
      })));
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
    } finally {
      setPreviewLoading(false);
      setLoadingOverlay(false);
    }
  };

  // ✅ Auto refresh effect
  useEffect(() => {
    fetchPreviewData();
    
  }, []);

  // ✅ Download CSV
  const handleConfirmDownload = () => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
    let url = `${baseUrl}/download-logs`;
    
    // เพิ่มพารามิเตอร์วันที่
    if (downloadDates && downloadDates.length === 2) {
      const from = dayjs(downloadDates[0]).format("YYYY-MM-DD HH:mm:ss");
      const to = dayjs(downloadDates[1]).format("YYYY-MM-DD HH:mm:ss");
      url += `?from_date=${from}&to_date=${to}`;
    } else {
      // ถ้าไม่ระบุวันที่ ให้ดาวน์โหลด 7 วันล่าสุด
      url += `?`;
    }
    
    // เพิ่มพารามิเตอร์ฟิลด์ที่เลือก
    if (selectedFields.length > 0) {
      const fieldsParam = selectedFields.join(',');
      url += url.includes('?') && !url.endsWith('?') ? `&fields=${fieldsParam}` : `fields=${fieldsParam}`;
    }
    
    console.log("Download URL:", url);
    console.log("Fields ที่เลือก:", selectedFields);
    
    window.open(url, "_blank");
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
      case '1month':
        fromDate = now.subtract(1, 'month');
        toDate = now;
        break;
      case '3months':
        fromDate = now.subtract(3, 'months');
        toDate = now;
        break;
      case '6months':
        fromDate = now.subtract(6, 'months');
        toDate = now;
        break;
      case '1year':
        fromDate = now.subtract(1, 'year');
        toDate = now;
        break;
      case 'all':
        fromDate = null;
        toDate = null;
        break;
      default:
        return;
    }

    const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
    let url;
    if (period === 'all') {
      url = `${baseUrl}/download-logs?download_all=true&fields=${selectedFields.join(',')}`;
    } else {
      url = `${baseUrl}/download-logs?from_date=${fromDate.format('YYYY-MM-DD HH:mm:ss')}&to_date=${toDate.format('YYYY-MM-DD HH:mm:ss')}&fields=${selectedFields.join(',')}`;
    }
    
    console.log("Quick download URL:", url);
    console.log("Fields ที่เลือก:", selectedFields);
    
    window.open(url, "_blank");
    notification.success({
      message: `📥 กำลังดาวน์โหลด Data Logs (${period === '1month' ? '1 เดือน' : period === '3months' ? '3 เดือน' : period === '6months' ? '6 เดือน' : period === '1year' ? '1 ปี' : 'ทั้งหมด'})`,
      description: "ระบบกำลังเตรียมไฟล์จาก InfluxDB กรุณารอสักครู่...",
    });
  };

  const downloadMenuItems = [
    {
      key: '1month',
      label: '📅 1 เดือน',
      onClick: () => handleQuickDownload('1month')
    },
    {
      key: '3months',
      label: '📅 3 เดือน',
      onClick: () => handleQuickDownload('3months')
    },
    {
      key: '6months',
      label: '📅 6 เดือน',
      onClick: () => handleQuickDownload('6months')
    },
    {
      key: '1year',
      label: '📅 1 ปี',
      onClick: () => handleQuickDownload('1year')
    },
    {
      type: 'divider'
    },
    {
      key: 'all',
      label: '📊 ดาวน์โหลดทั้งหมด',
      onClick: () => handleQuickDownload('all')
    },
    {
      type: 'divider'
    },
    {
      key: 'custom',
      label: '⚙️ กำหนดเอง',
      onClick: () => setDownloadModalVisible(true)
    }
  ];

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

        {/* Download Button Section - Top Right */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '16px'
        }}>
          <Dropdown
            menu={{ items: downloadMenuItems }}
            placement="bottomRight"
          >
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              ดาวน์โหลด <DownOutlined />
            </Button>
          </Dropdown>
        </div>

        <Title level={5} style={{ marginTop: 32 }}>
          🔎 Latest Data Preview (Stack 1) - Manual
          {lastFetchTime > 0 && (
            <span style={{ fontSize: '14px', color: '#666', marginLeft: 10 }}>
              Last update: {dayjs(lastFetchTime).format('HH:mm:ss')}
            </span>
          )}

        </Title>

        {/* Data Filter Section - Below Table */}
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          border: '1px solid #e8e8e8'
        }}>
          <Title level={5} style={{ marginBottom: 16, color: '#1890ff' }}>
            🔍 ตัวกรองข้อมูล (Data Filter)
          </Title>
          <Space style={{ marginBottom: 16 }} wrap>
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
              icon={<ReloadOutlined />}
              onClick={() => fetchPreviewData(true, true)}
              loading={previewLoading}
            >
              รีเฟรชข้อมูล
            </Button>
          </Space>
        </div>

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
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>📅 ช่วงวันที่</Title>
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              onChange={(val) => setDownloadDates(val)}
              style={{ width: '100%' }}
              placeholder={["วันเริ่มต้น", "วันสิ้นสุด"]}
            />
          </div>
          
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>📊 ข้อมูลที่ต้องการ</Title>
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
              style={{ width: '100%' }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
