// Merge de anexos no PDF do laudo (server-side, vetorial).
// - PDFs: páginas reais mescladas via pdf-lib (texto selecionável preservado).
// - Imagens: embutidas como páginas A4 inteiras.
// - Outros arquivos: ficam apenas no índice de anexos (não embutíveis).
//
// Roda nas rotas /api/pdf/<modulo>/[id] APÓS gerarPdf(), antes de devolver.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { TipoAnexo } from "@/lib/anexos/types";

export interface AnexoParaMerge {
  nome: string;
  descricao?: string | null;
  url: string;
  mime?: string | null;
  tipo: TipoAnexo;
}

const A4 = { w: 595.28, h: 841.89 };

async function baixarBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Mescla os anexos no PDF do laudo e devolve os bytes finais.
 * Se não houver anexos, devolve o laudo inalterado.
 */
export async function mesclarAnexos(
  laudoPdf: Uint8Array | Buffer,
  anexos: AnexoParaMerge[],
): Promise<Uint8Array> {
  const base = laudoPdf instanceof Uint8Array ? laudoPdf : new Uint8Array(laudoPdf);
  if (anexos.length === 0) return base;

  const doc = await PDFDocument.load(base);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const trunc = (s: string) => (s.length > 95 ? s.slice(0, 95) + "…" : s);
  // O título "ANEXOS" sai UMA vez, no topo da primeira página de anexo (junto do
  // conteúdo) — sem página de índice separada/vazia. `headingPendente` controla
  // isso; retorna o `y` disponível após desenhar o título quando aplicável.
  let headingPendente = true;
  const desenharTitulo = (page: ReturnType<typeof doc.addPage>, topo: number): number => {
    if (!headingPendente) return topo;
    page.drawText("ANEXOS", { x: margin, y: topo - 18, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    headingPendente = false;
    return topo - 18 - 16;
  };

  // Arquivos não exibíveis (doc/xls/PDF ilegível): listados numa página ao final.
  const naoExibiveis: AnexoParaMerge[] = [];

  for (const a of anexos) {
    const bytes = await baixarBytes(a.url);
    if (!bytes) { naoExibiveis.push(a); continue; }

    if (a.tipo === "pdf") {
      try {
        const externo = await PDFDocument.load(bytes, { ignoreEncryption: true });
        // Não dá pra sobrepor o título numa página de PDF externo; se o título
        // ainda não saiu, cria uma divisória curta só com "ANEXOS" antes dele.
        if (headingPendente) {
          const div = doc.addPage([A4.w, A4.h]);
          desenharTitulo(div, A4.h - margin);
        }
        const paginas = await doc.copyPages(externo, externo.getPageIndices());
        paginas.forEach((p) => doc.addPage(p));
      } catch {
        naoExibiveis.push(a); // PDF ilegível/criptografado
      }
    } else if (a.tipo === "imagem") {
      try {
        const img = (a.mime ?? "").includes("png")
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const page = doc.addPage([A4.w, A4.h]);
        // Título (só na 1ª) + legenda no topo; imagem preenche o espaço restante.
        const topo = desenharTitulo(page, A4.h - margin);
        const legenda = `${a.nome}${a.descricao ? " — " + a.descricao : ""}`;
        page.drawText(trunc(legenda), { x: margin, y: topo - 10, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        const capBottom = topo - 22;
        const maxW = A4.w - margin * 2;
        const maxH = capBottom - margin;
        const escala = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        page.drawImage(img, { x: (A4.w - w) / 2, y: margin + (maxH - h) / 2, width: w, height: h });
      } catch {
        naoExibiveis.push(a); // imagem inválida
      }
    } else {
      naoExibiveis.push(a); // 'arquivo' (doc/xls/etc): não embutível
    }
  }

  // Lista dos não exibíveis (se houver) — também serve de marcador quando NENHUM
  // anexo era exibível (aí o título "ANEXOS" sai aqui).
  if (naoExibiveis.length > 0) {
    const page = doc.addPage([A4.w, A4.h]);
    const topo = desenharTitulo(page, A4.h - margin);
    page.drawText("Arquivos anexos (não exibíveis no PDF):", {
      x: margin, y: topo - 12, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2),
    });
    let y = topo - 34;
    naoExibiveis.forEach((a, i) => {
      if (y < margin) return;
      const linha = `${i + 1}. ${a.nome}${a.descricao ? " — " + a.descricao : ""}`;
      page.drawText(trunc(linha), { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 16;
    });
  }

  return await doc.save();
}
