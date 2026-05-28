/**
 * Captura o conteúdo do elemento <main> da página atual como PDF (A4).
 * Usa html-to-image (SVG foreignObject) para renderizar o DOM — suporta
 * CSS moderno incluindo oklch() do Tailwind v4 — e jsPDF para o arquivo.
 *
 * Comportamento de visibilidade (simula @media print):
 *  - Oculta elementos com classe  print:hidden
 *  - Exibe   elementos com classe  print:block / flex / table / inline
 *  - Exibe   seções print-only do globals.css (.drps-sumario etc.)
 *  - Corrige margens negativas de capas (compensam @page em tela)
 *  - Detecta quebras de página naturais (.drps-sumario, .drps-setor-bloco etc.)
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

  // 2. Exibe elementos print-only
  const printOnlySelectors = [
    '[class*="print:block"]',
    '[class*="print:flex"]',
    '[class*="print:table"]',
    '[class*="print:inline"]',
    ".drps-sumario",
    ".drps-gestao-resumo-print",
    ".drps-extras-print",
    ".drps-capitulos",
    ".drps-conclusao-geral-print",
    ".aet-sumario",
    ".textos-padrao-capitulos",
    ".conformidade-situacao-print",
    ".relacao-maquinas-footer-print",
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

  // 3. Corrige margens negativas das capas.
  //    Em tela: margin: -1.5rem (DRPS) ou -3cm (TextosPadrao) compensam o padding
  //    do container e o @page margin. Isso faz a capa ultrapassar os bounds do
  //    <main> e o html-to-image corta a imagem de fundo.
  //    Na impressão esse CSS já está em @media print { margin: 0 }, então anulamos
  //    aqui também antes da captura.
  const capaEls = Array.from(
    el.querySelectorAll<HTMLElement>(
      ".drps-capitulo--capa, .textos-padrao-capitulo--capa"
    )
  );
  const origCapaMargins = capaEls.map((e) => e.style.margin);
  capaEls.forEach((e) => { e.style.margin = "0"; });

  // 4. Aguarda todas as <img> carregarem antes de capturar
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

  // 5. Aguarda um frame para o layout se estabilizar após as mudanças acima
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  // 6. Detecta posições Y de quebras de página naturais (antes do toCanvas
  //    para coordenadas ainda válidas no DOM atual)
  const mainRect = el.getBoundingClientRect();

  // Seletores que no @media print têm break-before: page
  const pageBreakSelectors = [
    ".drps-sumario",          // sumário começa em página nova
    ".drps-setor-bloco",      // cada setor começa em página nova
    ".drps-gestao-resumo-print",
    ".drps-extras-print",
  ];

  const naturalBreaksCss: number[] = [];
  for (const sel of pageBreakSelectors) {
    el.querySelectorAll<HTMLElement>(sel).forEach((elem) => {
      const y = Math.round(elem.getBoundingClientRect().top - mainRect.top);
      if (y > 10) naturalBreaksCss.push(y); // ignora posições no topo
    });
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

    // Converte posições CSS → coordenadas do canvas, mescla duplicatas próximas
    const breaksCv = naturalBreaksCss
      .map((y) => Math.round(y * pixelRatio))
      .filter((y) => y > 0 && y < canvas.height)
      .reduce<number[]>((acc, y) => {
        if (acc.length === 0 || y - acc[acc.length - 1] > 30) acc.push(y);
        return acc;
      }, []);

    const segBounds = [0, ...breaksCv, canvas.height];

    // Divide cada segmento em páginas A4 (slice mecânico se segmento > 1 página)
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

    // Remove páginas em branco no final (< 8 % da altura de uma página)
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
    toHide.forEach((e, i) => { e.style.display = origHideDisplay[i]; });
    toShow.forEach((e, i) => { e.style.display = origShowDisplay[i]; });
    capaEls.forEach((e, i) => { e.style.margin = origCapaMargins[i]; });
  }
}
