# 🔧 InfluxDB Troubleshooting Guide

## ปัญหาที่พบบ่อยและการแก้ไข

### 1. ❌ ไม่สามารถเชื่อมต่อ InfluxDB ได้

**อาการ:**
```
InfluxDB health check failed: Failed to establish a new connection
```

**วิธีแก้ไข:**

#### 1.1 ตรวจสอบว่า Docker Desktop ทำงานอยู่
```bash
# ตรวจสอบ Docker status
docker --version
docker ps
```

#### 1.2 เริ่ม InfluxDB ด้วย Docker Compose
```bash
# ไปที่โฟลเดอร์โปรเจค
cd /path/to/ASE_CEMS2

# เริ่ม InfluxDB
docker-compose up -d

# ตรวจสอบสถานะ
docker-compose ps
```

#### 1.3 ตรวจสอบ InfluxDB logs
```bash
# ดู logs ของ InfluxDB
docker-compose logs influxdb
```

### 2. ❌ Token ไม่ถูกต้อง

**อาการ:**
```
InfluxDB health check failed: unauthorized
```

**วิธีแก้ไข:**

#### 2.1 เข้าไปที่ InfluxDB UI
- เปิดเบราว์เซอร์ไปที่: http://localhost:8086
- เข้าสู่ระบบด้วย:
  - Username: `admin`
  - Password: `password123`

#### 2.2 สร้าง Token ใหม่
1. ไปที่ **API Tokens** ในเมนูด้านซ้าย
2. คลิก **Generate API Token**
3. เลือก **Custom API Token**
4. ตั้งค่า:
   - **Description**: CEMS Token
   - **Organization**: CEMS
   - **Permissions**: 
     - Read/Write: cems_data bucket
5. คลิก **Save**
6. คัดลอก Token ที่ได้

#### 2.3 อัปเดต Token ในโค้ด
แก้ไขไฟล์ `database_influx.py`:
```python
INFLUX_CONFIG = {
    'url': 'http://localhost:8086',
    'token': 'YOUR_NEW_TOKEN_HERE',  # ใส่ Token ใหม่
    'org': 'CEMS',
    'bucket': 'cems_data'
}
```

### 3. ❌ Organization หรือ Bucket ไม่ถูกต้อง

**อาการ:**
```
InfluxDB health check failed: not found
```

**วิธีแก้ไข:**

#### 3.1 ตรวจสอบ Organization
1. ไปที่ InfluxDB UI: http://localhost:8086
2. ไปที่ **Organizations** ในเมนูด้านซ้าย
3. ตรวจสอบว่ามี Organization ชื่อ "CEMS" หรือไม่

#### 3.2 ตรวจสอบ Bucket
1. ไปที่ **Buckets** ในเมนูด้านซ้าย
2. ตรวจสอบว่ามี Bucket ชื่อ "cems_data" หรือไม่

#### 3.3 สร้าง Organization และ Bucket ใหม่ (ถ้าจำเป็น)
```python
# รัน setup script
python setup_influx.py
```

### 4. ❌ ปัญหา Type Conversion

**อาการ:**
```
Error saving to InfluxDB: can't multiply sequence by non-int of type 'float'
```

**วิธีแก้ไข:**

#### 4.1 ตรวจสอบข้อมูลที่ส่งไป
ข้อมูลที่ส่งไป InfluxDB ต้องเป็น:
- **Numbers**: float, int
- **Strings**: สำหรับ tags
- **Timestamps**: datetime object หรือ string

#### 4.2 ใช้ safe_float function
โค้ดมีการใช้ `safe_float()` function แล้วเพื่อแปลงข้อมูลอย่างปลอดภัย:

```python
def safe_float(value, default=0.0):
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default
```

### 5. ❌ ปัญหา Network/Port

**อาการ:**
```
Connection refused on port 8086
```

**วิธีแก้ไข:**

#### 5.1 ตรวจสอบ Port
```bash
# ตรวจสอบว่า port 8086 ถูกใช้งาน
netstat -an | findstr 8086  # Windows
netstat -an | grep 8086     # Linux/Mac
```

#### 5.2 ตรวจสอบ Firewall
- ตรวจสอบ Windows Firewall
- ตรวจสอบ Antivirus software
- ตรวจสอบ Docker network settings

### 6. 🔧 การทดสอบและตรวจสอบ

#### 6.1 ทดสอบการเชื่อมต่อ
```bash
python test_influx.py
```

#### 6.2 ทดสอบแบบครอบคลุม
```bash
python test_influx_comprehensive.py
```

#### 6.3 ตั้งค่า InfluxDB
```bash
python setup_influx.py
```

### 7. 📊 การตรวจสอบข้อมูล

#### 7.1 ดูข้อมูลใน InfluxDB UI
1. ไปที่ http://localhost:8086
2. ไปที่ **Data Explorer**
3. เลือก Organization: CEMS
4. เลือก Bucket: cems_data
5. ดูข้อมูล sensor_data

#### 7.2 ใช้ Query ใน Data Explorer
```sql
from(bucket: "cems_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "sensor_data")
  |> limit(n: 10)
```

### 8. 🚀 การเริ่มต้นใช้งาน

#### 8.1 เริ่มต้นครั้งแรก
```bash
# 1. เริ่ม Docker Desktop
# 2. รัน InfluxDB
docker-compose up -d

# 3. รอสักครู่ (30-60 วินาที)
# 4. ทดสอบการเชื่อมต่อ
python test_influx.py

# 5. เริ่ม backend
python main.py
```

#### 8.2 ตรวจสอบสถานะ
```bash
# ตรวจสอบ Docker containers
docker-compose ps

# ตรวจสอบ logs
docker-compose logs influxdb

# ทดสอบการเชื่อมต่อ
python setup_influx.py
```

### 9. 📝 หมายเหตุสำคัญ

1. **Token Security**: อย่าแชร์ Token ในโค้ดที่ public
2. **Data Retention**: InfluxDB จะเก็บข้อมูลตาม retention policy
3. **Performance**: ข้อมูลจะถูกเก็บใน memory ก่อนเขียนลง disk
4. **Backup**: ควร backup ข้อมูลเป็นประจำ

### 10. 🆘 ติดต่อขอความช่วยเหลือ

หากยังมีปัญหา:
1. ตรวจสอบ logs ทั้งหมด
2. ใช้ `setup_influx.py` เพื่อตรวจสอบ
3. ตรวจสอบ Docker และ network settings
4. ลอง restart Docker Desktop และ InfluxDB 