interface ElectronAPI {
  readonly isElectron: true
  gerarPdf(opts: {
    pageUrl?: string
    html?: string
    baseUrl?: string
  }): Promise<{ success: boolean; data?: Buffer; error?: string }>
  printMainWindowPdf(): Promise<{ success: boolean; data?: Buffer; error?: string }>
  abrirPdf(bytes: Uint8Array): Promise<{ success: boolean; error?: string }>
  getVersion(): Promise<string>
  selecionarCertificado(): Promise<string | null>
  /** EPI: verifica se há leitor de digital disponível (não captura). */
  epiLeitorCheck?(): Promise<{ ok: boolean; count?: number; error?: string | null }>
  /** EPI: captura uma digital e devolve o hash (biometria descartada). */
  epiLerDigital?(): Promise<{
    ok: boolean
    fingerHash?: string | null
    device?: string | null
    quality?: string | null
    error?: string | null
  }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
