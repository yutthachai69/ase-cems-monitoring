import asyncio, json, csv, os, random, sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pymodbus.client import AsyncModbusTcpClient, AsyncModbusSerialClient
from datetime import datetime
from contextlib import asynccontextmanager
import httpx
import sys, io

# ✅ lifespan ต้องประกาศก่อนสร้าง app
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    load_mapping()
    asyncio.create_task(logging_task())
    yield

# ✅ ใช้ lifespan ตอนสร้าง app เลย (ไม่ต้องมี app = FastAPI() ก่อนหน้านี้อีก)
app = FastAPI(lifespan=lifespan)

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ✅ Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Files
CONFIG_FILE = "config.json"
MAPPING_FILE = "mapping.json"
LOG_FILE = "CEMS_DataLog.csv"
ERROR_LOG = "CEMS_ErrorLog.csv"
BLOWBACK_SETTINGS_FILE = "blowback_settings.json"
LOG_INTERVAL = 60

# ✅ Global
modbus_client: AsyncModbusTcpClient = None
current_config = {}
mapping_config = []
alarm_values = [0, 0, 0, 0]
status_values = [0] * 15
blowback_status = [0, 0, 0, 0, 0, 0]
is_blowback_running = False
modbus_last_status = "error"
system_alerts = []  # ✅ แจ้งเตือนล่าสุด (10 รายการ)

# ✅ NEW: Multi-Device
modbus_clients = {}  # ✅ เก็บ client แยกตาม device
modbus_status = {}   # ✅ เก็บสถานะแยกตาม device
last_reconnect_try_map = {}  # ✅ เพิ่มตัวแปรที่ขาดหายไป
RECONNECT_INTERVAL = 60  # ✅ ย้ายมาที่นี่

# ✅ NEW: Dynamic Config Management
config_lock = asyncio.Lock()  # ✅ ป้องกัน race condition

# โหลด config และ mapping ตอนเริ่มต้น
# load_config() # ลบบรรทัดนี้ออก
# load_mapping() # ลบบรรทัดนี้ออก

# ---------------------
# ✅ Utility Functions
# ---------------------
def add_system_alert(message: str):
    """เพิ่มข้อความแจ้งเตือนเข้า list (เก็บแค่ 10 ข้อความล่าสุด)"""
    global system_alerts
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    alert_msg = f"[{timestamp}] {message}"
    if not system_alerts or system_alerts[0] != alert_msg:
        system_alerts.insert(0, alert_msg)
    system_alerts = system_alerts[:10]

def load_config():
    global current_config, LOG_INTERVAL, RECONNECT_INTERVAL
    if not os.path.exists(CONFIG_FILE):
        # ✅ สร้าง config เริ่มต้นแบบใหม่
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

    # ✅ โหลดค่าจาก config
    LOG_INTERVAL = current_config.get("connection", {}).get("log_interval", 60)
    RECONNECT_INTERVAL = current_config.get("connection", {}).get("reconnect_interval", 60)
    
    # ✅ ตรวจสอบโครงสร้าง config ใหม่
    if "connection" not in current_config:
        # ✅ แปลง config เก่าเป็นใหม่
        old_devices = current_config.get("devices", [])
        new_config = {
            "connection": {
                "devices": old_devices,
                "alarm_threshold": current_config.get("alarm_threshold", {"SO2": 200, "CO": 100, "Dust": 50}),
                "log_interval": current_config.get("log_interval", 60),
                "reconnect_interval": current_config.get("reconnect_interval", 60)
            },
            "stack_info": current_config.get("stack_info", {"area": 1.0, "diameter": 1.0})
        }
        current_config = new_config
        # ✅ บันทึก config ใหม่
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(current_config, f, indent=2, ensure_ascii=False)


