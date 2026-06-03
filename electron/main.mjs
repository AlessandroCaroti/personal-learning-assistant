import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEV_SERVER_URL = 'http://localhost:5173'
const isDev =
  !app.isPackaged ||
  process.env.ELECTRON_RENDERER_URL === DEV_SERVER_URL ||
  process.env.NODE_ENV === 'development'

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL || DEV_SERVER_URL)
    return window
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  window.loadFile(indexPath)
  return window
}

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
