/**
 * Captura o conteúdo do elemento <main> da página atual como PDF (A4).
 * Usa html-to-image (SVG foreignObject) para renderizar o DOM — suporta
 * CSS moderno incluindo oklch() do Tailwind v4 — e jsPDF para o arquivo.
 * Elementos com a classe print:hidden são ocultados temporariamente.
 */
export async function gerarPdfDaPagina(): Promise<ArrayBuffer> {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const el = (document.querySelector("main") as HTMLElement | null) ?? document.body;

  // Oculta temporariamente elementos que não devem aparecer no PDF
  const toHide = Array.from(
    el.querySelectorAll<HTMLElement>('[class*="print:hidden"]')
  );
  const origDisplay = toHide.map((e) => e.style.display);
  toHide.forEach((e) => {
    e.style.display = "none";
  });

  try {
    const canvas = await toCanvas(el, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      // Evita erros de CORS em imagens externas (logos, assinaturas)
      skipFonts: false,
      fetchRequestInit: { mode: "cors" },
    });

    // Dimensões A4 em mm com margem de 10 mm
    const A4_W = 210;
    const A4_H = 297;
    const MARGIN = 10;
    const contentW = A4_W - 2 * MARGIN; // 190 mm

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Quantos mm vale cada pixel do canvas
    const pxToMm = contentW / canvas.width;
    // Quantos pixels cabem na área útil de uma página A4
    const pageHeightPx = (A4_H - 2 * MARGIN) / pxToMm;

    let yPx = 0;
    let firstPage = true;

    while (yPx < canvas.height) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const sliceH = Math.min(pageHeightPx, canvas.height - yPx);

      // Extrai fatia vertical do canvas para esta página
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceH);
      const ctx = slice.getContext("2d")!;
      ctx.drawImage(
        canvas,
        0, yPx, canvas.width, sliceH,  // fonte
        0, 0,   canvas.width, sliceH   // destino
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
    // Restaura visibilidade dos elementos ocultados
    toHide.forEach((e, i) => {
      e.style.display = origDisplay[i];
    });
  }
}