def load_mapping():
    global mapping_config
    if not os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, "w") as f:
            json.dump([{"name": "SO2", "address": 0, "unit": "ppm", "formula": "x"}], f, indent=2)
    with open(MAPPING_FILE) as f:
        mapping_config = json.load(f)
    if not isinstance(mapping_config, list):
        mapping_config = []

    # ✅ เพิ่มตรงนี้ เพื่อล้างช่องว่างชื่อก๊าซ
    for m in mapping_config:
        if isinstance(m.get("name"), str):
            m["name"] = m["name"].strip()

    print("[load_mapping] cleaned mapping:", mapping_config)  # ✅ Debug เช็กชื่อที่ถูกล้างแล้ว


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
# ✅ Multi-Device Modbus Client
# ---------------------
async def get_modbus_client(device_name: str = None, force_reconnect=False):
    global modbus_client, modbus_clients, modbus_last_status, modbus_status, last_reconnect_try_map

    # ✅ ถ้าไม่ได้ส่ง device_name → ใช้ logic เดิม
    if not device_name:
        return modbus_client

    # ✅ แก้ไขการเข้าถึง devices ให้ตรงกับโครงสร้าง config ใหม่
    devices = current_config.get("connection", {}).get("devices", [])
    device = next((d for d in devices if d["name"] == device_name), None)
    if not device:
        add_system_alert(f" Device '{device_name}' not found in config")
        return None

    now = datetime.now().timestamp()
    if force_reconnect:
        last_reconnect_try_map[device_name] = 0

    last_reconnect_try = last_reconnect_try_map.get(device_name, 0)
    client = modbus_clients.get(device_name)
    status = modbus_status.get(device_name, "error")

    if status == "error" and client and not client.connected and now - last_reconnect_try < RECONNECT_INTERVAL:
       return None


    try:
        if not client or not client.connected:
            last_reconnect_try_map[device_name] = now
            print(f"[get_modbus_client] Attempting to connect to {device_name} at {device['ip']}:{device['port']}")
            
            if device["mode"] == "tcp":
                client = AsyncModbusTcpClient(
                    device["ip"], port=device["port"], timeout=5, retries=3
                )
            elif device["mode"] == "rtu":
                client = AsyncModbusSerialClient(
                    method="rtu",
                    port=device.get("comPort", "COM1"),
                    baudrate=device.get("baudrate", 9600),
                    parity=device.get("parity", "none"),
                    data_bits=device.get("dataBits", 8),
                    stop_bits=device.get("stopBits", 1),
                    timeout=5,
                    retries=3
                )
            else:
                print(f"[get_modbus_client] Unknown mode: {device['mode']} for {device_name}")
                return None
                
            await client.connect()
            print(f"[get_modbus_client] Connection result for {device_name}: {client.connected}")
            modbus_clients[device_name] = client
    except Exception as e:
        print(f"[get_modbus_client] Connection failed for {device_name}: {e}")
        add_system_alert(f" Modbus({device_name}) connection failed: {e}")
        modbus_status[device_name] = "error"
        return None

    modbus_status[device_name] = "connected" if client.connected else "error"
    return client

# ✅ NEW: Regenerate All Modbus Clients
async def regenerate_modbus_clients():
    """ปิด client เดิมและสร้างใหม่ตาม config ล่าสุด"""
    global modbus_clients, modbus_status, last_reconnect_try_map
    
    print("[regenerate_modbus_clients] Regenerating all Modbus clients...")
    
    # ✅ ปิด client เดิมทั้งหมด
    for device_name, client in modbus_clients.items():
        try:
            if client and client.connected:
                await client.close()
                print(f"[regenerate_modbus_clients] Closed client for {device_name}")
        except Exception as e:
            print(f"[regenerate_modbus_clients] Error closing client for {device_name}: {e}")
    
    # ✅ ล้างข้อมูลทั้งหมด
    modbus_clients = {}
    modbus_status = {}
    last_reconnect_try_map = {}
    
    # ✅ สร้าง client ใหม่ตาม config ล่าสุด
    devices = current_config.get("connection", {}).get("devices", [])
    for device in devices:
        device_name = device.get("name")
        if device_name:
            print(f"[regenerate_modbus_clients] Creating new client for {device_name}")
            await get_modbus_client(device_name, force_reconnect=True)
    
    add_system_alert("✅ Regenerated all Modbus clients")
    print(f"[regenerate_modbus_clients] Completed. Active clients: {list(modbus_clients.keys())}")

