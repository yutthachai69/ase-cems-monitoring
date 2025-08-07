# CEMS (Continuous Emission Monitoring System)

ระบบติดตามการปล่อยมลพิษต่อเนื่องแบบครบวงจร พัฒนาด้วย React + FastAPI

## 🚀 การติดตั้งและใช้งาน

### Backend Setup

1. **ติดตั้ง Python Dependencies**
```bash
cd cems-backend
pip install -r requirements.txt
```

2. **รัน Backend Server**
```bash
python main.py
# หรือ
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. **ติดตั้ง Node.js Dependencies**
```bash
cd cems-frontend
npm install
```

2. **สร้างไฟล์ .env**
```bash
# สร้างไฟล์ .env ใน cems-frontend/
VITE_BACKEND_URL=http://127.0.0.1:8000
```

3. **รัน Frontend Development Server**
```bash
npm run dev
```

## 📋 หน้าต่างๆ ในระบบ

### 🏠 Home
- แสดงข้อมูล Gas Values แบบ Real-time
- แสดง Corrected Values (ปรับเทียบที่ 7% O2)
- แสดงสถานะ Alarm และ Threshold
- รองรับการ Refresh ข้อมูล

### 📊 Status
- แสดงสถานะระบบทั้งหมด (15 สถานะ)
- แสดง Alarm Status (4 อาการเตือน)
- เชื่อมต่อผ่าน WebSocket แบบ Real-time
- รองรับ API Mode และ Modbus Mode

### 📄 DataLogs
- แสดงข้อมูล Log ล่าสุด 10 รายการ
- รองรับการ Filter ตามช่วงเวลา
- ดาวน์โหลดไฟล์ CSV
- แสดง Threshold Colors

### 🔄 Blowback
- ตั้งค่า Blowback Parameters
- Manual Blowback Control
- แสดงสถานะ Blowback แบบ Real-time
- ตรวจสอบ Modbus Connection

### ⚙️ Config
- ตั้งค่าการเชื่อมต่อ Modbus/API
- จัดการ Mapping Configuration
- รองรับ TCP, RTU, API Modes
- บันทึกการตั้งค่าลงไฟล์

### 🌐 WebPortal
- Dashboard แบบครบวงจร
- Quick Actions และ System Status
- Data Management และ System Control
- รองรับการดาวน์โหลดหลายรูปแบบ

## 🔧 การตั้งค่า

### Modbus Configuration
```json
{
  "mode": "tcp",
  "ip": "127.0.0.1",
  "port": 1502,
  "slaveId": 1,
  "registerType": "holding"
}
```

### Mapping Configuration
```json
[
  {"name": "SO2", "address": 0, "unit": "ppm", "formula": "x"},
  {"name": "NOx", "address": 1, "unit": "ppm", "formula": "x"},
  {"name": "O2", "address": 2, "unit": "%", "formula": "x/10"},
  {"name": "CO", "address": 3, "unit": "ppm", "formula": "x"},
  {"name": "Dust", "address": 4, "unit": "mg/m³", "formula": "x"},
  {"name": "Temperature", "address": 5, "unit": "°C", "formula": "x/10"},
  {"name": "Velocity", "address": 6, "unit": "m/s", "formula": "x/10"},
  {"name": "Flowrate", "address": 7, "unit": "m³/hr", "formula": "x"},
  {"name": "Pressure", "address": 8, "unit": "Pa", "formula": "x"}
]
```

### Blowback Settings
```json
{
  "every": 30,
  "period": 2,
  "hold": 2,
  "pulseOn": 1,
  "pulseOff": 5
}
```

## 🌐 API Endpoints

### WebSocket Endpoints
- `/ws/gas` - Real-time gas data
- `/ws/status` - System status updates
- `/ws/blowback-status` - Blowback status

### REST API Endpoints
- `GET /health` - Health check
- `GET /get-config` - Get connection config
- `POST /save-config` - Save connection config
- `GET /get-mapping-config` - Get mapping config
- `POST /save-mapping-config` - Save mapping config
- `GET /get-blowback-settings` - Get blowback settings
- `POST /write-blowback-settings` - Save blowback settings
- `POST /trigger-manual-blowback` - Trigger manual blowback
- `GET /log-preview` - Get recent logs
- `GET /download-logs` - Download CSV logs

## 🛠️ เทคโนโลยีที่ใช้

### Frontend
- React 18
- Ant Design 5
- React Router DOM
- Day.js
- Vite

### Backend
- FastAPI
- PyModbus
- WebSockets
- CSV/JSON File I/O

## 📝 หมายเหตุ

1. **Mock Data**: ระบบใช้ Mock Data เมื่อไม่สามารถเชื่อมต่อ Modbus ได้
2. **Auto Reconnect**: WebSocket จะ reconnect อัตโนมัติเมื่อขาดการเชื่อมต่อ
3. **Error Handling**: มีการจัดการ Error และแสดงข้อความแจ้งเตือน
4. **Responsive Design**: รองรับการแสดงผลบนหน้าจอขนาดต่างๆ

## 🔍 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

1. **Frontend แสดง "--" หรือ "NaN"**
   - ตรวจสอบ Backend URL ใน .env
   - ตรวจสอบการเชื่อมต่อ WebSocket

2. **Config Page Error**
   - ตรวจสอบ endpoint `/get-mapping-config`
   - ตรวจสอบ Tabs component (ใช้ AntTabs แทน Tabs)

3. **Blowback ไม่ทำงาน**
   - ตรวจสอบ Modbus Connection
   - ตรวจสอบ Blowback Settings

4. **DataLogs ไม่แสดงข้อมูล**
   - ตรวจสอบไฟล์ CEMS_DataLog.csv
   - ตรวจสอบ endpoint `/log-preview`

## 📞 การติดต่อ

หากมีปัญหาหรือต้องการความช่วยเหลือ กรุณาติดต่อทีมพัฒนา 