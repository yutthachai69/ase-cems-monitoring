const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  // โหลด frontend ที่ถูก build แล้ว
  win.loadFile(path.join(__dirname, '../cems-backend/dist/index.html'));
}

// เรียก backend FastAPI ผ่าน run_all.bat
function runBackend() {
  exec('start run_all.bat', (err, stdout, stderr) => {
    if (err) {
      console.error(`❌ Failed to run backend: ${err}`);
      return;
    }
    console.log(`✅ Backend started`);
  });
}

app.whenReady().then(() => {
  runBackend();      // ← รัน backend
  createWindow();    // ← เปิดหน้าต่าง
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