# ---------------------
# ✅ Apply Formula & Logging
# ---------------------
import struct

def convert_modbus_data(registers: list, data_type: str = "int16", byte_order: str = "Signed") -> float:
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
                return struct.unpack('>f', bytes_data)[0]
            elif byte_order == "Float CD AB":
                bytes_data = struct.pack('>HH', registers[1], registers[0])
                return struct.unpack('>f', bytes_data)[0]
            elif byte_order == "Float BA DC":
                bytes_data = struct.pack('<HH', registers[0], registers[1])
                return struct.unpack('<f', bytes_data)[0]
            elif byte_order == "Float DC BA":
                bytes_data = struct.pack('<HH', registers[1], registers[0])
                return struct.unpack('<f', bytes_data)[0]
            else:
                # Default to AB CD
                bytes_data = struct.pack('>HH', registers[0], registers[1])
                return struct.unpack('>f', bytes_data)[0]
                
        elif data_type == "float64":
            if len(registers) < 4:
                return 0.0
                
            if byte_order == "Float AB CD EF GH":
                bytes_data = struct.pack('>HHHH', registers[0], registers[1], registers[2], registers[3])
                return struct.unpack('>d', bytes_data)[0]
            else:
                # Default to AB CD EF GH
                bytes_data = struct.pack('>HHHH', registers[0], registers[1], registers[2], registers[3])
                return struct.unpack('>d', bytes_data)[0]
        else:
            # Default to int16
            return float(registers[0])
    except Exception as e:
        print(f"[convert_modbus_data] Error converting {data_type} with {byte_order}: {e}")
        return 0.0

def apply_formula(formula: str, value: float) -> float:
    try:
        x = value
        return round(eval(formula), 2)
    except:
        return value

def calculate_corrected_values(gas_data: dict) -> dict:
    """คำนวณ Corrected to 7% O₂ values"""
    corrected = {}
    
    # สูตรการ Correct to 7% O₂: Ccorr = Cmeas × (21 - O2ref) / (21 - O2meas)
    # O2ref = 7%, O2meas = gas_data.get("O2", 0)
    O2ref = 7
    O2meas = gas_data.get("O2", 0)
    
    print(f"[calculate_corrected_values] O2meas = {O2meas}%")
    
    # ตรวจสอบว่า O2meas มีค่าที่ถูกต้อง
    if O2meas > 0 and O2meas < 21:
        correction_factor = (21 - O2ref) / (21 - O2meas)
        print(f"[calculate_corrected_values] Correction factor = {correction_factor:.3f}")
        
        # ✅ เพิ่มการเตือนเมื่อค่า O₂ ผิดปกติ
        if O2meas > 15:
            add_system_alert(f"⚠️ O₂ สูงผิดปกติ: {O2meas}% (ควร < 15%)")
        elif O2meas < 6:
            add_system_alert(f"⚠️ O₂ ต่ำผิดปกติ: {O2meas}% (ควร 6-15%)")
    else:
        correction_factor = 1.0  # ไม่ต้อง correct ถ้า O2 ไม่ถูกต้อง
        if O2meas >= 21:
            add_system_alert(f"❌ O₂ ผิดปกติมาก: {O2meas}% (เกิน 21% - เป็นไปไม่ได้!)")
        else:
            add_system_alert(f"❌ O₂ ผิดปกติ: {O2meas}% (ควร 3-21%)")
        print(f"[calculate_corrected_values] O2 out of range, using factor = 1.0")
    
    # คำนวณ corrected values สำหรับก๊าซที่ต้อง correct
    gases_to_correct = ["SO2", "NOx", "CO", "Dust"]
    
    for gas in gases_to_correct:
        if gas in gas_data and gas_data[gas] is not None:
            original_value = gas_data[gas]
            corrected_value = round(original_value * correction_factor, 2)
            corrected[f"{gas}Corr"] = corrected_value
            print(f"[calculate_corrected_values] {gas}: {original_value} → {corrected_value}")
        else:
            corrected[f"{gas}Corr"] = None
            print(f"[calculate_corrected_values] {gas}: No data")
    
    return corrected

