# 📋 คู่มือการตั้งค่า Status & Alarm

## 🎯 **เป้าหมาย**
ตั้งค่าให้หน้า Status แสดงข้อมูล Status & Alarm จาก Modbus ได้

## 🔧 **การตั้งค่าที่จำเป็น**

### **1. Modbus Slave Setup**

#### **Status Device (test4) - Port 505**
```
Device Name: test4
IP: 127.0.0.1
Port: 505
Slave ID: 1
Register Type: Holding Registers
```

#### **Alarm Device (test5) - Port 506**
```
Device Name: test5
IP: 127.0.0.1
Port: 506
Slave ID: 1
Register Type: Holding Registers
```

### **2. Register Values**

#### **Status Registers (test4) - Address 0-14**
| Address | Name | Value | Description |
|---------|------|-------|-------------|
| 0 | Maintenance Mode | 0/1 | โหมดบำรุงรักษา |
| 1 | Calibration Through Probe | 0/1 | การสอบเทียบผ่าน probe |
| 2 | Manual Blowback Button | 0/1 | ปุ่ม blowback แบบมือ |
| 3 | Analyzer Calibration | 0/1 | การสอบเทียบเครื่องวิเคราะห์ |
| 4 | Analyzer Holding Zero | 0/1 | เครื่องวิเคราะห์ถือค่า zero |
| 5 | Analyzer Zero Indicator | 0/1 | ตัวบ่งชี้ zero ของเครื่องวิเคราะห์ |
| 6 | Sampling SOV | 0/1 | Solenoid valve สำหรับการสุ่มตัวอย่าง |
| 7 | Sampling Pump | 0/1 | ปั๊มสุ่มตัวอย่าง |
| 8 | Direct Calibration SOV | 0/1 | Solenoid valve สำหรับการสอบเทียบโดยตรง |
| 9 | Blowback SOV | 0/1 | Solenoid valve สำหรับ blowback |
| 10 | Calibration Through Probe SOV | 0/1 | Solenoid valve สำหรับการสอบเทียบผ่าน probe |
| 11 | Calibration Through Probe Light | 0/1 | ไฟแสดงการสอบเทียบผ่าน probe |
| 12 | Blowback Light | 0/1 | ไฟแสดง blowback |
| 13 | Blowback in Operation | 0/1 | Blowback กำลังทำงาน |
| 14 | Hold Current Value | 0/1 | ถือค่าปัจจุบัน |

#### **Alarm Registers (test5) - Address 0-3**
| Address | Name | Value | Description |
|---------|------|-------|-------------|
| 0 | Temperature Controller Alarm | 0/1 | แจ้งเตือนตัวควบคุมอุณหภูมิ |
| 1 | Analyzer Malfunction | 0/1 | เครื่องวิเคราะห์ทำงานผิดปกติ |
| 2 | Sample Probe Alarm | 0/1 | แจ้งเตือน probe สุ่มตัวอย่าง |
| 3 | Alarm Light | 0/1 | ไฟแจ้งเตือน |

### **3. การทดสอบ**

#### **ขั้นตอนที่ 1: เปิด Modbus Slave**
1. เปิด Modbus Slave Simulator
2. สร้าง 2 instances:
   - **Instance 1**: Port 505 (test4 - Status)
   - **Instance 2**: Port 506 (test5 - Alarm)

#### **ขั้นตอนที่ 2: ตั้งค่า Registers**
1. **test4 (Status)**: ตั้งค่า Address 0-14 เป็น 0 หรือ 1
2. **test5 (Alarm)**: ตั้งค่า Address 0-3 เป็น 0 หรือ 1

#### **ขั้นตอนที่ 3: ทดสอบการเชื่อมต่อ**
1. เปิดหน้า Status ในเว็บ
2. ตรวจสอบว่าแสดง "✅ Modbus Connected"
3. เปลี่ยนค่าใน Modbus Slave และดูการอัปเดต

## 🚨 **การแก้ไขปัญหา**

### **ปัญหา: เชื่อมต่อไม่ได้**
**สาเหตุ:** Port ไม่ตรงกัน
**แก้ไข:** ตรวจสอบ Port 505 และ 506 ใน Modbus Slave

### **ปัญหา: ข้อมูลไม่แสดง**
**สาเหตุ:** Register Address ไม่ตรงกัน
**แก้ไข:** ตรวจสอบ Address 0-14 สำหรับ Status และ 0-3 สำหรับ Alarm

### **ปัญหา: ข้อมูลไม่อัปเดต**
**สาเหตุ:** WebSocket ไม่ทำงาน
**แก้ไข:** ตรวจสอบ backend ว่าทำงานอยู่

## 📊 **การตรวจสอบ**

### **Backend Logs**
```bash
cd cems-backend
python main.py
```

ดู log:
- `[get_status_data]` - การอ่านข้อมูล Status & Alarm
- `[ws_status]` - WebSocket Status

### **Frontend Console**
เปิด Developer Tools และดู:
- WebSocket connection
- Data updates

## ✅ **การยืนยันการทำงาน**

1. **✅ Modbus Connected** - แสดงในหน้า Status
2. **✅ ข้อมูลอัปเดต** - เปลี่ยนค่าใน Modbus Slave แล้วเห็นการเปลี่ยนแปลง
3. **✅ ไม่มี Error** - ไม่มี error ใน console

## 🔄 **การทำงานของระบบ**

```
Modbus Slave (test4:505, test5:506)
    ↓
Backend (get_status_data)
    ↓
WebSocket (/ws/status)
    ↓
Frontend (Status.jsx)
    ↓
แสดงผลในหน้า Status
```

## 📝 **หมายเหตุ**

- **Data Type**: int16 (0 หรือ 1)
- **Update Frequency**: ทุก 2 วินาที (WebSocket)
- **Connection**: TCP/IP
- **Slave ID**: 1 (ทั้ง test4 และ test5)









