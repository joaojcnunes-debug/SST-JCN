// Exporta um QpsTipo completo como Word (.docx) ou Excel (.xlsx para re-importação).

import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
} from "docx";
import type { QpsTipo, QpsCategoria, QpsPergunta } from "@/lib/supabase/types";

export function slugifyExport(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);
}

function labelsEscala(min: number, max: number): string[] {
  const n = max - min + 1;
  if (n === 2) return ["Não", "Sim"];
  if (n === 3) return ["Baixo", "Médio", "Alto"];
  if (n === 4) return ["Nunca", "Às vezes", "Frequentemente", "Sempre"];
  if (n === 5) return ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"];
  if (n === 6) return ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Muito frequentemente", "Sempre"];
  if (n === 7) return ["Discordo totalmente", "Discordo muito", "Discordo", "Neutro", "Concordo", "Concordo muito", "Concordo totalmente"];
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? "Mínimo" : i === n - 1 ? "Máximo" : String(min + i)
  );
}

// ─── Word (.docx) ─────────────────────────────────────────────────────────────

export async function gerarWordTipo(
  tipo: QpsTipo,
  categorias: QpsCategoria[],
  perguntas: QpsPergunta[]
): Promise<Blob> {
  const labels = labelsEscala(tipo.escala_min, tipo.escala_max);
  const escalaLinha = labels.map((l, i) => `${tipo.escala_min + i} = ${l}`).join("   |   ");

  const children: Paragraph[] = [];

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: tipo.nome, bold: true, size: 40, color: "1E3A5F" })],
      spacing: { after: 100 },
    })
  );

  if (tipo.descricao) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: tipo.descricao, color: "555555", size: 22, italics: true })],
        spacing: { after: 200 },
      })
    );
  }

  // ── Escala ─────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Escala de resposta: ", bold: true, size: 22 }),
        new TextRun({ text: `${tipo.escala_min} a ${tipo.escala_max}`, size: 22 }),
      ],
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: escalaLinha, size: 20, italics: true, color: "3B4DB8" })],
      spacing: { after: 240 },
    })
  );

  // ── Instruções ─────────────────────────────────────────────────────────────
  if (tipo.instrucoes) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Instruções ao respondente", bold: true, size: 24, color: "1E3A5F" })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { color: "CCCCDD", size: 6, style: BorderStyle.SINGLE } },
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: tipo.instrucoes, size: 22 })],
        spacing: { after: 320 },
      })
    );
  }

  // ── Categorias e perguntas ─────────────────────────────────────────────────
  const catsOrdenadas = [...categorias].sort((a, b) => a.ordem - b.ordem);
  let numGlobal = 1;

  for (const cat of catsOrdenadas) {
    const pergsCat = perguntas
      .filter((p) => p.id_categoria === cat.id_categoria)
      .sort((a, b) => a.ordem - b.ordem);
    if (pergsCat.length === 0) continue;

    children.push(
      new Paragraph({
        children: [new TextRun({ text: cat.nome.toUpperCase(), bold: true, size: 26, color: "2D3282" })],
        spacing: { before: 480, after: 160 },
        border: { bottom: { color: "B0B8E0", size: 6, style: BorderStyle.SINGLE } },
      })
    );

    if (cat.descricao) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: cat.descricao, color: "888888", size: 20, italics: true })],
          spacing: { after: 120 },
        })
      );
    }

    for (const p of pergsCat) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${numGlobal}.  `, bold: true, size: 22, color: "111111" }),
            new TextRun({ text: p.texto, size: 22 }),
          ],
          spacing: { before: 180, after: 60 },
          indent: { left: 360 },
        })
      );

      const logicaLabel =
        p.logica === "direta"
          ? "Direta (↑ = maior exposição ao risco)"
          : "Invertida (↑ = menor exposição / situação favorável)";

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Lógica: ${logicaLabel}`, italics: true, size: 18, color: "888888" }),
          ],
          spacing: { after: 40 },
          indent: { left: 720 },
        })
      );

      children.push(
        new Paragraph({
          children: [new TextRun({ text: escalaLinha, size: 18, color: "3B4DB8" })],
          spacing: { after: 80 },
          indent: { left: 720 },
        })
      );

      numGlobal++;
    }
  }

  const doc = new Document({
    creator: "Chabra SST",
    title: tipo.nome,
    description: tipo.descricao ?? undefined,
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

// ─── Excel para re-importação ─────────────────────────────────────────────────
// Formato idêntico ao que o "Importar Excel" espera: Categoria | Pergunta | Lógica

export function gerarExcelExportTipo(
  tipo: QpsTipo,
  categorias: QpsCategoria[],
  perguntas: QpsPergunta[]
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const catsOrdenadas = [...categorias].sort((a, b) => a.ordem - b.ordem);
  const rows: string[][] = [["Categoria", "Pergunta", "Lógica"]];

  for (const cat of catsOrdenadas) {
    const pergsCat = perguntas
      .filter((p) => p.id_categoria === cat.id_categoria)
      .sort((a, b) => a.ordem - b.ordem);
    for (const p of pergsCat) {
      rows.push([cat.nome, p.texto, p.logica]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 70 }, { wch: 12 }];

  // Nome da aba = nome do tipo (limite 31 chars do Excel)
  XLSX.utils.book_append_sheet(wb, ws, tipo.nome.slice(0, 31));

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
