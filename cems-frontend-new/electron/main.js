const { app, BrowserWindow, Menu, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const fetch = require('node-fetch');

let mainWindow;
let backendProcess;
let isDev = process.env.NODE_ENV === 'development';

// Register custom protocol
app.whenReady().then(() => {
  // Register protocol for loading local files
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6);
    callback({ path: path.normalize(`${__dirname}/../dist/${url}`) });
  });
});

// Backend configuration
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, '../assets/ASEicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    show: false, // Don't show until ready
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Load the app
  if (isDev) {
    // Development mode
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - show local placeholder first, then switch to backend when ready
    try {
      mainWindow.loadURL('app://index.html');
    } catch (e) {
      console.warn('Failed to load local placeholder via app://, fallback to blank', e);
      mainWindow.loadURL('about:blank');
    }
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Wait for backend to start before loading page
    if (!isDev) {
      waitForBackend();
    } else {
      checkBackendStatus();
    }
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Ignore initial failures while backend has not started yet
    if (!isDev && validatedURL && validatedURL.startsWith('http://localhost:8000')) {
      console.log('Backend not ready yet, suppressing initial load error');
      return;
    }
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
    dialog.showErrorBox('Load Error', `Failed to load: ${validatedURL}\nError: ${errorDescription}`);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Logs',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            }).then(result => {
              if (!result.canceled) {
                mainWindow.webContents.send('open-data-file', result.filePaths[0]);
              }
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Backend',
      submenu: [
        {
          label: 'Start Backend',
          click: () => startBackend()
        },
        {
          label: 'Stop Backend',
          click: () => stopBackend()
        },
        {
          label: 'Restart Backend',
          click: () => restartBackend()
        },
        { type: 'separator' },
        {
          label: 'Backend Status',
          click: () => checkBackendStatus()
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ASE CEMS',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ASE CEMS',
              message: 'ASE CEMS Monitoring System',
              detail: 'Version 1.0.0\nContinuous Emission Monitoring System\nDeveloped by ASE Team'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startBackend() {
  if (backendProcess) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Backend Status',
      message: 'Backend is already running'
    });
    return;
  }

  const backendPath = isDev 
    ? path.join(__dirname, '../../cems-backend/main.py')
    : path.join(process.resourcesPath, 'backend.exe');

  console.log('Starting backend with path:', backendPath);

  if (isDev) {
    const pythonPath = 'python';
    backendProcess = spawn(pythonPath, [backendPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../../cems-backend')
    });
  } else {
    backendProcess = spawn(backendPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(backendPath)
    });
  }

  backendProcess.stdout.on('data', (data) => {
    console.log('Backend stdout:', data.toString());
  });

  backendProcess.stderr.on('data', (data) => {
    console.error('Backend stderr:', data.toString());
    // Show error in dialog only for critical errors, not expected Modbus connection issues
    const errorMsg = data.toString();
    const isExpectedError = errorMsg.includes('WinError 1225') || 
                           errorMsg.includes('ConnectionRefusedError') ||
                           errorMsg.includes('Connection refused') ||
                           errorMsg.includes('The remote computer refused');
    
    if ((errorMsg.includes('Error') || errorMsg.includes('Exception')) && !isExpectedError) {
      dialog.showErrorBox('Backend Error', errorMsg);
    }
  });

  backendProcess.on('close', (code) => {
    console.log('Backend process exited with code:', code);
    backendProcess = null;
  });

  backendProcess.on('error', (error) => {
    console.error('Backend process error:', error);
    dialog.showErrorBox('Backend Error', `Failed to start backend: ${error.message}`);
    backendProcess = null;
  });

  // Wait a bit for backend to start
  setTimeout(() => {
    checkBackendStatus();
  }, 2000);
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Backend Status',
      message: 'Backend stopped'
    });
  } else {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Backend Status',
      message: 'Backend is not running'
    });
  }
}

function restartBackend() {
  stopBackend();
  setTimeout(() => {
    startBackend();
  }, 1000);
}

async function waitForBackend() {
  console.log('Waiting for backend to start...');
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds
  
  const checkBackend = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        console.log('Backend is ready! Loading page...');
        mainWindow.loadURL('http://localhost:8000');
        mainWindow.webContents.send('backend-status', { running: true });
        return;
      }
    } catch (error) {
      console.log(`Backend not ready yet (attempt ${attempts + 1}/${maxAttempts}):`, error.message);
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(checkBackend, 1000);
    } else {
      console.error('Backend failed to start after 30 seconds');
      dialog.showErrorBox('Backend Error', 'Backend failed to start. Please restart the application.');
    }
  };
  
  checkBackend();
}

async function checkBackendStatus() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (response.ok) {
      console.log('Backend is running');
      mainWindow.webContents.send('backend-status', { running: true });
    } else {
      console.log('Backend is not responding');
      mainWindow.webContents.send('backend-status', { running: false });
    }
  } catch (error) {
    console.log('Backend is not running:', error.message);
    mainWindow.webContents.send('backend-status', { running: false });
  }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();

  // Start backend automatically
  setTimeout(() => {
    startBackend();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ปิด backend เมื่อปิดโปรแกรม
app.on('window-all-closed', () => {
  console.log('Window closed, stopping backend...');
  stopBackendAndQuit();
});

app.on('before-quit', () => {
  console.log('App is quitting, stopping backend...');
  stopBackendAndQuit();
});

// ปิด backend เมื่อปิดโปรแกรมด้วย Ctrl+C หรือ process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping backend...');
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping backend...');
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// IPC handlers
ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});

ipcMain.handle('check-backend-status', () => {
  return checkBackendStatus();
});

ipcMain.handle('start-backend', () => {
  startBackend();
});

ipcMain.handle('stop-backend', () => {
  stopBackend();
});

// ฟังก์ชันปิด backend และ quit app
function stopBackendAndQuit() {
  if (backendProcess) {
    console.log('Stopping backend process...');
    
    try {
      // ลองปิดแบบ graceful ก่อน
      if (isWindows) {
        backendProcess.kill('SIGTERM');
      } else {
        backendProcess.kill('SIGTERM');
      }
      
      // รอ 3 วินาที (เพิ่มจาก 2 เป็น 3)
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          console.log('Force killing backend process...');
          try {
            // ลองปิดแบบ force
            if (isWindows) {
              // Windows: ใช้ taskkill เพื่อปิด process และ child processes
              const { exec } = require('child_process');
              exec(`taskkill /F /T /PID ${backendProcess.pid}`, (error) => {
                if (error) {
                  console.log('Taskkill failed, trying SIGKILL...');
                  backendProcess.kill('SIGKILL');
                }
                // รอ 1 วินาทีแล้ว quit
                setTimeout(() => {
                  console.log('Quitting app...');
                  app.exit(0);
                }, 1000);
              });
            } else {
              backendProcess.kill('SIGKILL');
              // รอ 1 วินาทีแล้ว quit
              setTimeout(() => {
                console.log('Quitting app...');
                app.exit(0);
              }, 1000);
            }
          } catch (e) {
            console.log('Error killing backend:', e);
            app.exit(0);
          }
        } else {
          console.log('Backend already stopped, quitting app...');
          app.exit(0);
        }
      }, 3000); // เพิ่มจาก 2000 เป็น 3000
    } catch (e) {
      console.log('Error stopping backend:', e);
      app.exit(0);
    }
  } else {
    console.log('No backend process, quitting app...');
    app.exit(0);
  }
}
