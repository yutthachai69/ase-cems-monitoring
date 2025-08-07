# 🚀 การรองรับข้อมูลหลายแบบในระบบ CEMS

## 📋 ภาพรวม

ระบบ CEMS ได้รับการอัปเกรดให้รองรับการรับข้อมูล Modbus หลายแบบ เพื่อความยืดหยุ่นในการใช้งานกับอุปกรณ์ต่างๆ

## 🔧 ประเภทข้อมูลที่รองรับ

### 1. **16-bit Integer** (ค่าเริ่มต้น)
- **Registers:** 1 register
- **ช่วงค่า:** 0 - 65,535
- **การใช้งาน:** เหมาะสำหรับค่าที่ไม่ต้องการความแม่นยำสูง
- **ตัวอย่าง:** สถานะ ON/OFF, ค่าจำนวนเต็ม

### 2. **32-bit Integer**
- **Registers:** 2 registers
- **ช่วงค่า:** -2,147,483,648 ถึง 2,147,483,647
- **การใช้งาน:** สำหรับค่าจำนวนเต็มขนาดใหญ่
- **ตัวอย่าง:** จำนวนนับ, ค่าที่ต้องการช่วงกว้าง

### 3. **32-bit Float (IEEE 754)**
- **Registers:** 2 registers (AB CD)
- **รูปแบบ:** IEEE 754 Big-endian
- **การใช้งาน:** สำหรับค่าทศนิยมที่ต้องการความแม่นยำ
- **ตัวอย่าง:** อุณหภูมิ, ความดัน, ความเข้มข้น

### 4. **64-bit Float (IEEE 754)**
- **Registers:** 4 registers (AB CD EF GH)
- **รูปแบบ:** IEEE 754 Big-endian
- **การใช้งาน:** สำหรับค่าที่ต้องการความแม่นยำสูงมาก
- **ตัวอย่าง:** การวัดที่ต้องการความแม่นยำระดับสูง

## 🎯 การตั้งค่าในหน้า Config

### ขั้นตอนการตั้งค่า

1. **เปิดหน้า Config**
2. **ไปที่แท็บ "Mapping Configuration"**
3. **เลือก "Data Type"** สำหรับแต่ละ parameter:
   - 16-bit Integer
   - 32-bit Integer
   - 32-bit Float (IEEE 754)
   - 64-bit Float (IEEE 754)

### การตั้งค่าอัตโนมัติ

- **Register Count** จะถูกตั้งค่าอัตโนมัติตาม Data Type
- **Formula** จะถูกตั้งค่าเริ่มต้นเป็น "x" สำหรับ float types

## 📊 ตัวอย่างการตั้งค่า

### ตัวอย่างที่ 1: 16-bit Integer (แบบเดิม)
```json
{
  "name": "SO2",
  "address": 0,
  "unit": "ppm",
  "formula": "x",
  "device": "GasAnalyzer",
  "dataType": "int16",
  "registerCount": 1
}
```

### ตัวอย่างที่ 2: 32-bit Float (AB CD)
```json
{
  "name": "Temperature",
  "address": 10,
  "unit": "°C",
  "formula": "x",
  "device": "GasAnalyzer",
  "dataType": "float32",
  "registerCount": 2
}
```

### ตัวอย่างที่ 3: 64-bit Float (AB CD EF GH)
```json
{
  "name": "PreciseFlow",
  "address": 20,
  "unit": "m³/h",
  "formula": "x",
  "device": "FlowAnalyzer",
  "dataType": "float64",
  "registerCount": 4
}
```

## 🔄 Preset Configurations

### Float AB CD Mode
- **คำอธิบาย:** การตั้งค่าสำหรับอุปกรณ์ที่ใช้ 32-bit Float
- **Address Pattern:** 0, 2, 4, 6, 8, 10 (เว้น 1 register ระหว่าง parameters)
- **Data Type:** float32
- **Register Count:** 2

### การใช้งาน Preset
1. เปิดหน้า Config
2. กดปุ่ม **📋 Load Preset**
3. เลือก **"Float AB CD Mode"**
4. ตรวจสอบการตั้งค่าและกด **Save**

## ⚙️ การทำงานของ Backend

### ฟังก์ชัน convert_modbus_data()
```python
def convert_modbus_data(registers: list, data_type: str = "int16") -> float:
    if data_type == "int16":
        return float(registers[0])
    elif data_type == "int32":
        value = (registers[0] << 16) | registers[1]
        if value > 0x7FFFFFFF:
            value = value - 0x100000000
        return float(value)
    elif data_type == "float32":
        packed = struct.pack('>HH', registers[0], registers[1])
        return struct.unpack('>f', packed)[0]
    elif data_type == "float64":
        packed = struct.pack('>HHHH', registers[0], registers[1], registers[2], registers[3])
        return struct.unpack('>d', packed)[0]
```

### การอ่านข้อมูล
```python
# อ่านตามจำนวน registers ที่กำหนด
res = await client.read_holding_registers(
    address=m["address"], 
    count=register_count, 
    slave=slave_id
)

# แปลงข้อมูลตาม data type
raw_val = convert_modbus_data(res.registers, data_type)
```

## 🎨 การแสดงผลในหน้า Config

### คอลัมน์ใหม่
- **Data Type:** Dropdown เลือกประเภทข้อมูล
- **Registers:** แสดงจำนวน registers (อัตโนมัติ)

### การอัปเดตอัตโนมัติ
- เมื่อเลือก Data Type → Register Count จะอัปเดตอัตโนมัติ
- Formula จะถูกตั้งค่าเริ่มต้นสำหรับ float types

## 🔍 การแก้ไขปัญหา

### ปัญหา: ค่าที่อ่านได้ไม่ถูกต้อง
**สาเหตุ:** Data Type ไม่ตรงกับอุปกรณ์
**วิธีแก้:**
1. ตรวจสอบ Data Sheet ของอุปกรณ์
2. เปลี่ยน Data Type ให้ตรงกับอุปกรณ์
3. ตรวจสอบ Address และ Register Count

### ปัญหา: Error แปลงข้อมูล
**สาเหตุ:** จำนวน registers ไม่พอ
**วิธีแก้:**
1. ตรวจสอบ Register Count
2. ตรวจสอบ Address ที่ไม่ซ้อนทับกัน
3. ดู error log ใน backend

### ปัญหา: ค่าลบแสดงผิด
**สาเหตุ:** การแปลง 32-bit integer ไม่ถูกต้อง
**วิธีแก้:**
1. ตรวจสอบว่าใช้ int32 สำหรับค่าลบ
2. ตรวจสอบการแปลง two's complement

## 📝 หมายเหตุสำคัญ

1. **Address Planning:** ต้องวางแผน address ให้ไม่ซ้อนทับกัน
2. **Performance:** การอ่านหลาย registers จะช้ากว่า
3. **Compatibility:** ระบบเก่ายังใช้งานได้ปกติ (default เป็น int16)
4. **Testing:** ทดสอบกับอุปกรณ์จริงก่อนใช้งาน

## 🚀 การพัฒนาต่อ

- รองรับ Little-endian format
- รองรับ Data Type อื่นๆ (string, boolean)
- เพิ่ม Preset Configurations อื่นๆ
- ปรับปรุง UI/UX ให้ใช้งานง่ายขึ้น

---

**🎉 ระบบพร้อมรองรับการรับข้อมูลหลายแบบแล้ว!** 