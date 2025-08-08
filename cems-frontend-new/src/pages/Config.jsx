import React, { useState, useEffect } from "react";
import {
  Typography,
  Tabs,
  Space,
  Row,
  Col,
  message,
  Alert,
  Card,
  Button,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Table,
  Tag,
  Divider,
  Spin,
  Modal,
} from "antd";
import apiService from "../config/apiService";
import {
  SettingOutlined,
  DatabaseOutlined,
  ToolOutlined,
  RocketOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function Config() {
  // State management
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [mappingData, setMappingData] = useState([]);
  const [activeTab, setActiveTab] = useState("connection");
  const [editingDevice, setEditingDevice] = useState(null);
  const [editingMapping, setEditingMapping] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState("device"); // "device" or "mapping"
  const [selectedDevice, setSelectedDevice] = useState(null); // เพิ่ม state สำหรับอุปกรณ์ที่เลือก
  const [selectedParameter, setSelectedParameter] = useState(null); // เพิ่ม state สำหรับพารามิเตอร์ที่เลือก

  // Form instances
  const [deviceForm] = Form.useForm();
  const [mappingForm] = Form.useForm();
  const [systemForm] = Form.useForm();
  




  // ✅ เพิ่ม Device Parameter Mapping
  const deviceParameterMapping = {
    "GasAnalyzer": [
      { name: "SO2", unit: "ppm", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "NOx", unit: "ppm", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "O2", unit: "%", address: 4, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "CO", unit: "ppm", address: 6, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Dust", unit: "mg/m³", address: 8, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Temperature", unit: "°C", address: 10, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Velocity", unit: "m/s", address: 12, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Pressure", unit: "Pa", address: 14, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "DustSensor": [
      { name: "Dust", unit: "mg/m³", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "PM2.5", unit: "µg/m³", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "PM10", unit: "µg/m³", address: 4, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Temperature", unit: "°C", address: 6, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Humidity", unit: "%", address: 8, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "FlowSensor": [
      { name: "Temperature", unit: "°C", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Velocity", unit: "m/s", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Pressure", unit: "Pa", address: 4, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Flowrate", unit: "m³/h", address: 6, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "EnvironmentalMonitor": [
      { name: "Temperature", unit: "°C", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Humidity", unit: "%", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Pressure", unit: "hPa", address: 4, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "WindSpeed", unit: "m/s", address: 6, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "WindDirection", unit: "°", address: 8, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "PowerMeter": [
      { name: "Voltage", unit: "V", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Current", unit: "A", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Power", unit: "kW", address: 4, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Energy", unit: "kWh", address: 6, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "PowerFactor", unit: "", address: 8, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "MultiParameterDevice": [
      { name: "Param1", unit: "", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Param2", unit: "", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Param3", unit: "", address: 4, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Param4", unit: "", address: 6, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "DualParameterDevice": [
      { name: "Param1", unit: "", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 },
      { name: "Param2", unit: "", address: 2, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ],
    "SingleParameterDevice": [
      { name: "Value1", unit: "", address: 0, dataType: "float32", dataFormat: "Float AB CD", registerCount: 2 }
    ]
  };

  // ✅ ฟังก์ชันสำหรับดึงชื่ออุปกรณ์จาก deviceType
  const getDeviceNameFromType = (deviceType) => {
    const typeMapping = {
      "Gas Analyzer": "GasAnalyzer",
      "Dust Sensor": "DustSensor", 
      "Flow Sensor": "FlowSensor",
      "Environmental Monitor": "EnvironmentalMonitor",
      "Power Meter": "PowerMeter",
      "Multi-Parameter Device": "MultiParameterDevice",
      "Dual-Parameter Device": "DualParameterDevice",
      "Single-Parameter Device": "SingleParameterDevice"
    };
    return typeMapping[deviceType] || "GasAnalyzer";
  };

  // ✅ ฟังก์ชันสำหรับดึงพารามิเตอร์ตามอุปกรณ์
  const getParametersForDevice = (deviceName) => {
    // ถ้าเป็นชื่ออุปกรณ์โดยตรง
    if (deviceParameterMapping[deviceName]) {
      return deviceParameterMapping[deviceName];
    }
    
    // ถ้าเป็น deviceType ให้แปลงเป็นชื่ออุปกรณ์
    const mappedName = getDeviceNameFromType(deviceName);
    return deviceParameterMapping[mappedName] || deviceParameterMapping["GasAnalyzer"];
  };

  // ✅ ฟังก์ชันสำหรับอัพเดทฟอร์มเมื่อเลือกอุปกรณ์
  const handleDeviceChange = (deviceName) => {
    setSelectedDevice(deviceName);
    setSelectedParameter(null);
    
    // รีเซ็ตฟิลด์ที่เกี่ยวข้อง
    mappingForm.setFieldsValue({
      name: undefined,
      unit: undefined,
      address: undefined,
      dataType: undefined,
      dataFormat: undefined,
      registerCount: undefined
    });
  };

  // ✅ ฟังก์ชันสำหรับอัพเดทฟอร์มเมื่อเลือกพารามิเตอร์
  const handleParameterChange = (parameterName) => {
    if (!selectedDevice) return;
    
    setSelectedParameter(parameterName);
    
    const parameters = getParametersForDevice(selectedDevice);
    const selectedParam = parameters.find(p => p.name === parameterName);
    
    if (selectedParam) {
      mappingForm.setFieldsValue({
        unit: selectedParam.unit,
        address: selectedParam.address,
        dataType: selectedParam.dataType,
        dataFormat: selectedParam.dataFormat,
        registerCount: selectedParam.registerCount
      });
    }
  };

  // ✅ เพิ่มฟังก์ชันคำนวณพื้นที่อัตโนมัติ
  const calculateArea = () => {
    const shape = systemForm.getFieldValue("stack_shape");
    
    if (shape === "circular") {
      const diameter = systemForm.getFieldValue("stack_diameter");
      if (diameter) {
        const area = Math.PI * Math.pow(diameter / 2, 2);
        systemForm.setFieldValue("stack_area", parseFloat(area.toFixed(3)));
      }
    } else if (shape === "circular_circumference") {
      const circumference = systemForm.getFieldValue("stack_circumference");
      if (circumference) {
        // สูตร: เส้นผ่านศูนย์กลาง = เส้นรอบวง ÷ π
        const diameter = circumference / Math.PI;
        // สูตร: พื้นที่ = π × (เส้นผ่านศูนย์กลาง/2)²
        const area = Math.PI * Math.pow(diameter / 2, 2);
        
        systemForm.setFieldValue("stack_diameter", parseFloat(diameter.toFixed(3)));
        systemForm.setFieldValue("stack_area", parseFloat(area.toFixed(3)));
      }
    } else if (shape === "rectangular") {
      const width = systemForm.getFieldValue("stack_width");
      const length = systemForm.getFieldValue("stack_length");
      if (width && length) {
        const area = width * length;
        systemForm.setFieldValue("stack_area", parseFloat(area.toFixed(3)));
      }
    }
  };

  // Check backend connection
  const checkBackendConnection = async () => {
    try {
      const connected = await apiService.checkBackendConnection();
      setBackendConnected(connected);
      return connected;
    } catch {
      setBackendConnected(false);
      return false;
    }
  };

  // Load configuration data
  const loadConfigData = async () => {
    if (!backendConnected) return;
    
    setLoading(true);
    try {
      // Load config
      const config = await apiService.getConfig();
      setConfigData(config);
      
      // Set form values
      try {
        systemForm.setFieldsValue({
          log_interval: config.connection?.log_interval || 60,
          reconnect_interval: config.connection?.reconnect_interval || 60,
          alarm_threshold_so2: config.connection?.alarm_threshold?.SO2 || 200,
          alarm_threshold_co: config.connection?.alarm_threshold?.CO || 100,
          alarm_threshold_dust: config.connection?.alarm_threshold?.Dust || 50,
          stack_area: config.stack_info?.area || 1.0,
          stack_diameter: config.stack_info?.diameter || 1.0,
        });
      } catch {
        // Form not mounted yet, ignore
      }

      // Load mapping
      const mapping = await apiService.getMapping();
      setMappingData(mapping);
    } catch (error) {
      message.error("❌ ไม่สามารถโหลดข้อมูลได้");
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save configuration
  const saveConfig = async (values) => {
    if (!backendConnected) {
      message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
      return;
    }

    setLoading(true);
    try {
      const configToSave = {
        connection: {
          devices: configData?.connection?.devices || [],
          alarm_threshold: {
            SO2: values.alarm_threshold_so2,
            CO: values.alarm_threshold_co,
            Dust: values.alarm_threshold_dust,
          },
          log_interval: values.log_interval,
          reconnect_interval: values.reconnect_interval,
        },
        stack_info: {
          area: values.stack_area,
          diameter: values.stack_diameter,
        }
      };

      await apiService.updateConfig(configToSave);
      message.success("✅ บันทึกการตั้งค่าเรียบร้อยแล้ว");
      await loadConfigData(); // Reload data
    } catch (error) {
      message.error("❌ เกิดข้อผิดพลาดในการบันทึก");
      console.error("Error saving config:", error);
    } finally {
      setLoading(false);
    }
  };



  // Add device
  const addDevice = () => {
    setModalType("device");
    setEditingDevice(null);
    setIsModalVisible(true);
  };

  // Edit device
  const editDevice = (device, index) => {
    setModalType("device");
    setEditingDevice({ ...device, index });
    deviceForm.setFieldsValue(device);
    setIsModalVisible(true);
  };

  // Delete device
  const deleteDevice = async (index) => {
    if (!backendConnected) {
      message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
      return;
    }

    Modal.confirm({
      title: "ยืนยันการลบ",
      content: "คุณต้องการลบอุปกรณ์นี้หรือไม่?",
      onOk: async () => {
        try {
          const newDevices = [...(configData?.connection?.devices || [])];
          newDevices.splice(index, 1);
          
          const configToSave = {
            ...configData,
            connection: {
              ...configData.connection,
              devices: newDevices
            }
          };

          const res = await fetch(`${backendUrl}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configToSave)
          });

          if (res.ok) {
            setConfigData(configToSave);
            message.success("✅ ลบอุปกรณ์เรียบร้อยแล้ว");
          } else {
            message.error("❌ ไม่สามารถลบอุปกรณ์ได้");
          }
        } catch (error) {
          console.error("Error deleting device:", error);
          message.error("❌ เกิดข้อผิดพลาดในการลบ");
        }
      }
    });
  };

  // Save device
  const saveDevice = async () => {
    if (!backendConnected) {
      message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
      return;
    }

    try {
      const values = await deviceForm.validateFields();
      const newDevices = [...(configData?.connection?.devices || [])];
      
      if (editingDevice !== null) {
        // Edit existing device
        newDevices[editingDevice.index] = values;
      } else {
        // Add new device
        newDevices.push(values);
      }

      // Save to backend
      const configToSave = {
        ...configData,
        connection: {
          ...configData.connection,
          devices: newDevices
        }
      };

      const res = await fetch(`${backendUrl}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave)
      });

      if (res.ok) {
        setConfigData(configToSave);
        setIsModalVisible(false);
        message.success(editingDevice ? "✅ แก้ไขอุปกรณ์เรียบร้อยแล้ว" : "✅ เพิ่มอุปกรณ์เรียบร้อยแล้ว");
        // Reload config to ensure backend has latest data
        await loadConfigData();
      } else {
        message.error("❌ ไม่สามารถบันทึกอุปกรณ์ได้");
      }
    } catch (error) {
      console.error("Form validation error:", error);
      message.error("❌ เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Add mapping
  const addMapping = () => {
    setModalType("mapping");
    setEditingMapping(null);
    setSelectedDevice(null);
    setSelectedParameter(null);
    setIsModalVisible(true);
  };

  // Edit mapping
  const editMapping = (mapping, index) => {
    setModalType("mapping");
    setEditingMapping({ ...mapping, index });
    setSelectedDevice(mapping.device);
    setSelectedParameter(mapping.name);
    mappingForm.setFieldsValue(mapping);
    setIsModalVisible(true);
  };

  // Delete mapping
  const deleteMapping = async (index) => {
    if (!backendConnected) {
      message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
      return;
    }

    Modal.confirm({
      title: "ยืนยันการลบ",
      content: "คุณต้องการลบการแมปข้อมูลนี้หรือไม่?",
      onOk: async () => {
        try {
          const newMapping = [...mappingData];
          newMapping.splice(index, 1);
          
          const res = await fetch(`${backendUrl}/mapping`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMapping)
          });

          if (res.ok) {
            setMappingData(newMapping);
            message.success("✅ ลบการแมปข้อมูลเรียบร้อยแล้ว");
          } else {
            message.error("❌ ไม่สามารถลบการแมปข้อมูลได้");
          }
        } catch (error) {
          console.error("Error deleting mapping:", error);
          message.error("❌ เกิดข้อผิดพลาดในการลบ");
        }
      }
    });
  };

  // Save mapping
  const saveMappingItem = async () => {
    if (!backendConnected) {
      message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
      return;
    }

    try {
      const values = await mappingForm.validateFields();
      const newMapping = [...mappingData];
      
      if (editingMapping !== null) {
        // Edit existing mapping
        newMapping[editingMapping.index] = values;
      } else {
        // Add new mapping
        newMapping.push(values);
      }

      // Save to backend
      await apiService.updateMapping(newMapping);
      setMappingData(newMapping);
      setIsModalVisible(false);
      setSelectedDevice(null);
      setSelectedParameter(null);
      message.success(editingMapping ? "✅ แก้ไขการแมปข้อมูลเรียบร้อยแล้ว" : "✅ เพิ่มการแมปข้อมูลเรียบร้อยแล้ว");
      // Reload mapping to ensure backend has latest data
      await loadConfigData();
    } catch (error) {
      console.error("Form validation error:", error);
      message.error("❌ เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Reset configuration
  const resetConfig = async () => {
    Modal.confirm({
      title: "ยืนยันการรีเซ็ต",
      content: "คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดเป็นค่าเริ่มต้นหรือไม่?",
      onOk: async () => {
        setLoading(true);
        try {
          await apiService.resetConfig();
          message.success("✅ รีเซ็ตการตั้งค่าเรียบร้อยแล้ว");
          await loadConfigData();
        } catch (error) {
          message.error("❌ เกิดข้อผิดพลาดในการรีเซ็ต");
          console.error("Error resetting config:", error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Load configuration on mount
  useEffect(() => {
    const init = async () => {
      const connected = await checkBackendConnection();
      if (connected) {
        await loadConfigData();
      }
    };
    init();
  }, [backendConnected]);

  // Device columns for table
  const deviceColumns = [
    {
      title: "ชื่ออุปกรณ์",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "โหมด",
      dataIndex: "mode",
      key: "mode",
      render: (mode) => <Tag color={mode === "tcp" ? "blue" : "green"}>{mode.toUpperCase()}</Tag>,
    },
    {
      title: "IP/Port",
      key: "address",
      render: (_, record) => (
        <span>
          {record.mode === "tcp" ? `${record.ip}:${record.port}` : record.comPort}
        </span>
      ),
    },
    {
      title: "Slave ID",
      dataIndex: "slaveId",
      key: "slaveId",
    },
    {
      title: "การดำเนินการ",
      key: "actions",
      render: (_, record, index) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => editDevice(record, index)}
          >
            แก้ไข
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteDevice(index)}
          >
            ลบ
          </Button>
        </Space>
      ),
    },
  ];

  // Mapping columns for table
  const mappingColumns = [
    {
      title: "ชื่อพารามิเตอร์",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "อุปกรณ์",
      dataIndex: "device",
      key: "device",
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Data Type",
      dataIndex: "dataType",
      key: "dataType",
      render: (type) => <Tag color="purple">{type}</Tag>,
    },
    {
      title: "Format",
      dataIndex: "dataFormat",
      key: "dataFormat",
      render: (format) => <Tag color="orange">{format}</Tag>,
    },
    {
      title: "หน่วย",
      dataIndex: "unit",
      key: "unit",
    },
    {
      title: "การดำเนินการ",
      key: "actions",
      render: (_, record, index) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => editMapping(record, index)}
          >
            แก้ไข
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteMapping(index)}
          >
            ลบ
          </Button>
        </Space>
      ),
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: "connection",
      label: (
        <span>
          <DatabaseOutlined />
          การเชื่อมต่อ
        </span>
      ),
      children: (
        <Card title="การตั้งค่าการเชื่อมต่ออุปกรณ์" size="small">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={5}>อุปกรณ์ Modbus</Title>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadConfigData}
                  loading={loading}
                >
                  โหลดใหม่
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addDevice}
                >
                  เพิ่มอุปกรณ์
                </Button>
              </Space>
            </div>
            
            <Table
              dataSource={configData?.connection?.devices || []}
              columns={deviceColumns}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Space>
        </Card>
      ),
    },
    {
      key: "mapping",
      label: (
        <span>
          <ToolOutlined />
          การแมปข้อมูล
        </span>
      ),
      children: (
        <Card title="การตั้งค่าการแมปข้อมูล" size="small">
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={5}>การแมป Registers</Title>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadConfigData}
                  loading={loading}
                >
                  โหลดใหม่
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addMapping}
                >
                  เพิ่มการแมป
                </Button>
              </Space>
            </div>
            
            <Table
              dataSource={mappingData}
              columns={mappingColumns}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Space>
        </Card>
      ),
    },
    {
      key: "system",
      label: (
        <span>
          <SettingOutlined />
          การตั้งค่าระบบ
        </span>
      ),
      children: (
        <Card title="การตั้งค่าระบบ" size="small">
          <Form
            form={systemForm}
            layout="vertical"
            onFinish={saveConfig}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Title level={5}>การตั้งค่าการบันทึก</Title>
                <Form.Item
                  label="ช่วงเวลาบันทึก (วินาที)"
                  name="log_interval"
                  rules={[{ required: true, message: "กรุณาระบุช่วงเวลาบันทึก" }]}
                >
                  <InputNumber min={1} max={3600} style={{ width: "100%" }} />
                </Form.Item>
                
                <Form.Item
                  label="ช่วงเวลาลองเชื่อมต่อใหม่ (วินาที)"
                  name="reconnect_interval"
                  rules={[{ required: true, message: "กรุณาระบุช่วงเวลาลองเชื่อมต่อใหม่" }]}
                >
                  <InputNumber min={1} max={3600} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Title level={5}>การตั้งค่า Alarm Threshold</Title>
                <Form.Item
                  label="SO₂ (ppm)"
                  name="alarm_threshold_so2"
                  rules={[{ required: true, message: "กรุณาระบุค่า SO₂" }]}
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
                
                <Form.Item
                  label="CO (ppm)"
                  name="alarm_threshold_co"
                  rules={[{ required: true, message: "กรุณาระบุค่า CO" }]}
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
                
                <Form.Item
                  label="Dust (mg/m³)"
                  name="alarm_threshold_dust"
                  rules={[{ required: true, message: "กรุณาระบุค่า Dust" }]}
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            
            <Divider />
            
            <Title level={5}>ข้อมูล Stack</Title>
            
            {/* Stack Shape Selection */}
            <Form.Item
              label="รูปร่าง Stack"
              name="stack_shape"
              initialValue="circular"
            >
              <Select onChange={calculateArea}>
                <Option value="circular">วงกลม (Circular)</Option>
                <Option value="circular_circumference">วงกลม - ใส่เส้นรอบวง</Option>
                <Option value="rectangular">สี่เหลี่ยม (Rectangular)</Option>
                <Option value="custom">กำหนดเอง (Custom)</Option>
              </Select>
            </Form.Item>
            
            {/* Conditional Fields based on Shape */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.stack_shape !== currentValues.stack_shape}
            >
              {({ getFieldValue }) => {
                const shape = getFieldValue("stack_shape");
                
                if (shape === "circular") {
                  return (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="เส้นผ่านศูนย์กลาง (m)"
                          name="stack_diameter"
                          rules={[{ required: true, message: "กรุณาระบุเส้นผ่านศูนย์กลาง" }]}
                        >
                          <InputNumber 
                            min={0.1} 
                            step={0.1} 
                            style={{ width: "100%" }}
                            onChange={calculateArea}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="พื้นที่ (m²)"
                          name="stack_area"
                        >
                          <InputNumber disabled style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                } else if (shape === "circular_circumference") {
                  return (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="เส้นรอบวง (m)"
                          name="stack_circumference"
                          rules={[{ required: true, message: "กรุณาระบุเส้นรอบวง" }]}
                        >
                          <InputNumber 
                            min={0.1} 
                            step={0.1} 
                            style={{ width: "100%" }}
                            onChange={calculateArea}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          label="เส้นผ่านศูนย์กลาง (m)"
                          name="stack_diameter"
                        >
                          <InputNumber disabled style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          label="พื้นที่ (m²)"
                          name="stack_area"
                        >
                          <InputNumber disabled style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                } else if (shape === "rectangular") {
                  return (
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          label="ความกว้าง (m)"
                          name="stack_width"
                          rules={[{ required: true, message: "กรุณาระบุความกว้าง" }]}
                        >
                          <InputNumber 
                            min={0.1} 
                            step={0.1} 
                            style={{ width: "100%" }}
                            onChange={calculateArea}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          label="ความยาว (m)"
                          name="stack_length"
                          rules={[{ required: true, message: "กรุณาระบุความยาว" }]}
                        >
                          <InputNumber 
                            min={0.1} 
                            step={0.1} 
                            style={{ width: "100%" }}
                            onChange={calculateArea}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          label="พื้นที่ (m²)"
                          name="stack_area"
                        >
                          <InputNumber disabled style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                } else {
                  return (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="พื้นที่ (m²)"
                          name="stack_area"
                          rules={[{ required: true, message: "กรุณาระบุพื้นที่" }]}
                        >
                          <InputNumber min={0.1} step={0.1} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="เส้นผ่านศูนย์กลาง (m)"
                          name="stack_diameter"
                          rules={[{ required: true, message: "กรุณาระบุเส้นผ่านศูนย์กลาง" }]}
                        >
                          <InputNumber min={0.1} step={0.1} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                }
              }}
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={loading}
                >
                  บันทึกการตั้งค่า
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadConfigData}
                  loading={loading}
                >
                  โหลดใหม่
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: "quick",
      label: (
        <span>
          <RocketOutlined />
          การตั้งค่าเร็ว
        </span>
      ),
      children: (
        <Card title="การตั้งค่าเร็ว" size="small">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert
              message="การตั้งค่าเร็ว"
              description="ใช้การตั้งค่าเริ่มต้นสำหรับระบบ CEMS"
              type="info"
              showIcon
            />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Title level={5}>การตั้งค่าเริ่มต้น</Title>
                <Text type="secondary">
                  ใช้การตั้งค่าเริ่มต้นสำหรับ Gas Analyzer, Dust Sensor, และ Flow Sensor
                </Text>
              </div>
              <Button
                type="primary"
                danger
                icon={<ReloadOutlined />}
                onClick={resetConfig}
                loading={loading}
              >
                รีเซ็ตการตั้งค่า
              </Button>
            </div>
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
          ⚙️ การตั้งค่าระบบ CEMS
        </Title>
        <Text type="secondary">
          ตั้งค่าการเชื่อมต่อ การแมปข้อมูล และการทำงานของระบบ
        </Text>
      </div>

      {/* Backend Status */}
      <Alert
        message={backendConnected ? "✅ Backend เชื่อมต่อได้" : "❌ Backend ไม่เชื่อมต่อ"}
        description={
          backendConnected
            ? "ระบบพร้อมใช้งาน"
            : "กรุณาตรวจสอบการเชื่อมต่อ backend"
        }
        type={backendConnected ? "success" : "error"}
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Configuration Tabs */}
      <Spin spinning={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ background: "white", padding: 24, borderRadius: 8 }}
        />
      </Spin>

      {/* Device Modal */}
      <Modal
        title={editingDevice ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}
        open={isModalVisible && modalType === "device"}
        onOk={saveDevice}
        onCancel={() => setIsModalVisible(false)}
        width={600}
        destroyOnHidden
        maskClosable={false}
        keyboard={false}
        afterClose={() => {
          if (!editingDevice) {
            deviceForm.resetFields();
          }
        }}
      >
        <Form
          form={deviceForm}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="ชื่ออุปกรณ์"
            name="name"
            rules={[{ required: true, message: "กรุณาระบุชื่ออุปกรณ์" }]}
          >
            <Input placeholder="เช่น GasAnalyzer, DustSensor" />
          </Form.Item>
          
          <Form.Item
            label="โหมดการเชื่อมต่อ"
            name="mode"
            rules={[{ required: true, message: "กรุณาเลือกโหมดการเชื่อมต่อ" }]}
          >
            <Select placeholder="เลือกโหมดการเชื่อมต่อ">
              <Option value="tcp">TCP</Option>
              <Option value="rtu">RTU</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.mode !== currentValues.mode}
          >
            {({ getFieldValue }) => {
              const mode = getFieldValue("mode");
              return mode === "tcp" ? (
                <>
                  <Form.Item
                    label="IP Address"
                    name="ip"
                    rules={[{ required: true, message: "กรุณาระบุ IP Address" }]}
                  >
                    <Input placeholder="127.0.0.1" />
                  </Form.Item>
                  
                  <Form.Item
                    label="Port"
                    name="port"
                    rules={[{ required: true, message: "กรุณาระบุ Port" }]}
                  >
                    <InputNumber min={1} max={65535} style={{ width: "100%" }} placeholder="502" />
                  </Form.Item>
                </>
              ) : mode === "rtu" ? (
                <>
                  <Form.Item
                    label="COM Port"
                    name="comPort"
                    rules={[{ required: true, message: "กรุณาระบุ COM Port" }]}
                  >
                    <Input placeholder="COM1" />
                  </Form.Item>
                  
                  <Form.Item
                    label="Baudrate"
                    name="baudrate"
                    rules={[{ required: true, message: "กรุณาระบุ Baudrate" }]}
                  >
                    <Select placeholder="เลือก Baudrate">
                      <Option value={9600}>9600</Option>
                      <Option value={19200}>19200</Option>
                      <Option value={38400}>38400</Option>
                      <Option value={57600}>57600</Option>
                      <Option value={115200}>115200</Option>
                    </Select>
                  </Form.Item>
                </>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item
            label="Slave ID"
            name="slaveId"
            rules={[{ required: true, message: "กรุณาระบุ Slave ID" }]}
          >
            <InputNumber min={1} max={255} style={{ width: "100%" }} placeholder="1" />
          </Form.Item>
          
          <Form.Item
            label="ประเภท Register"
            name="registerType"
            initialValue="holding"
          >
            <Select>
              <Option value="holding">Holding Registers</Option>
              <Option value="input">Input Registers</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Mapping Modal */}
      <Modal
        title={editingMapping ? "แก้ไขการแมปข้อมูล" : "เพิ่มการแมปข้อมูล"}
        open={isModalVisible && modalType === "mapping"}
        onOk={saveMappingItem}
        onCancel={() => {
          setIsModalVisible(false);
          setSelectedDevice(null);
          setSelectedParameter(null);
        }}
        width={600}
        destroyOnHidden
        maskClosable={false}
        keyboard={false}
        afterClose={() => {
          if (!editingMapping) {
            mappingForm.resetFields();
          }
        }}
      >
        <Form
          form={mappingForm}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="อุปกรณ์"
            name="device"
            rules={[{ required: true, message: "กรุณาเลือกอุปกรณ์" }]}
          >
            <Select
              placeholder="เลือกอุปกรณ์"
              onChange={handleDeviceChange}
              showSearch
              optionFilterProp="children"
              notFoundContent={
                (configData?.connection?.devices || []).length === 0 
                  ? "ไม่มีอุปกรณ์ กรุณาเพิ่มอุปกรณ์ก่อน" 
                  : "ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา"
              }
            >
              {(configData?.connection?.devices || []).map(device => (
                <Option key={device.name} value={device.name}>
                  {device.name} {device.deviceType ? `(${device.deviceType})` : ''} - {device.mode === 'tcp' ? `${device.ip}:${device.port}` : device.comPort}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            label="ชื่อพารามิเตอร์"
            name="name"
            rules={[{ required: true, message: "กรุณาเลือกชื่อพารามิเตอร์" }]}
          >
            <Select
              placeholder={selectedDevice ? "เลือกพารามิเตอร์" : "กรุณาเลือกอุปกรณ์ก่อน"}
              onChange={handleParameterChange}
              disabled={!selectedDevice}
              showSearch
              optionFilterProp="children"
              notFoundContent={
                !selectedDevice 
                  ? "กรุณาเลือกอุปกรณ์ก่อน" 
                  : "ไม่พบพารามิเตอร์ที่ตรงกับคำค้นหา"
              }
            >
              {(selectedDevice ? getParametersForDevice(selectedDevice) : []).map(param => (
                <Option key={param.name} value={param.name}>
                  {param.name} ({param.unit}) - Address: {param.address}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            label="Address"
            name="address"
            rules={[{ required: true, message: "กรุณาระบุ Address" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
          </Form.Item>
          
          {selectedDevice && (
            <Alert
              message={`อุปกรณ์: ${selectedDevice}`}
              description={`พารามิเตอร์ที่แนะนำสำหรับอุปกรณ์นี้: ${getParametersForDevice(selectedDevice).map(p => `${p.name} (${p.unit})`).join(', ')}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Form.Item
            label="Data Type"
            name="dataType"
            rules={[{ required: true, message: "กรุณาเลือก Data Type" }]}
          >
            <Select placeholder="เลือก Data Type">
              <Option value="int16">int16</Option>
              <Option value="int32">int32</Option>
              <Option value="float32">float32</Option>
              <Option value="float64">float64</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="Data Format"
            name="dataFormat"
            rules={[{ required: true, message: "กรุณาเลือก Data Format" }]}
          >
            <Select placeholder="เลือก Data Format">
              <Option value="Signed">Signed</Option>
              <Option value="Unsigned">Unsigned</Option>
              <Option value="Float AB CD">Float AB CD</Option>
              <Option value="Float CD AB">Float CD AB</Option>
              <Option value="Float BA DC">Float BA DC</Option>
              <Option value="Float DC BA">Float DC BA</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="Register Count"
            name="registerCount"
            rules={[{ required: true, message: "กรุณาระบุ Register Count" }]}
          >
            <InputNumber min={1} max={10} style={{ width: "100%" }} placeholder="1" />
          </Form.Item>
          
          <Form.Item
            label="Address Base"
            name="addressBase"
            initialValue={0}
          >
            <Select>
              <Option value={0}>Base 0 (Protocol)</Option>
              <Option value={1}>Base 1 (PLC)</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="หน่วย"
            name="unit"
            rules={[{ required: true, message: "กรุณาระบุหน่วย" }]}
          >
            <Input placeholder="เช่น ppm, %, °C" />
          </Form.Item>
          
          {selectedDevice && selectedParameter && (() => {
            const params = getParametersForDevice(selectedDevice);
            const selectedParam = params.find(p => p.name === selectedParameter);
            return selectedParam ? (
              <Alert
                message={`พารามิเตอร์: ${selectedParameter}`}
                description={`ข้อมูลที่แนะนำ: Address: ${selectedParam.address}, Data Type: ${selectedParam.dataType}, Format: ${selectedParam.dataFormat}, Register Count: ${selectedParam.registerCount}, Unit: ${selectedParam.unit}`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            ) : null;
          })()}
          
          <Form.Item
            label="สูตรคำนวณ"
            name="formula"
            initialValue="x"
          >
            <Input placeholder="x (ค่าดิบ), x/10, x*2" />
          </Form.Item>
          
          <Alert
            message="💡 เคล็ดลับ"
            description="เมื่อเลือกอุปกรณ์และพารามิเตอร์แล้ว ระบบจะกรอกข้อมูลที่แนะนำให้อัตโนมัติ คุณสามารถแก้ไขได้ตามต้องการ"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
          
          <Alert
            message="🔧 ข้อมูลเพิ่มเติม"
            description="ระบบจะแสดงพารามิเตอร์ที่เหมาะสมกับอุปกรณ์ที่เลือก เช่น GasAnalyzer จะมี SO2, NOx, O2, CO เป็นต้น หรือ DustSensor จะมี Dust, PM2.5, PM10 เป็นต้น หรือ FlowSensor จะมี Temperature, Velocity, Pressure เป็นต้น หรือ PowerMeter จะมี Voltage, Current, Power เป็นต้น หรือ EnvironmentalMonitor จะมี Temperature, Humidity, Pressure เป็นต้น หรือ MultiParameterDevice จะมี Param1, Param2, Param3, Param4 เป็นต้น หรือ DualParameterDevice จะมี Param1, Param2 เป็นต้น หรือ SingleParameterDevice จะมี Value1 เป็นต้น หรือ Modbus RTU Device จะมี Param1, Param2 เป็นต้น หรือ Web Interface จะมี Status, Config เป็นต้น หรือ Extended Modbus จะมี Custom1, Custom2 เป็นต้น หรือ Unknown Device จะมี Param1, Param2 เป็นต้น หรือ Custom Device จะมี Param1, Param2 เป็นต้น หรือ Other Device จะมี Param1, Param2 เป็นต้น หรือ Default Device จะมี Param1, Param2 เป็นต้น หรือ Generic Device จะมี Param1, Param2 เป็นต้น หรือ Standard Device จะมี Param1, Param2 เป็นต้น หรือ Basic Device จะมี Param1, Param2 เป็นต้น หรือ Simple Device จะมี Param1, Param2 เป็นต้น"
            type="info"
            showIcon
            style={{ marginTop: 8 }}
          />
        </Form>
      </Modal>

      {/* Footer */}
      <div style={{
        marginTop: 24,
        textAlign: "center",
        color: "#666",
        fontSize: "0.9em"
      }}>
        เวอร์ชัน 1.0.1 - ระบบ CEMS Configuration
      </div>
    </div>
  );
}
