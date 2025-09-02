import asyncio, json, csv, os, random, sys
from database_influx import init_influx_database, save_sensor_data_to_influx, save_system_alert_to_influx, get_latest_data_from_influx, get_system_alerts_from_influx, influx_manager
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pymodbus.client import AsyncModbusTcpClient, AsyncModbusSerialClient
from datetime import datetime
from contextlib import asynccontextmanager
import httpx
from jose import jwt
import bcrypt
import sys, io

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    load_mapping()
    
    # Initialize InfluxDB
    influx_success = await init_influx_database()
    if influx_success:
        print(" InfluxDB initialized successfully")
    else:
        print(" InfluxDB not available - using in-memory storage")
    
    asyncio.create_task(logging_task())
    yield

app = FastAPI(lifespan=lifespan)

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

#  Allow CORS
# CORS: หลีกเลี่ยง "*" ร่วมกับ allow_credentials=True (เบราว์เซอร์จะบล็อก)
frontend_origins = [
    os.environ.get("FRONTEND_ORIGIN") or "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#  Serve static files (frontend)
try:
    # Try to serve from dist folder (if exists)
    if os.path.exists("dist"):
        app.mount("/static", StaticFiles(directory="dist", html=True), name="static")
    elif os.path.exists("../dist"):
        app.mount("/static", StaticFiles(directory="../dist", html=True), name="static")
except Exception as e:
    print(f"Warning: Could not mount static files: {e}")

#  Files - ORIGINAL relative paths
CONFIG_FILE = "config.json"
MAPPING_FILE = "mapping.json"
LOG_FILE = "CEMS_DataLog.csv"
ERROR_LOG = "CEMS_ErrorLog.csv"
BLOWBACK_SETTINGS_FILE = "blowback_settings.json"
LOG_INTERVAL = 10

# Auth/JWT settings
SECRET_KEY = os.environ.get("CEMS_SECRET_KEY", "cems-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

# Global variables
modbus_client: AsyncModbusTcpClient = None
current_config = {}
mapping_config = []
alarm_values = [0, 0, 0, 0]
status_values = [0] * 15
blowback_status = [0, 0, 0, 0, 0, 0]
is_blowback_running = False
modbus_last_status = "error"
system_alerts = []

# Lock for config writes
config_lock = asyncio.Lock()

# ---------------------
# Auth utilities
# ---------------------
def get_password_hash(password: str) -> str:
    try:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    except Exception:
        return ""

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def auth_get_user(role: str):
    return (
        current_config.get("auth", {})
        .get("users", {})
        .get(role)
    )

def auth_get_hash(role: str):
    user = auth_get_user(role)
    if not user:
        return None
    return user.get("password_hash")

def auth_set_hash(role: str, password_hash: str):
    if "auth" not in current_config:
        current_config["auth"] = {"users": {}}
    if "users" not in current_config["auth"]:
        current_config["auth"]["users"] = {}
    if role not in current_config["auth"]["users"]:
        current_config["auth"]["users"][role] = {"role": role}
    current_config["auth"]["users"][role]["password_hash"] = password_hash

def create_access_token(role: str) -> str:
    payload = {
        "sub": role,
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# ---------------------
# Utility Functions
# ---------------------
def add_system_alert(message: str):
    """เพิ่มข้อความแจ้งเตือนเข้า list"""
    global system_alerts
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    alert_msg = f"[{timestamp}] {message}"
    system_alerts.insert(0, alert_msg)
    system_alerts = system_alerts[:10]

def load_config():
    global current_config
    if not os.path.exists(CONFIG_FILE):
        default_config = {
            "connection": {
                "devices": [
                    {
                        "name": "GasAnalyzer",
                        "mode": "tcp",
                        "ip": "127.0.0.1",
                        "port": 502,
                        "slaveId": 1,
                        "registerType": "holding"
                    }
                ],
                "alarm_threshold": {"SO2": 200, "CO": 100, "Dust": 50},
                "log_interval": 60,
                "reconnect_interval": 60
            },
            "stack_info": {"area": 1.0, "diameter": 1.0}
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
    
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        current_config = json.load(f)


def load_mapping():
    global mapping_config
    if not os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, "w", encoding="utf-8") as f:
            json.dump([{"name": "SO2", "address": 0, "unit": "ppm", "formula": "x"}], f, indent=2, ensure_ascii=False)
    try:
        with open(MAPPING_FILE, "r", encoding="utf-8") as f:
            mapping_config = json.load(f)
    except UnicodeDecodeError:
        # ถ้าไม่สามารถอ่านด้วย utf-8 ได้ ให้ลองอ่านด้วย encoding อื่น
        try:
            with open(MAPPING_FILE, "r", encoding="cp874") as f:
                mapping_config = json.load(f)
        except UnicodeDecodeError:
            # ถ้ายังไม่ได้ ให้สร้างไฟล์ใหม่
            print("[load_mapping] Unicode error, creating new mapping file")
            mapping_config = [{"name": "SO2", "address": 0, "unit": "ppm", "formula": "x"}]
            with open(MAPPING_FILE, "w", encoding="utf-8") as f:
                json.dump(mapping_config, f, indent=2, ensure_ascii=False)
    
    if not isinstance(mapping_config, list):
        mapping_config = []

    #  เพิ่มตรงนี้ เพื่อล้างช่องว่างชื่อก๊าซ
    for m in mapping_config:
        if isinstance(m.get("name"), str):
            m["name"] = m["name"].strip()

    # Debug mapping without emojis to avoid codepage issues in frozen apps
    print("[load_mapping] cleaned mapping:", mapping_config)


def log_error(msg: str):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    file_exists = os.path.exists(ERROR_LOG)
    with open(ERROR_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["Timestamp", "Error"])
        writer.writerow([now, msg])
    add_system_alert(f"Error: {msg}")

# ลบออกเพราะย้ายไปด้านบนแล้ว

# ---------------------
# Modbus Client
# ---------------------
# Global variables for multiple Modbus clients
modbus_clients = {}
# Remember last successful port per device to avoid re-scanning every loop
device_last_ports = {}

async def get_modbus_client(device_name=None):
    global modbus_clients, modbus_last_status, device_last_ports

    try:
        devices = current_config.get("connection", {}).get("devices", [])
        if not devices:
            return None

        # ถ้าไม่ระบุ device_name ให้ใช้ device แรก
        if device_name is None:
            device = devices[0]
            device_name = device["name"]
        else:
            # หา device ตามชื่อ
            device = None
            for d in devices:
                if d["name"] == device_name:
                    device = d
                    break
            if not device:
                return None

        # ถ้ามี client อยู่แล้วและยัง connected ให้ใช้ต่อ
        if device_name in modbus_clients and getattr(modbus_clients[device_name], "connected", False):
            return modbus_clients[device_name]

        # เตรียม candidate ports (รองรับหลายพอร์ต ไม่ fix)
        ip_address = device.get("ip", "127.0.0.1")
        primary_port = device.get("port", None)
        configured_ports = device.get("ports", []) or []  # อนุญาตกำหนดเป็น array ได้
        default_ports = current_config.get("connection", {}).get(
            "default_ports", [502, 503, 504, 1502, 2404, 8502, 10502]
        )
        # โหมดเข้มงวด: ลองเฉพาะพอร์ตที่กำหนดไว้เท่านั้น ไม่ใช้ fallback ค่าเริ่มต้น
        strict_global = current_config.get("connection", {}).get("strict_ports", False)
        strict_device = device.get("strictPorts")
        strict_mode = strict_device if strict_device is not None else strict_global
        # บังคับให้ต้องกำหนดพอร์ตใน config (ระดับระบบ)
        require_ports = current_config.get("connection", {}).get("require_ports", False)

        if require_ports and not primary_port and not configured_ports:
            print(f"[get_modbus_client] Device '{device_name}' has no 'port' or 'ports' configured (require_ports=true). Skipping.")
            modbus_last_status = "error"
            return None

        # เรียงลำดับพอร์ต: last-success -> primary -> configured list -> defaults
        ordered_ports = []
        last_success_port = device_last_ports.get(device_name)
        allowed_ports_set = set()
        if primary_port is not None:
            allowed_ports_set.add(primary_port)
        for p in configured_ports:
            allowed_ports_set.add(p)

        # last-success: ใส่เฉพาะเมื่อไม่ strict หรือเมื่ออยู่ใน allowed set
        if last_success_port is not None and (not strict_mode or last_success_port in allowed_ports_set):
            ordered_ports.append(last_success_port)

        # primary port
        if primary_port is not None and primary_port not in ordered_ports:
            ordered_ports.append(primary_port)

        # configured ports
        for p in configured_ports:
            if p not in ordered_ports:
                ordered_ports.append(p)

        # default fallback ports เฉพาะเมื่อไม่ strict และไม่ได้บังคับ require_ports
        if not strict_mode and not require_ports:
            for p in default_ports:
                if p not in ordered_ports:
                    ordered_ports.append(p)

        if not ordered_ports:
            print(f"[get_modbus_client] No ports to try for {device_name} (strict={strict_mode}). Configure 'port' or 'ports' in config.json")
            return None

        # ลองเชื่อมต่อทีละพอร์ตด้วย timeout สั้นๆ
        if device.get("mode") == "rtu":
            client = AsyncModbusSerialClient(
                method="rtu",
                port=device.get("comPort", "COM1"),
                baudrate=device.get("baudrate", 9600),
                parity=device.get("parity", "none"),
                data_bits=device.get("dataBits", 8),
                stop_bits=device.get("stopBits", 1),
                timeout=2,
                retries=1,
            )
            await client.connect()
            modbus_clients[device_name] = client
            modbus_last_status = "connected" if getattr(client, "connected", False) else "error"
            return client if getattr(client, "connected", False) else None

        # TCP: try multiple ports
        for port in ordered_ports:
            try:
                test_client = AsyncModbusTcpClient(ip_address, port=port, timeout=1, retries=1)
                await test_client.connect()
                if getattr(test_client, "connected", False):
                    # ปิด client เดิมถ้ามี
                    try:
                        if device_name in modbus_clients and hasattr(modbus_clients[device_name], "close"):
                            await modbus_clients[device_name].close()
                    except Exception:
                        pass

                    modbus_clients[device_name] = test_client
                    device_last_ports[device_name] = port
                    modbus_last_status = "connected"
                    print(f"[get_modbus_client] Connected {device_name} at {ip_address}:{port}")
                    return test_client
                else:
                    try:
                        await test_client.close()
                    except Exception:
                        pass
            except Exception:
                # ลองพอร์ตถัดไป
                continue

        # ไม่สามารถเชื่อมต่อได้กับทุกพอร์ต - เงียบๆ
        modbus_last_status = "error"
        return None

    except Exception as e:
        # ไม่แสดง error เมื่อเชื่อมต่อไม่ได้ - เงียบๆ
        # print(f"[get_modbus_client] Connection failed for {device_name}: {e}")
        modbus_last_status = "error"
        return None


#  Apply Formula & Logging

import struct

def convert_modbus_data(registers: list, data_type: str = "int16", byte_order: str = "Signed") -> float:
    # FIXED: แสดงค่าตาม data type 
    """
    แปลงข้อมูลจาก Modbus registers เป็นค่าตาม data type และ byte order
    """
    try:
        if data_type == "int16":
            if byte_order == "Unsigned":
                return float(registers[0])
            elif byte_order == "Signed":
                # Handle signed 16-bit
                value = registers[0]
                if value > 0x7FFF:
                    value = value - 0x10000
                return float(value)
            elif byte_order == "Hex":
                return float(registers[0])
            elif byte_order == "Binary":
                return float(registers[0])
            else:
                return float(registers[0])
                
        elif data_type == "int32":
            if len(registers) < 2:
                return 0.0
                
            if byte_order == "Long AB CD":
                value = (registers[0] << 16) | registers[1]
            elif byte_order == "Long CD AB":
                value = (registers[1] << 16) | registers[0]
            elif byte_order == "Long BA DC":
                value = ((registers[0] & 0xFF) << 24) | ((registers[0] >> 8) << 16) | ((registers[1] & 0xFF) << 8) | (registers[1] >> 8)
            elif byte_order == "Long DC BA":
                value = ((registers[1] & 0xFF) << 24) | ((registers[1] >> 8) << 16) | ((registers[0] & 0xFF) << 8) | (registers[0] >> 8)
            else:
                # Default to AB CD
                value = (registers[0] << 16) | registers[1]
                
            # Handle negative values (two's complement)
            if value > 0x7FFFFFFF:
                value = value - 0x100000000
            return float(value)
            
        elif data_type == "float32":
            if len(registers) < 2:
                return 0.0
                
            if byte_order == "Float AB CD":
                # Convert to bytes and pack as float
                bytes_data = struct.pack('>HH', registers[0], registers[1])
                value = struct.unpack('>f', bytes_data)[0]
                # แสดงค่าตาม float32 ที่แท้จริง
                return value
            elif byte_order == "Float CD AB":
                bytes_data = struct.pack('>HH', registers[1], registers[0])
                value = struct.unpack('>f', bytes_data)[0]
                return value
            elif byte_order == "Float BA DC":
                bytes_data = struct.pack('<HH', registers[0], registers[1])
                value = struct.unpack('<f', bytes_data)[0]
                return value
            elif byte_order == "Float DC BA":
                bytes_data = struct.pack('<HH', registers[1], registers[0])
                value = struct.unpack('<f', bytes_data)[0]
                return value
            else:
                # Default to AB CD
                bytes_data = struct.pack('>HH', registers[0], registers[1])
                value = struct.unpack('>f', bytes_data)[0]
                return value
                
        elif data_type == "float64":
            if len(registers) < 4:
                return 0.0
                
            if byte_order == "Float AB CD EF GH":
                bytes_data = struct.pack('>HHHH', registers[0], registers[1], registers[2], registers[3])
                value = struct.unpack('>d', bytes_data)[0]
                return value
            else:
                # Default to AB CD EF GH
                bytes_data = struct.pack('>HHHH', registers[0], registers[1], registers[2], registers[3])
                value = struct.unpack('>d', bytes_data)[0]
                return value
        else:
            # Default to int16
            return float(registers[0])
    except Exception as e:
        print(f"[convert_modbus_data] Error converting {data_type} with {byte_order}: {e}")
        return 0.0

def apply_formula(formula: str, value: float) -> float:
    try:
        x = value
        return eval(formula)  
    except:
        return value

def calculate_corrected_values(gas_data: dict) -> dict:
    """คำนวณ Corrected to 7% O₂ values"""
    corrected = {}
    
    O2ref = 7
    O2meas = gas_data.get("O2", 0)
    
    if O2meas > 0 and O2meas < 21:
        correction_factor = (21 - O2ref) / (21 - O2meas)
    else:
        correction_factor = 1.0
    
    gases_to_correct = ["SO2", "NOx", "CO", "Dust"]
    
    for gas in gases_to_correct:
        if gas in gas_data and gas_data[gas] is not None:
            original_value = gas_data[gas]
            corrected_value = round(original_value * correction_factor, 2)
            corrected[f"{gas}Corr"] = float(corrected_value)
        else:
            corrected[f"{gas}Corr"] = None
    
    return corrected

def write_log_to_csv(timestamp: str, gas_values: dict):
    headers = ["Timestamp"] + list(gas_values.keys())
    file_exists = os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(headers)
        writer.writerow([timestamp] + list(gas_values.values()))


# Gas Data Fetch

async def get_status_data() -> dict:
    """อ่านข้อมูล Status และ Alarm จาก Modbus"""
    global modbus_last_status
    
    try:
        status_data = {}
        alarm_data = {}
        connected_devices = 0
        
        # อ่าน Status data
        try:
            client = await get_modbus_client("test4")
            if client and client.connected:
                # อ่าน status registers (0-14)
                for i in range(15):
                    try:
                        res = await client.read_holding_registers(address=i, count=1, slave=1)
                        if not res.isError():
                            status_data[f"status_{i}"] = res.registers[0]
                        else:
                            status_data[f"status_{i}"] = 0
                    except Exception as e:
                        # ไม่แสดง error เมื่ออ่านข้อมูลไม่ได้ - เงียบๆ
                        # print(f"[get_status_data] Error reading status register {i}: {e}")
                        status_data[f"status_{i}"] = 0
                connected_devices += 1
        except Exception as e:
            # ไม่แสดง error เมื่อไม่มี device - เงียบๆ
            # print(f"[get_status_data] Error connecting to status device: {e}")
            # ใส่ค่า 0 สำหรับ status ทั้งหมด
            for i in range(15):
                status_data[f"status_{i}"] = 0
        
        # อ่าน Alarm data
        try:
            client = await get_modbus_client("test5")
            if client and client.connected:
                # อ่าน alarm registers (0-3)
                for i in range(4):
                    try:
                        res = await client.read_holding_registers(address=i, count=1, slave=1)
                        if not res.isError():
                            alarm_data[f"alarm_{i}"] = res.registers[0]
                        else:
                            alarm_data[f"alarm_{i}"] = 0
                    except Exception as e:
                        # ไม่แสดง error เมื่ออ่านข้อมูลไม่ได้ - เงียบๆ
                        # print(f"[get_status_data] Error reading alarm register {i}: {e}")
                        alarm_data[f"alarm_{i}"] = 0
                connected_devices += 1
        except Exception as e:
            # ไม่แสดง error เมื่อไม่มี device - เงียบๆ
            # print(f"[get_status_data] Error connecting to alarm device: {e}")
            # ใส่ค่า 0 สำหรับ alarm ทั้งหมด
            for i in range(4):
                alarm_data[f"alarm_{i}"] = 0
        
        # อัปเดตสถานะการเชื่อมต่อ
        if connected_devices > 0:
            modbus_last_status = "connected"
        else:
            modbus_last_status = "error"
        
        # รวมข้อมูล
        combined_data = {**status_data, **alarm_data}
        return combined_data
        
    except Exception as e:
        modbus_last_status = "error"
        # ไม่แสดง error หลัก - เงียบๆ
        # print(f"[get_status_data] Error: {e}")
        return None

async def get_gas_data() -> dict:
    """อ่านข้อมูลก๊าซจาก Modbus"""
    global modbus_last_status, alarm_values
    
    try:
        gas_data = {}
        connected_devices = 0
        
        # จัดกลุ่ม mapping ตาม device
        device_mappings = {}
        for m in mapping_config:
            device_name = m.get("device", "test")
            if device_name not in device_mappings:
                device_mappings[device_name] = []
            device_mappings[device_name].append(m)
        
        # อ่านข้อมูลจากแต่ละ device
        for device_name, mappings in device_mappings.items():
            try:
                client = await get_modbus_client(device_name)
                if not client:
                    # ไม่แสดง error เมื่อไม่มี device - เงียบๆ
                    # print(f"[get_gas_data] Cannot connect to device {device_name}")
                    continue
                
                # หา slave ID จาก config
                devices = current_config.get("connection", {}).get("devices", [])
                slave_id = 1  # default
                for device in devices:
                    if device["name"] == device_name:
                        slave_id = device.get("slaveId", 1)
                        break
                
                # อ่านข้อมูลจาก device นี้
                for m in mappings:
                    try:
                        if m.get("address") is None:
                            gas_data[m["name"]] = 0
                            continue
                        
                        # อ่านตาม register count
                        register_count = m.get("registerCount", 1)
                        res = await client.read_holding_registers(
                            address=m["address"], count=register_count, slave=slave_id
                        )
                        
                        if not res.isError():
                            if register_count == 1:
                                raw_val = res.registers[0]
                                gas_data[m["name"]] = apply_formula(m["formula"], raw_val)
                            else:
                                # ใช้ convert_modbus_data สำหรับหลาย registers
                                data_type = m.get("dataType", "int16")
                                data_format = m.get("dataFormat", "Signed")
                                gas_data[m["name"]] = convert_modbus_data(
                                    res.registers, data_type, data_format
                                )
                        else:
                            gas_data[m["name"]] = 0
                            
                    except Exception as e:
                        # ไม่แสดง error เมื่ออ่านข้อมูลไม่ได้ - เงียบๆ
                        # print(f"[get_gas_data] Error reading {m['name']} from {device_name}: {e}")
                        gas_data[m["name"]] = 0
                
                connected_devices += 1
                
            except Exception as e:
                # ไม่แสดง error เมื่อมีปัญหา - เงียบๆ
                # print(f"[get_gas_data] Error connecting to device {device_name}: {e}")
                # ใส่ค่า 0 สำหรับ device ที่เชื่อมไม่ได้
                for m in mappings:
                    gas_data[m["name"]] = 0
        
        # สร้างข้อมูลเริ่มต้นเป็น 0.0 (float) สำหรับทุก sensor
        default_data = {
            'SO2': 0.0,
            'NOx': 0.0,
            'O2': 0.0,
            'CO': 0.0,
            'Dust': 0.0,
            'Temperature': 0.0,
            'Velocity': 0.0,
            'Flowrate': 0.0,
            'Pressure': 0.0
        }
        
        # อัปเดตด้วยข้อมูลที่ได้จาก Modbus (ถ้ามี)
        if gas_data:
            default_data.update(gas_data)
        
        # อัปเดตสถานะการเชื่อมต่อ
        if connected_devices > 0:
            modbus_last_status = "connected"
        else:
            modbus_last_status = "error"
        
        # คำนวณ Flowrate
        if "Velocity" in default_data:
            area = current_config.get("stack_info", {}).get("area", 1.0)
            velocity = default_data["Velocity"]
            default_data["Flowrate"] = round(velocity * area * 3600, 2)
        
        # คำนวณค่าที่ปรับแก้
        corrected_values = calculate_corrected_values(default_data)
        default_data.update(corrected_values)
        
        # Note: Alarm values are now read from Modbus device "alarm" instead of calculated here
        
        return default_data
        
    except Exception as e:
        modbus_last_status = "error"
        # ไม่แสดง error หลัก - เงียบๆ
        # print(f"[get_gas_data] Error: {e}")
        return None
    """สแกนหาอุปกรณ์ Modbus ในเครือข่าย"""
    try:
        # สแกน IP range ที่เป็นไปได้
        base_ips = ["192.168.1", "192.168.0", "10.0.0", "172.16.0"]
        common_ports = [502, 1502, 503, 504]
        found_devices = []
        
        for base_ip in base_ips:
            for i in range(1, 255):  # สแกน 1-254
                ip = f"{base_ip}.{i}"
                for port in common_ports:
                    try:
                        # ทดสอบการเชื่อมต่อ
                        client = AsyncModbusTcpClient(ip, port, timeout=1)
                        await client.connect()
                        
                        if client.connected:
                            # ทดสอบอ่านข้อมูล
                            try:
                                response = await asyncio.wait_for(
                                    client.read_holding_registers(0, 2),
                                    timeout=1
                                )
                                if response and not response.isError():
                                    found_devices.append({
                                        "ip": ip,
                                        "port": port,
                                        "name": f"AutoDetected_{ip}_{port}",
                                        "mode": "tcp",
                                        "slaveId": 1,
                                        "registerType": "holding"
                                    })
                                    print(f"[auto_scan] Found device at {ip}:{port}")
                            except:
                                pass
                            
                            await client.close()
                            
                    except:
                        continue
                        
        return found_devices
        
    except Exception as e:
        print(f"[auto_scan] Error: {e}")
        return []

async def update_config_with_scanned_devices(scanned_devices):
    """อัปเดต config ด้วย devices ที่สแกนพบ"""
    try:
        async with config_lock:
            # อัปเดต devices ใน config
            current_config["connection"]["devices"] = scanned_devices
            
            # บันทึก config
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(current_config, f, indent=2, ensure_ascii=False)
                
            print(f"[update_config] Updated with {len(scanned_devices)} devices")
            
    except Exception as e:
        print(f"[update_config] Error: {e}")



# ---------------------
# Blowback
# ---------------------
@app.websocket("/ws/blowback-status")
async def ws_blowback_status(websocket: WebSocket):
    global blowback_status, is_blowback_running
    await websocket.accept()
    try:
        while True:
            if not is_blowback_running:
                client = await get_modbus_client()  # ใช้ device แรก
                if client and client.connected:
                    try:
                        result = await client.read_holding_registers(
                            address=106, count=6, slave=1
                        )
                        if not result.isError():
                            blowback_status = result.registers
                    except Exception as e:
                        pass
            await websocket.send_json({
                "type": "blowback_status",
                "values": blowback_status,
                "connection_status": modbus_last_status,
                "alerts": system_alerts
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        add_system_alert(" /ws/blowback-status disconnected")

@app.post("/trigger-manual-blowback")
async def trigger_manual_blowback():
    global is_blowback_running, blowback_status
    if is_blowback_running:
        return {"error": "Blowback already running"}
    if not os.path.exists(BLOWBACK_SETTINGS_FILE):
        return {"error": "Blowback settings not configured"}

    try:
        with open(BLOWBACK_SETTINGS_FILE, "r") as f:
            settings = json.load(f)
    except Exception as e:
        add_system_alert(f" Blowback settings read error: {e}")
        return {"error": str(e)}

    is_blowback_running = True
    try:
        client = await get_modbus_client()  # ใช้ device แรก
        if client and client.connected:
            try:
                result = await client.write_register(
                    address=105, value=1, slave=1
                )
                if result.isError():
                    add_system_alert(" Blowback trigger failed")
            except Exception as e:
                add_system_alert(f" Modbus blowback trigger error: {e}")

        hold_time = int(settings.get("hold", 2))
        period_time = int(settings.get("period", 2))

        blowback_status = [0, 0, 0, 0, 0, 1]
        await asyncio.sleep(hold_time)

        blowback_status = [0, 0, 1, 1, 1, 0]
        test_duration = min(30, period_time * 60)
        await asyncio.sleep(test_duration)

        blowback_status = [0, 0, 0, 0, 0, 0]
        add_system_alert(" Blowback Finished")
        return {"success": True}
    except Exception as e:
        add_system_alert(f" trigger-manual-blowback error: {e}")
        return {"error": str(e)}
    finally:
        is_blowback_running = False


# WebSockets

@app.websocket("/ws/status")
async def ws_status(websocket: WebSocket):
    global status_values, alarm_values
    await websocket.accept()
    try:
        while True:
            try:
                # อ่านข้อมูล status และ alarm จาก mapping
                status_data = await get_status_data()
                if status_data:
                    # แยก status และ alarm values
                    status_values = []
                    alarm_values = []
                    
                    # Status values (0-14)
                    for i in range(15):
                        status_values.append(status_data.get(f"status_{i}", 0))
                    
                    # Alarm values (0-3)
                    for i in range(4):
                        alarm_values.append(status_data.get(f"alarm_{i}", 0))
                else:
                    # Fallback to default values
                    status_values = [0] * 15
                    alarm_values = [0] * 4
                    
            except Exception as e:
                print(f"[ws_status] Error reading status data: {e}")
                status_values = [0] * 15
                alarm_values = [0] * 4

            try:
                await websocket.send_json({
                    "type": "status",
                    "values": status_values + alarm_values,
                    "connection_status": modbus_last_status,
                    "alerts": system_alerts
                })
            except WebSocketDisconnect:
                add_system_alert(" /ws/status disconnected")
                break
            except Exception as e:
                if websocket.client_state.name != "DISCONNECTED":
                    print(f"[ws_status] send error: {e}")
                break

            await asyncio.sleep(2)
    except WebSocketDisconnect:
        add_system_alert(" /ws/status disconnected")

@app.websocket("/ws/gas")
async def ws_gas(websocket: WebSocket):
    print("[ws_gas] accepted")
    await websocket.accept()
    try:
        while True:
            try:
                gas_data = await get_gas_data()
                gas_values = []
                for key in ["SO2", "NOx", "O2", "CO", "Dust", "Temperature", "Velocity", "Flowrate", "Pressure"]:
                    value = gas_data.get(key, 0) if gas_data else 0
                    gas_values.append(value)
                
                # ใช้ corrected values จาก gas_data ที่คำนวณแล้ว
                corrected_values = {
                    "SO2Corr": gas_data.get("SO2Corr") if gas_data else None,
                    "NOxCorr": gas_data.get("NOxCorr") if gas_data else None,
                    "COCorr": gas_data.get("COCorr") if gas_data else None,
                    "DustCorr": gas_data.get("DustCorr") if gas_data else None
                }
                
            except Exception as e:
                print("[ws_gas] error:", e)
                gas_values = [0] * 9
                corrected_values = {}

            try:
                await websocket.send_json({
                    "type": "all",
                    "gas": gas_values,
                    "SO2Corr": corrected_values.get("SO2Corr"),
                    "NOxCorr": corrected_values.get("NOxCorr"),
                    "COCorr": corrected_values.get("COCorr"),
                    "DustCorr": corrected_values.get("DustCorr"),
                    "connection_status": modbus_last_status,
                    "alerts": system_alerts,
                    "has_real_data": any(value != 0 for value in gas_values[:4])
                })
            except WebSocketDisconnect:
                print("[ws_gas] disconnected")
                add_system_alert(" /ws/gas disconnected")
                break
            except Exception as e:
                if websocket.client_state.name != "DISCONNECTED":
                    print(f"[ws_gas] send error: {e}")
                break
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        add_system_alert(" /ws/gas disconnected")


#  Config API

@app.post("/reload-config")
async def reload_config():
    """โหลด config และ mapping ใหม่"""
    try:
        #  ป้องกัน race condition
            load_config()
            load_mapping()
            
            #  Regenerate Modbus clients ใหม่
            global modbus_clients
            modbus_clients = {}  # ล้าง clients เก่า
            # ล้างพอร์ตที่เคยเชื่อมสำเร็จ เพื่อบังคับให้ใช้ค่าใหม่ตาม strict ports
            global device_last_ports
            device_last_ports = {}
            
            add_system_alert(" โหลด config ใหม่เรียบร้อยแล้ว")
            return {"message": " โหลด config ใหม่เรียบร้อยแล้ว"}
    except Exception as e:
        add_system_alert(f" reload-config error: {e}")
        return {"error": str(e)}


#  Logs & Health


@app.get("/log-preview")
async def log_preview():
    """ดึงข้อมูลล่าสุดจาก InfluxDB (fallback สำหรับหน้า DataLog)"""
    try:
        # ใช้ InfluxDB API เดียวกัน แต่จำกัดจำนวนน้อย
        return await get_influxdb_logs(limit=20, hours=2)  # เพิ่มเป็น 20 รายการ ใน 2 ชั่วโมง
    except Exception as e:
        return {"error": f"Error fetching data: {str(e)}"}

@app.get("/logs/influxdb")
async def get_influxdb_logs(limit: int = 100, hours: int = 168, parameter: str = None, every: str = None, max_points: int = 0):  # รองรับการ aggregateWindow
    """ดึงข้อมูลจาก InfluxDB สำหรับหน้า DataLog"""
    try:
        from database_influx import influx_manager
        
        if not influx_manager.connected:
            print(" InfluxDB not connected")
            return []
        
        # ใช้ query แบบยืดหยุ่น - รองรับ aggregateWindow เพื่อลดจำนวนจุด
        # รองรับ filter เฉพาะพารามิเตอร์ (เช่น parameter=Temperature)
        param_filter = ""
        if parameter:
            # ฝั่งเขียน ใช้ tag "parameter" ระบุชื่อ เช่น SO2, NOx, Temperature, ...
            param_filter = f'\n            |> filter(fn: (r) => r["parameter"] == "{parameter}")'

        # คำนวณช่วง aggregateWindow อัตโนมัติ ถ้าไม่ได้ส่ง every แต่กำหนด max_points
        def seconds_to_flux_duration(seconds: int) -> str:
            try:
                if seconds % 3600 == 0:
                    return f"{seconds // 3600}h"
                if seconds % 60 == 0:
                    return f"{seconds // 60}m"
                return f"{seconds}s"
            except Exception:
                return "60s"

        aggregate_clause = ""
        try:
            if every:
                aggregate_clause = f"\n            |> aggregateWindow(every: {every}, fn: mean, createEmpty: false)"
            elif max_points and hours and hours > 0:
                target_points = max(10, int(max_points))
                seconds = int((hours * 3600) / target_points)
                seconds = max(1, seconds)
                dur = seconds_to_flux_duration(seconds)
                aggregate_clause = f"\n            |> aggregateWindow(every: {dur}, fn: mean, createEmpty: false)"
        except Exception:
            pass

        # เลือก bucket ตามช่วงที่ร้องขอ: ช่วงสั้นใช้ raw, ช่วงยาวใช้ agg_bucket
        bucket_name = influx_manager.config.get('bucket')
        try:
            hrs = int(hours)
            if hrs >= 24 and influx_manager.config.get('agg_bucket'):
                bucket_name = influx_manager.config['agg_bucket']
        except Exception:
            pass

        query = f'''
        from(bucket: "{bucket_name}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r["_measurement"] == "sensor_data")
            {param_filter}
            {aggregate_clause}
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: {limit * 10})
        '''
        
        try:
            result = influx_manager.query_api.query(query)
            print(f"DEBUG: Query result has {len(result)} tables")
            
            # จัดกลุ่มข้อมูลตาม timestamp
            data_by_time = {}
            
            for table in result:
                for record in table.records:
                    # แปลง UTC เป็น Thailand Time (UTC+7)
                    utc_time = record.get_time()
                    thailand_time = utc_time + timedelta(hours=7)
                    timestamp = thailand_time.strftime("%Y-%m-%d %H:%M:%S")
                    
                    if timestamp not in data_by_time:
                        data_by_time[timestamp] = {
                            "key": len(data_by_time) + 1,
                            "Timestamp": timestamp,
                            "SO2": 0, "NOx": 0, "O2": 0, "CO": 0, "Dust": 0,
                            "Temperature": 0, "Velocity": 0, "Flowrate": 0, "Pressure": 0,
                            "SO2_corrected": 0, "NOx_corrected": 0, "CO_corrected": 0, "Dust_corrected": 0
                        }
                    
                    # ใส่ค่าตาม field name
                    field_name = record.get_field()
                    field_value = record.get_value()
                    
                    # แปลง field name ให้ตรงกับที่ frontend ต้องการ
                    if field_name == "value":
                        parameter = record.values.get("parameter")  # parameter name จาก tag
                        
                        # แปลงชื่อ parameter ให้ตรงกับ frontend
                        if parameter == "SO2Corr":
                            parameter = "SO2_corrected"
                        elif parameter == "NOxCorr":
                            parameter = "NOx_corrected"
                        elif parameter == "COCorr":
                            parameter = "CO_corrected"
                        elif parameter == "DustCorr":
                            parameter = "Dust_corrected"
                        
                        if parameter in data_by_time[timestamp]:
                            try:
                                data_by_time[timestamp][parameter] = float(field_value)
                            except:
                                data_by_time[timestamp][parameter] = 0
            
            # แปลงเป็น list และเรียงตามเวลา
            transformed_data = list(data_by_time.values())
            transformed_data.sort(key=lambda x: x['Timestamp'], reverse=True)
            
            print(f"DEBUG: Returning {len(transformed_data)} records from InfluxDB")
            return transformed_data[:limit]
            
        except Exception as e:
            print(f" Error querying InfluxDB: {e}")
            return []
        
    except Exception as e:
        print(f" Error fetching from InfluxDB: {e}")
        return []

@app.get("/download-logs")
async def download_logs(from_date: str = None, to_date: str = None, fields: str = None, download_all: bool = False, every: str = None):
    """ดาวน์โหลดข้อมูลจาก InfluxDB เป็น CSV"""
    try:
        from database_influx import influx_manager
        
        if not influx_manager.connected:
            return {"error": "InfluxDB not connected"}
        
        # กำหนดช่วงเวลา
        if download_all:
            # ดาวน์โหลดข้อมูลทั้งหมด
            bucket_to_query = influx_manager.config.get('agg_bucket', influx_manager.config['bucket'])
            aggregate_clause = f"|> aggregateWindow(every: {every}, fn: mean, createEmpty: false)" if every else ""
            query = f'''
            from(bucket: "{bucket_to_query}")
                |> range(start: 0)
                |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                {aggregate_clause}
                |> sort(columns: ["_time"], desc: false)
            '''
        elif from_date and to_date:
            # รองรับทั้งรูปแบบวัน (YYYY-MM-DD) และวัน+เวลา (YYYY-MM-DD HH:mm:ss)
            # สมมติ timezone เป็น UTC+7 หากไม่ได้ระบุ
            def parse_to_utc(dt_str: str, is_start: bool) -> str:
                from datetime import timezone
                tz_offset_hours = 7
                fmt_with_time = "%Y-%m-%d %H:%M:%S"
                fmt_date_only = "%Y-%m-%d"
                try:
                    if len(dt_str.strip()) > 10:
                        dt_local = datetime.strptime(dt_str.strip(), fmt_with_time)
                    else:
                        dt_local = datetime.strptime(dt_str.strip(), fmt_date_only)
                        if is_start:
                            dt_local = dt_local.replace(hour=0, minute=0, second=0)
                        else:
                            dt_local = dt_local.replace(hour=23, minute=59, second=59)
                except Exception:
                    # หากพาร์สไม่ได้ ให้ fallback เป็น 7 วันที่ผ่านมา
                    return None
                # แปลงเป็น UTC (สมมติรับเข้ามาเป็นเวลาโลคัล +7)
                dt_utc = dt_local - timedelta(hours=tz_offset_hours)
                return dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

            start_time = parse_to_utc(from_date, True)
            end_time = parse_to_utc(to_date, False)
            if not start_time or not end_time:
                query = f'''
                from(bucket: "{influx_manager.config['bucket']}")
                    |> range(start: -7d)
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> sort(columns: ["_time"], desc: false)
                '''
            else:
                # เลือก bucket แบบฉลาด (ช่วงยาวใช้ agg_bucket)
                def diff_hours(a:str,b:str)->int:
                    try:
                        from datetime import datetime
                        da = datetime.strptime(a, "%Y-%m-%dT%H:%M:%SZ")
                        db = datetime.strptime(b, "%Y-%m-%dT%H:%M:%SZ")
                        return int((db-da).total_seconds()//3600)
                    except Exception:
                        return 0
                hours = diff_hours(start_time, end_time)
                bucket_to_query = influx_manager.config.get('bucket')
                if hours >= 24:
                    bucket_to_query = influx_manager.config.get('agg_bucket', bucket_to_query)
                # สร้าง filter สำหรับ fields เฉพาะ (ถ้ามี)
                param_filter = ""
                if fields:
                    try:
                        fs = [f.strip() for f in fields.split(',') if f.strip()]
                        if fs:
                            params_array = ",".join([f'"{p}"' for p in fs])
                            param_filter = f"|> filter(fn: (r) => contains(value: r[\"parameter\"], set: [{params_array}]))"
                    except Exception:
                        param_filter = ""
                aggregate_clause = f"|> aggregateWindow(every: {every}, fn: mean, createEmpty: false)" if every else ("|> aggregateWindow(every: 1m, fn: mean, createEmpty: false)" if hours >= 24 else "")
                query = f'''
                from(bucket: "{bucket_to_query}")
                    |> range(start: {start_time}, stop: {end_time})
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    {param_filter}
                    {aggregate_clause}
                    |> sort(columns: ["_time"], desc: false)
                '''
        else:
            # ดึงข้อมูล 7 วันล่าสุด
            bucket_to_query = influx_manager.config.get('bucket')
            aggregate_clause = f"|> aggregateWindow(every: {every}, fn: mean, createEmpty: false)" if every else ""
            query = f'''
            from(bucket: "{bucket_to_query}")
                |> range(start: -7d)
                |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                {aggregate_clause}
                |> sort(columns: ["_time"], desc: false)
            '''
        
        result = influx_manager.query_api.query(query)
        
        # จัดกลุ่มข้อมูลตาม timestamp
        data_by_time = {}
        
        for table in result:
            for record in table.records:
                # แปลง UTC เป็น Thailand Time (UTC+7)
                utc_time = record.get_time()
                thailand_time = utc_time + timedelta(hours=7)
                timestamp = thailand_time.strftime("%Y-%m-%d %H:%M:%S")
                
                if timestamp not in data_by_time:
                    data_by_time[timestamp] = {
                        "Timestamp": timestamp,
                        "SO2": 0, "NOx": 0, "O2": 0, "CO": 0, "Dust": 0,
                        "Temperature": 0, "Velocity": 0, "Flowrate": 0, "Pressure": 0,
                        "SO2_corrected": 0, "NOx_corrected": 0, "CO_corrected": 0, "Dust_corrected": 0
                    }
                
                # ใส่ค่าตาม field name
                field_name = record.get_field()
                field_value = record.get_value()
                
                if field_name == "value":
                    parameter = record.values.get("parameter")
                    
                    # แปลงชื่อ parameter
                    if parameter == "SO2Corr":
                        parameter = "SO2_corrected"
                    elif parameter == "NOxCorr":
                        parameter = "NOx_corrected"
                    elif parameter == "COCorr":
                        parameter = "CO_corrected"
                    elif parameter == "DustCorr":
                        parameter = "Dust_corrected"
                    
                    if parameter in data_by_time[timestamp]:
                        try:
                            data_by_time[timestamp][parameter] = float(field_value)
                        except:
                            data_by_time[timestamp][parameter] = 0
        
        # แปลงเป็น list และเรียงตามเวลา
        transformed_data = list(data_by_time.values())
        transformed_data.sort(key=lambda x: x['Timestamp'])

        # หากผู้ใช้เลือก fields เฉพาะ ให้กรองคอลัมน์
        selected_fields = None
        if fields:
            try:
                selected_fields = [f.strip() for f in fields.split(',') if f.strip()]
            except Exception:
                selected_fields = None
        
        # สร้าง CSV
        import csv
        import io
        
        output = io.StringIO()
        if transformed_data:
            if selected_fields:
                fieldnames = ["Timestamp"] + selected_fields
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                for row in transformed_data:
                    filtered = {k: row.get(k) for k in fieldnames}
                    writer.writerow(filtered)
            else:
                fieldnames = transformed_data[0].keys()
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(transformed_data)
        
        csv_content = output.getvalue()
        output.close()
        
        # สร้างไฟล์ response
        from fastapi.responses import Response
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=CEMS_DataLog.csv"}
        )
        
    except Exception as e:
        return {"error": f"Error downloading logs: {str(e)}"}

@app.get("/health")
async def health_check():
    return {
        "status": "ok", 
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.1"
    }

# ---------------------
# Authentication endpoints (simple, file-based)
# ---------------------

def _default_password_for_role(role: str) -> str:
    return "admin" if role == "admin" else "user"

@app.post("/login")
async def login_endpoint(payload: dict = Body(...)):
    try:
        role = (payload.get("role") or "").strip()
        password = payload.get("password") or ""
        if role not in ("admin", "user"):
            return JSONResponse(status_code=400, content={"error": "Invalid role"})

        stored_hash = auth_get_hash(role)
        ok = False
        if stored_hash:
            ok = verify_password(password, stored_hash)
        else:
            # ถ้ายังไม่เคยตั้งรหัสผ่าน ใช้รหัสเริ่มต้น (admin/user)
            ok = password == _default_password_for_role(role)

        if not ok:
            return JSONResponse(status_code=401, content={"error": "Invalid credentials"})

        token = create_access_token(role)
        return {"role": role, "token": token}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/change-password")
async def change_password_endpoint(payload: dict = Body(...)):
    try:
        username = payload.get("username") or payload.get("role") or ""
        old_password = payload.get("old_password") or ""
        new_password = payload.get("new_password") or ""

        role = username if username in ("admin", "user") else None
        if not role:
            return JSONResponse(status_code=400, content={"error": "Invalid username/role"})
        if not new_password or len(new_password) < 6:
            return JSONResponse(status_code=400, content={"error": "Password too short"})

        stored_hash = auth_get_hash(role)
        valid_old = False
        if stored_hash:
            valid_old = verify_password(old_password, stored_hash)
        else:
            valid_old = old_password == _default_password_for_role(role)

        if not valid_old:
            return JSONResponse(status_code=401, content={"error": "Old password incorrect"})

        # อัปเดตรหัสผ่านใหม่ลงไฟล์ config
        new_hash = get_password_hash(new_password)
        async with config_lock:
            auth_set_hash(role, new_hash)
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(current_config, f, indent=2, ensure_ascii=False)

        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/debug")
async def debug_info():
    """Debug endpoint เพื่อตรวจสอบสถานะระบบ"""
    try:
        # ตรวจสอบ InfluxDB
        influx_status = influx_manager.connected
        
        # ตรวจสอบ Modbus
        modbus_status = {}
        devices = current_config.get("connection", {}).get("devices", [])
        for device in devices:
            client = await get_modbus_client(device["name"])
            modbus_status[device["name"]] = {
                "connected": client.connected if client else False,
                "ip": device["ip"],
                "port": device["port"]
            }
        
        # ตรวจสอบข้อมูลล่าสุด
        latest_data = await get_gas_data()
        
        return {
            "influxdb_connected": influx_status,
            "modbus_status": modbus_status,
            "latest_data": latest_data,
            "config_devices": devices,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/test-save")
async def test_save_data():
    """ทดสอบการบันทึกข้อมูลลง InfluxDB"""
    try:
        # ข้อมูลทดสอบ
        test_data = {
            "SO2": 11.1,
            "NOx": 22.2,
            "O2": 19.3,
            "CO": 25.6,
            "Dust": 0.0,
            "Temperature": 0.0,
            "Velocity": 0.0,
            "Flowrate": 0.0,
            "Pressure": 0.0
        }
        
        # บันทึกลง InfluxDB
        result = await save_sensor_data_to_influx(test_data)
        
        return {
            "success": result,
            "data_saved": test_data,
            "influxdb_connected": influx_manager.connected,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/raw-influxdb")
async def get_raw_influxdb_data():
    """ดึงข้อมูลดิบจาก InfluxDB"""
    try:
        if not influx_manager.connected:
            return {"error": "InfluxDB not connected"}
        
        query = f'''
        from(bucket: "{influx_manager.config['bucket']}")
            |> range(start: -1h)
            |> filter(fn: (r) => r["_measurement"] == "sensor_data")
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 20)
        '''
        
        result = influx_manager.query_api.query(query)
        raw_data = []
        
        for table in result:
            for record in table.records:
                raw_data.append({
                    "time": record.get_time().isoformat(),
                    "measurement": record.get_measurement(),
                    "field": record.get_field(),
                    "value": record.get_value(),
                    "tags": dict(record.values)
                })
        
        return {
            "raw_data": raw_data,
            "count": len(raw_data),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def serve_frontend():
    """Serve the frontend application"""
    try:
        # Try to serve from dist folder
        if os.path.exists("dist/index.html"):
            return FileResponse("dist/index.html")
        elif os.path.exists("../dist/index.html"):
            return FileResponse("../dist/index.html")
        else:
            return {"message": "Frontend not found", "status": "error"}
    except Exception as e:
        return {"message": f"Error serving frontend: {e}", "status": "error"}

#  ดึงค่าการตั้งค่าทั้งหมด (ใหม่)
@app.get("/config")
async def get_config_endpoint():
    try:
        if not os.path.exists(CONFIG_FILE):
            # สร้างไฟล์ config ใหม่ถ้าไม่มี
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "connection": {
                        "devices": [
                            {
                                "name": "GasAnalyzer",
                                "mode": "tcp",
                                "ip": "127.0.0.1",
                                "port": 502,
                                "slaveId": 1,
                                "registerType": "holding"
                            }
                        ],
                        "alarm_threshold": {"SO2": 200, "CO": 100, "Dust": 50},
                        "log_interval": 60,
                        "reconnect_interval": 60
                    },
                    "stack_info": {"area": 1.0, "diameter": 1.0}
                }, f, ensure_ascii=False, indent=2)
            return {"connection": current_config}
        
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error reading config: {str(e)}"}
        )

#  บันทึกค่าการตั้งค่า (รวมกับ save_config)
@app.put("/config")
async def update_config_endpoint(request: Request):
    try:
        data = await request.json()
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        #  โหลด config ใหม่
        load_config()
        
        return {
            "message": "Configuration updated successfully", 
            "timestamp": datetime.now().isoformat(),
            "devices": data.get("connection", {}).get("devices", [])
        }
    except Exception as e:
        add_system_alert(f"❌ update-config error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error updating config: {str(e)}"}
        )

#  ดึงค่า mapping configuration (รวมกับ get_mapping_config)
@app.get("/mapping")
async def get_mapping_endpoint():
    try:
        if not os.path.exists(MAPPING_FILE):
            # สร้างไฟล์ mapping ใหม่ถ้าไม่มี
            default_mapping = [
                {
                    "name": "SO2",
                    "address": 0,
                    "unit": "ppm",
                    "formula": "x",
                    "device": "GasAnalyzer",
                    "dataType": "float32",
                    "dataFormat": "Float AB CD",
                    "registerCount": 2,
                    "byteOrder": "Float AB CD",
                    "addressBase": 0
                }
            ]
            with open(MAPPING_FILE, "w", encoding="utf-8") as f:
                json.dump(default_mapping, f, ensure_ascii=False, indent=2)
            return default_mapping
        
        with open(MAPPING_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error reading mapping: {str(e)}"}
        )

#  บันทึกค่า mapping configuration (รวมกับ save_mapping)
@app.put("/mapping")
async def update_mapping_endpoint(request: Request):
    try:
        data = await request.json()
        print(f"[update_mapping_endpoint] Received data: {data}")
        
        with open(MAPPING_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # โหลด mapping ใหม่
        load_mapping()
        print(f"[update_mapping_endpoint] Mapping updated successfully")
        return {"message": "Mapping updated successfully", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        print(f"[update_mapping_endpoint] Error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error updating mapping: {str(e)}"}
        )

#  รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น (ใหม่)
@app.post("/reset-config")
async def reset_config_endpoint():
    try:
        #  ป้องกัน race condition
        # รีเซ็ต config
            default_config = {
                "connection": {
                    "devices": [
                        {
                            "name": "GasAnalyzer",
                            "mode": "tcp",
                            "ip": "127.0.0.1",
                            "port": 502,
                            "slaveId": 1,
                            "registerType": "holding"
                        }
                    ],
                    "alarm_threshold": {"SO2": 200, "CO": 100, "Dust": 50},
                    "log_interval": 60,
                    "reconnect_interval": 60
                },
                "stack_info": {"area": 1.0, "diameter": 1.0}
            }
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            
            # รีเซ็ต mapping
            default_mapping = [
                {
                    "name": "SO2",
                    "address": 0,
                    "unit": "ppm",
                    "formula": "x",
                    "device": "GasAnalyzer",
                    "dataType": "float32",
                    "dataFormat": "Float AB CD",
                    "registerCount": 2,
                    "byteOrder": "Float AB CD",
                    "addressBase": 0
                }
            ]
            with open(MAPPING_FILE, "w", encoding="utf-8") as f:
                json.dump(default_mapping, f, ensure_ascii=False, indent=2)
            
            #  โหลด config และ mapping ใหม่
            load_config()
            load_mapping()
            
            #  Regenerate Modbus clients ใหม่
            await regenerate_modbus_clients()
            
            add_system_alert(" Configuration reset to default successfully")
            return {
                "message": "Configuration reset to default successfully",
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        add_system_alert(f" reset-config error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error resetting config: {str(e)}"}
        )

#  ตรวจสอบสถานะไฟล์ (ใหม่)
@app.get("/status")
async def get_status_endpoint():
    try:
        config_exists = os.path.exists(CONFIG_FILE)
        mapping_exists = os.path.exists(MAPPING_FILE)
        
        return {
            "config_file": {
                "exists": config_exists,
                "path": os.path.abspath(CONFIG_FILE) if config_exists else None
            },
            "mapping_file": {
                "exists": mapping_exists,
                "path": os.path.abspath(MAPPING_FILE) if mapping_exists else None
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error checking status: {str(e)}"}
        )

# อ่านข้อมูลจาก Modbus register โดยตรง
@app.post("/read-register")
async def read_register_endpoint(request: dict = Body(...)):
    """อ่านข้อมูลจาก Modbus register โดยตรง"""
    try:
        device_name = request.get("device")
        address = request.get("address", 0)
        count = request.get("count", 1)
        data_type = request.get("dataType", "int16")
        data_format = request.get("dataFormat", "Signed")
        
        if not device_name:
            return JSONResponse(
                status_code=400,
                content={"error": "Device name is required"}
            )
        
        # หา device จาก config
        devices = current_config.get("connection", {}).get("devices", [])
        device = None
        for d in devices:
            if d["name"] == device_name:
                device = d
                break
        
        if not device:
            return JSONResponse(
                status_code=404,
                content={"error": f"Device '{device_name}' not found"}
            )
        
        # เชื่อมต่อ Modbus
        client = await get_modbus_client(device_name)
        if not client or not client.connected:
            return JSONResponse(
                status_code=503,
                content={"error": f"Cannot connect to device '{device_name}'"}
            )
        
        # อ่านข้อมูล
        slave_id = device.get("slaveId", 1)
        res = await client.read_holding_registers(
            address=address, 
            count=count, 
            slave=slave_id
        )
        
        if res.isError():
            return JSONResponse(
                status_code=500,
                content={"error": f"Modbus read error: {res}"}
            )
        
        # แปลงข้อมูลตาม data type
        if count == 1:
            raw_value = res.registers[0]
            if data_type == "int16":
                if data_format == "Signed" and raw_value > 0x7FFF:
                    raw_value = raw_value - 0x10000
                value = float(raw_value)
            else:
                value = float(raw_value)
        else:
            value = convert_modbus_data(res.registers, data_type, data_format)
        
        return {
            "device": device_name,
            "address": address,
            "count": count,
            "dataType": data_type,
            "dataFormat": data_format,
            "rawRegisters": res.registers,
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"[read_register] Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Error reading register: {str(e)}"}
        )

async def logging_task():
    while True:
        try:
            gas_data = await get_gas_data()
            if gas_data:
                now = datetime.now()
                
                # บันทึกลง InfluxDB
                try:
                    if not influx_manager.connected:
                        print(" Reconnecting to InfluxDB...")
                        influx_manager.connect()
                    
                    if influx_manager.connected:
                        await save_sensor_data_to_influx(gas_data)
                        print(f" เก็บข้อมูล: {now.strftime('%H:%M:%S')} - SO2: {gas_data.get('SO2', 0)}, NOx: {gas_data.get('NOx', 0)}, O2: {gas_data.get('O2', 0)}, CO: {gas_data.get('CO', 0)}")
                    else:
                        print(f" InfluxDB not connected - skipping data save")
                except Exception as e:
                    print(f" InfluxDB save error: {e}")
                    
        except Exception as e:
            print(f"Logging error: {e}")
        await asyncio.sleep(LOG_INTERVAL)

@app.post("/api/scan-devices")
async def scan_devices(scan_request: dict = Body(...)):
    """สแกนหาอุปกรณ์ Modbus TCP และ RTU"""
    results = []
    
    try:
        #  สแกน TCP Devices
        if scan_request.get("scan_tcp", True):
            tcp_ips = scan_request.get("tcp_ips", ["127.0.0.1"])
            tcp_ports = scan_request.get("tcp_ports", None)  # รับ custom ports
            tcp_results = await scan_tcp_devices(tcp_ips, tcp_ports)
            results.extend(tcp_results)
        
        #  สแกน RTU Devices  
        if scan_request.get("scan_rtu", True):
            rtu_ports = scan_request.get("rtu_ports", ["COM1", "COM2", "COM3", "COM4"])
            rtu_results = await scan_rtu_devices(rtu_ports)
            results.extend(rtu_results)
        
        print(f"[scan_devices] Found {len(results)} devices")
        return results
        
    except Exception as e:
        print(f"[scan_devices] Error: {e}")
        add_system_alert(f"Scan error: {e}")
        return []

async def identify_device_type(client, ip, port):
    """ระบุชนิดอุปกรณ์จากข้อมูลที่อ่านได้"""
    try:
        # อ่านข้อมูลจาก registers ต่างๆ เพื่อระบุชนิดอุปกรณ์
        test_registers = [0, 2, 4, 6]  # ทดสอบ registers ต่างๆ
        device_data = {}
        
        for reg_addr in test_registers:
            try:
                response = await asyncio.wait_for(
                    client.read_holding_registers(reg_addr, 2),
                    timeout=1
                )
                if response and response.registers:
                    device_data[reg_addr] = response.registers
            except:
                continue
        
        if not device_data:
            return None
            
        # วิเคราะห์ข้อมูลเพื่อระบุชนิดอุปกรณ์
        device_type, suggested_params = analyze_device_data(device_data, port)
        
        return {
            "ip": ip,
            "port": port,
            "mode": "tcp",
            "status": "success",
            "deviceType": device_type,
            "rawData": list(device_data.values())[0] if device_data else [],
            "isUnknown": device_type == "Unknown Device",
            "parameters": suggested_params,
            "dataType": "float32",
            "dataFormat": "Float AB CD",
            "registersFound": list(device_data.keys())
        }
        
    except Exception as e:
        print(f"[identify_device_type] Error identifying {ip}:{port} - {e}")
        return None

def analyze_device_data(device_data, port):
    """วิเคราะห์ข้อมูลเพื่อระบุชนิดอุปกรณ์"""
    
    # กำหนดชนิดอุปกรณ์ตาม port (เป็นการคาดเดาเบื้องต้น)
    port_mapping = {
        502: ("Gas Analyzer", ["SO2", "NOx", "O2", "CO"]),
        503: ("Dust Sensor", ["Dust", "PM2.5", "PM10"]),
        504: ("Flow Sensor", ["Temperature", "Velocity", "Pressure"]),
        1502: ("Environmental Monitor", ["Temperature", "Humidity", "Pressure"]),
        2404: ("Power Meter", ["Voltage", "Current", "Power"]),
        8080: ("Web Interface", ["Status", "Config"]),
        8502: ("Extended Modbus", ["Custom1", "Custom2"])
    }
    
    # ลองระบุจาก port ก่อน
    if port in port_mapping:
        device_type, params = port_mapping[port]
        return device_type, params
    
    # ถ้าไม่รู้จัก port ให้วิเคราะห์จากข้อมูล
    register_count = len(device_data)
    if register_count >= 4:
        return "Multi-Parameter Device", [f"Param{i+1}" for i in range(4)]
    elif register_count >= 2:
        return "Dual-Parameter Device", [f"Param{i+1}" for i in range(2)]
    else:
        return "Single-Parameter Device", ["Value1"]

async def scan_tcp_devices(ip_list, custom_ports=None):
    """สแกนอุปกรณ์ TCP - แบบเร็ว"""
    results = []
    
    #  ลดจำนวน IP ที่สแกน (ไม่เกิน 20 IP)
    if len(ip_list) > 20:
        ip_list = ip_list[:20]
        print(f"[scan_tcp_devices] Limiting scan to first 20 IPs")
    
    #  กำหนด ports ที่จะสแกน
    if custom_ports:
        ports_to_scan = custom_ports
        print(f"[scan_tcp_devices] Using custom ports: {ports_to_scan}")
    else:
        ports_to_scan = [502, 503, 504, 1502, 2404, 8080, 8502, 10502]
        print(f"[scan_tcp_devices] Using default ports: {ports_to_scan}")
    
    for ip in ip_list:
        for port in ports_to_scan:
            try:
                print(f"[scan_tcp_devices] Scanning {ip}:{port}")
                client = AsyncModbusTcpClient(ip, port, timeout=1)  # ลด timeout จาก 2 เป็น 1
                await asyncio.wait_for(client.connect(), timeout=1)  # ลด timeout จาก 2 เป็น 1
                
                #  ลองอ่านข้อมูลจากหลาย registers เพื่อระบุชนิดอุปกรณ์
                device_info = await identify_device_type(client, ip, port)
                if device_info:
                    results.append(device_info)
                    print(f"[scan_tcp_devices] Found {device_info['deviceType']} at {ip}:{port}")
                
                await client.close()
                
            except Exception as e:
                # print(f"[scan_tcp_devices] {ip}:{port} - {e}")
                continue
    
    return results

async def scan_rtu_devices(com_ports):
    """สแกนอุปกรณ์ RTU - แบบเร็ว"""
    results = []
    
    #  ลดจำนวน COM ports ที่สแกน (ไม่เกิน 4 ports)
    if len(com_ports) > 4:
        com_ports = com_ports[:4]
        print(f"[scan_rtu_devices] Limiting scan to first 4 COM ports")
    
    for com_port in com_ports:
        #  สแกนเฉพาะ baudrate 9600 (มาตรฐาน)
        for baudrate in [9600]:  # ลดจาก [9600, 19200, 38400, 57600, 115200]
            #  สแกนเฉพาะ parity none (มาตรฐาน)
            for parity in ["none"]:  # ลดจาก ["none", "even", "odd"]
                try:
                    print(f"[scan_rtu_devices] Scanning {com_port} at {baudrate} baud")
                    client = AsyncModbusSerialClient(
                        method="rtu",
                        port=com_port,
                        baudrate=baudrate,
                        parity=parity,
                        data_bits=8,
                        stop_bits=1,
                        timeout=1  # ลด timeout จาก 2 เป็น 1
                    )
                    
                    await asyncio.wait_for(client.connect(), timeout=1)  # ลด timeout จาก 2 เป็น 1
                    
                    #  ลองอ่านข้อมูล
                    response = await asyncio.wait_for(
                        client.read_holding_registers(0, 2),  # ลดจาก 5 เป็น 2 registers
                        timeout=1  # ลด timeout จาก 3 เป็น 1
                    )
                    
                    if response and response.registers:
                        device_info = {
                            "comPort": com_port,
                            "baudrate": baudrate,
                            "parity": parity,
                            "mode": "rtu",
                            "status": "success",
                            "deviceType": "Modbus RTU Device",
                            "rawData": response.registers[:2],
                            "isUnknown": True,
                            "parameters": [f"Param{i+1}" for i in range(min(2, len(response.registers)))],
                            "dataType": "float32",
                            "dataFormat": "Float AB CD"
                        }
                        results.append(device_info)
                        print(f"[scan_rtu_devices] Found device at {com_port}")
                    
                    await client.close()
                    
                except Exception as e:
                    # print(f"[scan_rtu_devices] {com_port} - {e}")
                    continue
    
    return results


#  Run Server

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting CEMS Backend Server...")
    print("📍 Server will be available at: http://127.0.0.1:8000")
    print("🔗 WebSocket endpoints:")
    print("   - ws://127.0.0.1:8000/ws/gas")
    print("   - ws://127.0.0.1:8000/ws/status")
    print("   - ws://127.0.0.1:8000/ws/blowback-status")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_config=None)

#  API endpoint สำหรับจัดการ gas configuration
@app.get("/gas-config")
async def get_gas_config():
    """ดึง gas configuration"""
    try:
        gas_config = current_config.get("gas_config", {})
        return gas_config
    except Exception as e:
        return {"error": f"Error getting gas config: {str(e)}"}

@app.put("/gas-config")
async def update_gas_config(request: Request):
    """อัปเดต gas configuration"""
    try:
        async with config_lock:
            data = await request.json()
            
            # อัปเดต gas_config
            current_config["gas_config"] = data
            
            # บันทึก config
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(current_config, f, indent=2, ensure_ascii=False)
                
            print(f"[update_gas_config] Updated gas configuration")
            return {"success": True, "message": "Gas configuration updated"}
            
    except Exception as e:
        return {"error": f"Error updating gas config: {str(e)}"}

@app.get("/enabled-gases")
async def get_enabled_gases():
    """ดึงรายการแก๊สที่เปิดใช้งาน"""
    try:
        gas_config = current_config.get("gas_config", {})
        enabled_gases = []
        
        # เพิ่ม default gases ที่ enabled
        for gas in gas_config.get("default_gases", []):
            if gas.get("enabled", True):
                enabled_gases.append(gas)
        
        # เพิ่ม additional gases ที่ enabled
        for gas in gas_config.get("additional_gases", []):
            if gas.get("enabled", False):
                enabled_gases.append(gas)
        
        return enabled_gases
    except Exception as e:
        return {"error": f"Error getting enabled gases: {str(e)}"}

#  API endpoint สำหรับ gas configuration ในหน้าคอนฟิก
@app.get("/config/gas")
async def get_gas_config_page():
    """หน้าคอนฟิกแก๊ส"""
    try:
        gas_config = current_config.get("gas_config", {})
        return {
            "default_gases": gas_config.get("default_gases", []),
            "additional_gases": gas_config.get("additional_gases", []),
            "message": "Gas configuration loaded successfully"
        }
    except Exception as e:
        return {"error": f"Error loading gas config: {str(e)}"}

@app.put("/config/gas")
async def update_gas_config_page(request: Request):
    """อัปเดตการตั้งค่าแก๊ส"""
    try:
            data = await request.json()
            
            # อัปเดต gas_config
            current_config["gas_config"] = {
                "default_gases": data.get("default_gases", []),
                "additional_gases": data.get("additional_gases", [])
            }
            
            # บันทึก config
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(current_config, f, indent=2, ensure_ascii=False)
                
            print(f"[update_gas_config] Gas configuration updated")
            return {"success": True, "message": "Gas configuration updated successfully"}
            
    except Exception as e:
        return {"error": f"Error updating gas config: {str(e)}"}

@app.post("/config/gas/toggle")
async def toggle_gas(request: Request):
    """เปิด/ปิดการแสดงแก๊ส"""
    try:
            data = await request.json()
            gas_name = data.get("gas_name")
            enabled = data.get("enabled", False)
            
            gas_config = current_config.get("gas_config", {})
            
            # หาแก๊สใน default_gases
            for gas in gas_config.get("default_gases", []):
                if gas["name"] == gas_name:
                    gas["enabled"] = enabled
                    break
            
            # หาแก๊สใน additional_gases
            for gas in gas_config.get("additional_gases", []):
                if gas["name"] == gas_name:
                    gas["enabled"] = enabled
                    break
            
            # บันทึก config
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(current_config, f, indent=2, ensure_ascii=False)
                
            print(f"[toggle_gas] {gas_name} {'enabled' if enabled else 'disabled'}")
            return {"success": True, "message": f"{gas_name} {'enabled' if enabled else 'disabled'}"}
            
    except Exception as e:
        return {"error": f"Error toggling gas: {str(e)}"}
