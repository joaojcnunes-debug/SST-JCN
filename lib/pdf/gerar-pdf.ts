/**
 * Wrapper centralizado de geração de PDF via Puppeteer.
 *
 * Vercel serverless:    puppeteer-core + @sparticuz/chromium
 * Dev local / Electron: puppeteer-core + Chrome ou Edge do sistema
 *
 * Usar apenas em route handlers Node.js (nunca em Client Components ou Edge).
 */

import { existsSync } from 'fs'

export interface GerarPdfOpts {
  /** Margens da página. Padrão: 20mm topo/base, 15mm laterais. */
  margens?: {
    top: string
    bottom: string
    left: string
    right: string
  }
  /** Imprime fundos e cores CSS. Padrão: true. */
  printBackground?: boolean
  /** Exibe "página X / Y" no rodapé à direita de TODAS as páginas. Padrão: false. */
  numeroPaginas?: boolean
  /**
   * Numera no rodapé à direita SOMENTE as páginas após o elemento que casa com
   * este seletor CSS (ex.: '[data-slug="sumario"]'). As páginas iniciais
   * (capa, sumário) ficam sem número; a contagem recomeça em 1 na primeira
   * página de conteúdo. Implementado via pdf-lib (o footer do Puppeteer não
   * permite deslocar a numeração).
   */
  numeroPaginasAposSeletor?: string
  /**
   * Quando true, deixa o Chromium honrar o tamanho/orientação definidos no CSS
   * via `@page` (`size: A4 landscape`, etc.) — necessário para capítulos em
   * paisagem por seção. Implica REMOVER `format: 'A4'` (senão ele sobrescreve o
   * CSS). Default false (mantém A4 retrato global; sem regressão nos demais laudos).
   * Use só em templates que definem `@page` explicitamente (tamanho E margem).
   */
  preferCssPageSize?: boolean
  /**
   * Capa full-bleed: a capa (`.tp-capa { page: capa }`) ocupa a folha inteira,
   * sem moldura branca. Implementado com `@page capa { margin: 0 }` honrado via
   * preferCSSPageSize — único jeito confiável (margem negativa NÃO sangra para a
   * área de margem da página no Chromium). As demais páginas mantêm as margens
   * normais (vêm da opção `margens`, pois o `@page` padrão não declara margem).
   */
  capaFullBleed?: boolean
}

/** Converte "12mm" → pontos PDF (1pt = 1/72in). */
function mmParaPt(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? (n * 72) / 25.4 : 34
}

const MARGENS_PADRAO: NonNullable<GerarPdfOpts['margens']> = {
  top: '20mm',
  bottom: '20mm',
  left: '15mm',
  right: '15mm',
}

/** Caminhos comuns do Chrome/Edge por plataforma. */
const SYSTEM_CHROME_PATHS: string[] =
  process.platform === 'win32'
    ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ]

function findSystemChrome(): string {
  const found = SYSTEM_CHROME_PATHS.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      'Nenhum browser compatível encontrado no sistema. ' +
        'Instale o Google Chrome ou Microsoft Edge para gerar PDFs.',
    )
  }
  return found
}

/**
 * Converte uma string HTML completa em buffer de PDF A4.
 *
 * O HTML deve ser autocontido: CSS em <style>, imagens como data URIs ou URLs
 * acessíveis ao browser headless. Regras @media print são aplicadas pelo Puppeteer.
 */
export async function gerarPdf(
  html: string,
  opts?: GerarPdfOpts,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: { newPage(): Promise<any>; close(): Promise<void> }

  if (process.env.VERCEL) {
    // Vercel serverless: @sparticuz/chromium (binário baixado no build via camada)
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ])
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 }, // A4 a 96dpi (210mm × 297mm)
      executablePath: await chromium.executablePath(),
      headless: 'shell' as never,
    })
  } else {
    // Dev local / Electron prod: puppeteer-core + Chrome ou Edge do sistema
    const executablePath = findSystemChrome()
    const { default: puppeteer } = await import('puppeteer-core')
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }

  try {
    const page = await browser.newPage()
    const margens = opts?.margens ?? MARGENS_PADRAO
    // Capa full-bleed: define a named page `capa` sem margem. A `.tp-capa` usa
    // `page: capa` e ocupa a folha inteira; as demais páginas seguem com as
    // margens normais (a opção `margens` abaixo, já que o `@page` padrão não
    // declara margem). Requer preferCSSPageSize para o Chromium honrar o @page.
    const capaCss = opts?.capaFullBleed
      ? `<style>@page{size:A4 portrait;}@page capa{size:A4 portrait;margin:0;}</style>`
      : ''
    await page.setContent(capaCss + html, { waitUntil: 'networkidle0' })
    const seletor = opts?.numeroPaginasAposSeletor

    // Com preferCssPageSize, o tamanho/orientação vêm do CSS @page (necessário
    // p/ paisagem por capítulo) — e NÃO se passa `format` (ele sobrescreveria).
    // Sem a flag (default), mantém o A4 retrato global de sempre.
    const basePdfOpts = (opts?.preferCssPageSize || opts?.capaFullBleed)
      ? {
          printBackground: opts?.printBackground ?? true,
          margin: margens,
          preferCSSPageSize: true as const,
        }
      : {
          format: 'A4' as const,
          printBackground: opts?.printBackground ?? true,
          margin: margens,
        }

    // Caso A: numeração a partir de um seletor — pdf-lib desenha "X / Y" só nas
    // páginas após o miolo inicial (capa/sumário), recomeçando em 1.
    if (seletor) {
      const fullRaw = await page.pdf(basePdfOpts)
      let offset = 0
      try {
        const achou = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel)
          if (!el) return false
          let n = el.nextElementSibling
          while (n) {
            const prox = n.nextElementSibling
            n.remove()
            n = prox
          }
          return true
        }, seletor)
        if (achou) {
          const frontRaw = await page.pdf(basePdfOpts)
          const { PDFDocument } = await import('pdf-lib')
          offset = (await PDFDocument.load(frontRaw)).getPageCount()
        }
      } catch {
        offset = 0
      }

      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const doc = await PDFDocument.load(fullRaw)
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const pages = doc.getPages()
      const numeradas = Math.max(0, pages.length - offset)
      const margemDir = mmParaPt(margens.right)
      for (let i = offset; i < pages.length; i++) {
        const p = pages[i]
        const { width } = p.getSize()
        const txt = `${i - offset + 1} / ${numeradas}`
        const size = 8
        const w = font.widthOfTextAtSize(txt, size)
        p.drawText(txt, {
          x: width - margemDir - w,
          y: 18,
          size,
          font,
          color: rgb(0.42, 0.45, 0.5),
        })
      }
      return Buffer.from(await doc.save())
    }

    // Caso B: numeração simples em todas as páginas (footer do Puppeteer).
    const footerTemplate = opts?.numeroPaginas
      ? `<div style="width:100%; font-size:8px; color:#6b7280; font-family: Arial, Helvetica, sans-serif; padding:0 ${margens.right}; text-align:right;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`
      : '<div></div>'
    const raw = await page.pdf({
      ...basePdfOpts,
      displayHeaderFooter: !!opts?.numeroPaginas,
      headerTemplate: '<div></div>',
      footerTemplate,
    })
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
  } finally {
    await browser.close()
  }
}
