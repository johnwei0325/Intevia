const { app, BrowserWindow, desktopCapturer } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 350,
    height: 500,
    title: 'AI Meeting Assistant',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: true
    },
    show: false,
    autoHideMenuBar: true,
    minWidth: 300,
    minHeight: 450,
  });

  app.setName('AI Meeting Assistant');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(width - 370, 20);

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'microphone', 'camera', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowedPermissions = ['media', 'microphone', 'camera', 'display-capture'];
    return allowedPermissions.includes(permission);
  });

  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback({ video: sources[0] });
    }).catch((error) => {
      console.error('Error getting screen sources:', error);
      callback(null);
    });
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../out/index.html')}`
  ).catch(err => {
    console.error('Failed to load app:', err);
    app.quit();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('enable-features', 'WebRTCHWDecoding');
app.commandLine.appendSwitch('enable-features', 'WebRTCHWEncoding');

app.on('render-process-gone', (event, webContents, reason) => {
  console.error('Renderer process gone:', reason);
  app.quit();
});

app.whenReady().then(createWindow).catch(err => {
  console.error('Failed to create window:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
}); 