import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, net, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs'
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

ipcMain.handle('open-external', (_event, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true)
})

const CREDS_FILE = () => path.join(app.getPath('userData'), 'saved-creds.bin')

ipcMain.handle('save-credentials', (_event, email: string, password: string) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { success: false }
    const encrypted = safeStorage.encryptString(JSON.stringify({ email, password }))
    writeFileSync(CREDS_FILE(), encrypted)
    return { success: true }
  } catch {
    return { success: false }
  }
})

ipcMain.handle('load-credentials', () => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const file = CREDS_FILE()
    if (!existsSync(file)) return null
    const decrypted = safeStorage.decryptString(readFileSync(file))
    return JSON.parse(decrypted) as { email: string; password: string }
  } catch {
    return null
  }
})

ipcMain.handle('clear-credentials', () => {
  try {
    const file = CREDS_FILE()
    if (existsSync(file)) unlinkSync(file)
  } catch {}
})

// Consulta GitHub API e retorna a URL de download do .exe do release mais recente
ipcMain.handle('get-installer-url', async () => {
  try {
    const resp = await net.fetch(
      'https://api.github.com/repos/joaojcnunes-debug/SST-JCN/releases/latest',
      { headers: { 'User-Agent': 'SSTJCN-Updater', 'Accept': 'application/vnd.github.v3+json' } }
    )
    if (!resp.ok) throw new Error(`GitHub API HTTP ${resp.status}`)
    const release = await resp.json() as {
      assets: Array<{ name: string; browser_download_url: string }>
    }
    const asset = release.assets.find((a) => a.name.endsWith('.exe'))
    if (!asset) throw new Error('Instalador .exe não encontrado no release')
    return { success: true, url: asset.browser_download_url }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

// Download in-app do instalador usando o download manager nativo do Electron
ipcMain.handle('download-update-file', (_event, url: string) => {
  return new Promise<{ success: boolean; path?: string; error?: string }>((resolve) => {
    if (!mainWindow) {
      resolve({ success: false, error: 'Janela principal não disponível' })
      return
    }

    const dest = path.join(app.getPath('downloads'), 'SSTJCN-Setup.exe')

    mainWindow.webContents.session.once('will-download', (_ev, item) => {
      item.setSavePath(dest)

      item.on('updated', (_ev, state) => {
        if (state === 'progressing') {
          const total = item.getTotalBytes()
          if (total > 0) {
            const pct = Math.round((item.getReceivedBytes() / total) * 100)
            mainWindow?.webContents.send('download-progress', { percent: pct })
          }
        }
      })

      item.once('done', (_ev, state) => {
        if (state === 'completed') {
          resolve({ success: true, path: dest })
        } else {
          resolve({ success: false, error: `Download ${state}` })
        }
      })
    })

    mainWindow.webContents.downloadURL(url)
  })
})

ipcMain.handle('run-installer-file', async (_event, filePath: string) => {
  const err = await shell.openPath(filePath)
  return { success: !err, error: err || undefined }
})

// Atualiza o ícone da janela em tempo real quando o logo muda no Supabase
ipcMain.handle('update-window-icon', async (_event, url: string) => {
  try {
    const resp = await net.fetch(url)
    if (!resp.ok) return
    const image = nativeImage.createFromBuffer(Buffer.from(await resp.arrayBuffer()))
    if (!image.isEmpty()) mainWindow?.setIcon(image)
  } catch {
    // ícone é cosmético — falha silenciosa
  }
})

// ── Ciclo de vida ─────────────────────────────────────────────────

// ── Auto-update ───────────────────────────────────────────────────

async function checkForUpdateGitHub(): Promise<void> {
  try {
    const resp = await net.fetch(
      'https://api.github.com/repos/joaojcnunes-debug/SST-JCN/releases/latest',
      { headers: { 'User-Agent': 'SSTJCN-Updater', 'Accept': 'application/vnd.github.v3+json' } }
    )
    if (!resp.ok) return
    const release = await resp.json() as { tag_name: string }
    const remoteVersion = release.tag_name.replace(/^v/, '')
    const currentVersion = app.getVersion()
    const [rMaj, rMin, rPatch] = remoteVersion.split('.').map(Number)
    const [cMaj, cMin, cPatch] = currentVersion.split('.').map(Number)
    const isNewer =
      rMaj > cMaj ||
      (rMaj === cMaj && rMin > cMin) ||
      (rMaj === cMaj && rMin === cMin && rPatch > cPatch)
    if (isNewer) {
      mainWindow?.webContents.send('update-available', { version: remoteVersion })
    }
  } catch (err) {
    console.error('[Updater] falha ao verificar:', err instanceof Error ? err.message : err)
  }
}

function setupAutoUpdater(): void {
  // Verifica 5s após iniciar
  setTimeout(checkForUpdateGitHub, 5_000)

  // Verifica a cada 30 minutos — garante que usuários que deixam o app aberto
  // o dia inteiro também recebam a notificação sem precisar reiniciar
  setInterval(checkForUpdateGitHub, 30 * 60 * 1000)

  // Verifica ao focar a janela (usuário volta ao app após horas fora)
  app.on('browser-window-focus', () => {
    checkForUpdateGitHub().catch(() => {})
  })
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
