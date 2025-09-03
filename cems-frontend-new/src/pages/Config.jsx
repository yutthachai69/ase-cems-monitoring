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
  ExperimentOutlined,
  BugOutlined,
} from "@ant-design/icons";
import SystemAlertBar from "../components/SystemAlertBar";
import { CONFIG } from "../config/config";

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
  const [gasConfig, setGasConfig] = useState({
    default_gases: [],
    additional_gases: []
  });
  const [gasConfigMessage, setGasConfigMessage] = useState('');
  const [isGasModalVisible, setIsGasModalVisible] = useState(false);

  const [newGasConfig, setNewGasConfig] = useState({
    name: '',
    display_name: '',
    unit: 'ppm',
    enabled: true,
    alarm_threshold: 50
  });

  

  // Form instances
  const [deviceForm] = Form.useForm();
  const [mappingForm] = Form.useForm();
  const [gasForm] = Form.useForm();
  const [systemForm] = Form.useForm();
  


  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  const auth = (() => { try { return JSON.parse(localStorage.getItem('auth')) || {}; } catch { return {}; } })();
  const authHeaders = auth.token ? { Authorization: `Bearer ${auth.token}` } : {};

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

  // ✅ ฟังก์ชันสำหรับ Status & Alarm
  const getStatusAlarmDescription = (name) => {
    const descriptions = {
      // Status descriptions
      "Maintenance Mode": "โหมดบำรุงรักษา",
      "Calibration Through Probe": "การสอบเทียบผ่าน probe",
      "Manual Blowback Button": "ปุ่ม blowback แบบมือ",
      "Analyzer Calibration": "การสอบเทียบเครื่องวิเคราะห์",
      "Analyzer Holding Zero": "เครื่องวิเคราะห์ถือค่า zero",
      "Analyzer Zero Indicator": "ตัวบ่งชี้ zero ของเครื่องวิเคราะห์",
      "Sampling SOV": "Solenoid valve สำหรับการสุ่มตัวอย่าง",
      "Sampling Pump": "ปั๊มสุ่มตัวอย่าง",
      "Direct Calibration SOV": "Solenoid valve สำหรับการสอบเทียบโดยตรง",
      "Blowback SOV": "Solenoid valve สำหรับ blowback",
      "Calibration Through Probe SOV": "Solenoid valve สำหรับการสอบเทียบผ่าน probe",
      "Calibration Through Probe Light": "ไฟแสดงการสอบเทียบผ่าน probe",
      "Blowback Light": "ไฟแสดง blowback",
      "Blowback in Operation": "Blowback กำลังทำงาน",
      "Hold Current Value": "ถือค่าปัจจุบัน",
      
      // Alarm descriptions
      "Temperature Controller Alarm": "แจ้งเตือนตัวควบคุมอุณหภูมิ",
      "Analyzer Malfunction": "เครื่องวิเคราะห์ทำงานผิดปกติ",
      "Sample Probe Alarm": "แจ้งเตือน probe สุ่มตัวอย่าง",
      "Alarm Light": "ไฟแจ้งเตือน"
    };
    
    return descriptions[name] || "ไม่ระบุ";
  };

  // ✅ ฟังก์ชันสำหรับ Address อัตโนมัติของ Status & Alarm
  const getStatusAlarmAddress = (name, deviceType) => {
    if (deviceType === "test4") {
      // Status addresses (0-14)
      const statusAddresses = {
        "Maintenance Mode": 0,
        "Calibration Through Probe": 1,
        "Manual Blowback Button": 2,
        "Analyzer Calibration": 3,
        "Analyzer Holding Zero": 4,
        "Analyzer Zero Indicator": 5,
        "Sampling SOV": 6,
        "Sampling Pump": 7,
        "Direct Calibration SOV": 8,
        "Blowback SOV": 9,
        "Calibration Through Probe SOV": 10,
        "Calibration Through Probe Light": 11,
        "Blowback Light": 12,
        "Blowback in Operation": 13,
        "Hold Current Value": 14
      };
      return statusAddresses[name] !== undefined ? statusAddresses[name] : null;
    } else if (deviceType === "test5") {
      // Alarm addresses (0-3)
      const alarmAddresses = {
        "Temperature Controller Alarm": 0,
        "Analyzer Malfunction": 1,
        "Sample Probe Alarm": 2,
        "Alarm Light": 3
      };
      return alarmAddresses[name] !== undefined ? alarmAddresses[name] : null;
    }
    return null;
  };

  // ✅ ฟังก์ชันสำหรับ Unit อัตโนมัติของ Status & Alarm
  const getStatusAlarmUnit = () => {
    // Status & Alarm ใช้ค่า 0/1 หรือ ON/OFF
    return "ON/OFF";
  };

  // ฟังก์ชันสำหรับรายการชื่อที่แนะนำตามประเภท
  const getSuggestedNames = (type) => {
    if (type === "test4") {
      return [
        "Maintenance Mode",
        "Calibration Through Probe", 
        "Manual Blowback Button",
        "Analyzer Calibration",
        "Analyzer Holding Zero",
        "Analyzer Zero Indicator",
        "Sampling SOV",
        "Sampling Pump",
        "Direct Calibration SOV",
        "Blowback SOV",
        "Calibration Through Probe SOV",
        "Calibration Through Probe Light",
        "Blowback Light",
        "Blowback in Operation",
        "Hold Current Value"
      ];
    } else if (type === "test5") {
      return [
        "Temperature Controller Alarm",
        "Analyzer Malfunction",
        "Sample Probe Alarm",
        "Alarm Light"
      ];
    }
    return [];
  };

  // ✅ เพิ่มฟังก์ชันคำนวณพื้นที่อัตโนมัติ
  const calculateArea = () => {
    if (!systemForm) return;
    
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
        
        console.log(`การคำนวณ: เส้นรอบวง ${circumference}m → เส้นผ่านศูนย์กลาง ${diameter.toFixed(3)}m → พื้นที่ ${area.toFixed(3)}m²`);
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
      const res = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
        headers: { ...authHeaders }
      });
      const isConnected = res.ok;
      setBackendConnected(isConnected);
      console.log("Backend connection status:", isConnected);
      return isConnected;
    } catch (error) {
      console.log("Backend connection error:", error);
      setBackendConnected(false);
      return false;
    }
  };

  // Load configuration data (รีเฟรชหน้า)
  const loadConfigData = async () => {
    // รีเฟรชทั้งหน้าเลย ไม่ต้องรอ
    window.location.reload();
  };

  // Load configuration data (โหลดข้อมูลแบบปกติ)
  const loadConfigDataNormal = async () => {
    setLoading(true);
    try {
      console.log("🔄 กำลังโหลดข้อมูล...");
      console.log("🔧 Backend URL:", backendUrl);
      console.log("🔧 Auth Headers:", authHeaders);
      
      // 1. Load config
      const configRes = await fetch(
        `${backendUrl}/config/?ts=${Date.now()}`,
        { headers: { ...authHeaders }, cache: 'no-store' }
      );
      console.log("🔧 Config Response Status:", configRes.status, configRes.statusText);
      console.log("🔧 Config Response Headers:", Object.fromEntries(configRes.headers.entries()));
      
      if (configRes.ok) {
        const config = await configRes.json();
        console.log("🔧 Config Data:", config);
        setConfigData(config);
        console.log("✅ โหลด config สำเร็จ");
        console.log("🚨 DEVICES IN CONFIG:", config?.connection?.devices);
        console.log("🚨 DEVICES COUNT:", config?.connection?.devices?.length || 0);
      } else {
        const errorText = await configRes.text().catch(() => "");
        console.log("❌ ไม่สามารถโหลด config ได้:", configRes.status, errorText);
      }

      // 2. Load mapping
      const mappingRes = await fetch(
        `${backendUrl}/config/mapping?ts=${Date.now()}`,
        { headers: { ...authHeaders }, cache: 'no-store' }
      );
      if (mappingRes.ok) {
        const mapping = await mappingRes.json();
        console.log("✅ โหลด mapping สำเร็จ:", mapping.length, "รายการ");
        console.log("🔧 Mapping data:", mapping);
        setMappingData(mapping);
      } else {
        console.log("❌ ไม่สามารถโหลด mapping ได้:", mappingRes.status);
        setMappingData([]);
      }
      
      console.log("✅ โหลดข้อมูลเสร็จสิ้น");
      
    } catch (error) {
      message.error("❌ ไม่สามารถโหลดข้อมูลได้");
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  // ทดสอบ backend mapping endpoint (merge-only หรือ replace)
  const testBackendMapping = async () => {
    // ลบการตรวจสอบ backendConnected ออก เพื่อให้ทดสอบได้
    // if (!backendConnected) {
    //   message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
    //   return;
    // }

    try {
      console.log("=== TESTING BACKEND MAPPING ENDPOINT ===");
      
      // 1) เอาข้อมูลปัจจุบันมาเก็บไว้
      const cur = await (await fetch(`${backendUrl}/config/mapping?ts=${Date.now()}`, { 
        headers: { ...authHeaders }, 
        cache: 'no-store' 
      })).json();
      console.log("Current mapping length:", cur.length);

      // 2) ลอง PUT เป็นอาร์เรย์ว่าง (ถ้า "replace" จริง ควรได้ว่าง)
      const emptyRes = await fetch(`${backendUrl}/config/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', ...authHeaders },
        body: JSON.stringify([]),
      });
      console.log("PUT empty array response status:", emptyRes.status);

      // 3) อ่านกลับ
      const after = await (await fetch(`${backendUrl}/config/mapping?ts=${Date.now()}`, { 
        headers: { ...authHeaders }, 
        cache: 'no-store' 
      })).json();
      console.log('After PUT empty array length =', after.length);

      // 4) ฟื้นฟูข้อมูลเดิม
      const restoreRes = await fetch(`${backendUrl}/config/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', ...authHeaders },
        body: JSON.stringify(cur),
      });
      console.log("Restore original data response status:", restoreRes.status);

      // สรุปผล
      if (after.length === 0) {
        console.log("✅ Backend is REPLACE mode - delete should work!");
        message.success("✅ Backend เป็น REPLACE mode - ปุ่มลบควรทำงานได้");
      } else {
        console.log("❌ Backend is MERGE-ONLY mode - delete won't work!");
        message.error("❌ Backend เป็น MERGE-ONLY mode - ปุ่มลบจะไม่ทำงาน");
      }

    } catch (error) {
      console.error("Error testing backend mapping:", error);
      message.error("❌ เกิดข้อผิดพลาดในการทดสอบ");
    }
  };

  // Load gas configuration
  const loadGasConfig = async () => {
    try {
      const response = await fetch(`${backendUrl}/config/gas`, { headers: { ...authHeaders } });
      if (response.ok) {
        const data = await response.json();
        setGasConfig(data);
      } else {
        console.log("Gas config response not ok:", response.status);
        // ใช้ค่าเริ่มต้นถ้าไม่มีข้อมูล
        setGasConfig({
          default_gases: [],
          additional_gases: []
        });
      }
    } catch (error) {
      console.error('Error loading gas config:', error);
      setGasConfigMessage('Error loading gas configuration');
      // ใช้ค่าเริ่มต้นถ้าเกิด error
      setGasConfig({
        default_gases: [],
        additional_gases: []
      });
    }
  };

  

  // Toggle gas display
  const toggleGas = async (gasName, enabled) => {
    try {
      const response = await fetch(`${backendUrl}/config/gas/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          gas_name: gasName,
          enabled: enabled
        })
      });
      
      if (response.ok) {
        // อัปเดต state
        setGasConfig(prev => ({
          default_gases: prev.default_gases.map(gas => 
            gas.name === gasName ? { ...gas, enabled } : gas
          ),
          additional_gases: prev.additional_gases.map(gas => 
            gas.name === gasName ? { ...gas, enabled } : gas
          )
        }));
        
        setGasConfigMessage(`${gasName} ${enabled ? 'enabled' : 'disabled'} successfully`);
      }
    } catch (error) {
      console.error('Error toggling gas:', error);
      setGasConfigMessage('Error updating gas configuration');
    }
  };

  // Add new gas to additional gases
  const addNewGas = async () => {
    try {
      // ตรวจสอบว่าข้อมูลครบหรือไม่
      if (!newGasConfig.name || !newGasConfig.display_name || !newGasConfig.unit || newGasConfig.alarm_threshold === undefined) {
        setGasConfigMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
      }

      // ตรวจสอบว่าชื่อแก๊สซ้ำหรือไม่
      const isDuplicate = gasConfig.default_gases?.some(gas => gas.name === newGasConfig.name) ||
                         gasConfig.additional_gases?.some(gas => gas.name === newGasConfig.name);
      
      if (isDuplicate) {
        setGasConfigMessage('ชื่อแก๊สนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
        return;
      }

      const updatedConfig = {
        default_gases: gasConfig.default_gases,
        additional_gases: [...gasConfig.additional_gases, newGasConfig]
      };

      const response = await fetch(`${backendUrl}/config/gas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        setGasConfig(updatedConfig);
        setGasConfigMessage(`${newGasConfig.display_name} added successfully`);
        setIsGasModalVisible(false);
        // รีเซ็ตฟอร์ม
        setNewGasConfig({
          name: '',
          display_name: '',
          unit: 'ppm',
          enabled: true,
          alarm_threshold: 50
        });
        gasForm.resetFields();
      }
    } catch (error) {
      console.error('Error adding gas:', error);
      setGasConfigMessage('Error adding gas');
    }
  };



  // Remove gas from additional gases
  const removeGas = async (gasName) => {
    try {
      const updatedConfig = {
        default_gases: gasConfig.default_gases,
        additional_gases: gasConfig.additional_gases.filter(gas => gas.name !== gasName)
      };

      const response = await fetch(`${backendUrl}/config/gas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        setGasConfig(updatedConfig);
        setGasConfigMessage(`${gasName} removed successfully`);
      }
    } catch (error) {
      console.error('Error removing gas:', error);
      setGasConfigMessage('Error removing gas');
    }
  };

  // Update alarm threshold
  const updateAlarmThreshold = async (gasName, threshold) => {
    try {
      const updatedConfig = {
        default_gases: gasConfig.default_gases.map(gas => 
          gas.name === gasName ? { ...gas, alarm_threshold: threshold } : gas
        ),
        additional_gases: gasConfig.additional_gases.map(gas => 
          gas.name === gasName ? { ...gas, alarm_threshold: threshold } : gas
        )
      };

      const response = await fetch(`${backendUrl}/config/gas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        setGasConfig(updatedConfig);
        setGasConfigMessage(`Alarm threshold for ${gasName} updated successfully`);
      }
    } catch (error) {
      console.error('Error updating alarm threshold:', error);
      setGasConfigMessage('Error updating alarm threshold');
    }
  };

  // Update gas range
  const updateGasRange = async (gasName, field, value) => {
    try {
      const updatedConfig = {
        default_gases: gasConfig.default_gases.map(gas => 
          gas.name === gasName ? { ...gas, [field]: value } : gas
        ),
        additional_gases: gasConfig.additional_gases.map(gas => 
          gas.name === gasName ? { ...gas, [field]: value } : gas
        )
      };

      const response = await fetch(`${backendUrl}/config/gas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        setGasConfig(updatedConfig);
        setGasConfigMessage(`Range for ${gasName} updated successfully`);
      }
    } catch (error) {
      console.error('Error updating gas range:', error);
      setGasConfigMessage('Error updating gas range');
    }
  };

  // Save configuration
  const saveConfig = async (values) => {
    // ลบการตรวจสอบ backendConnected ออก เพื่อให้บันทึกได้
    // if (!backendConnected) {
    //   message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
    //   return;
    // }

    setLoading(true);
    try {
      const configToSave = {
        connection: {
          devices: configData?.connection?.devices || [],
          parameter_threshold: {
            Temperature: values.temperature_threshold,
            Pressure: values.pressure_threshold,
            Velocity: values.velocity_threshold,
          },
          log_interval: Math.round(values.log_interval * 60), // แปลงนาทีเป็นวินาที (ปัดเศษ)
          reconnect_interval: Math.round(values.reconnect_interval * 60), // แปลงนาทีเป็นวินาที (ปัดเศษ)
        },
        stack_info: {
          area: values.stack_area,
          diameter: values.stack_diameter,
        }
      };

      const res = await fetch(`${backendUrl}/config/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(configToSave)
      });

      if (res.ok) {
        message.success("✅ บันทึกการตั้งค่าเรียบร้อยแล้ว");
        await loadConfigData(); // Reload data
      } else {
        message.error("❌ ไม่สามารถบันทึกการตั้งค่าได้");
      }
    } catch (error) {
      message.error("❌ เกิดข้อผิดพลาดในการบันทึก");
      console.error("Error saving config:", error);
    } finally {
      setLoading(false);
    }
  };



  // Add device
  const addDevice = () => {
    console.log("🔧 addDevice called");
    console.log("Current modalType:", modalType);
    console.log("Current isModalVisible:", isModalVisible);
    
    setModalType("device");
    setEditingDevice(null);
    setIsModalVisible(true);
    
    console.log("After setState - modalType:", "device");
    console.log("After setState - isModalVisible:", true);
    
    // Reset form fields
    deviceForm.resetFields();
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
    console.log("🚨 DELETE DEVICE FUNCTION CALLED!");
    console.log("🚨 Index:", index);
    console.log("🚨 ConfigData:", configData);
    console.log("🚨 Devices:", configData?.connection?.devices);

    console.log("🚨 ABOUT TO OPEN MODAL.CONFIRM...");
    Modal.confirm({
      title: "ยืนยันการลบ",
      content: "คุณต้องการลบอุปกรณ์นี้หรือไม่?",
      onOk: async () => {
        console.log("🚨 MODAL.CONFIRM ONOK CLICKED!");
        try {
          console.log("🚨 STARTING DEVICE DELETION...");
          const newDevices = [...(configData?.connection?.devices || [])];
          console.log("🔧 Original devices:", newDevices);
          
          newDevices.splice(index, 1);
          console.log("🔧 After splice devices:", newDevices);
          
          const configToSave = {
            ...configData,
            connection: {
              ...configData.connection,
              devices: newDevices
            }
          };
          console.log("🔧 Config to save:", configToSave);

          console.log("🔧 Sending request to:", `${backendUrl}/config/devices`);
          console.log("🔧 Request headers:", { 'Content-Type': 'application/json', ...authHeaders });
          console.log("🔧 Request body:", JSON.stringify(newDevices, null, 2));
          
          const res = await fetch(`${backendUrl}/config/devices`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(newDevices)
          });

          console.log("🔧 Response status:", res.status, res.statusText);
          console.log("🔧 Response headers:", Object.fromEntries(res.headers.entries()));
          
          if (res.ok) {
            const responseData = await res.json();
            console.log("🔧 Response data:", responseData);
            setConfigData(configToSave);
            message.success("✅ ลบอุปกรณ์เรียบร้อยแล้ว");
          } else {
            const errorText = await res.text();
            console.error("🔧 Backend error:", res.status, errorText);
            message.error(`❌ ไม่สามารถลบอุปกรณ์ได้ (${res.status}): ${errorText}`);
          }
        } catch (error) {
          console.error("🔧 Error deleting device:", error);
          message.error("❌ เกิดข้อผิดพลาดในการลบ");
        }
      }
    });
  };

  // Save device
  const saveDevice = async () => {
    console.log("🔧 saveDevice called");
    console.log("Backend connected:", backendConnected);
    console.log("ConfigData:", configData);
    
    if (!configData) {
      console.log("🔧 ConfigData is null, trying to load config first...");
      await loadConfigDataNormal();
      // รอสักครู่แล้วลองใหม่
      setTimeout(async () => {
        if (!configData) {
          message.error("❌ ไม่สามารถโหลดข้อมูล config ได้");
          return;
        }
        await saveDevice();
      }, 1000);
      return;
    }
    
    // ลบการตรวจสอบ backendConnected ออก เพื่อให้เพิ่มอุปกรณ์ได้
    // if (!backendConnected) {
    //   message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
    //   return;
    // }

    try {
      console.log("🔧 Validating form fields...");
      const values = await deviceForm.validateFields();
      console.log("🔧 Form values:", values);
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

      const res = await fetch(`${backendUrl}/config/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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

  // Add Status & Alarm mapping
  const addStatusAlarmMapping = () => {
    setModalType("status-alarm");
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
  const deleteMapping = async (rowKey) => {
    console.log("🚨 DELETE MAPPING FUNCTION CALLED!");
    console.log("🚨 RowKey:", rowKey);
    console.log("🚨 MappingData:", mappingData);
    console.log("🚨 MappingData length:", mappingData.length);
    
    console.log("🚨 ABOUT TO OPEN MODAL.CONFIRM FOR MAPPING...");
    Modal.confirm({
      title: "ยืนยันการลบ",
      content: "คุณต้องการลบการแมปข้อมูลนี้หรือไม่?",
      onOk: async () => {
        console.log("🚨 MODAL.CONFIRM ONOK CLICKED FOR MAPPING!");
        try {
          console.log("🚨 STARTING MAPPING DELETION...");
          const idx = mappingData.findIndex((m, i) => mappingRowKey(m, i) === rowKey);
          console.log("🔧 Found index:", idx);
          
          if (idx === -1) {
            console.error("🔧 Item not found for rowKey:", rowKey);
            message.error("❌ ไม่พบข้อมูลที่ต้องการลบ");
            return;
          }

          const newMapping = mappingData.filter((_, i) => i !== idx);
          console.log("🔧 Original mapping:", mappingData);
          console.log("🔧 New mapping:", newMapping);
          console.log("🔧 Deleted item:", mappingData[idx]);

          console.log("🔧 Sending request to:", `${backendUrl}/config/mapping`);
          console.log("🔧 Request headers:", { 'Content-Type': 'application/json', ...authHeaders });
          console.log("🔧 Request body:", JSON.stringify(newMapping, null, 2));
          
          const res = await fetch(`${backendUrl}/config/mapping`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(newMapping)
          });

          console.log("🔧 Response status:", res.status, res.statusText);
          console.log("🔧 Response headers:", Object.fromEntries(res.headers.entries()));

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error("🔧 Backend error:", res.status, errText);
            message.error("❌ ไม่สามารถลบการแมปข้อมูลได้");
            return;
          }

          const responseData = await res.json();
          console.log("🔧 Response data:", responseData);
          
          setMappingData(newMapping);           // อัปเดตหน้าให้เห็นทันที
          await loadConfigData();                // ดึงจาก backend ยืนยันผล
          message.success("✅ ลบการแมปข้อมูลเรียบร้อยแล้ว");
        } catch (e) {
          console.error("🔧 Error deleting mapping:", e);
          message.error("❌ เกิดข้อผิดพลาดในการลบ");
        }
      }
    });
  };

  // Save mapping
  const saveMappingItem = async () => {
    // ลบการตรวจสอบ backendConnected ออก เพื่อให้บันทึกได้
    // if (!backendConnected) {
    //   message.error("❌ ไม่สามารถเชื่อมต่อกับ Backend ได้");
    //   return;
    // }

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
      const res = await fetch(`${backendUrl}/config/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(newMapping)
      });

      if (res.ok) {
        setMappingData(newMapping);
        setIsModalVisible(false);
        setSelectedDevice(null);
        setSelectedParameter(null);
        message.success(editingMapping ? "✅ แก้ไขการแมปข้อมูลเรียบร้อยแล้ว" : "✅ เพิ่มการแมปข้อมูลเรียบร้อยแล้ว");
        // Reload mapping to ensure backend has latest data
        await loadConfigData();
      } else {
        message.error("❌ ไม่สามารถบันทึกการแมปข้อมูลได้");
      }
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
          // ลบ reset-config endpoint ออก เพราะไม่มีใน backend
          message.info("❌ ฟีเจอร์รีเซ็ตยังไม่พร้อมใช้งาน");
          // await loadConfigData();
        } catch (error) {
          message.error("❌ เกิดข้อผิดพลาดในการรีเซ็ต");
          console.error("Error resetting config:", error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Load configuration on mount and when component becomes visible
  useEffect(() => {
    const init = async () => {
      console.log("🔧 Config component mounted, starting initialization...");
      await checkBackendConnection();
      console.log("🔧 Backend connection checked");
      // โหลดข้อมูลแบบปกติ ไม่รีเฟรชหน้า
      await loadConfigDataNormal();
      console.log("🔧 Config data loaded");
      await loadGasConfig();
      console.log("🔧 Gas config loaded");
      
      // ไม่ต้องสร้าง systemForm ใน useEffect
    };
    init();
  }, []); // ลบ dependency บน backendConnected ออก

  // ลบการเช็ค backend connection เมื่อเปลี่ยน tab (หยุดการเช็คซ้ำ)
  // useEffect(() => {
  //   const checkConnection = async () => {
  //     await checkBackendConnection();
  //   };
  //   checkConnection();
  // }, [activeTab]);

  // Debug: Log configData changes
  useEffect(() => {
    console.log("🔧 configData changed:", configData);
    console.log("🔧 configData is null:", configData === null);
    console.log("🔧 configData type:", typeof configData);
  }, [configData]);

  // Debug: Log mappingData
  useEffect(() => {
    console.log("🔧 mappingData changed:", mappingData);
    console.log("🔧 mappingData length:", mappingData.length);
    console.log("🔧 mappingData type:", typeof mappingData);
    console.log("🔧 mappingData is array:", Array.isArray(mappingData));
  }, [mappingData]);

  // Set form values after component mounts
  // useEffect(() => {
  //   if (configData && systemForm) {
  //     try {
  //       systemForm.setFieldsValue({
  //         log_interval: parseFloat(((configData.connection?.log_interval || 60) / 60).toFixed(2)),
  //         reconnect_interval: parseFloat(((configData.connection?.reconnect_interval || 60) / 60).toFixed(2)),
  //         temperature_threshold: configData.connection?.parameter_threshold?.Temperature || 80,
  //         pressure_threshold: configData.connection?.parameter_threshold?.Pressure || 1000,
  //         velocity_threshold: configData.connection?.parameter_threshold?.Velocity || 30,
  //         stack_area: configData.stack_info?.area || 1.0,
  //         stack_diameter: configData.stack_info?.diameter || 1.0,
  //       });
  //     } catch (error) {
  //       console.log('Form not ready yet:', error);
  //     }
  //   }
  // }, [configData, systemForm]);

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
            onClick={(e) => {
              e.stopPropagation();
              console.log("🚨 DELETE DEVICE BUTTON CLICKED!");
              console.log("🚨 Index:", index);
              console.log("🚨 Record:", record);
              deleteDevice(index);
            }}
          >
            ลบ
          </Button>
        </Space>
      ),
    },
  ];

  // คีย์ที่ไม่ซ้ำต่อรายการ (ใช้ index แทน)
  const mappingRowKey = (m, index) => index;

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
              render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => editMapping(record)}
            >
              แก้ไข
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
                          onClick={(e) => {
              e.stopPropagation();
              console.log("🚨 DELETE MAPPING BUTTON CLICKED!");
              console.log("🚨 Record:", record);
              console.log("🚨 RowKey:", mappingRowKey(record));
              deleteMapping(mappingRowKey(record));
            }}
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
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              padding: "16px",
              background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
              borderRadius: "8px",
              marginBottom: "16px"
            }}>
              <div>
                <Title level={5} style={{ margin: 0, color: "#333" }}>อุปกรณ์ Modbus</Title>
                <Text type="secondary" style={{ fontSize: "14px" }}>
                  จัดการอุปกรณ์ Modbus TCP/RTU สำหรับการเชื่อมต่อเซ็นเซอร์
                </Text>
              </div>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadConfigData}
                  loading={loading}
                  style={{ borderRadius: "8px" }}
                >
                  โหลดใหม่
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addDevice}
                  style={{ borderRadius: "8px" }}
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
              scroll={{ x: 'max-content' }}
              onRow={(record, index) => ({
                onClick: () => {
                  console.log("🚨 TABLE ROW CLICKED!");
                  console.log("🚨 Record:", record);
                  console.log("🚨 Index:", index);
                }
              })}
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
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DatabaseOutlined style={{ color: '#722ed1' }} />
              <span>การตั้งค่าการแมปข้อมูล</span>
            </div>
          } 
          size="small"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              padding: '12px 0',
              borderBottom: '1px solid #f0f0f0',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ToolOutlined style={{ color: '#722ed1', fontSize: '16px' }} />
                <Title level={5} style={{ margin: 0 }}>การแมป Registers</Title>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  marginLeft: '16px',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  background: backendConnected ? '#f6ffed' : '#fff2f0',
                  border: `1px solid ${backendConnected ? '#b7eb8f' : '#ffccc7'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: backendConnected ? '#52c41a' : '#ff4d4f',
                    boxShadow: backendConnected ? '0 0 4px rgba(82,196,26,0.4)' : '0 0 4px rgba(255,77,79,0.4)'
                  }} />
                  <span style={{ 
                    fontSize: '12px',
                    color: backendConnected ? '#52c41a' : '#ff4d4f',
                    fontWeight: '500',
                    letterSpacing: '0.5px'
                  }}>
                    {backendConnected ? 'เชื่อมต่อสำเร็จ' : 'ไม่สามารถเชื่อมต่อ'}
                  </span>
                </div>
              </div>
              <Space size="middle">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadConfigData}
                  loading={loading}
                  style={{ borderRadius: '6px' }}
                >
                  โหลดใหม่
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addMapping}
                  style={{ 
                    background: "#722ed1", 
                    borderColor: "#722ed1",
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(114,46,209,0.3)'
                  }}
                >
                  เพิ่มการแมป
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addStatusAlarmMapping}
                  style={{ 
                    background: "#52c41a", 
                    borderColor: "#52c41a",
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(82,196,26,0.3)'
                  }}
                >
                  เพิ่ม Status/Alarm
                </Button>
                <Button
                  type="dashed"
                  icon={<BugOutlined />}
                  onClick={testBackendMapping}
                  style={{ borderRadius: '6px' }}
                >
                  ทดสอบ Backend
                </Button>
              </Space>
            </div>
            
            <div style={{ 
              background: '#fafafa', 
              borderRadius: '8px', 
              padding: '16px',
              border: '1px solid #f0f0f0'
            }}>
              <Table
                dataSource={mappingData}
                columns={mappingColumns}
                rowKey={(record, index) => mappingRowKey(record, index)}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                loading={loading}
                style={{ 
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
                locale={{
                  emptyText: (
                    <div style={{ 
                      padding: '40px 20px', 
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                      borderRadius: '8px',
                      margin: '20px'
                    }}>
                      <DatabaseOutlined style={{ 
                        fontSize: '48px', 
                        color: '#d9d9d9', 
                        marginBottom: '16px' 
                      }} />
                      <div style={{ 
                        fontSize: '18px', 
                        color: '#666', 
                        marginBottom: '8px',
                        fontWeight: '500'
                      }}>
                        ไม่มีข้อมูลการแมป
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#999',
                        marginBottom: '16px',
                        lineHeight: '1.5'
                      }}>
                        ยังไม่มีการตั้งค่าการแมปข้อมูล Modbus registers
                      </div>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={addMapping}
                        style={{ 
                          background: "#722ed1", 
                          borderColor: "#722ed1",
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        เพิ่มการแมปแรก
                      </Button>
                    </div>
                  )
                }}
              />
            </div>
          </Space>
        </Card>
      ),
    },
    {
      key: "system",
      label: (
        <span>
          <SettingOutlined />
          การตั้งค่าพารามิเตอร์อื่นๆ
        </span>
      ),
      children: (
        <Card title="การตั้งค่าพารามิเตอร์อื่นๆ" size="small">
          <Form
            form={systemForm}
            layout="vertical"
            onFinish={saveConfig}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Title level={5}>การตั้งค่าการบันทึก</Title>
                <Form.Item
                  label="ช่วงเวลาบันทึก (นาที)"
                  name="log_interval"
                  rules={[{ required: true, message: "กรุณาระบุช่วงเวลาบันทึก" }]}
                >
                  <Input 
                    type="number" 
                    min="0.01" 
                    max="1440" 
                    step="0.01"
                    style={{ width: "100%" }} 
                    placeholder="เช่น 0.17 = 10 วินาที, 1 = 1 นาที, 60 = 1 ชั่วโมง"
                  />
                </Form.Item>
                
                <Form.Item
                  label="ช่วงเวลาลองเชื่อมต่อใหม่ (นาที)"
                  name="reconnect_interval"
                  rules={[{ required: true, message: "กรุณาระบุช่วงเวลาลองเชื่อมต่อใหม่" }]}
                >
                  <Input 
                    type="number" 
                    min="0.01" 
                    max="1440" 
                    step="0.01"
                    style={{ width: "100%" }} 
                    placeholder="เช่น 0.17 = 10 วินาที, 1 = 1 นาที"
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Title level={5}>การตั้งค่าพารามิเตอร์อื่นๆ</Title>
                <Form.Item
                  label="Temperature (°C)"
                  name="temperature_threshold"
                  rules={[{ required: true, message: "กรุณาระบุค่า Temperature" }]}
                >
                  <InputNumber min={-50} max={200} style={{ width: "100%" }} />
                </Form.Item>
                
                <Form.Item
                  label="Pressure (Pa)"
                  name="pressure_threshold"
                  rules={[{ required: true, message: "กรุณาระบุค่า Pressure" }]}
                >
                  <InputNumber min={0} max={10000} style={{ width: "100%" }} />
                </Form.Item>
                
                <Form.Item
                  label="Velocity (m/s)"
                  name="velocity_threshold"
                  rules={[{ required: true, message: "กรุณาระบุค่า Velocity" }]}
                >
                  <InputNumber min={0} max={100} style={{ width: "100%" }} />
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
                <Option value="manual_area">ใส่พื้นที่โดยตรง</Option>
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
                          label="พื้นที่หน้าตัด (m²)"
                          name="stack_area"
                          rules={[{ required: true, message: "กรุณาระบุพื้นที่หน้าตัด" }]}
                        >
                          <InputNumber 
                            min={0.1} 
                            step={0.01} 
                            style={{ width: "100%" }}
                            onChange={(value) => {
                              if (value && systemForm) {
                                // คำนวณเส้นผ่านศูนย์กลางจากพื้นที่
                                const diameter = Math.sqrt((value * 4) / Math.PI);
                                systemForm.setFieldValue("stack_diameter", parseFloat(diameter.toFixed(3)));
                              }
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="เส้นผ่านศูนย์กลาง (m)"
                          name="stack_diameter"
                        >
                          <InputNumber 
                            disabled 
                            style={{ width: "100%" }} 
                            placeholder="คำนวณอัตโนมัติ"
                          />
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
                } else if (shape === "manual_area") {
                  return (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="พื้นที่หน้าตัด (m²)"
                          name="stack_area"
                          rules={[{ required: true, message: "กรุณาระบุพื้นที่หน้าตัด" }]}
                        >
                          <InputNumber 
                            min={0.1} 
                            step={0.01} 
                            style={{ width: "100%" }} 
                            onChange={(value) => {
                              if (value && systemForm) {
                                // คำนวณเส้นผ่านศูนย์กลางจากพื้นที่
                                const diameter = Math.sqrt((value * 4) / Math.PI);
                                systemForm.setFieldValue("stack_diameter", parseFloat(diameter.toFixed(3)));
                              }
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="เส้นผ่านศูนย์กลาง (m)"
                          name="stack_diameter"
                        >
                          <InputNumber 
                            disabled 
                            style={{ width: "100%" }} 
                            placeholder="คำนวณอัตโนมัติ"
                          />
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
      key: "gas",
      label: (
        <span>
          <ExperimentOutlined />
          การตั้งค่าแก๊ส
        </span>
      ),
      children: (
        <Card title="การตั้งค่าแก๊ส" size="small">
          <Space direction="vertical" style={{ width: "100%" }}>
            {gasConfigMessage && (
              <Alert
                message={gasConfigMessage}
                type={gasConfigMessage.includes('Error') ? 'error' : 'success'}
                showIcon
                closable
                onClose={() => setGasConfigMessage('')}
              />
            )}
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={5}>การตั้งค่าแก๊ส</Title>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadGasConfig}
                  loading={loading}
                >
                  โหลดใหม่
                </Button>
                
              </Space>
            </div>

            <Row gutter={16}>
              {/* Default Gases */}
              <Col span={12}>
                <Card title="แก๊สเริ่มต้น" size="small" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    {gasConfig.default_gases?.map((gas) => (
                      <Card 
                        key={gas.name} 
                        size="small" 
                        style={{ 
                          borderLeft: `4px solid ${gas.color}`,
                          marginBottom: 8
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div>
                            <Text strong>{gas.display_name}</Text>
                            <br />
                            <Text type="secondary">หน่วย: {gas.unit}</Text>
                          </div>
                          <div>
                            <Tag color={gas.enabled ? "green" : "default"}>
                              {gas.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                            </Tag>
                            <Tag color="blue">เริ่มต้น</Tag>
                          </div>
                        </div>
                        
                        <Form.Item label={`ค่าแจ้งเตือน (${gas.unit})`}>
                          <InputNumber
                            value={gas.alarm_threshold}
                            onChange={(value) => updateAlarmThreshold(gas.name, value)}
                            style={{ width: "100%" }}
                            min={0}
                          />
                        </Form.Item>
                        
                        <Form.Item label={`ช่วงการแสดงผล (${gas.unit})`}>
                          <Row gutter={8}>
                            <Col span={12}>
                              <InputNumber
                                placeholder="ต่ำสุด"
                                value={gas.min_value || 0}
                                onChange={(value) => updateGasRange(gas.name, 'min_value', value)}
                                style={{ width: "100%" }}
                                min={0}
                              />
                            </Col>
                            <Col span={12}>
                              <InputNumber
                                placeholder="สูงสุด"
                                value={gas.max_value || 300}
                                onChange={(value) => updateGasRange(gas.name, 'max_value', value)}
                                style={{ width: "100%" }}
                                min={0}
                              />
                            </Col>
                          </Row>
                        </Form.Item>
                        
                        <Button
                          type={gas.enabled ? "default" : "primary"}
                          size="small"
                          onClick={() => toggleGas(gas.name, !gas.enabled)}
                          style={{ width: "100%" }}
                        >
                          {gas.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                      </Card>
                    ))}
                  </Space>
                </Card>
              </Col>

              {/* Additional Gases */}
              <Col span={12}>
                <Card title="แก๊สเพิ่มเติม" size="small" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Text>แก๊สที่เพิ่มเข้ามา</Text>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsGasModalVisible(true)}
                      >
                        เพิ่มแก๊ส
                      </Button>
                    </div>
                    
                    {gasConfig.additional_gases?.length > 0 ? (
                      gasConfig.additional_gases.map((gas) => (
                        <Card 
                          key={gas.name} 
                          size="small" 
                          style={{ 
                            borderLeft: `4px solid ${gas.color}`,
                            marginBottom: 8
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div>
                              <Text strong>{gas.display_name}</Text>
                              <br />
                              <Text type="secondary">หน่วย: {gas.unit}</Text>
                            </div>
                            <div>
                              <Tag color={gas.enabled ? "green" : "default"}>
                                {gas.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                              </Tag>
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => removeGas(gas.name)}
                              >
                                ลบ
                              </Button>
                            </div>
                          </div>
                          
                          <Form.Item label={`ค่าแจ้งเตือน (${gas.unit})`}>
                            <InputNumber
                              value={gas.alarm_threshold}
                              onChange={(value) => updateAlarmThreshold(gas.name, value)}
                              style={{ width: "100%" }}
                              min={0}
                            />
                          </Form.Item>
                          
                          <Form.Item label={`ช่วงการแสดงผล (${gas.unit})`}>
                            <Row gutter={8}>
                              <Col span={12}>
                                <InputNumber
                                  placeholder="ต่ำสุด"
                                  value={gas.min_value || 0}
                                  onChange={(value) => updateGasRange(gas.name, 'min_value', value)}
                                  style={{ width: "100%" }}
                                  min={0}
                                />
                              </Col>
                              <Col span={12}>
                                <InputNumber
                                  placeholder="สูงสุด"
                                  value={gas.max_value || 300}
                                  onChange={(value) => updateGasRange(gas.name, 'max_value', value)}
                                  style={{ width: "100%" }}
                                  min={0}
                                />
                              </Col>
                            </Row>
                          </Form.Item>
                          
                          <Button
                            type={gas.enabled ? "default" : "primary"}
                            size="small"
                            onClick={() => toggleGas(gas.name, !gas.enabled)}
                            style={{ width: "100%" }}
                          >
                            {gas.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          </Button>
                        </Card>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                        <Text type="secondary">ยังไม่มีแก๊สเพิ่มเติม</Text>
                        <br />
                        <Text type="secondary">คลิก "เพิ่มแก๊ส" เพื่อเพิ่มแก๊สใหม่</Text>
                      </div>
                    )}
                  </Space>
                </Card>
              </Col>
            </Row>

            <Alert
              message="คำแนะนำ"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li><strong>แก๊สเริ่มต้น:</strong> แสดงบน Dashboard เสมอ</li>
                  <li><strong>แก๊สเพิ่มเติม:</strong> สามารถเปิด/ปิดการแสดงได้</li>
                  <li><strong>ค่าแจ้งเตือน:</strong> ตั้งค่าที่จะทำให้ระบบแจ้งเตือน</li>
                  <li>การเปลี่ยนแปลงจะถูกบันทึกอัตโนมัติ</li>
                </ul>
              }
              type="info"
              showIcon
            />
          </Space>
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
    <div className="config-page" style={{ 
      padding: "16px", 
      maxWidth: "1400px", 
      margin: "0 auto",
      background: "#f0f0f0",
      minHeight: "100vh"
    }}>
      <SystemAlertBar />
      
      {/* Header Section */}
      <div style={{ 
        marginBottom: "24px",
        padding: "0"
      }}>
        <div style={{ marginBottom: "16px" }}>
          <Title level={2} style={{ 
            margin: 0, 
            color: "#000",
            fontSize: "22px",
            fontWeight: "bold"
          }}>
            ระบบจัดการการตั้งค่า CEMS
          </Title>
          <Text style={{ 
            fontSize: "13px", 
            color: "#333",
            fontWeight: "normal"
          }}>
            Continuous Emission Monitoring System Configuration
          </Text>
        </div>
        
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "12px",
          flexWrap: "wrap"
        }}>
          <div style={{
            padding: "8px 16px",
            background: "#e6f7ff",
            color: "#1890ff",
            borderRadius: "20px",
            fontSize: "14px",
            fontWeight: "500",
            border: "1px solid #91d5ff"
          }}>
            อัปเดต: 14:00
          </div>
          
          <div style={{
            padding: "8px 16px",
            background: "#f6ffed",
            color: "#52c41a",
            borderRadius: "20px",
            fontSize: "14px",
            fontWeight: "500",
            border: "1px solid #b7eb8f"
          }}>
            Stack: Stack 1
          </div>
        </div>
      </div>

      {/* Configuration Tabs */}
      <Spin spinning={loading}>
        <div style={{
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          overflow: "hidden"
        }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            style={{
              padding: "0",
              background: "transparent"
            }}
            tabBarStyle={{
              margin: "0",
              padding: "0 32px",
              background: "white",
              borderBottom: "1px solid #e0e0e0"
            }}
            tabBarGutter={0}
          />
        </div>
      </Spin>

      {/* Gas Configuration Modal */}
      <Modal
        title="เพิ่มแก๊สใหม่"
        open={isGasModalVisible}
        onOk={() => {
          gasForm.validateFields()
            .then(() => {
              addNewGas();
            })
            .catch((info) => {
              console.log('Validate Failed:', info);
            });
        }}
        onCancel={() => {
          setIsGasModalVisible(false);
          gasForm.resetFields();
          setNewGasConfig({
            name: '',
            display_name: '',
            unit: 'ppm',
            enabled: true,
            alarm_threshold: 50,

          });
        }}
        width={600}
        okText="บันทึก"
        cancelText="ยกเลิก"
      >
        <Form
          form={gasForm}
          layout="vertical"
          onValuesChange={(changedValues, allValues) => {
            setNewGasConfig(allValues);
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="ชื่อแก๊ส (Name)"
                name="name"
                rules={[
                  { required: true, message: "กรุณาระบุชื่อแก๊ส" },
                  { 
                    validator: (_, value) => {
                      if (value) {
                        const isDuplicate = gasConfig.default_gases?.some(gas => gas.name === value) ||
                                           gasConfig.additional_gases?.some(gas => gas.name === value);
                        if (isDuplicate) {
                          return Promise.reject(new Error('ชื่อแก๊สนี้มีอยู่แล้ว'));
                        }
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input placeholder="เช่น NH3, HCl, HF" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="ชื่อแสดง (Display Name)"
                name="display_name"
                rules={[{ required: true, message: "กรุณาระบุชื่อแสดง" }]}
              >
                <Input placeholder="เช่น NH3 (แอมโมเนีย)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="หน่วย (Unit)"
                name="unit"
                rules={[{ required: true, message: "กรุณาเลือกหน่วย" }]}
              >
                <Select placeholder="เลือกหน่วย">
                  <Option value="ppm">ppm</Option>
                  <Option value="ppb">ppb</Option>
                  <Option value="mg/m³">mg/m³</Option>
                  <Option value="µg/m³">µg/m³</Option>
                  <Option value="%">%</Option>
                  <Option value="°C">°C</Option>
                  <Option value="Pa">Pa</Option>
                  <Option value="m/s">m/s</Option>
                  <Option value="m³/h">m³/h</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="ค่าแจ้งเตือน (Alarm Threshold)"
                name="alarm_threshold"
                rules={[{ required: true, message: "กรุณาระบุค่าแจ้งเตือน" }]}
              >
                <InputNumber 
                  min={0} 
                  style={{ width: "100%" }} 
                  placeholder="50"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="สถานะเริ่มต้น"
                name="enabled"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="เปิดใช้งาน" 
                  unCheckedChildren="ปิดใช้งาน"
                />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            message="คำแนะนำ"
            description="กรุณากรอกข้อมูลแก๊สที่ต้องการเพิ่ม โดยชื่อแก๊สควรเป็นภาษาอังกฤษและไม่มีช่องว่าง"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>

      {/* Device Modal */}
      <Modal
        title={editingDevice ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}
        open={isModalVisible && modalType === "device"}
        onOk={saveDevice}
        onCancel={() => {
          console.log("🔧 Modal onCancel called");
          setIsModalVisible(false);
        }}
        width={600}
        destroyOnHidden={false}
        maskClosable={false}
        keyboard={false}
        afterClose={() => {
          console.log("🔧 Modal afterClose called");
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
          

        </Form>
      </Modal>

      {/* Status & Alarm Modal */}
      <Modal
        title={editingMapping ? "แก้ไขการตั้งค่า Status/Alarm" : "เพิ่มการตั้งค่า Status/Alarm"}
        open={isModalVisible && modalType === "status-alarm"}
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
            label="ประเภท"
            name="device"
            rules={[{ required: true, message: "กรุณาเลือกประเภท" }]}
          >
            <Select
              placeholder="เลือกประเภท"
              onChange={handleDeviceChange}
            >
              <Option value="test4">Status Indicators</Option>
              <Option value="test5">Alarm Signals</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="ชื่อ"
            name="name"
            rules={[{ required: true, message: "กรุณาระบุชื่อ" }]}
          >
            <Select
              placeholder="เลือกชื่อหรือพิมพ์เพื่อค้นหา"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
              onChange={(value) => {
                // อัปเดตคำอธิบายเมื่อเลือกชื่อ
                const description = getStatusAlarmDescription(value);
                mappingForm.setFieldValue('description', description);
                
                // อัปเดต Address อัตโนมัติตามชื่อที่เลือก
                const deviceType = mappingForm.getFieldValue('device');
                const address = getStatusAlarmAddress(value, deviceType);
                if (address !== null) {
                  mappingForm.setFieldValue('address', address);
                }
                
                // อัปเดตค่าอื่นๆ อัตโนมัติสำหรับ Status & Alarm
                mappingForm.setFieldValue('dataType', 'int16');
                mappingForm.setFieldValue('dataFormat', 'Signed');
                mappingForm.setFieldValue('registerCount', 1);
                mappingForm.setFieldValue('addressBase', 0);
                mappingForm.setFieldValue('unit', getStatusAlarmUnit(value));
                mappingForm.setFieldValue('formula', 'x');
              }}
            >
              {(() => {
                // ใช้ state แทนการเรียก form.getFieldValue ใน render
                const deviceType = selectedDevice;
                const suggestedNames = getSuggestedNames(deviceType);
                return suggestedNames.map(name => (
                  <Option key={name} value={name}>
                    {name} - {getStatusAlarmDescription(name)}
                  </Option>
                ));
              })()}
            </Select>
          </Form.Item>
          
          <Form.Item
            label="คำอธิบาย"
            name="description"
          >
            <Input placeholder="คำอธิบายจะถูกเติมอัตโนมัติเมื่อเลือกชื่อ" disabled />
          </Form.Item>
          
          <Form.Item
            label="Address"
            name="address"
            rules={[{ required: true, message: "กรุณาระบุ Address" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
          </Form.Item>
          
          <Form.Item
            label="Data Type"
            name="dataType"
            initialValue="int16"
          >
            <Select 
              placeholder="เลือก Data Type"
              onChange={(value) => {
                // อัปเดต Register Count ตาม Data Type
                if (value === 'int16') {
                  mappingForm.setFieldValue('registerCount', 1);
                } else if (value === 'int32' || value === 'float32') {
                  mappingForm.setFieldValue('registerCount', 2);
                } else if (value === 'float64') {
                  mappingForm.setFieldValue('registerCount', 4);
                }
              }}
            >
              <Option value="int16">16-bit Integer (แนะนำสำหรับ Status/Alarm)</Option>
              <Option value="int32">32-bit Integer</Option>
              <Option value="float32">32-bit Float</Option>
              <Option value="float64">64-bit Float</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="Data Format"
            name="dataFormat"
            initialValue="Signed"
          >
            <Select placeholder="เลือก Data Format">
              <Option value="Signed">Signed (0 = OFF, 1 = ON)</Option>
              <Option value="Unsigned">Unsigned (0 = OFF, 1 = ON)</Option>
              <Option value="Hex">Hex</Option>
              <Option value="Binary">Binary</Option>
              <Option value="Long AB CD">Long AB CD</Option>
              <Option value="Long CD AB">Long CD AB</Option>
              <Option value="Long BA DC">Long BA DC</Option>
              <Option value="Long DC BA">Long DC BA</Option>
              <Option value="Float AB CD">Float AB CD</Option>
              <Option value="Float CD AB">Float CD AB</Option>
              <Option value="Float BA DC">Float BA DC</Option>
              <Option value="Float DC BA">Float DC BA</Option>
              <Option value="Float AB CD EF GH">Float AB CD EF GH</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="Register Count"
            name="registerCount"
            initialValue={1}
          >
            <InputNumber 
              min={1} 
              max={4} 
              style={{ width: "100%" }} 
            />
          </Form.Item>
          
          <Form.Item
            label="Address Base"
            name="addressBase"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          
          <Form.Item
            label="Unit"
            name="unit"
            initialValue=""
          >
            <Input placeholder="เช่น ON/OFF, 0/1, หรือว่าง" />
          </Form.Item>
          
          <Form.Item
            label="Formula"
            name="formula"
            initialValue="x"
          >
            <Input placeholder="x (ค่าดิบ), x/10, x*2" />
          </Form.Item>

          {(() => {
            // ใช้ state แทนการเรียก form.getFieldValue
            const selectedName = selectedParameter;
            const deviceType = selectedDevice;
            if (selectedName && deviceType) {
              const address = getStatusAlarmAddress(selectedName, deviceType);
              return (
                <Alert
                  message={`✅ การตั้งค่าอัตโนมัติ: ${selectedName}`}
                  description={
                    <div>
                      <p><strong>ข้อมูลที่ถูกเซ็ตอัตโนมัติ:</strong></p>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        <li>Address: {address}</li>
                        <li>Data Type: int16</li>
                        <li>Data Format: Signed</li>
                        <li>Register Count: 1</li>
                        <li>Unit: ON/OFF</li>
                        <li>Formula: x</li>
                      </ul>
                      <p style={{ marginTop: 8, marginBottom: 0 }}>
                        <strong>หมายเหตุ:</strong> คุณสามารถแก้ไขการตั้งค่าได้ตามต้องการ
                      </p>
                    </div>
                  }
                  type="success"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              );
            }
            return (
              <Alert
                message="💡 Status & Alarm Configuration"
                description={
                  <div>
                    <p><strong>การตั้งค่าแนะนำ:</strong></p>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      <li>Data Type: int16 (16-bit integer) - แนะนำสำหรับ ON/OFF</li>
                      <li>Register Count: 1 (1 register per status)</li>
                      <li>Values: 0 = OFF, 1 = ON</li>
                      <li>Formula: x (ใช้ค่าดิบโดยตรง)</li>
                    </ul>
                    <p style={{ marginTop: 8, marginBottom: 0 }}>
                      <strong>หมายเหตุ:</strong> เลือกชื่อเพื่อให้ระบบเซ็ตค่าอัตโนมัติ
                    </p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            );
          })()}
        </Form>
      </Modal>

      {/* Footer note (version badge is global in SidebarLayout) */}

      {/* Enhanced Styles */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .config-page .ant-tabs-tab {
          padding: 16px 24px !important;
          font-weight: 600 !important;
          background: #f5f5f5 !important;
          color: #333 !important;
          border-radius: 8px 8px 0 0 !important;
          margin-right: 4px !important;
          border: none !important;
        }
        
        .config-page .ant-tabs-tab:hover {
          color: #1890ff !important;
        }
        
        .config-page .ant-tabs-tab-active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          border-radius: 8px 8px 0 0 !important;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
          border: none !important;
          font-weight: bold !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
        }
        
        .config-page .ant-tabs-tab-active .anticon {
          color: white !important;
        }
        
        .config-page .ant-tabs-tab .anticon {
          color: inherit !important;
        }
        
        .config-page .ant-tabs-tab-active span {
          color: white !important;
          font-weight: normal !important;
        }
        
        .config-page .ant-card {
          border-radius: 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
        }
        
        .config-page .ant-card-head {
          background: #fafafa !important;
          border-radius: 4px 4px 0 0 !important;
          border-bottom: 1px solid #e8e8e8 !important;
        }
        
        .config-page .ant-table {
          border-radius: 4px !important;
          overflow: hidden !important;
        }
        
        .config-page .ant-table-thead > tr > th {
          background: #fafafa !important;
          color: #333 !important;
          font-weight: 600 !important;
          border-bottom: 1px solid #e8e8e8 !important;
        }
        
        .config-page .ant-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          border: none !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
        }
        
        .config-page .ant-btn-primary:hover {
          background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;
        }
        
        .config-page .ant-input, .config-page .ant-input-number, .config-page .ant-select-selector {
          border-radius: 4px !important;
          border: 1px solid #d9d9d9 !important;
          transition: all 0.3s ease !important;
        }
        
        .config-page .ant-input:focus, .config-page .ant-input-number:focus, .config-page .ant-select-focused .ant-select-selector {
          border-color: #1890ff !important;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
        }
        
        .config-page .ant-tag {
          border-radius: 4px !important;
          font-weight: normal !important;
        }
        
        .config-page .ant-alert {
          border-radius: 8px !important;
          border: none !important;
        }
        
        @media (max-width: 768px) {
          .config-page { 
            padding: 16px !important; 
            max-width: 100% !important;
          }
          .config-page .ant-card { 
            margin-bottom: 16px !important; 
          }
          .config-page .ant-tabs-tab {
            padding: 12px 16px !important;
            font-size: 14px !important;
          }
        }
        
        @media (max-width: 480px) {
          .config-page { 
            padding: 12px !important; 
          }
          .config-page .ant-card { 
            margin-bottom: 12px !important; 
          }
          .config-page .ant-tabs-tab {
            padding: 8px 12px !important;
            font-size: 13px !important;
          }
        }
      `}</style>
    </div>
  );
}
