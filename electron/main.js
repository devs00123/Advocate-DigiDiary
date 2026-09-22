const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const dotenv = require('dotenv');
const { autoUpdater } = require('electron-updater');

// Early environment initialization across development and packaged builds
function loadEnvironment() {
  const possiblePaths = [];

  // When packaged, check extraResources and app root
  if (process.resourcesPath) {
    possiblePaths.push(path.join(process.resourcesPath, '.env'));
    possiblePaths.push(path.join(process.resourcesPath, 'app', '.env'));
  }
  if (app && typeof app.getAppPath === 'function') {
    try {
      possiblePaths.push(path.join(app.getAppPath(), '.env'));
    } catch (_) {}
  }
  if (app && typeof app.getPath === 'function') {
    try {
      possiblePaths.push(path.join(app.getPath('userData'), '.env'));
    } catch (_) {}
  }

  // Development paths
  possiblePaths.push(path.join(__dirname, '..', '.env'));
  possiblePaths.push(path.join(process.cwd(), '.env'));

  let loaded = false;
  for (const envFile of possiblePaths) {
    try {
      if (fs.existsSync(envFile)) {
        dotenv.config({ path: envFile });
        console.log(`[Electron] Loaded environment from: ${envFile}`);
        loaded = true;
        break;
      }
    } catch (_) {}
  }

  if (!loaded) {
    dotenv.config();
  }
}

loadEnvironment();

let mainWindow;
let httpServer;

const DEFAULT_CLOUD_URL = 'https://advocate-digidiary.onrender.com';
const CLOUD_URL = process.env.CLOUD_URL || DEFAULT_CLOUD_URL;
const PORT = parseInt(process.env.PORT, 10) || 5050;
const LOCAL_SERVER_URL = `http://localhost:${PORT}`;

// In packaged mode, connect to the shared Cloud Chamber practice on Render.
// In dev mode (or if USE_LOCAL_SERVER=true), use the local Express server.
const useCloud = (app.isPackaged || process.env.USE_CLOUD === 'true') && process.env.USE_LOCAL_SERVER !== 'true';
const TARGET_URL = useCloud ? CLOUD_URL : LOCAL_SERVER_URL;

