import json
import os
from datetime import datetime
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.client.exceptions import InfluxDBError

# Config file path
CONFIG_FILE = "config.json"

def load_config():
    """โหลด config จากไฟล์"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        return None

def get_influx_config():
    """ดึง InfluxDB config"""
    config = load_config()
    if not config:
        return None
    
    influx_config = config.get('influxdb', {})
    if not influx_config:
        print("❌ No InfluxDB configuration found")
        return None
    
    return {
        'url': influx_config.get('url', 'http://localhost:8086'),
        'token': influx_config.get('token', ''),
        'org': influx_config.get('org', 'CEMS'),
        'bucket': influx_config.get('bucket', 'cems_data')
    }

class InfluxDBManager:
    def __init__(self):
        self.client = None
        self.write_api = None
        self.query_api = None
        self.config = get_influx_config()
        self.connected = False
        
    def connect(self):
        """เชื่อมต่อ InfluxDB"""
        if not self.config:
            print("❌ No InfluxDB configuration")
            return False
            
        try:
            self.client = InfluxDBClient(
                url=self.config['url'],
                token=self.config['token'],
                org=self.config['org']
            )
            
            # ทดสอบการเชื่อมต่อ
            health = self.client.health()
            if health.status == 'pass':
                self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
                self.query_api = self.client.query_api()
                self.connected = True
                print(f"✅ Connected to InfluxDB: {self.config['url']}")
                return True
            else:
                print(f"❌ InfluxDB health check failed: {health.message}")
                return False
                
        except Exception as e:
            print(f"❌ Error connecting to InfluxDB: {e}")
            return False
    
    def disconnect(self):
        """ปิดการเชื่อมต่อ"""
        if self.client:
            self.client.close()
            self.connected = False
            print("🔌 Disconnected from InfluxDB")
    
    def save_sensor_data(self, data):
        """บันทึกข้อมูลเซ็นเซอร์"""
        if not self.connected:
            print("❌ Not connected to InfluxDB")
            return False
            
        try:
            # สร้าง Point สำหรับแต่ละพารามิเตอร์
            points = []
            timestamp = datetime.utcnow()
            
            for key, value in data.items():
                if value is not None and key != 'timestamp':
                    try:
                        float_value = float(value)
                        # ปัดเศษเป็น 1 ตำแหน่งสำหรับการแสดงผล
                        rounded_value = round(float_value, 1)
                        point = Point("sensor_data") \
                            .tag("parameter", key) \
                            .field("value", rounded_value) \
                            .time(timestamp)
                        points.append(point)
                    except (ValueError, TypeError):
                        continue
            
            if points:
                self.write_api.write(
                    bucket=self.config['bucket'],
                    org=self.config['org'],
                    record=points
                )
                print(f"✅ Saved {len(points)} data points to InfluxDB")
                return True
            else:
                print("⚠️ No valid data points to save")
                return False
                
        except Exception as e:
            print(f"❌ Error saving to InfluxDB: {e}")
            return False
    
    def save_system_alert(self, alert_data):
        """บันทึกระบบแจ้งเตือน"""
        if not self.connected:
            return False
            
        try:
            point = Point("system_alerts") \
                .tag("type", alert_data.get('type', 'general')) \
                .field("message", alert_data.get('message', '')) \
                .field("level", alert_data.get('level', 'info')) \
                .time(datetime.utcnow())
            
            self.write_api.write(
                bucket=self.config['bucket'],
                org=self.config['org'],
                record=point
            )
            return True
            
        except Exception as e:
            print(f"❌ Error saving alert to InfluxDB: {e}")
            return False
    
    def get_latest_data(self, parameter=None, limit=1):
        """ดึงข้อมูลล่าสุด"""
        if not self.connected:
            return None
            
        try:
            if parameter:
                query = f'''
                from(bucket: "{self.config['bucket']}")
                    |> range(start: -1h)
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> filter(fn: (r) => r["parameter"] == "{parameter}")
                    |> last()
                '''
            else:
                query = f'''
                from(bucket: "{self.config['bucket']}")
                    |> range(start: -1h)
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> last()
                '''
            
            result = self.query_api.query(query)
            
            if result:
                data = {}
                for table in result:
                    for record in table.records:
                        param = record.get_value()
                        value = record.get_field()
                        data[param] = value
                return data
            return None
            
        except Exception as e:
            print(f"❌ Error querying InfluxDB: {e}")
            return None
    
    def get_system_alerts(self, hours=24):
        """ดึงระบบแจ้งเตือน"""
        if not self.connected:
            return []
            
        try:
            query = f'''
            from(bucket: "{self.config['bucket']}")
                |> range(start: -{hours}h)
                |> filter(fn: (r) => r["_measurement"] == "system_alerts")
                |> sort(columns: ["_time"], desc: true)
                |> limit(n: 100)
            '''
            
            result = self.query_api.query(query)
            alerts = []
            
            for table in result:
                for record in table.records:
                    alerts.append({
                        'time': record.get_time(),
                        'type': record.get_value(),
                        'message': record.get_field(),
                        'level': record.get_field()
                    })
            
            return alerts
            
        except Exception as e:
            print(f"❌ Error querying alerts: {e}")
            return []

# Global instance
influx_manager = InfluxDBManager()

# Functions for main.py
async def init_influx_database():
    """เริ่มต้น InfluxDB"""
    return influx_manager.connect()

async def save_sensor_data_to_influx(data):
    """บันทึกข้อมูลเซ็นเซอร์"""
    return influx_manager.save_sensor_data(data)

async def save_system_alert_to_influx(alert_data):
    """บันทึกระบบแจ้งเตือน"""
    return influx_manager.save_system_alert(alert_data)

async def get_latest_data_from_influx(parameter=None):
    """ดึงข้อมูลล่าสุด"""
    return influx_manager.get_latest_data(parameter)

async def get_system_alerts_from_influx(hours=24):
    """ดึงระบบแจ้งเตือน"""
    return influx_manager.get_system_alerts(hours) 