/**
 * Gera PDF da página atual.
 *
 * Modos:
 *   - Electron        → printMainWindowPdf() (sempre, para ambos os fluxos)
 *   - Web, visualizar → window.print()  — abre o diálogo nativo, sem buffer
 *   - Web, assinar    → html-to-image + jsPDF (client-side, sem Railway)
 *
 * Problema comum: imagens hospedadas no Supabase Storage são cross-origin.
 * html-to-image tenta buscá-las via fetch() para inlinear como data URI; se o
 * CORS impedir, a imagem é omitida silenciosamente e o PNG fica em branco.
 * Solução: pré-inlinear as imagens via fetch antes de chamar toPng().
 */

// ── Helpers internos ─────────────────────────────────────────────────────────

/** Converte um Blob para data URL via FileReader. */
function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Carrega uma HTMLImageElement a partir de uma src. */
function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Substitui temporariamente todas as <img> externas no elemento por data URIs,
 * evitando CORS ao chamar toPng().
 * Retorna uma função de restauração que reverte as alterações.
 */
async function inlinearImagensExternas(el: HTMLElement): Promise<() => void> {
  const imgs = Array.from(el.querySelectorAll<HTMLImageElement>('img'))
  const restauracoes: Array<() => void> = []

  await Promise.allSettled(
    imgs.map(async (img) => {
      const src = img.src
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return
      try {
        const res = await fetch(src, { credentials: 'include' })
        if (!res.ok) return
        const blob = await res.blob()
        const dataUrl = await blobParaDataUrl(blob)
        const original = img.src
        img.src = dataUrl
        // Aguarda a imagem carregar para garantir que o toPng() a encontre pronta
        await new Promise<void>((resolve) => {
          if (img.complete) { resolve(); return }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
        restauracoes.push(() => { img.src = original })
      } catch {
        // Falha silenciosa — a imagem fica ausente, mas não trava o canvas
      }
    }),
  )

  return () => restauracoes.forEach((fn) => fn())
}

/**
 * Retorna uma lista de zonas [top, bottom] (em pixels PDF escalonados) que
 * não devem ser cortadas por uma borda de página.
 * Examina o DOM em busca de linhas de tabela, artigos e blocos marcados
 * como indivisíveis, para usar na decisão de onde cortar cada página.
 */
function buildNoCutZones(
  el: HTMLElement,
  scale: number,
): Array<[number, number]> {
  const containerRect = el.getBoundingClientRect()
  const zones: Array<[number, number]> = []

  // Elementos que não devem ser partidos ao meio: linhas de tabela,
  // artigos (capítulos do texto padrão) e blocos de setor do DRPS.
  const selectors = [
    'tr',
    'article',
    '.textos-padrao-capitulo',
    '.drps-setor-bloco',
    '.drps-capitulo',
  ].join(',')

  el.querySelectorAll<HTMLElement>(selectors).forEach((child) => {
    const rect = child.getBoundingClientRect()
    if (rect.height < 20) return // ignora elementos minúsculos
    const top = (rect.top - containerRect.top) * scale
    const bottom = top + rect.height * scale
    zones.push([top, bottom])
  })

  return zones
}

/**
 * Dado um ponto de corte ingênuo (naiveEnd, em pixels PDF escalonados),
 * retorna um ponto de corte seguro que não bisecta nenhuma zona proibida.
 * Se não houver zona violada, devolve naiveEnd.
 * Se a zona violada for grande demais (ocupa mais de A4_H), aceita o corte.
 */
function safeCutPoint(
  naiveEnd: number,
  zones: Array<[number, number]>,
  pageStart: number,
  A4_H: number,
): number {
  for (const [top, bottom] of zones) {
    // O corte proposto está dentro desta zona?
    if (naiveEnd > top + 4 && naiveEnd < bottom - 4) {
      const movedUp = top - 4
      // Só move se ainda restar ao menos 50 % de página aproveitável
      if (movedUp >= pageStart + A4_H * 0.5) return movedUp
    }
  }
  return naiveEnd
}

// ── Função principal ─────────────────────────────────────────────────────────

export async function gerarHtmlParaPdf(opts?: { forSigning?: boolean }): Promise<ArrayBuffer> {
  // ── 1. Electron ──────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const result = await window.electronAPI.printMainWindowPdf()
    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Erro ao gerar PDF no Electron')
    }
    const bytes = result.data as unknown as Uint8Array
    const ab = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(ab).set(bytes)
    return ab
  }

  // ── 2. Web — visualizar: impressão nativa ────────────────────────────────────
  if (!opts?.forSigning) {
    window.print()
    return new ArrayBuffer(0)
  }

  // ── 3. Web — assinar: html-to-image + jsPDF ──────────────────────────────────
  const { toPng } = await import('html-to-image')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (await import('jspdf')) as any

  // Localiza o container do laudo
  let contentEl = document.querySelector<HTMLElement>('[data-pdf-content]')
  if (!contentEl) {
    const bgWhiteEls = Array.from(document.querySelectorAll<HTMLElement>('div.bg-white'))
    contentEl =
      bgWhiteEls.length > 0
        ? bgWhiteEls.reduce((a, b) => (b.scrollHeight > a.scrollHeight ? b : a))
        : document.querySelector<HTMLElement>('main')
  }
  if (!contentEl) {
    throw new Error(
      'Não foi possível localizar o conteúdo do documento. ' +
        'Verifique se a página carregou completamente e tente novamente.',
    )
  }

  const elW = contentEl.scrollWidth || contentEl.offsetWidth || 794
  const elH = contentEl.scrollHeight || contentEl.offsetHeight || 1123
  const A4_W = 794
  const A4_H = 1123
  const scale = A4_W / elW

  // Mede posições dos elementos indivisíveis ANTES de alterar o DOM
  const zones = buildNoCutZones(contentEl, scale)

  // Pré-inlineia imagens cross-origin para evitar que o canvas fique em branco
  const restaurar = await inlinearImagensExternas(contentEl)

  let dataUrl: string
  try {
    dataUrl = await toPng(contentEl, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width: elW,
      height: elH,
      skipFonts: true, // evita falhas de CORS ao tentar buscar webfonts externas
    })
  } finally {
    restaurar()
  }

  // Se a captura retornou uma imagem minúscula, provavelmente ficou em branco
  if (dataUrl.length < 5_000) {
    throw new Error(
      'A captura do documento ficou em branco. Recarregue a página e tente novamente.',
    )
  }

  const scaledH = Math.round(elH * scale)
  const imgEl = await carregarImagem(dataUrl)

  // Calcula fronteiras de página com corte inteligente — evita bisectar
  // linhas de tabela, capítulos e outros blocos indivisíveis.
  const pageStarts: number[] = [0]
  let cursor = 0
  while (cursor + A4_H < scaledH) {
    const naiveEnd = cursor + A4_H
    const end = safeCutPoint(naiveEnd, zones, cursor, A4_H)
    // Garante progresso mínimo para evitar loop infinito em elementos gigantes
    const nextCursor = end > cursor + A4_H * 0.3 ? end : naiveEnd
    pageStarts.push(nextCursor)
    cursor = nextCursor
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [A4_W, A4_H],
    compress: true,
  })

  for (let i = 0; i < pageStarts.length; i++) {
    if (i > 0) pdf.addPage()
    const pageStart = pageStarts[i]

    // Fatia a imagem de alta resolução (2×) para a página i
    const canvas = document.createElement('canvas')
    canvas.width = A4_W * 2
    canvas.height = A4_H * 2
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // pageStart está em pixels PDF (= canvas / 2), por isso * 2 abaixo
    ctx.drawImage(imgEl, 0, -(pageStart * 2), A4_W * 2, scaledH * 2)

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_W, A4_H)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdf.output('arraybuffer') as ArrayBuffer
}
