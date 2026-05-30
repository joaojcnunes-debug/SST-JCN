/**
 * Captura o HTML da página atual e gera um PDF A4 nativo.
 *
 * Ordem de prioridade:
 *   1. Electron (desktop) — abre janela invisível com Chromium local via IPC
 *      → sem Railway, sem rasterização, sem timeout Vercel
 *   2. Railway Puppeteer  — para usuários web sem app desktop
 *      → token HMAC de 2 min, @media print aplicado pelo Chrome
 *
 * Em ambos os casos:
 *   - PDF gerado por page.pdf() / printToPDF() do Chrome (texto vetorial)
 *   - @media print CSS é aplicado corretamente
 *   - Não usa html-to-image, canvas, JPEG, nem jsPDF
 */
export async function gerarHtmlParaPdf(): Promise<ArrayBuffer> {
  // ── 1. Electron: imprime a janela principal diretamente ──────────
  // Mais confiável que abrir uma janela oculta — a main window já está
  // visível, autenticada e com a página carregada.
  // Sidebar e barra de ações têm print:hidden → só o conteúdo do relatório
  // aparece no PDF.
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const result = await window.electronAPI.printMainWindowPdf()
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Erro ao gerar PDF no Electron')
    }
    // Buffer Node.js → ArrayBuffer
    const bytes = result.data as unknown as Uint8Array
    const ab = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(ab).set(bytes)
    return ab
  }

  // ── 2. Railway Puppeteer (web) ───────────────────────────────────
  const tokenRes = await fetch('/api/pdf/token', { method: 'POST' })
  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Erro ao autorizar geração de PDF',
    )
  }
  const { token, serviceUrl } = (await tokenRes.json()) as {
    token: string
    serviceUrl: string
  }

  // Clona o DOM sem tocar no DOM ativo (modal continua aberto)
  const clone = document.documentElement.cloneNode(true) as HTMLElement

  // Remove elementos print:hidden — garante ausência no PDF
  clone
    .querySelectorAll<HTMLElement>('[class*="print:hidden"]')
    .forEach((el) => el.remove())

  // Remove portais renderizados fora do root Next.js (modais, toasts, etc.)
  const cloneBody = clone.querySelector('body')
  if (cloneBody) {
    const nextRoot = cloneBody.firstElementChild
    Array.from(cloneBody.children).forEach((child) => {
      if (child !== nextRoot) child.remove()
    })
  }

  const html = clone.outerHTML

  const pdfRes = await fetch(`${serviceUrl}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, html, baseUrl: window.location.origin }),
  })

  if (!pdfRes.ok) {
    const body = await pdfRes.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Erro ao gerar PDF no serviço',
    )
  }

  return pdfRes.arrayBuffer()
}
