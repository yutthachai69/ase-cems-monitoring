import subprocess
import sys
import os
import time
import threading
import webbrowser
from pathlib import Path

def run_backend():
    """รัน backend server"""
    try:
        # รัน backend
        backend_process = subprocess.Popen([sys.executable, "main.py"], 
                                         cwd=os.getcwd(),
                                         stdout=subprocess.PIPE,
                                         stderr=subprocess.PIPE)
        print("Backend started successfully")
        return backend_process
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")
        return None

def run_frontend():
    """รัน frontend development server"""
    try:
        # ไปที่ frontend directory
        frontend_dir = Path(__file__).parent.parent / "cems-frontend-new"
        
        # รัน frontend
        frontend_process = subprocess.Popen(["npm", "run", "dev"], 
                                          cwd=frontend_dir,
                                          stdout=subprocess.PIPE,
                                          stderr=subprocess.PIPE)
        print("Frontend started successfully")
        return frontend_process
    except Exception as e:
        print(f"❌ Failed to start frontend: {e}")
        return None

def open_browser():
    """เปิด browser หลังจากรอสักครู่"""
    time.sleep(5)  # รอให้ server เริ่มทำงาน
    try:
        webbrowser.open("http://localhost:5173")
        print("🌐 Browser opened automatically")
    except:
        print("⚠️ Please open browser manually: http://localhost:5173")

def main():
    print("🚀 Starting CEMS Monitoring System...")
    print("=" * 50)
    
    # รัน backend
    backend_process = run_backend()
    if not backend_process:
        print("❌ Cannot start backend. Exiting...")
        return
    
    # รอสักครู่ให้ backend เริ่มทำงาน
    time.sleep(3)
    
    # รัน frontend
    frontend_process = run_frontend()
    if not frontend_process:
        print("❌ Cannot start frontend. Exiting...")
        backend_process.terminate()
        return
    
    # เปิด browser ใน thread แยก
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    print("=" * 50)
    print("🎉 CEMS Monitoring System is running!")
    print("📊 Backend: http://localhost:8000")
    print("🖥️ Frontend: http://localhost:5173")
    print("=" * 50)
    print("Press Ctrl+C to stop all services...")
    
    try:
        # รอให้ผู้ใช้กด Ctrl+C
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping services...")
        
        # หยุด frontend
        if frontend_process:
            frontend_process.terminate()
            print("Frontend stopped")
        
        # หยุด backend
        if backend_process:
            backend_process.terminate()
            print("Backend stopped")
        
        print("👋 Goodbye!")

if __name__ == "__main__":
    main()