def write_log_to_csv(timestamp: str, gas_values: dict):
    headers = ["Timestamp"] + list(gas_values.keys())
    file_exists = os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(headers)
        writer.writerow([timestamp] + list(gas_values.values()))

# ---------------------
# ✅ Gas Data Fetch (Multi-Device + Logic เดิม)
# ---------------------
async def get_gas_data() -> dict:
    global alarm_values
    data = {}
    print("[get_gas_data] mapping_config:", mapping_config)
    print("[get_gas_data] current_config:", current_config)

    for m in mapping_config:
        device_name = m.get("device")
        print(f"[get_gas_data] reading {m['name']} from {device_name}")
        client = await get_modbus_client(device_name)
        print(f"[get_gas_data] client for {device_name}:", client)
        # ✅ แก้ไขการเข้าถึง devices ให้ตรงกับโครงสร้าง config ใหม่
        devices = current_config.get("connection", {}).get("devices", [])
        # หา device ที่มี name หรือ deviceType ตรงกับ device_name
        device = next((d for d in devices if d.get("name") == device_name or d.get("deviceType", "").replace(" ", "") == device_name), None)
        slave_id = device.get("slaveId", 1) if device else 1

        if not client:
            print(f"[get_gas_data] No client for {device_name}, skipping {m['name']}")
            data[m["name"]] = 0  # กลับมาใช้ 0 แทน None
            continue

        try:
            # Check if address is valid
            if m.get("address") is None:
                print(f"[get_gas_data] {m['name']} has no address, set 0")
                data[m["name"]] = 0
                continue
                
            # Get data type, format and register count from mapping
            data_type = m.get("dataType", "int16")
            data_format = m.get("dataFormat", "Signed")
            byte_order = m.get("byteOrder", "Signed")
            register_count = m.get("registerCount", 1)
            
            # ✅ รองรับ Protocol Addresses (Base 0) และ PLC Addresses (Base 1)
            address_base = m.get("addressBase", 0)  # 0 = Protocol, 1 = PLC
            register_address = m["address"] - address_base  # ลบ 1 ถ้าเป็น PLC Base 1
            res = await client.read_holding_registers(
                address=register_address, count=register_count, slave=slave_id
            )
            print(f"[get_gas_data] res for {m['name']} ({data_format}):", res)
            if not res.isError():
                # Debug: Print raw registers
                print(f"[get_gas_data] {m['name']} raw registers: {res.registers}")
                print(f"[get_gas_data] {m['name']} data_type: {data_type}, byte_order: {byte_order}")
                
                # Convert registers to value based on data type and byte order
                raw_val = convert_modbus_data(res.registers, data_type, byte_order)
                data[m["name"]] = apply_formula(m["formula"], raw_val)
                print(f"[get_gas_data] {m['name']} raw={raw_val}, final={data[m['name']]}")
            else:
                print(f"[get_gas_data] {m['name']} isError, set 0")
                data[m["name"]] = 0
        except Exception as e:
            print(f"[get_gas_data] Exception for {m['name']} ({device_name}):", e)
            add_system_alert(f" get_gas_data({device_name}) error: {e}")
            data[m["name"]] = 0

    # ✅ เพิ่ม Flowrate Auto Calculate
    if "Velocity" in data:
        area = current_config.get("stack_info", {}).get("area", 1.0)
        velocity = data["Velocity"]
        
        # ✅ ตรวจสอบค่าที่สมเหตุสมผล
        if velocity > 50:  # ถ้า Velocity สูงเกินไป
            print(f"[get_gas_data] ⚠️ Velocity สูงผิดปกติ: {velocity} m/s")
            add_system_alert(f"⚠️ Velocity สูงผิดปกติ: {velocity} m/s (ควร < 50 m/s)")
            velocity = min(velocity, 50)  # จำกัดที่ 50 m/s
        
        if area > 100:  # ถ้า Area ใหญ่เกินไป
            print(f"[get_gas_data] ⚠️ Area ใหญ่ผิดปกติ: {area} m²")
            add_system_alert(f"⚠️ Area ใหญ่ผิดปกติ: {area} m² (ควร < 100 m²)")
            area = min(area, 100)  # จำกัดที่ 100 m²
        
        try:
            data["Flowrate"] = round(velocity * area * 3600, 2)
            print(f"[get_gas_data] Flowrate = {data['Flowrate']} m³/h (Velocity: {velocity} m/s, Area: {area} m²)")
            
            # ✅ ตรวจสอบ Flowrate ที่สมเหตุสมผล
            if data["Flowrate"] > 1000000:  # ถ้า Flowrate สูงเกินไป
                print(f"[get_gas_data] ⚠️ Flowrate สูงผิดปกติ: {data['Flowrate']} m³/h")
                add_system_alert(f"⚠️ Flowrate สูงผิดปกติ: {data['Flowrate']} m³/h")
                
        except Exception as e:
            print("[get_gas_data] Flowrate calc error:", e)
            data["Flowrate"] = 0

    # ✅ Threshold Alarm
    threshold = current_config.get("alarm_threshold", {})
    alarm_values[0] = 1 if data.get("SO2", 0) > threshold.get("SO2", 200) else 0
    alarm_values[1] = 1 if data.get("CO", 0) > threshold.get("CO", 100) else 0
    alarm_values[2] = 1 if data.get("Dust", 0) > threshold.get("Dust", 50) else 0
    alarm_values[3] = 1 if any(alarm_values[:3]) else 0

    print("[get_gas_data] return:", data)
    return data