function getSplashHtml(isCloud) {
  const title = isCloud ? 'Connecting to Chamber Cloud...' : 'Starting Practice Server...';
  const subtitle = isCloud ? 'Synchronizing with shared chamber database...' : 'Initializing local database...';
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Advocate DigiDiary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    .container {
      text-align: center;
      max-width: 440px;
      padding: 32px;
    }
    .logo-badge {
      width: 72px;
      height: 72px;
      margin: 0 auto 20px;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 175, 55, 0.15);
    }
    .logo-badge svg {
      width: 40px;
      height: 40px;
      stroke: #d4af37;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 28px;
      letter-spacing: 0.3px;
    }
    .spinner-wrap {
      position: relative;
      width: 40px;
      height: 40px;
      margin: 0 auto 18px;
    }
    .spinner {
      width: 100%;
      height: 100%;
      border: 3px solid rgba(212, 175, 55, 0.15);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .status-text {
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .sub-status {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    .retry-btn {
      display: none;
      margin-top: 18px;
      padding: 9px 20px;
      background: #d4af37;
      color: #0f172a;
      font-weight: 600;
      font-size: 13px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(212, 175, 55, 0.25);
    }
    .retry-btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    </div>
    <h1>Advocate DigiDiary</h1>
    <div class="tagline">Digital Legal Practice & Court Diary</div>
    
    <div class="spinner-wrap" id="spinner">
      <div class="spinner"></div>
    </div>
    <div class="status-text" id="status">${title}</div>
    <div class="sub-status" id="subStatus">${subtitle}</div>
    <button class="retry-btn" id="retryBtn" onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`)}`;
}

function waitForServer(urlStr, maxAttempts = 90, interval = 1200) {
  return new Promise((resolve) => {
    let attempts = 0;
    const urlObj = new URL(urlStr);
    const client = urlObj.protocol === 'https:' ? https : http;

    const check = () => {
      attempts++;
      const req = client.get(urlStr, { timeout: 8000 }, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) {
          console.log(`[Electron] Server ready at ${urlStr} (status: ${res.statusCode}, attempts: ${attempts})`);
          resolve(true);
        } else if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          console.warn(`[Electron] Server responded with status ${res.statusCode} after max attempts`);
          resolve(false);
        }
      });

      req.on('error', (err) => {
        if (attempts % 5 === 0) {
          console.log(`[Electron] Waiting for server (${attempts}/${maxAttempts})...`);
        }
        if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          console.error(`[Electron] Server not reachable after ${maxAttempts} attempts:`, err.message);
          resolve(false);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          resolve(false);
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
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Load branded loading splash screen first
  mainWindow.loadURL(getSplashHtml(useCloud));

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

async function startServer() {
  console.log(`[Electron] Packaged: ${app.isPackaged}`);

  loadEnvironment();

  process.env.PORT = String(PORT);
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  const { connectDB } = require('../server/config/database');
  const expressApp = require('../server/app');

  await connectDB();

  if (process.env.SEED_ON_EMPTY === 'true') {
    try {
      const User = require('../server/models/User');
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[SEED] Empty database. Populating initial data...');
        const seedData = require('../server/scripts/seed');
        await seedData();
      }
    } catch (e) {
      console.warn('[SEED] Notice:', e.message);
    }
  }

  try {
    const User = require('../server/models/User');
    const LawFirm = require('../server/models/LawFirm');
    const bcrypt = require('bcryptjs');
    const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@digidiary.com').toLowerCase();
    let existingSuper = await User.findOne({ email: superEmail });
    if (!existingSuper) {
      let firm = await LawFirm.findOne();
      if (!firm) {
        firm = await LawFirm.create({
          name: 'Advocate DigiDiary Platform Administration',
          chamberNumber: 'Master Suite 001',
          address: 'Supreme Court Commercial Arcade, New Delhi',
          email: superEmail,
          barCouncilRegistration: 'D/ROOT/2026',
        });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026', salt);
      await User.create({
        name: 'Master Super Administrator',
        email: superEmail,
        phone: '+91 99999 00000',
        passwordHash,
        role: 'superadmin',
        designation: 'Platform Super Administrator',
        enrollmentNumber: 'D/ROOT/2026',
        lawFirmId: firm._id,
        emailVerified: true,
        lastLogin: new Date(),
      });
      console.log(`[SUPERADMIN] Provisioned: ${superEmail}`);
    }
  } catch (e) {
    console.warn('[SUPERADMIN] Notice:', e.message);
  }

  return new Promise((resolve, reject) => {
    httpServer = expressApp.listen(PORT, () => {
      console.log(`[Electron] Server running on ${SERVER_URL}`);
      resolve();
    });

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Electron] Port ${PORT} in use, trying ${PORT + 1}...`);
        httpServer = expressApp.listen(PORT + 1, () => {
          resolve();
        });
      } else {
        reject(err);
      }
    });
  });
}

app.whenReady().then(async () => {
  createWindow();

  try {
    if (!useCloud) {
      // Local development or local offline server
      await startServer();
      const ready = await waitForServer(`${LOCAL_SERVER_URL}/api/health`, 60, 1000);
      if (ready && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(LOCAL_SERVER_URL);
      }
    } else {
      // Packaged / Cloud Mode: connect to shared cloud instance
      console.log(`[Electron] Cloud Mode active. Target: ${CLOUD_URL}`);
      const ready = await waitForServer(`${CLOUD_URL}/api/health`, 90, 1500);
      if (ready) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log(`[Electron] Cloud server ready. Loading: ${CLOUD_URL}`);
          mainWindow.loadURL(CLOUD_URL);
        }
      } else {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`
            document.getElementById('spinner').style.display = 'none';
            document.getElementById('status').innerText = 'Cloud Chamber Server Unreachable';
            document.getElementById('subStatus').innerText = 'Could not establish connection to the cloud chamber. Please verify your internet connection and try again.';
            const btn = document.getElementById('retryBtn');
            btn.style.display = 'inline-block';
            btn.onclick = () => { location.href = '${CLOUD_URL}'; };
          `).catch(() => {});
        }
      }
    }

    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  } catch (err) {
    console.error('[Electron] Fatal startup error:', err);
    if (!useCloud) {
      app.quit();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  app.quit();
});

app.on('before-quit', () => {
  if (httpServer) httpServer.close();
});

// ── Auto-Updater ──────────────────────────────────────────────────────────

autoUpdater.logger = {
  info: (msg) => console.log('[AutoUpdater]', msg),
  warn: (msg) => console.warn('[AutoUpdater]', msg),
  error: (msg) => console.error('[AutoUpdater]', msg),
};

autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log(`[AutoUpdater] Update available: v${info.version}`);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (v${info.version}) is available.\nIt will be downloaded in the background.`,
    buttons: ['OK'],
  });
});

autoUpdater.on('update-not-available', () => {
  console.log('[AutoUpdater] App is up to date.');
});

autoUpdater.on('download-progress', (progress) => {
  const msg = `Download speed: ${progress.bytesPerSecond} - ${Math.round(progress.percent)}%`;
  console.log(`[AutoUpdater] ${msg}`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded.\nRestart now to apply the update?`,
    buttons: ['Restart Now', 'Later'],
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err.message);
});
