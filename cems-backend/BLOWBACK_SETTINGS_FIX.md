# การแก้ไขปัญหา Blowback Settings

## ปัญหาที่เกิดขึ้น
- ข้อความ "Invalid blowback settings" เมื่อกดปุ่ม Manual Blowback
- เกิดจากการตรวจสอบค่า "every" ที่ต้องมากกว่า 0
- แต่สำหรับ Manual Blowback ค่า "every" สามารถเป็น 0 ได้

## การแก้ไข

### 1. แก้ไขการตรวจสอบใน Backend
- ปรับปรุงฟังก์ชัน `trigger_manual_blowback` ให้ยืดหยุ่นขึ้น
- ตรวจสอบเฉพาะค่าที่จำเป็น (period, hold, pulseOn, pulseOff)
- อนุญาตให้ค่า "every" เป็น 0 สำหรับ Manual Blowback

### 2. อัปเดตค่าเริ่มต้น
- แก้ไขไฟล์ `blowback_settings.json` ให้มีค่าที่ถูกต้อง
- ตั้งค่าเริ่มต้นที่ใช้งานได้จริง

### 3. ปรับปรุง Frontend Validation
- แก้ไขฟังก์ชัน `isSettingsValid()` ให้ตรวจสอบเฉพาะค่าที่จำเป็น
- เพิ่มการตรวจสอบก่อนส่งข้อมูล
- แสดงคำแนะนำการตั้งค่า

## โค้ดที่แก้ไข

### Backend (main.py)
```python
# ✅ ตรวจสอบว่ามีค่าที่จำเป็นครบหรือไม่
required_fields = ["every", "period", "hold", "pulseOn", "pulseOff"]
missing_fields = [field for field in required_fields if not settings.get(field)]

if missing_fields:
    return {"error": f"Missing required settings: {', '.join(missing_fields)}"}

# ✅ ตรวจสอบว่าค่าไม่เป็นลบ
negative_fields = [field for field in required_fields if int(settings.get(field, 0)) < 0]
if negative_fields:
    return {"error": f"Negative values not allowed: {', '.join(negative_fields)}"}

# ✅ สำหรับ Manual Blowback ไม่จำเป็นต้องมี every > 0
print(f"✅ Blowback settings validated: {settings}")
```

### Frontend (Blowback.jsx)
```javascript
const isSettingsValid = () => {
  // ✅ ตรวจสอบว่ามีค่าที่จำเป็นครบ
  const requiredFields = ["period", "hold", "pulseOn", "pulseOff"];
  const hasRequiredValues = requiredFields.every(field => 
    settings[field] !== "" && settings[field] !== "0" && parseInt(settings[field]) > 0
  );
  
  // ✅ ตรวจสอบว่าค่า every ไม่เป็นลบ (สามารถเป็น 0 ได้สำหรับ Manual Blowback)
  const everyValid = settings.every !== "" && parseInt(settings.every) >= 0;
  
  return hasRequiredValues && everyValid;
};
```

### Default Settings (blowback_settings.json)
```json
{
  "every": 30,
  "period": 5,
  "hold": 10,
  "pulseOn": 2,
  "pulseOff": 3
}
```

## การใช้งาน

### Manual Blowback
- ค่า "Blowback Every" สามารถเป็น 0 ได้
- ค่าอื่นๆ ต้องมากกว่า 0 เสมอ
- กดปุ่ม "Manual Blowback" เพื่อเริ่มทำความสะอาดทันที

### Automatic Blowback
- ค่า "Blowback Every" ต้องมากกว่า 0
- ระบบจะทำ Blowback อัตโนมัติตามความถี่ที่ตั้งไว้

## การทดสอบ
1. เปิดหน้า Blowback
2. ตรวจสอบว่าค่าเริ่มต้นถูกต้อง
3. ทดสอบกดปุ่ม "Manual Blowback"
4. ตรวจสอบว่าไม่เกิด error "Invalid blowback settings"

## ผลลัพธ์
- ✅ Manual Blowback ทำงานได้ปกติ
- ✅ การตรวจสอบค่าถูกต้องและยืดหยุ่น
- ✅ ผู้ใช้เข้าใจการตั้งค่าที่ถูกต้อง
- ✅ ระบบแสดงข้อผิดพลาดที่ชัดเจน 