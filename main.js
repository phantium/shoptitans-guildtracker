const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let dataDir;
let exportsDir;

// Set up user data directories after app is ready
function ensureDataDirectories() {
  // Use userData path for writable storage (works in both dev and production)
  const userDataPath = app.getPath('userData');
  
  // In development, use local directories. In production, use userData
  if (app.isPackaged) {
    dataDir = path.join(userDataPath, 'data');
    exportsDir = path.join(userDataPath, 'exports');
  } else {
    dataDir = path.join(__dirname, 'data');
    exportsDir = path.join(__dirname, 'exports');
  }
  
  // Create directories if they don't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  
  // Set environment variable so db.js can access the correct path
  process.env.APP_DATA_DIR = dataDir;
  
  console.log('Data directory:', dataDir);
  console.log('Exports directory:', exportsDir);
}

function createWindow() {
  // Load saved window bounds from settings
  const settings = db.getSettings();
  
  // Default window size
  let windowOptions = {
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };
  
  // Apply saved bounds if they exist and are reasonable
  if (settings.window_width && settings.window_height) {
    // Ensure minimum size of 400x300
    windowOptions.width = Math.max(400, settings.window_width);
    windowOptions.height = Math.max(300, settings.window_height);
  }
  
  if (settings.window_x !== null && settings.window_y !== null) {
    // Validate that the window position is on a visible screen
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    
    // Check if the saved position is within any display bounds
    const isValidPosition = displays.some(display => {
      const bounds = display.bounds;
      return settings.window_x >= bounds.x &&
             settings.window_x < bounds.x + bounds.width &&
             settings.window_y >= bounds.y &&
             settings.window_y < bounds.y + bounds.height;
    });
    
    // Only apply saved position if it's valid
    if (isValidPosition) {
      windowOptions.x = settings.window_x;
      windowOptions.y = settings.window_y;
    }
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // Load the HTML file with error handling
  mainWindow.loadFile('index.html').then(() => {
    console.log('Successfully loaded index.html');
  }).catch(err => {
    console.error('Failed to load index.html:', err);
    console.error('__dirname:', __dirname);
    console.error('process.resourcesPath:', process.resourcesPath);
    console.error('app.getAppPath():', app.getAppPath());
    
    // Show error dialog
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Load Error',
      `Failed to load application interface:\n\n${err.message}`
    );
  });
  
  // Log any load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
  });
  
  // Log when page is ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
  });
  
  // Open DevTools in development mode to see errors
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Save window bounds when the window is moved or resized
  const saveBounds = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
      const bounds = mainWindow.getBounds();
      db.saveWindowBounds(bounds);
    }
  };

  // Save bounds on move/resize with debouncing
  let saveBoundsTimeout;
  mainWindow.on('resize', () => {
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(saveBounds, 500);
  });
  
  mainWindow.on('move', () => {
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(saveBounds, 500);
  });

  // Save bounds when closing
  mainWindow.on('close', () => {
    saveBounds();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    ensureDataDirectories();
    db = getDB();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start application:\n\n${error.message}\n\nCheck console for details.`
    );
    app.quit();
  }
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

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  try {
    // Get primary display size for appropriate thumbnail size
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    
    // Capture thumbnails at reasonable size (scaled down for UI display)
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { 
        width: Math.min(width * primaryDisplay.scaleFactor, 1920), 
        height: Math.min(height * primaryDisplay.scaleFactor, 1080) 
      }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting sources:', error);
    throw error;
  }
});

ipcMain.handle('capture-screen', async (event, sourceId) => {
  try {
    // Get primary display size for full resolution capture
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    
    // Capture at full resolution (up to 4K)
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: width * primaryDisplay.scaleFactor, height: height * primaryDisplay.scaleFactor }
    });
    
    const source = sources.find(s => s.id === sourceId);
    if (source) {
      const thumbnail = source.thumbnail;
      return {
        dataUrl: thumbnail.toDataURL(),
        width: thumbnail.getSize().width,
        height: thumbnail.getSize().height
      };
    }
    throw new Error('Source not found');
  } catch (error) {
    console.error('Error capturing screen:', error);
    throw error;
  }
});

ipcMain.handle('get-screen-resolution', async () => {
  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    return {
      width: primaryDisplay.size.width,
      height: primaryDisplay.size.height,
      scaleFactor: primaryDisplay.scaleFactor
    };
  } catch (error) {
    console.error('Error getting screen resolution:', error);
    throw error;
  }
});

ipcMain.handle('get-source-dimensions', async (event, sourceId) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    const source = sources.find(s => s.id === sourceId);
    if (!source) {
      throw new Error('Source not found');
    }
    
    // Get the actual dimensions from the thumbnail
    const thumbnail = source.thumbnail;
    return {
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height
    };
  } catch (error) {
    console.error('Error getting source dimensions:', error);
    throw error;
  }
});

// Database operations - load after app is ready
let db;

function getDB() {
  if (!db) {
    const dbPath = require.resolve('./src/database/db');
    delete require.cache[dbPath];
    db = require('./src/database/db');
  }
  return db;
}

ipcMain.handle('save-player-stats', async (event, data) => {
  try {
    return db.savePlayerStats(data);
  } catch (error) {
    console.error('Error saving player stats:', error);
    throw error;
  }
});

ipcMain.handle('get-settings', async () => {
  try {
    return db.getSettings();
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    return db.saveSettings(settings);
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
});

ipcMain.handle('get-all-players', async () => {
  try {
    return db.getAllPlayers();
  } catch (error) {
    console.error('Error getting players:', error);
    throw error;
  }
});

ipcMain.handle('get-player-history', async (event, playerId) => {
  try {
    return db.getPlayerHistory(playerId);
  } catch (error) {
    console.error('Error getting player history:', error);
    throw error;
  }
});

ipcMain.handle('delete-history-entry', async (event, entryId) => {
  try {
    return db.deleteHistoryEntry(entryId);
  } catch (error) {
    console.error('Error deleting history entry:', error);
    throw error;
  }
});

ipcMain.handle('get-all-player-names', async (event, guildName) => {
  try {
    return db.getAllPlayerNames(guildName);
  } catch (error) {
    console.error('Error getting player names:', error);
    throw error;
  }
});

ipcMain.handle('rename-player', async (event, oldPlayerId, newPlayerName) => {
  try {
    return db.renamePlayer(oldPlayerId, newPlayerName);
  } catch (error) {
    console.error('Error renaming player:', error);
    throw error;
  }
});

ipcMain.handle('cleanup-duplicate-players', async () => {
  try {
    return db.cleanupDuplicatePlayers();
  } catch (error) {
    console.error('Error cleaning up duplicate players:', error);
    throw error;
  }
});

ipcMain.handle('cleanup-orphaned-players', async () => {
  try {
    return db.cleanupOrphanedPlayers();
  } catch (error) {
    console.error('Error cleaning up orphaned players:', error);
    throw error;
  }
});

ipcMain.handle('get-guild-statistics', async (event, guildName, previousSnapshotId, currentSnapshotId) => {
  try {
    return db.getGuildStatistics(guildName, previousSnapshotId, currentSnapshotId);
  } catch (error) {
    console.error('Error getting guild statistics:', error);
    throw error;
  }
});

ipcMain.handle('get-guild-snapshots', async (event, guildName) => {
  try {
    // Use separate module to avoid caching issues
    delete require.cache[require.resolve('./src/database/db_snapshots')];
    const { getGuildSnapshots } = require('./src/database/db_snapshots');
    return getGuildSnapshots(db.db, guildName);
  } catch (error) {
    console.error('Error getting guild snapshots:', error);
    throw error;
  }
});

ipcMain.handle('export-data', async (event, format, data) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `shop-titans-export-${timestamp}.${format}`;
    const filepath = path.join(exportsDir, filename);
    
    if (format === 'json') {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      fs.writeFileSync(filepath, data);
    }
    
    return { success: true, filepath };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
});

ipcMain.handle('save-ocr-debug', async (event, debugInfo) => {
  try {
    const debugFilePath = path.join(__dirname, 'debug-ocr-captures.txt');
    const separator = '\n' + '='.repeat(80) + '\n';
    
    // Handle both old format (just text) and new format (object with metadata)
    let entry;
    if (typeof debugInfo === 'string') {
      // Old format - just text
      const timestamp = new Date().toISOString();
      entry = `${separator}CAPTURE: ${timestamp}${separator}${debugInfo}\n`;
    } else {
      // New format - object with metadata
      const timestamp = debugInfo.timestamp || new Date().toISOString();
      const confidence = debugInfo.confidence ? `${Math.round(debugInfo.confidence)}%` : 'N/A';
      const region = debugInfo.captureRegion;
      const source = debugInfo.selectedSource;
      
      entry = `${separator}CAPTURE: ${timestamp}${separator}`;
      entry += `Source: ${source}\n`;
      entry += `Confidence: ${confidence}\n`;
      
      if (region && region !== 'Full screen') {
        entry += `Region: x=${region.x}, y=${region.y}, width=${region.width}, height=${region.height}\n`;
      } else {
        entry += `Region: Full screen\n`;
      }
      
      entry += `${'-'.repeat(80)}\n`;
      entry += `${debugInfo.text}\n`;
    }
    
    // Append to file (or create if doesn't exist)
    fs.appendFileSync(debugFilePath, entry);
    
    console.log('✅ OCR debug saved to:', debugFilePath);
    return { success: true, filepath: debugFilePath };
  } catch (error) {
    console.error('Error saving OCR debug:', error);
    throw error;
  }
});

ipcMain.handle('save-ranking-image', async (event, imageData, guildName, statName) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${guildName}-${statName}-${timestamp}.png`;
    const filepath = path.join(exportsDir, filename);
    
    // Convert data URL to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Save to file
    fs.writeFileSync(filepath, imageBuffer);
    
    console.log('✅ Ranking image saved to:', filepath);
    return { success: true, filepath };
  } catch (error) {
    console.error('Error saving ranking image:', error);
    throw error;
  }
});

