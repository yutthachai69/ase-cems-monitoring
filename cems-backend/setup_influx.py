#!/usr/bin/env python3
"""
Script สำหรับตั้งค่า InfluxDB สำหรับ CEMS
"""

import json
import requests

def setup_influxdb():
    """ตั้งค่า InfluxDB"""
    
    # InfluxDB configuration
    url = "http://localhost:8086"
    username = "admin"
    password = "admin123456"
    org_name = "CEMS"
    bucket_name = "cems_data"
    
    try:
        print("🔗 เชื่อมต่อ InfluxDB...")
        
        # ทดสอบการเชื่อมต่อ
        health_response = requests.get(f"{url}/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ InfluxDB ไม่ตอบสนอง")
            return False
        
        print("✅ InfluxDB เชื่อมต่อได้")
        
        # ใช้ token ที่มีอยู่แล้ว
        token = "cems-admin-token-123456"
        
        print("✅ ใช้ token ที่มีอยู่แล้ว!")
        print(f"📋 Organization: {org_name}")
        print(f"🪣 Bucket: {bucket_name}")
        print(f"🔑 Token: {token}")
        
        # อัปเดต config.json
        update_config(token, org_name, bucket_name)
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up InfluxDB: {e}")
        return False

def update_config(token, org, bucket):
    """อัปเดต config.json"""
    try:
        config_file = "config.json"
        
        # อ่าน config ปัจจุบัน
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # อัปเดต InfluxDB config
        config['influxdb'] = {
            "url": "http://localhost:8086",
            "token": token,
            "org": org,
            "bucket": bucket
        }
        
        # บันทึก config
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print("✅ อัปเดต config.json สำเร็จ!")
        
    except Exception as e:
        print(f"❌ Error updating config: {e}")

def test_connection():
    """ทดสอบการเชื่อมต่อ"""
    try:
        config_file = "config.json"
        
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        influx_config = config.get('influxdb', {})
        if not influx_config:
            print("❌ No InfluxDB configuration found")
            return False
        
        # ทดสอบการเชื่อมต่อด้วย requests
        headers = {
            'Authorization': f'Token {influx_config["token"]}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(f"{influx_config['url']}/health", headers=headers, timeout=5)
        
        if response.status_code == 200:
            print("✅ InfluxDB connection test successful!")
            return True
        else:
            print(f"❌ InfluxDB health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 CEMS InfluxDB Setup")
    print("=" * 50)
    
    # ตรวจสอบว่า InfluxDB ทำงานอยู่หรือไม่
    try:
        response = requests.get("http://localhost:8086/health", timeout=5)
        if response.status_code == 200:
            print("✅ InfluxDB is running")
        else:
            print("❌ InfluxDB is not responding")
            exit(1)
    except:
        print("❌ Cannot connect to InfluxDB. Please make sure it's running on localhost:8086")
        print("💡 Start with: docker run -d --name cems_influxdb -p 8086:8086 -e DOCKER_INFLUXDB_INIT_MODE=setup -e DOCKER_INFLUXDB_INIT_USERNAME=admin -e DOCKER_INFLUXDB_INIT_PASSWORD=admin123456 -e DOCKER_INFLUXDB_INIT_ORG=CEMS -e DOCKER_INFLUXDB_INIT_BUCKET=cems_data -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=cems-admin-token-123456 influxdb:2.7")
        exit(1)
    
    # ตั้งค่า InfluxDB
    if setup_influxdb():
        print("\n🧪 ทดสอบการเชื่อมต่อ...")
        test_connection()
        
        print("\n🎉 Setup completed!")
        print("📝 You can now run: python main.py")
    else:
        print("\n❌ Setup failed!") 