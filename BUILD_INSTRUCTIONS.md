# การ Build Standalone CEMS Application

## ข้อกำหนดเบื้องต้น

### 1. Node.js และ npm
- Node.js version 16 หรือสูงกว่า
- npm version 8 หรือสูงกว่า

### 2. Python
- Python 3.8 หรือสูงกว่า
- pip package manager

### 3. Dependencies
- Windows OS (สำหรับ build Windows app)
- Internet connection (สำหรับดาวน์โหลด dependencies)

## ขั้นตอนการ Build

### วิธีที่ 1: ใช้ Build Script (แนะนำ)

1. **เปิด Command Prompt หรือ PowerShell**
2. **ไปที่โฟลเดอร์โปรเจค**
   ```bash
   cd path\to\ASE_CEMS2
   ```
3. **รัน Build Script**
   ```bash
   build-standalone.bat
   ```

### วิธีที่ 2: Build แบบ Manual

1. **ติดตั้ง Frontend Dependencies**
   ```bash
   cd cems-frontend
   npm install
   ```

2. **ติดตั้ง Backend Dependencies**
   ```bash
   cd ../cems-backend
   pip install -r requirements.txt
   ```

3. **Build Frontend**
   ```bash
   cd ../cems-frontend
   npm run build
   ```

4. **Build Electron App**
   ```bash
   npm run build-standalone
   ```

## ผลลัพธ์

หลังจาก build เสร็จ คุณจะได้ไฟล์ในโฟลเดอร์ `build/`:

- **ASE CEMS Setup 1.0.0.exe** - ไฟล์ติดตั้ง (Installer)
- **win-unpacked/ASE CEMS.exe** - ไฟล์รันโดยตรง (Portable)

## การใช้งาน

### วิธีที่ 1: ติดตั้ง (Installer)
1. Double-click `ASE CEMS Setup 1.0.0.exe`
2. ทำตามขั้นตอนการติดตั้ง
3. รันโปรแกรมจาก Start Menu หรือ Desktop Shortcut

### วิธีที่ 2: รันโดยตรง (Portable)
1. Double-click `win-unpacked/ASE CEMS.exe`
2. โปรแกรมจะรันทันทีโดยไม่ต้องติดตั้ง

## ฟีเจอร์ของ Standalone App

✅ **รวมทั้ง Frontend และ Backend** - ไม่ต้องรัน backend แยก  
✅ **Auto-start Backend** - Backend จะเริ่มต้นอัตโนมัติ  
✅ **Single Executable** - ไฟล์เดียวรันได้เลย  
✅ **No Installation Required** - สามารถรันแบบ portable ได้  
✅ **Cross-platform Ready** - รองรับ Windows, Mac, Linux  

## การแก้ไขปัญหา

### ปัญหา: Build Failed
**สาเหตุ:** Dependencies ไม่ครบ
**วิธีแก้:**
```bash
# ลบ node_modules และติดตั้งใหม่
cd cems-frontend
rmdir /s node_modules
npm install
```

### ปัญหา: Backend ไม่เริ่มต้น
**สาเหตุ:** Python path ไม่ถูกต้อง
**วิธีแก้:**
1. ตรวจสอบว่า Python ติดตั้งแล้ว
2. ตรวจสอบ PATH environment variable
3. รัน `python --version` ใน command prompt

### ปัญหา: Frontend ไม่โหลด
**สาเหตุ:** ไฟล์ build ไม่ครบ
**วิธีแก้:**
```bash
# ลบ dist และ build ใหม่
cd cems-frontend
rmdir /s dist
npm run build
```

### ปัญหา: Electron Build Error
**สาเหตุ:** electron-builder config ไม่ถูกต้อง
**วิธีแก้:**
1. ตรวจสอบไฟล์ `electron-builder.config.js`
2. ตรวจสอบ icon path
3. รัน `npm run build-standalone` อีกครั้ง

## การพัฒนา

### Development Mode
```bash
cd cems-frontend
npm run electron-dev
```

### Production Build
```bash
cd cems-frontend
npm run build-standalone
```

## หมายเหตุ

- Standalone app จะใช้ port 8000 สำหรับ backend
- ตรวจสอบว่า port 8000 ไม่ถูกใช้งานโดยโปรแกรมอื่น
- สำหรับการใช้งานจริง ควรเปลี่ยน IP address ใน config เป็น IP ของเครื่อง 