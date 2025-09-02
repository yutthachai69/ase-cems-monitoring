# 🔌 การตั้งค่า Modbus จริงสำหรับ ASE CEMS Monitoring

## 🎯 **เป้าหมาย:**
- ใช้ Modbus จริง ไม่ใช่ Demo Mode
- เชื่อมต่อกับอุปกรณ์ Modbus จริง
- ทำงานได้ข้ามเครื่อง

## 📋 **ขั้นตอนการตั้งค่า:**

### **1. การตั้งค่า IP Address**

#### **สำหรับเครื่องที่มี Modbus Server:**
1. เปิดไฟล์ `cems-backend/config.json`
2. เปลี่ยน IP จาก `0.0.0.0` เป็น IP จริง:
```json
{
  "connection": {
    "devices": [
      {
        "name": "GasAnalyzer",
        "mode": "tcp",
        "ip": "192.168.1.100",  // IP ของ Modbus Server
        "port": 502,
        "slaveId": 1
      }
    ],
    "demo_mode": false,
    "auto_scan_network": true
  }
}
```

#### **สำหรับเครื่องที่ไม่มี Modbus Server:**
- ใช้ **Auto Scan** = ระบบจะสแกนหาอุปกรณ์อัตโนมัติ
- หรือติดตั้ง Modbus Simulator

### **2. การติดตั้ง Modbus Simulator (ถ้าต้องการ)**

#### **ดาวน์โหลด Modbus Simulator:**
- [Modbus Slave Simulator](https://www.modbustools.com/download.html)
- หรือ [QModMaster](https://sourceforge.net/projects/qmodmaster/)

#### **การตั้งค่า Simulator:**
1. เปิด Modbus Simulator
2. ตั้งค่า:
   - **IP**: 0.0.0.0 (รับทุก IP)
   - **Port**: 502
   - **Slave ID**: 1
   - **Register Type**: Holding Registers

3. ตั้งค่าข้อมูลใน Registers:
   - Register 0: SO₂ value
   - Register 1: NOx value
   - Register 2: O₂ value
   - Register 3: CO value
   - Register 4: Dust value
   - Register 5: Temperature
   - Register 6: Velocity
   - Register 7: Pressure

### **3. การตั้งค่า Network**

#### **เปิด Firewall:**
```bash
# Windows Firewall
netsh advfirewall firewall add rule name="Modbus TCP" dir=in action=allow protocol=TCP localport=502
netsh advfirewall firewall add rule name="CEMS Backend" dir=in action=allow protocol=TCP localport=8000
```

#### **ตรวจสอบ Network:**
```bash
# ทดสอบการเชื่อมต่อ
ping 192.168.1.100

# ทดสอบ Modbus Port
telnet 192.168.1.100 502
```

### **4. การตั้งค่า Mapping**

#### **ตรวจสอบไฟล์ `mapping.json`:**
```json
[
  {
    "name": "SO2",
    "device": "GasAnalyzer",
    "address": 0,
    "dataType": "int16",
    "formula": "x"
  },
  {
    "name": "NOx",
    "device": "GasAnalyzer", 
    "address": 1,
    "dataType": "int16",
    "formula": "x"
  }
]
```

### **5. การทดสอบ**

#### **ขั้นตอนการทดสอบ:**
1. เริ่มต้น Modbus Simulator
2. รันโปรแกรม CEMS
3. ตรวจสอบสถานะการเชื่อมต่อ
4. ดูข้อมูลในหน้าจอ Home

#### **สถานะที่ควรเห็น:**
- **สีเขียว**: "เชื่อมต่อกับ Modbus สำเร็จ"
- **ข้อมูลจริง**: ค่าที่อ่านได้จาก Modbus
- **ไม่มีข้อความ Error**

### **6. การแก้ไขปัญหา**

#### **ปัญหาที่พบบ่อย:**

**Q: ไม่สามารถเชื่อมต่อได้**
A: ตรวจสอบ IP, Port, Firewall, และ Modbus Server

**Q: ข้อมูลเป็น 0 ทั้งหมด**
A: ตรวจสอบ Mapping และ Register Address

**Q: Auto Scan ไม่พบอุปกรณ์**
A: ตรวจสอบ Network และ Modbus Server

**Q: Backend Error**
A: ตรวจสอบ Log และ Dependencies

## 🚀 **สรุป:**

### **สำหรับการใช้งานจริง:**
1. **ตั้งค่า IP Modbus** ให้ถูกต้อง
2. **เปิด Firewall** สำหรับ Port 502 และ 8000
3. **ตรวจสอบ Mapping** ให้ตรงกับอุปกรณ์
4. **ทดสอบการเชื่อมต่อ** ก่อนใช้งาน

### **สำหรับการทดสอบ:**
1. **ติดตั้ง Modbus Simulator**
2. **ตั้งค่า Simulator** ให้ตรงกับ Mapping
3. **ทดสอบการเชื่อมต่อ**

---
**📞 หากมีปัญหาเพิ่มเติม กรุณาติดต่อทีมพัฒนา ASE**

