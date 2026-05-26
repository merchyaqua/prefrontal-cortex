import 'dotenv/config'
import { app, BrowserWindow, globalShortcut, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { getActiveWindow } from './ipc/focus'
import { registerDbHandlers } from './ipc/db'
import { registerClaudeHandlers } from './ipc/claude'

let mainWindow: BrowserWindow | null = null
let destructorWindow: BrowserWindow | null = null
let checkInWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = !app.isPackaged
const rendererUrl = process.env['ELECTRON_RENDERER_URL']

function loadRoute(win: BrowserWindow, hash: string): void {
  if (isDev && rendererUrl) {
    void win.loadURL(`${rendererUrl}#${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    backgroundColor: '#fafaf7',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // In dev, show immediately. In production, start silently in tray.
    if (isDev) mainWindow?.show()
  })

  // Hide to tray instead of quitting
  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  loadRoute(mainWindow, '/dashboard')
}

function createTray(): void {
  const iconPath = isDev
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'icon.png')

  const img = nativeImage.createFromPath(iconPath)
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }))
  tray.setToolTip('Prefrontal Cortex')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: 'Destructor   Ctrl+Shift+D',
      click: () => summonDestructor()
    },
    {
      label: 'Check-in   Ctrl+Shift+L',
      click: () => summonCheckIn()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        // Remove the close guard so quit actually works
        mainWindow?.removeAllListeners('close')
        app.quit()
      }
    }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function openSmallWindow(route: string, refRef: 'destructor' | 'checkin'): BrowserWindow {
  const opts = {
    width: 720,
    height: 360,
    show: false,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#fafaf7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  } as const

  const win = new BrowserWindow(opts)
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (refRef === 'destructor') destructorWindow = null
    if (refRef === 'checkin') checkInWindow = null
  })
  loadRoute(win, route)
  return win
}

function summonDestructor(): void {
  if (destructorWindow) {
    destructorWindow.focus()
    return
  }
  destructorWindow = openSmallWindow('/destructor', 'destructor')
}

function summonCheckIn(): void {
  if (checkInWindow) {
    checkInWindow.focus()
    return
  }
  checkInWindow = openSmallWindow('/check-in', 'checkin')
}

function registerHotkeys(): void {
  globalShortcut.register('CommandOrControl+Shift+D', summonDestructor)
  globalShortcut.register('CommandOrControl+Shift+L', summonCheckIn)
}

function registerIPC(): void {
  ipcMain.handle(IPC.focus.current, async () => getActiveWindow())
  ipcMain.on(IPC.hotkey.openDestructor, summonDestructor)
  ipcMain.on(IPC.hotkey.openCheckIn, summonCheckIn)
  registerDbHandlers(ipcMain)
  registerClaudeHandlers(ipcMain)
}

void app.whenReady().then(() => {
  // Register as a login item so the app starts with Windows
  if (!isDev) {
    app.setLoginItemSettings({ openAtLogin: true })
  }

  registerIPC()
  registerHotkeys()
  createMainWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    else mainWindow?.show()
  })
})

// Keep the process alive — tray keeps the app running, so never quit on last window close
app.on('window-all-closed', () => {
  // Intentionally do nothing: tray presence keeps the app alive
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
