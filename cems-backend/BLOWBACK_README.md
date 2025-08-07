# Blowback System Documentation

## Overview
ระบบ Blowback ใช้สำหรับทำความสะอาด sensor โดยการส่งลมแรงดันสูงผ่าน sensor เพื่อกำจัดฝุ่นและสิ่งสกปรก

## Modbus Registers

### Settings Registers (Write)
- **Register 100**: Blowback_Every - ความถี่ในการทำ Blowback (นาที)
- **Register 101**: Blowback_Period - ระยะเวลาการทำ Blowback (นาที)  
- **Register 102**: Blowback_Hold - ระยะเวลารอ (วินาที)
- **Register 103**: Blowback_PulseOn - ระยะเวลาเปิด Pulse (วินาที)
- **Register 104**: Blowback_PulseOff - ระยะเวลาปิด Pulse (วินาที)

### Control Register (Write)
- **Register 105**: Blowback_Trigger - คำสั่งเริ่ม Manual Blowback (1 = เริ่ม)

### Status Registers (Read)
- **Register 106**: Blowback_SamplingSOV - สถานะ Sampling SOV
- **Register 107**: Blowback_SamplingPump - สถานะ Sampling Pump
- **Register 108**: Blowback_BlowbackSOV - สถานะ Blowback SOV
- **Register 109**: Blowback_BlowbackLight - สถานะ Blowback Light
- **Register 110**: Blowback_Running - สถานะการทำงาน Blowback
- **Register 111**: Blowback_HoldValue - สถานะ Hold Value

## API Endpoints

### GET /get-blowback-settings
อ่านค่า Blowback settings จาก Modbus หรือไฟล์

### POST /write-blowback-settings
บันทึกค่า Blowback settings ลงไฟล์และส่งเข้า Modbus

### POST /trigger-manual-blowback
สั่ง Manual Blowback โดยส่งคำสั่งเข้า Modbus

### WebSocket /ws/blowback-status
รับข้อมูลสถานะ Blowback แบบ Real-time

## การใช้งาน

1. **ตั้งค่า Blowback**: กรอกค่าต่างๆ ในหน้า Blowback แล้วกด SAVE
2. **ตรวจสอบสถานะ**: ดูสถานะ Modbus connection และ Blowback status
3. **Manual Blowback**: กดปุ่ม Manual Blowback เพื่อเริ่มทำความสะอาดทันที

## การแก้ไขปัญหา

### ปุ่ม Save ไม่ส่งค่าเข้า Modbus
1. ตรวจสอบ Modbus connection (ต้องแสดง "🟢 Online")
2. ตรวจสอบค่าในช่อง input (ต้องไม่เป็นค่าว่างหรือ 0)
3. ดู error message ใน console ของ browser
4. ตรวจสอบ backend logs

### Modbus Connection Failed
1. ตรวจสอบ IP address และ Port ในหน้า Config
2. ตรวจสอบว่า Modbus device เปิดอยู่
3. ตรวจสอบ network connection
4. ดู error logs ใน backend

## Default Settings
```json
{
  "every": 30,    // ทำ Blowback ทุก 30 นาที
  "period": 5,    // ระยะเวลา 5 นาที
  "hold": 10,     // รอ 10 วินาที
  "pulseOn": 2,   // เปิด Pulse 2 วินาที
  "pulseOff": 3   // ปิด Pulse 3 วินาที
}
``` 