// Guild snapshot export/import handlers
ipcMain.handle('export-guild-snapshot', async (event, guildName, snapshotDate) => {
  try {
    const { exportGuildSnapshot } = require('./src/database/db_export_import');
    const exportData = exportGuildSnapshot(db.db, guildName, snapshotDate);
    return { success: true, data: exportData };
  } catch (error) {
    console.error('Error exporting guild snapshot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('preview-import-snapshot', async (event, importData) => {
  try {
    const { previewImport } = require('./src/database/db_export_import');
    const preview = previewImport(db.db, importData);
    return { success: true, preview };
  } catch (error) {
    console.error('Error previewing import:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-guild-snapshot', async (event, importData, options) => {
  try {
    const { importGuildSnapshot } = require('./src/database/db_export_import');
    const result = importGuildSnapshot(db.db, importData, options);
    return result;
  } catch (error) {
    console.error('Error importing guild snapshot:', error);
    return { success: false, error: error.message };
  }
});

// PaddleOCR extraction handler
ipcMain.handle('paddle-ocr-extract', async (event, imageDataUrl) => {
  const { spawn } = require('child_process');
  const os = require('os');
  
  let tempImagePath = null;
  
  try {
    console.log('🐍 Starting PaddleOCR extraction...');
    
    // Convert data URL to buffer
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Save to temp file
    const tempDir = os.tmpdir();
    tempImagePath = path.join(tempDir, `ocr-temp-${Date.now()}.png`);
    fs.writeFileSync(tempImagePath, imageBuffer);
    console.log('   Temp image saved:', tempImagePath);
    
    // Get Python script path
    // In production (packaged app), always use unpacked path because Python can't read from ASAR
    let baseDir = __dirname;
    if (__dirname.includes('app.asar')) {
      baseDir = __dirname.replace('app.asar', 'app.asar.unpacked');
    }
    
    const scriptPath = path.join(baseDir, 'ocr_paddle.py');
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Python script not found: ${scriptPath}`);
    }
    
    console.log('   Using Python script:', scriptPath);
    
    // Determine Python command - check venv first, then system Python
    let pythonCmd;
    const venvPythonWin = path.join(baseDir, 'venv', 'Scripts', 'python.exe');
    const venvPythonUnix = path.join(baseDir, 'venv', 'bin', 'python');
    
    if (process.platform === 'win32' && fs.existsSync(venvPythonWin)) {
      pythonCmd = venvPythonWin;
      console.log('   Using venv Python (Windows)');
    } else if (fs.existsSync(venvPythonUnix)) {
      pythonCmd = venvPythonUnix;
      console.log('   Using venv Python (Unix)');
    } else {
      pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      console.log('   Using system Python');
    }
    
    // Call Python script
    console.log('   Calling Python script:', pythonCmd, scriptPath);
    
    return new Promise((resolve, reject) => {
      const python = spawn(pythonCmd, [scriptPath, tempImagePath]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        // Clean up temp file
        try {
          if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
        } catch (err) {
          console.warn('Failed to delete temp file:', err);
        }
        
        if (code !== 0) {
          console.error('❌ Python script failed with code:', code);
          console.error('   stdout:', stdout);
          console.error('   stderr:', stderr);
          
          // Try to parse stdout as JSON error message
          let errorMsg = stderr || 'Unknown error';
          try {
            const result = JSON.parse(stdout);
            if (result.error) {
              errorMsg = result.error;
            }
          } catch (e) {
            // Not JSON, use raw output
            errorMsg = stdout || stderr || 'Python script failed';
          }
          
          resolve({
            success: false,
            error: `Python script exited with code ${code}: ${errorMsg}`,
            text: '',
            confidence: 0
          });
          return;
        }
        
        try {
          // Parse JSON output
          const result = JSON.parse(stdout);
          console.log('✅ PaddleOCR result:', result.success ? 'Success' : 'Failed');
          if (result.success) {
            console.log('   Confidence:', result.confidence + '%');
            console.log('   Text length:', result.text.length);
          } else {
            console.log('   Error:', result.error);
          }
          resolve(result);
        } catch (err) {
          console.error('❌ Failed to parse Python output:', err);
          console.error('   stdout:', stdout);
          console.error('   stderr:', stderr);
          resolve({
            success: false,
            error: `Failed to parse Python output: ${err.message}`,
            text: '',
            confidence: 0
          });
        }
      });
      
      python.on('error', (err) => {
        console.error('❌ Failed to spawn Python process:', err);
        
        // Clean up temp file
        try {
          if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
        } catch (cleanupErr) {
          console.warn('Failed to delete temp file:', cleanupErr);
        }
        
        resolve({
          success: false,
          error: `Failed to run Python: ${err.message}. Make sure Python is installed and in PATH.`,
          text: '',
          confidence: 0
        });
      });
    });
    
  } catch (error) {
    console.error('❌ PaddleOCR extraction error:', error);
    
    // Clean up temp file on error
    try {
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }
    } catch (err) {
      console.warn('Failed to delete temp file:', err);
    }
    
    return {
      success: false,
      error: error.message,
      text: '',
      confidence: 0
    };
  }
});

