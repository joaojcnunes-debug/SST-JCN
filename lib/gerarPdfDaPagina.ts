/**
 * Captura o conteúdo do elemento <main> da página atual como PDF (A4).
 *
 * Simula @media print injetando todas as regras de impressão dos stylesheets
 * carregados — isso inclui print:hidden, print:block, break-before: page e
 * qualquer regra customizada do globals.css. O resultado é idêntico ao que
 * o browser renderizaria no modo de impressão (window.print()).
 */
export async function gerarPdfDaPagina(): Promise<ArrayBuffer> {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const el = (document.querySelector("main") as HTMLElement | null) ?? document.body;

  // 1. Extrai todas as regras @media print dos stylesheets carregados e injeta
  //    sem o wrapper, forçando o browser a aplicá-las imediatamente.
  //    Isso substitui o toggle manual de print:hidden/print:block e garante
  //    que QUALQUER regra de impressão (Tailwind, globals.css, etc.) seja aplicada.
  const printOverride = document.createElement("style");
  printOverride.id = "pdf-print-override";
  const printRules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSMediaRule && rule.media.mediaText.includes("print")) {
          for (const inner of Array.from(rule.cssRules)) {
            printRules.push(inner.cssText);
          }
        }
      }
    } catch {
      // Folha cross-origin (ex: Google Fonts) — ignorada silenciosamente
    }
  }
  printOverride.textContent = printRules.join("\n");
  document.head.appendChild(printOverride);

  // 2. Corrige margens negativas das capas.
  //    Em tela: margin negativa compensa o padding do container e o @page margin.
  //    No PDF essa margem corta a imagem de fundo, por isso zeramos aqui.
  const capaEls = Array.from(
    el.querySelectorAll<HTMLElement>(
      ".drps-capitulo--capa, .textos-padrao-capitulo--capa"
    )
  );
  const origCapaMargins = capaEls.map((e) => e.style.margin);
  capaEls.forEach((e) => { e.style.margin = "0"; });

  // 3. Aguarda imagens + dois frames para o layout se estabilizar com as
  //    regras de impressão injetadas (elementos ocultos/visíveis mudam o fluxo).
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

  // 4. Detecta elementos com break-before: page.
  //    Como o print CSS já está ativo, getComputedStyle reflete as regras de
  //    impressão — sem precisar de seletores hardcoded por tipo de relatório.
  const mainRect = el.getBoundingClientRect();
  const naturalBreaksCss: number[] = [];
  for (const elem of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
    const cs = getComputedStyle(elem);
    if (cs.breakBefore === "page" || cs.pageBreakBefore === "always") {
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

    const A4_W = 210;
    const A4_H = 297;
    const MARGIN = 10;
    const contentW = A4_W - 2 * MARGIN;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pxToMm = contentW / canvas.width;
    const pageHeightPx = (A4_H - 2 * MARGIN) / pxToMm;
    const pixelRatio = canvas.width / el.offsetWidth;

    // Converte posições CSS → coordenadas do canvas; mescla quebras muito próximas
    const breaksCv = naturalBreaksCss
      .map((y) => Math.round(y * pixelRatio))
      .filter((y) => y > 0 && y < canvas.height)
      .reduce<number[]>((acc, y) => {
        if (acc.length === 0 || y - acc[acc.length - 1] > 30) acc.push(y);
        return acc;
      }, []);

    const segBounds = [0, ...breaksCv, canvas.height];

    // Divide cada segmento em páginas A4 (slice mecânico se > 1 página)
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
      ctx.drawImage(
        canvas,
        0, yPx, canvas.width, sliceH,
        0, 0,   canvas.width, sliceH
      );

      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.92),
        "JPEG",
        MARGIN,
        MARGIN,
        contentW,
        sliceH * pxToMm
      );
    }

    return pdf.output("arraybuffer");
  } finally {
    printOverride.remove();
    capaEls.forEach((e, i) => { e.style.margin = origCapaMargins[i]; });
  }
}
