/**
 * Captura o conteúdo do elemento <main> da página atual como PDF (A4).
 * Usa html2canvas para renderizar o DOM e jsPDF para gerar o arquivo.
 * Elementos com a classe print:hidden são ocultados temporariamente.
 */
export async function gerarPdfDaPagina(): Promise<ArrayBuffer> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
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
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      // Força largura desktop para layout consistente
      windowWidth: Math.max(el.scrollWidth, 1200),
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
        0, yPx, canvas.width, sliceH,   // fonte
        0, 0,   canvas.width, sliceH    // destino
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
