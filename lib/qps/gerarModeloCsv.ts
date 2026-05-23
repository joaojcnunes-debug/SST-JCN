// Gera modelos para facilitar a configuração do Google Forms e a importação de CSV.

import type { QpsPergunta, QpsCategoria, QpsTipo } from "@/lib/supabase/types";

function escaparCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

// ─── CSV modelo (para importar no Google Sheets como folha de resposta) ────────

export function gerarModeloCsvQps(
  perguntasOrdenadas: QpsPergunta[],
  tipo: QpsTipo
): { conteudo: string; nomeArquivo: string } {
  const mid = Math.round((tipo.escala_min + tipo.escala_max) / 2);

  const cabecalho = [
    "Carimbo de data/hora",
    "Setor",
    "Cargo",
    ...perguntasOrdenadas.map((p, i) => `P${i + 1}: ${p.texto}`),
  ]
    .map(escaparCsv)
    .join(",");

  const exemplos = [
    [
      "01/01/2024 09:00:00",
      "Administrativo",
      "Analista",
      ...perguntasOrdenadas.map(() => String(tipo.escala_max)),
    ],
    [
      "01/01/2024 09:10:00",
      "Operacional",
      "Operador",
      ...perguntasOrdenadas.map(() => String(mid)),
    ],
    [
      "01/01/2024 09:20:00",
      "Comercial",
      "Gerente",
      ...perguntasOrdenadas.map(() => String(tipo.escala_min)),
    ],
  ];

  const linhas = [
    cabecalho,
    ...exemplos.map((r) => r.map(escaparCsv).join(",")),
  ];

  return {
    conteudo: linhas.join("\r\n"),
    nomeArquivo: `modelo-qps-${slugify(tipo.nome)}.csv`,
  };
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

// ─── Utilitário de download no browser ────────────────────────────────────────

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
