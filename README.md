# CEMS (Continuous Emission Monitoring System)

ระบบติดตามการปล่อยมลพิษต่อเนื่อง พัฒนาด้วย React (Vite) + FastAPI + Electron และบันทึกข้อมูล InfluxDB

## โครงสร้างโปรเจกต์

```
ASE_CEMS2/
├─ cems-frontend-new/           # Frontend (React + Vite + Ant Design)
│  ├─ src/
│  ├─ electron/                 # Electron main process + backend bootstrap
│  └─ package.json
├─ cems-backend/                # Backend (FastAPI)
│  ├─ main.py                   # FastAPI app, WebSockets, REST APIs
│  ├─ database_influx.py        # InfluxDB manager/utilities
│  ├─ dist/                     # Built frontend (served by backend/electron)
│  └─ requirements.txt
├─ electron/                    # Electron (legacy runner)
├─ docker-compose.yml           # InfluxDB stack
├─ README.md                    # เอกสารนี้
├─ BUILD_FIX_README.md          # คู่มือแก้ปัญหา build
├─ BUILD_SUCCESS_SUMMARY.md     # สรุปขั้นตอน build ที่สำเร็จ
├─ CROSS_MACHINE_SETUP.md       # การใช้งานข้ามเครื่อง + Demo mode
├─ MODBUS_SETUP_GUIDE.md        # ตั้งค่า Modbus จริง/จำลอง
├─ MULTI_DATA_TYPE_SUPPORT.md   # รองรับข้อมูลหลายแบบ (int/float/byte order)
└─ cems-backend/INFLUXDB_TROUBLESHOOTING.md
```

## การติดตั้งและรันแบบนักพัฒนา

### 1) Backend (FastAPI)

```bash
cd cems-backend
python -m venv .venv && .venv\Scripts\activate   # Windows PowerShell
pip install -r requirements.txt
python main.py
# หรือ
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend จะพร้อมที่ http://127.0.0.1:8000

### 2) Frontend (React + Vite)

```bash
cd cems-frontend-new
npm install

# ตั้งค่า .env (เชื่อมต่อ backend)
echo VITE_BACKEND_URL=http://127.0.0.1:8000 > .env

# รัน dev server
npm run dev
```

Frontend dev server จะรันบน http://127.0.0.1:5173 (ใช้ HashRouter)

### 3) Electron (ตัวเลือก: dev แบบเดสก์ท็อป)

```bash
cd cems-frontend-new
npm run electron-dev       # เปิด Vite dev + เปิด Electron
```

หมายเหตุ: Electron จะโหลดไฟล์จาก `cems-backend/dist/index.html` เมื่อทำการ build production

## การ Build เป็นแอปเดสก์ท็อป

1) Build backend เป็น executable (หากยังไม่มีใน `cems-backend/dist/backend.exe`)

ดูขั้นตอนที่ทดสอบแล้วใน:
- BUILD_FIX_README.md
- BUILD_SUCCESS_SUMMARY.md

โดยสรุป (ตัวอย่าง):
```bash
cd cems-backend
pyinstaller backend.spec
```

2) Build frontend และจัดแพ็กด้วย Electron Builder

```bash
cd cems-frontend-new
npm run build
npm run dist
```

ผลลัพธ์ไฟล์ติดตั้งจะอยู่ในโฟลเดอร์ `build-webportal/`

## การตั้งค่าแวดล้อมและไฟล์สำคัญ

- Frontend: `cems-frontend-new/.env`
  - `VITE_BACKEND_URL=http://127.0.0.1:8000`
- Backend config: `cems-backend/config.json`
- Mapping: `cems-backend/mapping.json`

สำหรับการใช้งานข้ามเครื่อง/เดโม: ดู `CROSS_MACHINE_SETUP.md`

## Modbus และการรองรับชนิดข้อมูล

- ตั้งค่าอุปกรณ์/ที่อยู่ register ที่ `cems-backend/mapping.json`
- ชนิดข้อมูลและ byte order ดูรายละเอียดที่ `MULTI_DATA_TYPE_SUPPORT.md`
- การเชื่อมต่ออุปกรณ์จริง/จำลอง ดู `MODBUS_SETUP_GUIDE.md`

## InfluxDB (ตัวเลือกสำหรับบันทึก/อ่านข้อมูล)

- ใช้ `docker-compose.yml` ที่ root เพื่อรัน InfluxDB stack
- คู่มือแก้ปัญหา/ตั้งค่า token/org/bucket: `cems-backend/INFLUXDB_TROUBLESHOOTING.md`

## Endpoints ที่ใช้งานจริง (ตาม cems-backend/main.py)

WebSocket:
- `ws://127.0.0.1:8000/ws/gas` – ข้อมูลก๊าซแบบเรียลไทม์
- `ws://127.0.0.1:8000/ws/status` – สถานะระบบ + alarm
- `ws://127.0.0.1:8000/ws/blowback-status` – สถานะ blowback

REST:
- `GET  /health` – สถานะระบบ
- `GET  /log-preview` – ตัวอย่างข้อมูลล่าสุด (fallback หน้า DataLogs)
- `GET  /download-logs` – ดาวน์โหลดข้อมูล CSV (รองรับพารามิเตอร์ช่วงเวลา)
- `GET  /config` / `PUT /config` – อ่าน/อัปเดตการตั้งค่า
- `GET  /mapping` / `PUT /mapping` – อ่าน/อัปเดต mapping
- `POST /reload-config` – โหลดไฟล์ config/mapping ใหม่และรีเซ็ต client
- `POST /reset-config` – รีเซ็ตเป็นค่าเริ่มต้น
- `POST /api/scan-devices` – สแกนหาอุปกรณ์ Modbus TCP/RTU
- `GET  /raw-influxdb` – ดูข้อมูลดิบใน InfluxDB (ตรวจสอบระบบ)

หมายเหตุ: ยังไม่มี `/login` และ `/change-password` ใน backend ณ ตอนนี้ แม้ frontend จะมี UI ที่เรียก endpoint ดังกล่าว

## การใช้งาน Blowback

- คู่มือ: `cems-backend/BLOWBACK_README.md`
- ควบคุมผ่าน `POST /trigger-manual-blowback` และติดตามสถานะผ่าน `/ws/blowback-status`

## Troubleshooting / เอกสารเพิ่มเติม

- Build และการแก้ไขปัญหา: `BUILD_FIX_README.md`, `BUILD_SUCCESS_SUMMARY.md`
- InfluxDB: `cems-backend/INFLUXDB_TROUBLESHOOTING.md`
- ข้ามเครื่อง + Demo Mode: `CROSS_MACHINE_SETUP.md`
- Modbus จริง/จำลอง: `MODBUS_SETUP_GUIDE.md`
- รองรับข้อมูลหลายแบบ: `MULTI_DATA_TYPE_SUPPORT.md`

## หมายเหตุโครงสร้าง UI

- Frontend ใช้ `HashRouter` และมีหน้า:
  - Home, Status, DataLogs, Graph, Blowback, WebPortal, Config, Account
- การป้องกันหน้าใช้งานอิงบทบาทใน `cems-frontend-new/src/App.jsx` (Protected routes)

## เวอร์ชัน

- Backend `/health` แสดงค่า `version` (เช็คในรันไทม์)

---
หากทำตามขั้นตอนในเอกสารนี้และไฟล์อ้างอิงที่แนบไว้ จะสามารถรัน dev, build แอปเดสก์ท็อป, และใช้งานระบบได้ครบถ้วน











