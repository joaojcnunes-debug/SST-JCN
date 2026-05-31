import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
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
  // process.resourcesPath aponta para a pasta resources/ fora do asar.
  // .next/standalone fica em extraResources (não empacotado no asar) para que
  // spawn + ELECTRON_RUN_AS_NODE=1 (Node puro) possa ler os arquivos reais.
  const standaloneDir = path.join(process.resourcesPath, '.next', 'standalone')
  const serverScript = path.join(standaloneDir, 'server.js')

  return new Promise<void>((resolve) => {
    nextServerProcess = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',  // força modo Node.js puro (não Electron)
        PORT: String(SERVER_PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
      cwd: standaloneDir,
      stdio: 'pipe',
      windowsHide: true,
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
    autoHideMenuBar: true,
  })

  mainWindow.setMenu(null)

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

// Imprime a janela principal diretamente — evita criar janela oculta.
// Funciona sempre que a main window estiver visível e carregada.
ipcMain.handle('print-main-window-pdf', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Janela principal não disponível' }
  }
  try {
    const buffer = await mainWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      landscape: false,
      margins: { marginType: 'none' },
    })
    return { success: true, data: buffer }
  } catch (err) {
    console.error('[PDF main-window]', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('get-version', () => app.getVersion())

// Salva buffer de PDF em arquivo temp e abre no leitor padrão do sistema.
// Necessário no Electron porque blob: URLs não podem ser abertas externamente.
ipcMain.handle('abrir-pdf', async (_event, bytes: Uint8Array) => {
  try {
    const tmpFile = path.join(tmpdir(), `painel-sst-${Date.now()}.pdf`)
    writeFileSync(tmpFile, Buffer.from(bytes))
    await shell.openPath(tmpFile)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('selecionar-certificado', async (_event) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Selecionar Certificado A1',
    filters: [{ name: 'Certificado A1', extensions: ['pfx', 'p12'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── Ciclo de vida ─────────────────────────────────────────────────

// ── Auto-update ───────────────────────────────────────────────────

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Nova versão disponível',
      message: `Versão ${info.version} encontrada. Baixando em segundo plano...`,
      buttons: ['OK'],
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Atualização pronta',
      message: `Versão ${info.version} pronta para instalar.\nDeseja reiniciar o aplicativo agora?`,
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true)
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater]', err.message)
  })

  // Verifica após 5s — garante que a janela principal já carregou
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] falha ao verificar:', err.message)
    })
  }, 5_000)
}

app.whenReady().then(async () => {
  if (!isDev) await startNextServer()
  createMainWindow()
  if (!isDev) setupAutoUpdater()

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
