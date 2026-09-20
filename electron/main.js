const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;
let serverProcess;

const PORT = parseInt(process.env.PORT, 10) || 5050;
const SERVER_URL = `http://localhost:${PORT}`;

function waitForServer(url, maxAttempts = 60, interval = 1000) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          resolve();
        }
      });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Advocate DigiDiary',
    icon: path.join(__dirname, '..', 'public', 'img', 'logo.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function startServer() {
  return new Promise((resolve) => {
    const { fork } = require('child_process');
    serverProcess = fork(path.join(__dirname, '..', 'server', 'server.js'), {
      cwd: path.join(__dirname, '..'),
      silent: true,
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server] ${output.trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[Server] Failed to start:', err);
      resolve();
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Server] Exited with code ${code}`);
      if (mainWindow) mainWindow.close();
    });

    resolve();
  });
}

app.whenReady().then(async () => {
  await startServer();
  await waitForServer(SERVER_URL);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
});
