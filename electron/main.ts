import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { ChildProcess, spawn } from 'child_process'
import { gerarPdfElectron } from './services/pdfService'
import { closeDb } from './services/database/sqlite'
import { stopSyncLoop } from './services/sync/syncEngine'

const isDev = process.env.NODE_ENV === 'development'
const SERVER_PORT = 3456

let mainWindow: BrowserWindow | null = null
let nextServerProcess: ChildProcess | null = null

// ── Next.js standalone server (produção) ─────────────────────────

async function startNextServer(): Promise<void> {
  const serverScript = path.join(app.getAppPath(), '.next', 'standalone', 'server.js')

  return new Promise<void>((resolve) => {
    nextServerProcess = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
      stdio: 'pipe',
    })

    nextServerProcess.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      if (/ready|started|listening/i.test(line)) resolve()
    })

    nextServerProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[Next.js]', chunk.toString().trim())
    })

    nextServerProcess.on('error', (err) => {
      console.error('[Next.js] falha ao iniciar servidor:', err.message)
      resolve() // continua mesmo com erro
    })

    // Timeout: aguarda até 10s e prossegue
    setTimeout(resolve, 10_000)
  })
}

function getAppUrl(): string {
  return isDev ? 'http://localhost:3000' : `http://127.0.0.1:${SERVER_PORT}`
}

// ── Janela principal ─────────────────────────────────────────────

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,       // false permite require() no preload; contextIsolation protege o renderer
      webSecurity: true,
    },
    show: false,
  })

  mainWindow.loadURL(getAppUrl())

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) mainWindow?.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // Links externos abrem no browser padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── IPC handlers ─────────────────────────────────────────────────

ipcMain.handle(
  'gerar-pdf',
  async (_event, opts: { pageUrl?: string; html?: string; baseUrl?: string }) => {
    try {
      const buffer = await gerarPdfElectron(opts)
      return { success: true, data: buffer }
    } catch (err) {
      console.error('[PDF]', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
)

ipcMain.handle('get-version', () => app.getVersion())

ipcMain.handle('selecionar-certificado', async (_event) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Selecionar Certificado A1',
    filters: [{ name: 'Certificado A1', extensions: ['pfx', 'p12'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── Ciclo de vida ─────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isDev) await startNextServer()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  cleanup()
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => cleanup())

function cleanup(): void {
  stopSyncLoop()
  closeDb()
  nextServerProcess?.kill()
  nextServerProcess = null
  // Fecha todas as janelas (inclui janelas PDF invisíveis)
  BrowserWindow.getAllWindows().forEach((w) => {
    try { if (!w.isDestroyed()) w.destroy() } catch { /* noop */ }
  })
}
