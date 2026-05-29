/**
 * gerarPdfBase — fonte única de geração de PDF para todos os relatórios.
 *
 * Injeta todas as CSSStyleRules do @media print no modo tela antes da
 * captura com html-to-image, replicando o comportamento do window.print().
 * Isso inclui regras estruturais como padding:0 no container DRPS, remoção
 * de borda/sombra, e as regras de quebra de página.
 *
 * Elementos com margin negativa para compensar padding do container (ex: capa
 * DRPS) têm margin sobrescrita para 0 via inline style, evitando overflow
 * fora dos bounds do <main> durante a captura.
 */
export async function gerarPdfBase(): Promise<ArrayBuffer> {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const el = (document.querySelector("main") as HTMLElement | null) ?? document.body;

  // 1. Extrai @page margins da regra CSS da página (se presente).
  //    Usado para reproduzir as mesmas margens que window.print() aplicaria.
  const pageMargins = extractPageMargins();

  // 2. Injeta TODAS as CSSStyleRules do @media print como estilos de tela,
  //    replicando o comportamento do window.print(). Cobre regras de globals.css
  //    (ex: .drps-print-container { padding:0 }, .drps-sumario { display:block }).
  //    As regras de @page são tratadas separadamente em extractPageMargins().
  const printOverride = injectPrintRules();

  // 3. Aplica display para classes Tailwind print:* via inline style.
  //    Tailwind v4 envolve utilitários em @layer utilities — não acessível via
  //    sheet.cssRules — então injectPrintRules() não alcança print:hidden/print:block.
  //    Inline style supera qualquer regra CSS (maior especificidade) e garante:
  //      print:hidden → oculta toolbars, filtros e botões de ação
  //      print:block/flex → mostra logos, sumários e headers print-only
  type DisplayOv = { elem: HTMLElement; orig: string };
  const displayOverrides: DisplayOv[] = [];
  const forceDisplay = (sel: string, val: string) =>
    el.querySelectorAll<HTMLElement>(sel).forEach((e) => {
      displayOverrides.push({ elem: e, orig: e.style.display });
      e.style.display = val;
    });
  // Ordem importa: print:hidden primeiro, depois print:block sobrescreve se necessário
  forceDisplay('[class*="print:hidden"]', "none");
  forceDisplay('[class*="print:block"]', "block");
  forceDisplay('[class*="print:flex"]',  "flex");
  forceDisplay('[class*="print:grid"]',  "grid");

  // 4. Corrige margens negativas das capas.
  //    Em tela: margin negativa compensa o padding do container e o @page margin.
  //    Na captura html-to-image, isso faz a imagem de fundo ser recortada.
  //    A regra @media print { margin: 0 } já estaria em vigor via window.print(),
  //    mas aqui precisamos aplicar manualmente via inline style.
  const capaEls = Array.from(
    el.querySelectorAll<HTMLElement>(
      ".drps-capitulo--capa, .textos-padrao-capitulo--capa"
    )
  );
  const origCapaMargins = capaEls.map((e) => e.style.margin);
  capaEls.forEach((e) => { e.style.margin = "0"; });

  // 4.5 Constrains <main> to A4 content width so html-to-image reflows text at
  //     the same width that window.print() uses. Without this, content at ~1200px
  //     screen width produces far fewer pages than the browser print engine
  //     (which renders at 186mm ≈ 703px content width).
  //     Also zeroes main padding (print:p-0 is in @layer utilities, unreachable by injection).
  const A4_W = 210;
  const A4_H = 297;
  const MT = pageMargins.top;
  const MR = pageMargins.right;
  const MB = pageMargins.bottom;
  const ML = pageMargins.left;
  const contentW = A4_W - ML - MR;
  const a4ContentPx = Math.round((contentW / 25.4) * 96);
  const origEl = {
    padding:  el.style.padding,
    width:    el.style.width,
    maxWidth: el.style.maxWidth,
    minWidth: el.style.minWidth,
    flex:     el.style.flex,
  };
  el.style.padding  = "0";
  el.style.width    = `${a4ContentPx}px`;
  el.style.maxWidth = "none";
  el.style.minWidth = "0";
  el.style.flex     = "none";

  // 5. Aguarda imagens + dois frames para o layout se estabilizar.
  await Promise.allSettled(
    Array.from(el.querySelectorAll<HTMLImageElement>("img")).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
          })
    )
  );
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  // 6. Detecta TODOS os elementos com break-before: page.
  //    Funciona porque injetamos as regras de break no passo 2: agora
  //    getComputedStyle reflete os valores definidos pelo @media print da página,
  //    sem precisar de listas hardcoded por tipo de relatório (DRPS, AET, etc.).
  const mainRect = el.getBoundingClientRect();
  const naturalBreaksCss: number[] = [];
  for (const elem of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
    const cs = getComputedStyle(elem);
    const breaksPage =
      cs.breakBefore === "page" ||
      cs.breakBefore === "always" ||
      cs.getPropertyValue("page-break-before") === "always";
    if (breaksPage) {
      const y = Math.round(elem.getBoundingClientRect().top - mainRect.top);
      if (y > 10) naturalBreaksCss.push(y);
    }
  }
  naturalBreaksCss.sort((a, b) => a - b);

  try {
    const canvas = await toCanvas(el, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      skipFonts: false,
      fetchRequestInit: { mode: "cors", credentials: "omit" },
      filter: (node) => {
        if (node instanceof HTMLElement && node.tagName === "CANVAS") return false;
        return true;
      },
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pxToMm = contentW / canvas.width;
    const pageHeightPx = (A4_H - MT - MB) / pxToMm;
    const pixelRatio = canvas.width / el.offsetWidth;

    // Converte posições CSS → canvas, mescla quebras muito próximas
    const breaksCv = naturalBreaksCss
      .map((y) => Math.round(y * pixelRatio))
      .filter((y) => y > 0 && y < canvas.height)
      .reduce<number[]>((acc, y) => {
        if (acc.length === 0 || y - acc[acc.length - 1] > 30) acc.push(y);
        return acc;
      }, []);

    const segBounds = [0, ...breaksCv, canvas.height];

    const pages: Array<{ y: number; h: number }> = [];
    for (let i = 0; i < segBounds.length - 1; i++) {
      let y = segBounds[i];
      const end = segBounds[i + 1];
      while (y < end) {
        const h = Math.min(pageHeightPx, end - y);
        if (h > 5) pages.push({ y, h });
        y += pageHeightPx;
      }
    }

    // Remove páginas em branco no final (< 8% da altura de uma página)
    while (pages.length > 1 && pages[pages.length - 1].h < pageHeightPx * 0.08) {
      pages.pop();
    }

    let firstPage = true;
    for (const { y: yPx, h: sliceH } of pages) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceH);
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.92),
        "JPEG",
        ML,
        MT,
        contentW,
        sliceH * pxToMm
      );
    }

    return pdf.output("arraybuffer");
  } finally {
    printOverride.remove();
    displayOverrides.forEach(({ elem, orig }) => { elem.style.display = orig; });
    capaEls.forEach((e, i) => { e.style.margin = origCapaMargins[i]; });
    el.style.padding  = origEl.padding;
    el.style.width    = origEl.width;
    el.style.maxWidth = origEl.maxWidth;
    el.style.minWidth = origEl.minWidth;
    el.style.flex     = origEl.flex;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte valor CSS (cm, mm, in, px) para milímetros. */
function cssDimToMm(val: string): number | null {
  const m = val.trim().match(/^([\d.]+)(cm|mm|in|px)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "cm": return n * 10;
    case "mm": return n;
    case "in": return n * 25.4;
    case "px": return n * 0.264583;
    default:   return null;
  }
}

/** Extrai as margens da regra @page do CSS da página. Retorna 10mm se não encontrar. */
function extractPageMargins(): { top: number; right: number; bottom: number; left: number } {
  const def = { top: 10, right: 10, bottom: 10, left: 10 };

  const tryPage = (pageStyle: CSSStyleDeclaration) => {
    // Tenta shorthand "margin" primeiro, depois individualmente
    const shorthand = pageStyle.margin?.trim();
    if (shorthand) {
      const parts = shorthand.split(/\s+/).map(cssDimToMm).filter((v): v is number => v !== null);
      if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
      if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
      if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
      if (parts.length === 4) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    }
    const t = cssDimToMm(pageStyle.marginTop ?? "");
    const r = cssDimToMm(pageStyle.marginRight ?? "");
    const b = cssDimToMm(pageStyle.marginBottom ?? "");
    const l = cssDimToMm(pageStyle.marginLeft ?? "");
    if (t !== null && r !== null && b !== null && l !== null) {
      return { top: t, right: r, bottom: b, left: l };
    }
    return null;
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        // @page no nível raiz
        if (rule instanceof CSSPageRule) {
          const found = tryPage(rule.style);
          if (found) return found;
        }
        // @page dentro de @media print
        if (rule instanceof CSSMediaRule && rule.media.mediaText.includes("print")) {
          for (const inner of Array.from(rule.cssRules)) {
            if (inner instanceof CSSPageRule) {
              const found = tryPage(inner.style);
              if (found) return found;
            }
          }
        }
      }
    } catch {
      // Folha cross-origin — ignorada
    }
  }

  return def;
}

/**
 * Injeta todas as CSSStyleRules do @media print como estilos de tela normais,
 * simulando o que o browser aplica ao imprimir. Regras @page são ignoradas
 * aqui (tratadas por extractPageMargins).
 *
 * Retorna o elemento <style> para ser removido no finally.
 */
function injectPrintRules(): HTMLStyleElement {
  const style = document.createElement("style");
  style.id = "pdf-print-override";
  const lines: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSMediaRule) || !rule.media.mediaText.includes("print")) continue;
        for (const inner of Array.from(rule.cssRules)) {
          if (inner instanceof CSSStyleRule) {
            lines.push(inner.cssText);
          }
        }
      }
    } catch {
      // Folha cross-origin (Google Fonts etc.) — ignorada
    }
  }

  style.textContent = lines.join("\n");
  document.head.appendChild(style);
  return style;
}
