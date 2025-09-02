# 🔧 คู่มือการทดสอบ Status & Alarm (int16)

## 📋 **ภาพรวม**
หน้า Status ใหม่ได้รับการปรับปรุงให้อ่านข้อมูลจาก Modbus โดยตรง โดยใช้ **int16** สำหรับ Status & Alarm

## 🎯 **การตั้งค่าที่จำเป็น**

### **1. อุปกรณ์ Modbus**
- **test4** (Port 505): สำหรับ Status Indicators
- **test5** (Port 506): สำหรับ Alarm Signals

### **2. การตั้งค่าใน Modbus Slave**
```
Device: test4 (Status)
- Port: 505
- Registers: 0-14 (15 registers)
- Data Type: int16
- Values: 0 = OFF, 1 = ON

Device: test5 (Alarm)  
- Port: 506
- Registers: 0-3 (4 registers)
- Data Type: int16
- Values: 0 = OFF, 1 = ON
```

## 🧪 **ขั้นตอนการทดสอบ**

### **ขั้นตอนที่ 1: ตั้งค่า Modbus Slave**
1. เปิด Modbus Slave
2. สร้าง 2 devices:
   - **Device 1**: IP 127.0.0.1, Port 505 (test4)
   - **Device 2**: IP 127.0.0.1, Port 506 (test5)

### **ขั้นตอนที่ 2: ตั้งค่า Registers**
```
test4 (Status) - Port 505:
Register 0: Maintenance Mode (0/1)
Register 1: Calibration Through Probe (0/1)
Register 2: Manual Blowback Button (0/1)
Register 3: Analyzer Calibration (0/1)
Register 4: Analyzer Holding Zero (0/1)
Register 5: Analyzer Zero Indicator (0/1)
Register 6: Sampling SOV (0/1)
Register 7: Sampling Pump (0/1)
Register 8: Direct Calibration SOV (0/1)
Register 9: Blowback SOV (0/1)
Register 10: Calibration Through Probe SOV (0/1)
Register 11: Calibration Through Probe Light (0/1)
Register 12: Blowback Light (0/1)
Register 13: Blowback in Operation (0/1)
Register 14: Hold Current Value (0/1)

test5 (Alarm) - Port 506:
Register 0: Temperature Controller Alarm (0/1)
Register 1: Analyzer Malfunction (0/1)
Register 2: Sample Probe Alarm (0/1)
Register 3: Alarm Light (0/1)
```

### **ขั้นตอนที่ 3: ทดสอบการทำงาน**
1. ตั้งค่า register เป็น 0 (OFF)
2. เปลี่ยนเป็น 1 (ON) ทีละตัว
3. ตรวจสอบการแสดงผลในหน้า Status

## 🔍 **การตรวจสอบ**

### **1. ตรวจสอบ Backend**
```bash
cd cems-backend
python main.py
```

### **2. ตรวจสอบ Frontend**
```bash
cd cems-frontend-new
npm run dev
```

### **3. เข้าหน้า Status**
- URL: `http://localhost:5173/#/status`
- ควรเห็นสถานะ "✅ Modbus Connected"
- ข้อมูลจะอัปเดตทุก 2 วินาที

## 🐛 **การแก้ไขปัญหา**

### **ปัญหา: ไม่สามารถเชื่อมต่อได้**
1. ตรวจสอบว่า Modbus Slave ทำงานอยู่
2. ตรวจสอบ Port 505 และ 506
3. ตรวจสอบการตั้งค่าใน `config.json`

### **ปัญหา: ไม่เห็นข้อมูล**
1. ตรวจสอบ mapping ใน `mapping.json`
2. ตรวจสอบว่า register มีค่า 0 หรือ 1
3. ดู console log ใน browser

### **ปัญหา: ข้อมูลไม่ถูกต้อง**
1. ตรวจสอบ Data Type (int16)
2. ตรวจสอบ Data Format (Signed)
3. ตรวจสอบ Address Base (0)

## 📊 **การทดสอบแบบละเอียด**

### **ทดสอบ Status (test4)**
```
1. ตั้งค่า Register 0 = 1 → ควรเห็น "Maintenance Mode: ON"
2. ตั้งค่า Register 1 = 1 → ควรเห็น "Calibration Through Probe: ON"
3. ตั้งค่า Register 2 = 1 → ควรเห็น "Manual Blowback Button: ON"
... (ทำต่อจนครบ 15 registers)
```

### **ทดสอบ Alarm (test5)**
```
1. ตั้งค่า Register 0 = 1 → ควรเห็น "Temperature Controller Alarm: ON"
2. ตั้งค่า Register 1 = 1 → ควรเห็น "Analyzer Malfunction: ON"
3. ตั้งค่า Register 2 = 1 → ควรเห็น "Sample Probe Alarm: ON"
4. ตั้งค่า Register 3 = 1 → ควรเห็น "Alarm Light: ON"
```

## 🎨 **ฟีเจอร์ใหม่**

### **1. การอ่านข้อมูลโดยตรง**
- อ่านจาก Modbus registers โดยตรง
- ไม่ผ่าน WebSocket ที่เชื่อมกับค่าแก๊ส

### **2. การอัปเดตแบบ Real-time**
- อัปเดตข้อมูลทุก 2 วินาที
- แสดงเวลาอัปเดตล่าสุด

### **3. การแจ้งเตือน**
- แจ้งเตือนเมื่อมี Alarm ใหม่
- แสดงสถานะการเชื่อมต่อ Modbus

### **4. การจัดการข้อผิดพลาด**
- แสดงข้อความเมื่อไม่สามารถเชื่อมต่อได้
- แนะนำให้ตรวจสอบการตั้งค่า

## 🔧 **API Endpoints**

### **POST /read-register**
```json
{
  "device": "test4",
  "address": 0,
  "count": 1,
  "dataType": "int16",
  "dataFormat": "Signed"
}
```

### **Response**
```json
{
  "device": "test4",
  "address": 0,
  "count": 1,
  "dataType": "int16",
  "dataFormat": "Signed",
  "rawRegisters": [1],
  "value": 1,
  "timestamp": "2024-01-01T12:00:00"
}
```

## 📝 **หมายเหตุ**
- หน้า Status ใหม่ใช้ REST API แทน WebSocket
- ข้อมูลจะถูกอ่านจาก Modbus registers โดยตรง
- การตั้งค่าต้องตรงกับ mapping.json
- ควรทดสอบทีละ register เพื่อตรวจสอบการทำงาน
- **ใช้ int16 เท่านั้น** สำหรับ Status & Alarm (0 = OFF, 1 = ON)

## 🎯 **การตั้งค่าในหน้า Config**

### **Status & Alarm Configuration:**
- **Data Type:** int16 (16-bit integer) - **ล็อคไว้**
- **Register Count:** 1 (1 register per status) - **ล็อคไว้**
- **Values:** 0 = OFF, 1 = ON
- **Formula:** x (ใช้ค่าดิบโดยตรง) - **ล็อคไว้**
- **Data Format:** Signed หรือ Unsigned

### **ข้อดีของการใช้ int16:**
- ✅ รองรับทุก Modbus system
- ✅ ง่ายต่อการทดสอบ (0 = OFF, 1 = ON)
- ✅ มาตรฐานในอุตสาหกรรม
- ✅ ไม่ซับซ้อนเหมือน float32
