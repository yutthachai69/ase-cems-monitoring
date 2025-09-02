# 🌐 การใช้งาน ASE CEMS Monitoring ข้ามเครื่อง

## 📋 **ปัญหาที่พบ:**
เมื่อส่งโปรแกรมไปเครื่องอื่น ข้อมูลแสดงไม่ถูกต้อง:
- ค่าก๊าซสูงผิดปกติ (16,000+ ppm)
- ไม่มีการเชื่อมต่อ Modbus
- หน้าจอ Config แสดง "No data"

## ✅ **วิธีแก้ไข:**

### **1. การตั้งค่า Demo Mode (แนะนำสำหรับการทดสอบ)**

#### **เปิด Demo Mode:**
1. เปิดไฟล์ `cems-backend/config.json`
2. ตั้งค่า:
```json
{
  "connection": {
    "demo_mode": true,
    "demo_data_realistic": true
  }
}
```

#### **ผลลัพธ์:**
- ✅ ข้อมูลสมจริงมากขึ้น (SO₂: 20-80 ppm, NOx: 40-120 ppm)
- ✅ ไม่ต้องเชื่อมต่อ Modbus จริง
- ✅ ทำงานได้ทุกเครื่อง

### **2. การตั้งค่า Modbus สำหรับเครื่องปลายทาง**

#### **สำหรับเครื่องที่มี Modbus Server:**
1. เปลี่ยน IP ใน `config.json`:
```json
{
  "connection": {
    "devices": [
      {
        "name": "GasAnalyzer",
        "mode": "tcp",
        "ip": "192.168.1.100",  // IP ของเครื่องที่มี Modbus
        "port": 502,
        "slaveId": 1
      }
    ]
  }
}
```

#### **สำหรับเครื่องที่ไม่มี Modbus:**
- ใช้ **Demo Mode** (แนะนำ)
- หรือติดตั้ง Modbus Simulator

### **3. การตั้งค่า Network**

#### **เปิด Firewall:**
- Windows Firewall → Allow ASE CEMS Monitoring
- Port 8000 (Backend API)
- Port 502 (Modbus TCP)

#### **ตรวจสอบ Network:**
```bash
ping 192.168.1.100  # IP ของ Modbus Server
telnet 192.168.1.100 502  # ทดสอบ Modbus Port
```

### **4. การใช้งาน**

#### **รันโปรแกรม:**
1. ดับเบิลคลิก `ASE CEMS Monitoring.exe`
2. รอให้ Backend เริ่มต้น (ประมาณ 10-15 วินาที)
3. ตรวจสอบสถานะการเชื่อมต่อ

#### **ตรวจสอบสถานะ:**
- **สีเขียว**: "เชื่อมต่อกับ Modbus สำเร็จ"
- **สีเหลือง**: "Demo Mode" (ใช้ข้อมูลจำลอง)
- **สีแดง**: "ไม่สามารถเชื่อมต่อได้"

### **5. การแก้ไขปัญหา**

#### **ปัญหาที่พบบ่อย:**

**Q: ข้อมูลยังสูงผิดปกติ**
A: ตรวจสอบ `demo_data_realistic: true` ใน config.json

**Q: ไม่มีการเชื่อมต่อ Modbus**
A: ตรวจสอบ IP, Port, และ Firewall

**Q: Backend ไม่เริ่มต้น**
A: ตรวจสอบ Python และ dependencies

**Q: หน้าจอ Config แสดง "No data"**
A: ใช้ Demo Mode หรือตั้งค่า Modbus ให้ถูกต้อง

## 🚀 **สรุป:**

### **สำหรับการทดสอบ:**
- ใช้ **Demo Mode** = ข้อมูลสมจริง + ไม่ต้องตั้งค่า Modbus

### **สำหรับการใช้งานจริง:**
- ตั้งค่า IP Modbus ให้ถูกต้อง
- ตรวจสอบ Network และ Firewall
- ทดสอบการเชื่อมต่อก่อนใช้งาน

### **ไฟล์ที่สำคัญ:**
- `cems-backend/config.json` - การตั้งค่าหลัก
- `cems-backend/mapping.json` - การแมปข้อมูล Modbus
- `build/win-unpacked/` - โฟลเดอร์โปรแกรม

---
**📞 หากมีปัญหาเพิ่มเติม กรุณาติดต่อทีมพัฒนา ASE**

