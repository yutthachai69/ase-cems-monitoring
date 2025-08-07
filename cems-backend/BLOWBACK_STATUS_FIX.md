# การแก้ไขปัญหา Blowback Status ไม่แสดงการเปลี่ยนแปลง

## ปัญหาที่เกิดขึ้น
- กดปุ่ม Manual Blowback แล้วแจ้งเตือนสำเร็จ
- แต่ Blowback Status ทั้งหมดยังแสดง OFF
- ไม่เห็นการเปลี่ยนแปลงสถานะตามลำดับการทำงาน

## สาเหตุของปัญหา
1. **Mock sequence สั้นเกินไป**: จำลองแค่ 3 วินาที
2. **WebSocket เขียนทับ**: อ่านจาก Modbus ทุก 2 วินาที เขียนทับสถานะที่จำลอง
3. **ไม่มีการจำลองลำดับการทำงาน**: ไม่แสดง Hold phase และ Blowback phase

## การแก้ไข

### 1. ปรับปรุง Mock Sequence
```python
# ✅ Simulate blowback sequence with proper timing
settings = json.load(open(BLOWBACK_SETTINGS_FILE, "r"))
hold_time = int(settings.get("hold", 2))
period_time = int(settings.get("period", 2))

# ✅ Hold phase
print(f"⏳ Hold phase for {hold_time} seconds")
blowback_status = [0, 0, 0, 0, 0, 1]  # Hold Value ON
await asyncio.sleep(hold_time)

# ✅ Blowback phase
print(f"🚀 Blowback phase for {period_time} minutes")
blowback_status = [0, 0, 1, 1, 1, 0]  # Blowback SOV, Light, Running ON

# ✅ Simulate for shorter time for testing (30 seconds instead of full period)
test_duration = min(30, period_time * 60)  # Max 30 seconds for testing
await asyncio.sleep(test_duration)

# ✅ End blowback
blowback_status = [0, 0, 0, 0, 0, 0]  # All OFF
```

### 2. ป้องกัน WebSocket เขียนทับ
```python
# ✅ Only read from Modbus if not in mock sequence
if not is_blowback_running:
    # Read from Modbus
else:
    print(f"🔄 Using mock blowback status: {blowback_status}")
```

### 3. ปรับปรุง Frontend Display
- เพิ่มการแสดงสถานะที่ชัดเจนขึ้น
- เพิ่ม Status Summary เมื่อ Blowback กำลังทำงาน
- แสดงสีและน้ำหนักตัวอักษรที่แตกต่างกัน

## ลำดับการทำงานที่ควรเห็น

### Phase 1: Hold (รอ)
```
Hold Value: ON
Blowback Running: OFF
Blowback SOV: OFF
Blowback Light: OFF
```

### Phase 2: Blowback (ทำงาน)
```
Hold Value: OFF
Blowback Running: ON
Blowback SOV: ON
Blowback Light: ON
```

### Phase 3: End (จบ)
```
Hold Value: OFF
Blowback Running: OFF
Blowback SOV: OFF
Blowback Light: OFF
```

## การทดสอบ
1. เปิดหน้า Blowback
2. กดปุ่ม "Manual Blowback"
3. ดูการเปลี่ยนแปลงใน Blowback Status:
   - Hold Value เปลี่ยนเป็น ON (2 วินาที)
   - Blowback Running, SOV, Light เปลี่ยนเป็น ON (30 วินาที)
   - ทั้งหมดกลับเป็น OFF

## ผลลัพธ์
- ✅ Blowback Status แสดงการเปลี่ยนแปลงตามลำดับ
- ✅ เห็นการทำงานของ Hold phase และ Blowback phase
- ✅ Status Summary แสดงเมื่อ Blowback กำลังทำงาน
- ✅ การจำลองใช้เวลาที่เหมาะสมสำหรับการทดสอบ 