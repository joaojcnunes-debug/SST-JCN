/**
 * Captura o conteúdo do elemento <main> da página atual como PDF (A4).
 * Usa html-to-image (SVG foreignObject) para renderizar o DOM — suporta
 * CSS moderno incluindo oklch() do Tailwind v4 — e jsPDF para o arquivo.
 *
 * Comportamento de visibilidade (simula @media print):
 *  - Oculta elementos com classe  print:hidden
 *  - Exibe   elementos com classe  print:block  que estejam hidden na tela
 */
export async function gerarPdfDaPagina(): Promise<ArrayBuffer> {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const el = (document.querySelector("main") as HTMLElement | null) ?? document.body;

  // 1. Oculta elementos screen-only (print:hidden)
  const toHide = Array.from(
    el.querySelectorAll<HTMLElement>('[class*="print:hidden"]')
  );
  const origHideDisplay = toHide.map((e) => e.style.display);
  toHide.forEach((e) => { e.style.display = "none"; });

  // 2. Exibe elementos print-only (ocultos na tela mas visíveis na impressão)
  //    Inclui: print:block, print:flex, print:table, print:inline-block
  const printOnlySelectors = [
    '[class*="print:block"]',
    '[class*="print:flex"]',
    '[class*="print:table"]',
    '[class*="print:inline"]',
  ];
  const toShow = Array.from(
    new Set(
      printOnlySelectors.flatMap((sel) =>
        Array.from(el.querySelectorAll<HTMLElement>(sel))
      )
    )
  ).filter((e) => getComputedStyle(e).display === "none");
  const origShowDisplay = toShow.map((e) => e.style.display);
  toShow.forEach((e) => { e.style.display = "block"; });

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

    let yPx = 0;
    let firstPage = true;

    while (yPx < canvas.height) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const sliceH = Math.min(pageHeightPx, canvas.height - yPx);

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceH);
      const ctx = slice.getContext("2d")!;
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

      yPx += pageHeightPx;
    }

    return pdf.output("arraybuffer");
  } finally {
    // Restaura visibilidade original
    toHide.forEach((e, i) => { e.style.display = origHideDisplay[i]; });
    toShow.forEach((e, i) => { e.style.display = origShowDisplay[i]; });
  }
}
