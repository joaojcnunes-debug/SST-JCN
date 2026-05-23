// Gera modelos para facilitar a configuração do Google Forms e a importação de CSV.

import * as XLSX from "xlsx";
import type { QpsPergunta, QpsCategoria, QpsTipo } from "@/lib/supabase/types";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

// ─── Labels genéricos por tamanho da escala ───────────────────────────────────

function labelsEscala(min: number, max: number): string[] {
  const n = max - min + 1;
  if (n === 2) return ["Não", "Sim"];
  if (n === 3) return ["Baixo", "Médio", "Alto"];
  if (n === 4) return ["Nunca", "Às vezes", "Frequentemente", "Sempre"];
  if (n === 5) return ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"];
  if (n === 6) return ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Muito frequentemente", "Sempre"];
  if (n === 7) return ["Discordo totalmente", "Discordo muito", "Discordo", "Neutro", "Concordo", "Concordo muito", "Concordo totalmente"];
  // fallback genérico
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? "Mínimo" : i === n - 1 ? "Máximo" : String(min + i)
  );
}

// ─── Excel modelo (.xlsx) ──────────────────────────────────────────────────────

export function gerarModeloExcelQps(
  perguntasOrdenadas: QpsPergunta[],
  categorias: QpsCategoria[],
  tipo: QpsTipo
): { buffer: ArrayBuffer; nomeArquivo: string } {
  const mid = Math.round((tipo.escala_min + tipo.escala_max) / 2);
  const escalaStr = `${tipo.escala_min} a ${tipo.escala_max}`;
  const labels = labelsEscala(tipo.escala_min, tipo.escala_max);
  const legendaEscala = labels
    .map((l, i) => `${tipo.escala_min + i} = ${l}`)
    .join("  |  ");

  const wb = XLSX.utils.book_new();

  // ── Aba 1: Respostas ──────────────────────────────────────────────────────
  const linhaContexto = [
    `Tipo: ${tipo.nome}  |  Escala: ${escalaStr}  |  ${legendaEscala}`,
  ];
  const cabecalho = [
    "Carimbo de data/hora",
    "Setor",
    "Cargo",
    ...perguntasOrdenadas.map((p, i) => `P${i + 1}: ${p.texto}`),
  ];
  // Linha de referência de escala abaixo do cabeçalho
  const linhaEscala = [
    "(data/hora automática)",
    "(texto — obrigatório)",
    "(texto — opcional)",
    ...perguntasOrdenadas.map(() => `← ${escalaStr} →`),
  ];
  const exemplos = [
    ["01/01/2024 09:00:00", "Administrativo", "Analista", ...perguntasOrdenadas.map(() => tipo.escala_max)],
    ["01/01/2024 09:10:00", "Operacional",    "Operador", ...perguntasOrdenadas.map(() => mid)],
    ["01/01/2024 09:20:00", "Comercial",      "Gerente",  ...perguntasOrdenadas.map(() => tipo.escala_min)],
  ];

  const wsImport = XLSX.utils.aoa_to_sheet([linhaContexto, cabecalho, linhaEscala, ...exemplos]);
  wsImport["!cols"] = [
    { wch: 24 }, { wch: 20 }, { wch: 18 },
    ...perguntasOrdenadas.map(() => ({ wch: 12 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsImport, "Respostas");

  // ── Aba 2: Referência das perguntas ───────────────────────────────────────
  const refLinhas: (string | number)[][] = [
    ["Nº Col", "Categoria", "Pergunta", "Lógica", `Escala: ${escalaStr}`],
  ];
  const catsOrdenadas = [...categorias].sort((a, b) => a.ordem - b.ordem);
  let numCol = 4;
  for (const cat of catsOrdenadas) {
    const pergs = perguntasOrdenadas.filter((p) => p.id_categoria === cat.id_categoria);
    for (const p of pergs) {
      refLinhas.push([
        numCol,
        cat.nome,
        p.texto,
        p.logica === "direta" ? "Direta (↑ = mais exposição)" : "Invertida (↑ = menos exposição)",
        `${tipo.escala_min} – ${tipo.escala_max}`,
      ]);
      numCol++;
    }
  }
  const wsRef = XLSX.utils.aoa_to_sheet(refLinhas);
  wsRef["!cols"] = [{ wch: 8 }, { wch: 26 }, { wch: 60 }, { wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Referência Perguntas");

  // ── Aba 3: Legenda da escala ──────────────────────────────────────────────
  const legLinhas: (string | number)[][] = [
    [`LEGENDA — ${tipo.nome}`],
    [],
    ["Escala de resposta:", escalaStr],
    [],
    ["Valor", "Significado"],
    ...labels.map((l, i) => [tipo.escala_min + i, l]),
  ];

  if (tipo.instrucoes) {
    legLinhas.push([], ["Instrução ao respondente:"], [tipo.instrucoes]);
  }

  legLinhas.push(
    [],
    ["Como responder (lógica das perguntas):"],
    ["Direta", "Valores altos = maior exposição ao risco psicossocial"],
    ["Invertida", "Valores altos = menor exposição (situação favorável)"]
  );

  const wsLeg = XLSX.utils.aoa_to_sheet(legLinhas);
  wsLeg["!cols"] = [{ wch: 34 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsLeg, "Legenda Escala");

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { buffer, nomeArquivo: `modelo-importacao-${slugify(tipo.nome)}.xlsx` };
}

// ─── Guia TXT (instruções para configurar o Google Forms) ─────────────────────

export function gerarGuiaFormsQps(
  perguntasOrdenadas: QpsPergunta[],
  categorias: QpsCategoria[],
  tipo: QpsTipo
): { conteudo: string; nomeArquivo: string } {
  const linhas: string[] = [];

  linhas.push(`GUIA PARA CONFIGURAR O GOOGLE FORMS`);
  linhas.push(`Questionário: ${tipo.nome}`);
  linhas.push(`Escala: ${tipo.escala_min} (mínimo) a ${tipo.escala_max} (máximo)`);
  linhas.push(`Total de perguntas: ${perguntasOrdenadas.length}`);
  linhas.push(``);

  linhas.push(`=== ESTRUTURA DO FORMULÁRIO ===`);
  linhas.push(`Col 1: Carimbo de data/hora (gerado automaticamente pelo Google Forms)`);
  linhas.push(`Col 2: SETOR — pergunta de resposta curta, obrigatória`);
  linhas.push(`Col 3: CARGO — pergunta de resposta curta, opcional`);
  linhas.push(
    `Col 4 a ${perguntasOrdenadas.length + 3}: Perguntas de escala linear (${tipo.escala_min}–${tipo.escala_max})`
  );
  linhas.push(``);

  if (tipo.instrucoes) {
    linhas.push(`=== INSTRUÇÃO AO RESPONDENTE ===`);
    linhas.push(tipo.instrucoes);
    linhas.push(``);
  }

  linhas.push(`=== PERGUNTAS (adicionar NESTA ORDEM no formulário) ===`);
  linhas.push(``);

  const catsOrdenadas = [...categorias].sort((a, b) => a.ordem - b.ordem);
  let numCol = 4;

  for (const cat of catsOrdenadas) {
    const pergsCat = perguntasOrdenadas.filter((p) => p.id_categoria === cat.id_categoria);
    if (pergsCat.length === 0) continue;

    linhas.push(`[ ${cat.nome.toUpperCase()} ]`);
    for (const p of pergsCat) {
      linhas.push(`  Col ${numCol}. ${p.texto}`);
      numCol++;
    }
    linhas.push(``);
  }

  linhas.push(`=== AVISO IMPORTANTE ===`);
  linhas.push(`As perguntas DEVEM estar na mesma ordem que aparece neste guia.`);
  linhas.push(`O sistema mapeia as colunas do CSV exportado pelo Google Sheets`);
  linhas.push(`por posição — não pelo texto da pergunta.`);
  linhas.push(``);
  linhas.push(`Como exportar as respostas:`);
  linhas.push(`  1. Colete as respostas via Google Forms`);
  linhas.push(`  2. Abra a planilha de respostas no Google Sheets`);
  linhas.push(`  3. Arquivo → Baixar → Valores separados por vírgulas (.csv)`);
  linhas.push(`  4. No painel: Respondentes → Importar via CSV → cole ou faça upload`);

  return {
    conteudo: linhas.join("\n"),
    nomeArquivo: `guia-forms-${slugify(tipo.nome)}.txt`,
  };
}

// ─── Utilitários de download no browser ───────────────────────────────────────

export function triggerDownload(
  conteudo: string,
  nomeArquivo: string,
  mimeType: string
): void {
  const bom = mimeType.includes("csv") ? "﻿" : "";
  const blob = new Blob([bom + conteudo], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function triggerDownloadBuffer(buffer: ArrayBuffer, nomeArquivo: string, mimeType: string): void {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
