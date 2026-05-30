import { BrowserWindow } from 'electron'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import crypto from 'crypto'

/**
 * Gera PDF usando o Chromium embutido no Electron (webContents.printToPDF).
 * Equivalente ao page.pdf() do Puppeteer — sem Puppeteer externo, sem Railway.
 *
 * Dois modos:
 *  - pageUrl : abre uma janela invisível na URL (compartilha cookies/sessão Supabase)
 *  - html    : escreve em arquivo temp e carrega via file:// com base tag injetada
 */
export async function gerarPdfElectron(opts: {
  pageUrl?: string
  html?: string
  baseUrl?: string
}): Promise<Buffer> {
  if (opts.pageUrl) {
    return gerarPdfComUrl(opts.pageUrl)
  }
  if (opts.html) {
    return gerarPdfComHtml(opts.html, opts.baseUrl ?? '')
  }
  throw new Error('gerarPdfElectron: forneça pageUrl ou html')
}

// ── Modo URL (preferido) — carrega URL real, compartilha sessão ──

async function gerarPdfComUrl(pageUrl: string): Promise<Buffer> {
  const win = createPdfWindow()
  try {
    await win.loadURL(pageUrl)
    await aguardarLoad(win)
    return win.webContents.printToPDF(pdfOpts())
  } finally {
    destroyWindow(win)
  }
}

// ── Modo HTML — escreve em arquivo temp e carrega via file:// ────

async function gerarPdfComHtml(html: string, baseUrl: string): Promise<Buffer> {
  // Injeta <base> para que recursos relativos resolvam corretamente
  const htmlComBase = html.includes('<base ')
    ? html
    : html.replace('<head>', `<head><base href="${baseUrl}">`)

  const tmpFile = join(tmpdir(), `painel-sst-${crypto.randomUUID()}.html`)
  writeFileSync(tmpFile, htmlComBase, 'utf-8')

  const win = createPdfWindow()
  try {
    await win.loadFile(tmpFile)
    await aguardarLoad(win)
    return win.webContents.printToPDF(pdfOpts())
  } finally {
    destroyWindow(win)
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile) } catch { /* noop */ }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function createPdfWindow(): BrowserWindow {
  return new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Herda a sessão padrão → cookies Supabase são compartilhados
    },
  })
}

function pdfOpts(): Electron.PrintToPDFOptions {
  return {
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    landscape: false,
    margins: { marginType: 'none' },
  }
}

function aguardarLoad(win: BrowserWindow): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => setTimeout(resolve, 1500) // aguarda fontes e renders assíncronos

    if (!win.webContents.isLoading()) {
      done()
      return
    }
    win.webContents.once('did-stop-loading', done)
    // Timeout de segurança: 35s
    setTimeout(resolve, 35_000)
  })
}

function destroyWindow(win: BrowserWindow): void {
  try { if (!win.isDestroyed()) win.destroy() } catch { /* noop */ }
}
