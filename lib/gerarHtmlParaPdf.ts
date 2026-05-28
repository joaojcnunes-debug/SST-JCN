/**
 * Captura o HTML da página atual e envia ao serviço Puppeteer (Railway)
 * para gerar um PDF A4 nativo — com camada de texto real e quebras de
 * página aplicadas pelo Chrome via @media print CSS.
 *
 * Por que Railway em vez de html-to-image:
 *   - page.pdf() usa o motor de impressão nativo do Chrome
 *   - Respeita break-before: page, @page margins, print:block/hidden
 *   - Gera PDF com texto selecionável (não imagens JPEG)
 *   - Compatível com assinatura digital ICP-Brasil A1 via @signpdf
 *
 * Fluxo:
 *   1. POST /api/pdf/token  → token HMAC de 2 min (valida sessão Supabase)
 *   2. Clona DOM, remove overlays e print:hidden
 *   3. POST direto ao Railway /render (sem passar pelo Vercel — sem timeout)
 *   4. Retorna ArrayBuffer com o PDF
 */
export async function gerarHtmlParaPdf(): Promise<ArrayBuffer> {
  // 1. Token de curta duração para autenticar junto ao Railway
  const tokenRes = await fetch("/api/pdf/token", { method: "POST" });
  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? "Erro ao autorizar geração de PDF"
    );
  }
  const { token, serviceUrl } = (await tokenRes.json()) as {
    token: string;
    serviceUrl: string;
  };

  // 2. Clona o DOM sem tocar no DOM ativo (modal continua aberto)
  const clone = document.documentElement.cloneNode(true) as HTMLElement;

  // Remove elementos com print:hidden — reduz payload e garante ausência no PDF
  clone
    .querySelectorAll<HTMLElement>('[class*="print:hidden"]')
    .forEach((el) => el.remove());

  // Remove portais renderizados como filhos diretos de <body> fora do root
  // Next.js (modais via createPortal, toasts, tooltips, etc.).
  // O root Next.js é o primeiro filho de <body>; todo o restante é portal.
  const cloneBody = clone.querySelector("body");
  if (cloneBody) {
    const nextRoot = cloneBody.firstElementChild;
    Array.from(cloneBody.children).forEach((child) => {
      if (child !== nextRoot) child.remove();
    });
  }

  const html = clone.outerHTML;

  // 3. Chama o serviço Railway diretamente do browser.
  //    Isso evita o timeout de 10s das Serverless Functions do Vercel Hobby.
  //    O serviço aplica page.pdf() com @media print do Chrome.
  const pdfRes = await fetch(`${serviceUrl}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, html, baseUrl: window.location.origin }),
  });

  if (!pdfRes.ok) {
    const body = await pdfRes.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? "Erro ao gerar PDF no serviço"
    );
  }

  return pdfRes.arrayBuffer();
}
