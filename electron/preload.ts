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
})
