import { contextBridge, ipcRenderer } from 'electron'

/**
 * API segura exposta ao renderer via contextBridge.
 * nodeIntegration: false — o renderer NÃO acessa Node diretamente.
 * contextIsolation: true — o renderer não vê o contexto do preload.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true as const,

  /**
   * Gera PDF via Chromium local (Electron).
   * Aceita pageUrl (preferido) ou html + baseUrl.
   */
  gerarPdf: (opts: { pageUrl?: string; html?: string; baseUrl?: string }) =>
    ipcRenderer.invoke('gerar-pdf', opts) as Promise<{
      success: boolean
      data?: Buffer
      error?: string
    }>,

  /**
   * Gera PDF imprimindo a janela principal diretamente (sem janela oculta).
   * Mais confiável no Windows — a janela já está visível e autenticada.
   */
  printMainWindowPdf: () =>
    ipcRenderer.invoke('print-main-window-pdf') as Promise<{
      success: boolean
      data?: Buffer
      error?: string
    }>,

  /** Salva PDF em arquivo temp e abre no leitor padrão do Windows */
  abrirPdf: (bytes: Uint8Array) =>
    ipcRenderer.invoke('abrir-pdf', bytes) as Promise<{ success: boolean; error?: string }>,

  /** Versão do aplicativo desktop */
  getVersion: () => ipcRenderer.invoke('get-version') as Promise<string>,

  /** Abre diálogo nativo para selecionar arquivo .pfx/.p12 */
  selecionarCertificado: () =>
    ipcRenderer.invoke('selecionar-certificado') as Promise<string | null>,

  /** Abre URL no navegador padrão do sistema */
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url) as Promise<void>,

  /** Instala update baixado e reinicia o app */
  installUpdate: () =>
    ipcRenderer.invoke('install-update') as Promise<void>,

  /** Listener: nova versão disponível para download */
  onUpdateAvailable: (cb: (info: { version: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => cb(info))
  },

  /** Listener: update baixado e pronto para instalar */
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => cb(info))
  },

  /** Salva credenciais criptografadas via safeStorage do OS */
  saveCredentials: (email: string, password: string) =>
    ipcRenderer.invoke('save-credentials', email, password) as Promise<{ success: boolean }>,

  /** Carrega credenciais salvas (null se não houver) */
  loadCredentials: () =>
    ipcRenderer.invoke('load-credentials') as Promise<{ email: string; password: string } | null>,

  /** Remove credenciais salvas */
  clearCredentials: () =>
    ipcRenderer.invoke('clear-credentials') as Promise<void>,
})
