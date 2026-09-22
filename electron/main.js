const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
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

const PORT = parseInt(process.env.PORT, 10) || 5050;
const SERVER_URL = `http://localhost:${PORT}`;

function waitForServer(url, maxAttempts = 90, interval = 1000) {
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
          console.error('[Electron] Server did not respond after 90 seconds');
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
  try {
    await startServer();
    await waitForServer(SERVER_URL);
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.error('[Electron] Fatal:', err);
    app.quit();
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