# ✅ ส่วนอื่น ๆ (Blowback, Status, Config, Logs, WebSocket) **คงเดิม**
# (โค้ดเดิมของคุณผมจะไม่ลบ ไม่ตัดเลย แต่จะปรับ ws/status ใช้ get_modbus_client("GasAnalyzer"))
# ---------------------
# ✅ Blowback (คงเดิม)
@app.websocket("/ws/blowback-status")
async def ws_blowback_status(websocket: WebSocket):
    global blowback_status, is_blowback_running
    await websocket.accept()
    try:
        while True:
            if not is_blowback_running:
                client = await get_modbus_client("GasAnalyzer")  # ✅ ใช้ device name
                if client and client.connected:
                    try:
                        result = await client.read_holding_registers(
                            address=106, count=6,
                            slave=next((d["slaveId"] for d in current_config.get("devices", []) if d["name"] == "GasAnalyzer"), 1)
                        )
                        if not result.isError():
                            blowback_status = result.registers
                    except Exception as e:
                        add_system_alert(f" Blowback status read error: {e}")
            await websocket.send_json({
                "type": "blowback_status",
                "values": blowback_status,
                "connection_status": modbus_status.get("GasAnalyzer", modbus_last_status),
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
        client = await get_modbus_client("GasAnalyzer")
        if client and client.connected:
            try:
                # ✅ แก้ไขการเข้าถึง devices ให้ตรงกับโครงสร้าง config ใหม่
                devices = current_config.get("connection", {}).get("devices", [])
                result = await client.write_register(
                    address=105, value=1,
                    slave=next((d["slaveId"] for d in devices if d["name"] == "GasAnalyzer"), 1)
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

# ---------------------
# ✅ WebSockets (Status + Gas)
# ---------------------
@app.websocket("/ws/status")
async def ws_status(websocket: WebSocket):
    global status_values
    await websocket.accept()
    try:
        while True:
            try:
                client = await get_modbus_client("GasAnalyzer")
                if client and client.connected:
                    # ✅ แก้ไขการเข้าถึง devices ให้ตรงกับโครงสร้าง config ใหม่
                    devices = current_config.get("connection", {}).get("devices", [])
                    result = await client.read_holding_registers(
                        address=0, count=15,
                        slave=next((d["slaveId"] for d in devices if d["name"] == "GasAnalyzer"), 1)
                    )
                    if not result.isError():
                        status_values = result.registers
            except Exception as e:
                add_system_alert(f" Modbus status read error: {e}")

            try:
                await websocket.send_json({
                    "type": "status",
                    "values": status_values + alarm_values,
                    "connection_status": modbus_status.get("GasAnalyzer", modbus_last_status),
                    "alerts": system_alerts
                })
            except WebSocketDisconnect:
                add_system_alert(" /ws/status disconnected")
                break  # ✅ ออกจาก while ทันที
            except Exception as e:
                # ✅ FIX: ลด spam log
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
                # ส่งข้อมูลทั้งหมด (รวม 0)
                gas_values = []
                for key in ["SO2", "NOx", "O2", "CO", "Dust", "Temperature", "Velocity", "Flowrate", "Pressure"]:
                    value = gas_data.get(key, 0)  # ใช้ 0 เป็น default
                    gas_values.append(value)
                
                # คำนวณ corrected values
                corrected_values = calculate_corrected_values(gas_data)
                
            except Exception as e:
                print("[ws_gas] error:", e)
                add_system_alert(f" ws_gas error: {e}")
                gas_values = [0] * 9  # กลับมาใช้ 0 แทน None
                corrected_values = {}

            try:
                await websocket.send_json({
                    "type": "all",
                    "gas": gas_values,
                    "SO2Corr": corrected_values.get("SO2Corr"),
                    "NOxCorr": corrected_values.get("NOxCorr"),
                    "COCorr": corrected_values.get("COCorr"),
                    "DustCorr": corrected_values.get("DustCorr"),
                    "connection_status": modbus_status,
                    "alerts": system_alerts
                })
            except WebSocketDisconnect:
                print("[ws_gas] disconnected")
                add_system_alert(" /ws/gas disconnected")
                break  # ✅ ออกจาก while ทันที
            except Exception as e:
                # ✅ FIX: ลด spam log
                if websocket.client_state.name != "DISCONNECTED":
                    print(f"[ws_gas] send error: {e}")
                break
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        add_system_alert(" /ws/gas disconnected")

# ---------------------
# ✅ Config API
# ---------------------
@app.post("/save-config")
async def save_config(data: dict = Body(...)):
    try:
        async with config_lock:  # ✅ ป้องกัน race condition
            # ✅ ถ้าไม่มี stack_info ให้ใส่ค่า default
            if "stack_info" not in data:
                data["stack_info"] = current_config.get("stack_info", {"area": 1.0, "diameter": 1.0})

            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            # ✅ โหลด config ใหม่ทันที
            load_config()
            
            # ✅ Regenerate Modbus clients ใหม่
            await regenerate_modbus_clients()
            
            add_system_alert("✅ Config saved successfully and clients regenerated")
            return {"success": True, "message": "Configuration saved and clients regenerated"}
    except Exception as e:
        add_system_alert(f"❌ save-config error: {e}")
        return {"error": str(e)}

@app.post("/reload-config")
async def reload_config():
    """โหลด config และ mapping ใหม่"""
    try:
        async with config_lock:  # ✅ ป้องกัน race condition
            load_config()
            load_mapping()
            
            # ✅ Regenerate Modbus clients ใหม่
            await regenerate_modbus_clients()
            
            add_system_alert("✅ โหลด config ใหม่เรียบร้อยแล้ว")
            return {"message": "✅ โหลด config ใหม่เรียบร้อยแล้ว"}
    except Exception as e:
        add_system_alert(f"❌ reload-config error: {e}")
        return {"error": str(e)}


@app.get("/get-config")
async def get_config():
    try:
        if not os.path.exists(CONFIG_FILE):
            return {"error": "Config not found"}
        with open(CONFIG_FILE, "r") as f:
            cfg = json.load(f)

        if "stack_info" not in cfg:
            cfg["stack_info"] = {"area": 1.0, "diameter": 1.0}

        return {"success": True, "connection": cfg}
    except Exception as e:
        add_system_alert(f" get-config error: {e}")
        return {"error": str(e)}


@app.post("/save-mapping")
async def save_mapping(data: dict = Body(...)):
    try:
        with open(MAPPING_FILE, "w") as f:
            json.dump(data["mapping"], f, indent=2)
        load_mapping()
        add_system_alert(" Mapping saved successfully and reloaded")
        return {"success": True}
    except Exception as e:
        add_system_alert(f" save-mapping error: {e}")
        return {"error": str(e)}

@app.get("/get-mapping-config")
async def get_mapping_config():
    try:
        if not os.path.exists(MAPPING_FILE):
            default_mapping = [
                {"name": "SO2", "address": 0, "unit": "ppm", "formula": "x"},
                {"name": "NOx", "address": 1, "unit": "ppm", "formula": "x"},
                {"name": "O2", "address": 2, "unit": "%", "formula": "x"},
                {"name": "CO", "address": 3, "unit": "ppm", "formula": "x"},
                {"name": "Dust", "address": 4, "unit": "mg/m³", "formula": "x"},
                {"name": "Temperature", "address": 5, "unit": "°C", "formula": "x"},
                {"name": "Velocity", "address": 6, "unit": "m/s", "formula": "x"},
                {"name": "Flowrate", "address": 7, "unit": "m³/h", "formula": "x"},
                {"name": "Pressure", "address": 8, "unit": "Pa", "formula": "x"}
            ]
            with open(MAPPING_FILE, "w") as f:
                json.dump(default_mapping, f, indent=2)
            return {"success": True, "mapping": default_mapping}
        with open(MAPPING_FILE, "r") as f:
            mapping_data = json.load(f)
        return {"success": True, "mapping": mapping_data}
    except Exception as e:
        add_system_alert(f" get-mapping-config error: {e}")
        return {"error": str(e)}

# ---------------------
# ✅ Logs & Health
# ---------------------
@app.get("/log-preview")
async def log_preview():
    data = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, newline="", encoding="utf-8") as f:
            # ✅ อ่านข้อมูล 10 แถวล่าสุด
            lines = f.readlines()
            if len(lines) > 1:  # มี header และข้อมูล
                # ✅ ใช้ header มาตรฐานสำหรับ CEMS
                standard_headers = ["Timestamp", "SO2", "NOx", "O2", "CO", "Dust", "Temperature", "Velocity", "Flowrate", "Pressure"]
                
                # ✅ อ่านข้อมูล 10 แถวล่าสุด (ไม่รวม header)
                data_lines = lines[-10:] if len(lines) <= 11 else lines[-10:]
                
                for i, line in enumerate(reversed(data_lines), start=1):
                    values = line.strip().split(',')
                    if len(values) >= 10:  # มีข้อมูลครบ
                        row = {
                            "key": i,
                            "Timestamp": values[0],
                            "SO2": float(values[1]) if values[1] and values[1] != '' else 0,
                            "NOx": float(values[2]) if values[2] and values[2] != '' else 0,
                            "O2": float(values[3]) if values[3] and values[3] != '' else 0,
                            "CO": float(values[4]) if values[4] and values[4] != '' else 0,
                            "Dust": float(values[5]) if values[5] and values[5] != '' else 0,
                            "Temperature": float(values[6]) if values[6] and values[6] != '' else 0,
                            "Velocity": float(values[7]) if values[7] and values[7] != '' else 0,
                            "Flowrate": float(values[8]) if values[8] and values[8] != '' else 0,
                            "Pressure": float(values[9]) if values[9] and values[9] != '' else 0,
                        }
                        data.append(row)
    return data

@app.get("/download-logs")
async def download_logs():
    if not os.path.exists(LOG_FILE):
        return {"error": "Log file not found"}
    return FileResponse(LOG_FILE, filename="CEMS_DataLog.csv")

@app.get("/health")
async def health_check():
    return {
        "status": "ok", 
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.1"
    }

# ✅ ดึงค่าการตั้งค่าทั้งหมด (ใหม่)
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

# ✅ บันทึกค่าการตั้งค่า (ใหม่)
@app.put("/config")
async def update_config_endpoint(request: Request):
    try:
        async with config_lock:  # ✅ ป้องกัน race condition
            data = await request.json()
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # ✅ โหลด config ใหม่
            load_config()
            
            # ✅ Regenerate Modbus clients ใหม่
            await regenerate_modbus_clients()
            
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

# ✅ ดึงค่า mapping configuration (ใหม่)
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

# ✅ บันทึกค่า mapping configuration (ใหม่)
@app.put("/mapping")
async def update_mapping_endpoint(request: Request):
    try:
        data = await request.json()
        with open(MAPPING_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # โหลด mapping ใหม่
        load_mapping()
        return {"message": "Mapping updated successfully", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error updating mapping: {str(e)}"}
        )

# ✅ รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น (ใหม่)
@app.post("/reset-config")
async def reset_config_endpoint():
    try:
        async with config_lock:  # ✅ ป้องกัน race condition
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
            
            # ✅ โหลด config และ mapping ใหม่
            load_config()
            load_mapping()
            
            # ✅ Regenerate Modbus clients ใหม่
            await regenerate_modbus_clients()
            
            add_system_alert("✅ Configuration reset to default successfully")
            return {
                "message": "Configuration reset to default successfully",
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        add_system_alert(f"❌ reset-config error: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Error resetting config: {str(e)}"}
        )

# ✅ ตรวจสอบสถานะไฟล์ (ใหม่)
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

# ✅ ดึงข้อมูลตัวอย่าง (สำหรับ demo) (ใหม่)
@app.get("/demo-data")
async def get_demo_data_endpoint():
    import random
    from datetime import datetime, timedelta
    
    # สร้างข้อมูลตัวอย่าง
    base_time = datetime.now()
    data_points = []
    
    for i in range(10):
        timestamp = base_time - timedelta(minutes=i*5)
        data_points.append({
            "timestamp": timestamp.isoformat(),
            "SO2": round(random.uniform(50, 200), 2),
            "NOx": round(random.uniform(100, 500), 2),
            "O2": round(random.uniform(5, 10), 2),
            "CO": round(random.uniform(50, 300), 2),
            "Dust": round(random.uniform(10, 30), 2),
            "Temperature": round(random.uniform(100, 150), 2),
            "Velocity": round(random.uniform(15, 25), 2),
            "Flowrate": round(random.uniform(400000, 600000), 2),
            "Pressure": round(random.uniform(200, 300), 2)
        })
    
    return {
        "data": data_points,
        "count": len(data_points),
        "timestamp": datetime.now().isoformat()
    }

async def logging_task():
    while True:
        try:
            gas_data = await get_gas_data()
            if gas_data:
                now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                write_log_to_csv(now, gas_data)
        except Exception as e:
            add_system_alert(f" Logging error: {e}")
        await asyncio.sleep(LOG_INTERVAL)

@app.post("/api/scan-devices")
async def scan_devices(scan_request: dict = Body(...)):
    """สแกนหาอุปกรณ์ Modbus TCP และ RTU"""
    results = []
    
    try:
        # 🔍 สแกน TCP Devices
        if scan_request.get("scan_tcp", True):
            tcp_ips = scan_request.get("tcp_ips", ["127.0.0.1"])
            tcp_ports = scan_request.get("tcp_ports", None)  # รับ custom ports
            tcp_results = await scan_tcp_devices(tcp_ips, tcp_ports)
            results.extend(tcp_results)
        
        # 🔌 สแกน RTU Devices  
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
    
    # ⚡ ลดจำนวน IP ที่สแกน (ไม่เกิน 20 IP)
    if len(ip_list) > 20:
        ip_list = ip_list[:20]
        print(f"[scan_tcp_devices] Limiting scan to first 20 IPs")
    
    # 🔧 กำหนด ports ที่จะสแกน
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
                
                # 📊 ลองอ่านข้อมูลจากหลาย registers เพื่อระบุชนิดอุปกรณ์
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
    
    # ⚡ ลดจำนวน COM ports ที่สแกน (ไม่เกิน 4 ports)
    if len(com_ports) > 4:
        com_ports = com_ports[:4]
        print(f"[scan_rtu_devices] Limiting scan to first 4 COM ports")
    
    for com_port in com_ports:
        # ⚡ สแกนเฉพาะ baudrate 9600 (มาตรฐาน)
        for baudrate in [9600]:  # ลดจาก [9600, 19200, 38400, 57600, 115200]
            # ⚡ สแกนเฉพาะ parity none (มาตรฐาน)
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
                    
                    # 📊 ลองอ่านข้อมูล
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

# ---------------------
# ✅ Run Server
# ---------------------
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
