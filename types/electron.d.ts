interface ElectronAPI {
  readonly isElectron: true
  gerarPdf(opts: {
    pageUrl?: string
    html?: string
    baseUrl?: string
  }): Promise<{ success: boolean; data?: Buffer; error?: string }>
  getVersion(): Promise<string>
  selecionarCertificado(): Promise<string | null>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
