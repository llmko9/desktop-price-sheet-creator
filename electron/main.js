const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    titleBarStyle: 'default',
    show: false
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:8000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('export-image', async (event, options) => {
  try {
    if (!mainWindow) return { success: false, error: 'No main window' };
    
    const image = await mainWindow.webContents.capturePage();
    
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Price Sheet',
      defaultPath: `price-sheet-${new Date().toISOString().split('T')[0]}.png`,
      filters: [
        { name: 'PNG Images', extensions: ['png'] },
        { name: 'JPEG Images', extensions: ['jpg', 'jpeg'] }
      ]
    });

    if (filePath) {
      const buffer = filePath.endsWith('.png') ? image.toPNG() : image.toJPEG(90);
      fs.writeFileSync(filePath, buffer);
      return { success: true, filePath };
    }
    
    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-project', async (event, projectData) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project',
      defaultPath: `project-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'Project Files', extensions: ['json'] }
      ]
    });

    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2));
      return { success: true, filePath };
    }
    
    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    console.error('Save project error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-project', async (event) => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Load Project',
      filters: [
        { name: 'Project Files', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
      const data = fs.readFileSync(filePaths[0], 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    
    return { success: false, error: 'Load cancelled' };
  } catch (error) {
    console.error('Load project error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-labels', async (event, items) => {
  try {
    // Create a new window for printing labels
    const printWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Generate HTML for labels
    const labelsHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @media print {
            body { margin: 0; }
            .label { 
              width: 4in; 
              height: 2in; 
              border: 1px solid #000; 
              margin: 0.1in;
              padding: 0.2in;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .barcode { margin-bottom: 0.1in; }
            .name { font-weight: bold; margin-bottom: 0.05in; }
            .price { font-size: 1.2em; }
          }
        </style>
      </head>
      <body>
        ${items.map(item => `
          <div class="label">
            <div class="barcode">
              <svg id="barcode-${item.id}"></svg>
            </div>
            <div class="name">${item.name}</div>
            <div class="price">$${item.price}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(labelsHtml)}`);
    
    await printWindow.webContents.print({
      silent: false,
      printBackground: true
    });

    printWindow.close();
    return { success: true };
  } catch (error) {
    console.error('Print labels error:', error);
    return { success: false, error: error.message };
  }
});

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    navigationEvent.preventDefault();
  });
});
