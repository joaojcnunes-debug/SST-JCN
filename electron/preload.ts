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

  /** Consulta GitHub API e retorna a URL de download do .exe mais recente */
  getInstallerUrl: () =>
    ipcRenderer.invoke('get-installer-url') as Promise<{ success: boolean; url?: string; error?: string }>,

  /** Baixa o instalador de uma URL direta, salva em Downloads */
  downloadUpdateFile: (url: string) =>
    ipcRenderer.invoke('download-update-file', url) as Promise<{
      success: boolean
      path?: string
      error?: string
    }>,

  /** Executa o instalador via shell.openPath */
  runInstallerFile: (filePath: string) =>
    ipcRenderer.invoke('run-installer-file', filePath) as Promise<{
      success: boolean
      error?: string
    }>,

  /** Progresso do download in-app (0–100) */
  onDownloadProgress: (cb: (info: { percent: number }) => void) => {
    ipcRenderer.on('download-progress', (_event, info) => cb(info))
  },

  /** Atualiza o ícone da janela Electron com a imagem do logo configurado */
  updateWindowIcon: (url: string) =>
    ipcRenderer.invoke('update-window-icon', url) as Promise<void>,

  /** EPI: verifica se há leitor de digital disponível (não captura) */
  epiLeitorCheck: () =>
    ipcRenderer.invoke('epi:leitor-check') as Promise<{
      ok: boolean
      count?: number
      error?: string | null
    }>,

  /** EPI: captura uma digital e devolve o hash (biometria descartada) */
  epiLerDigital: () =>
    ipcRenderer.invoke('epi:ler-digital') as Promise<{
      ok: boolean
      fingerHash?: string | null
      device?: string | null
      quality?: string | null
      error?: string | null
    }>,
})
