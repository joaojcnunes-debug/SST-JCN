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

// ─── Alternativas próprias por pergunta (v180) ────────────────────────────────
//
// O modelo é o que ensina o formato: se ele mostrar "0 a 4" numa pergunta cuja
// resposta é texto, a pessoa monta o Forms errado e a importação descarta o
// arquivo inteiro. Então cada pergunta se apresenta do jeito dela.

function opcoesDe(p: QpsPergunta): string[] | null {
  const o = p.opcoes ?? [];
  return o.length >= 2 ? o : null;
}

/** Como a pergunta pede a resposta: as alternativas, ou a faixa numérica. */
function comoResponder(p: QpsPergunta, escalaStr: string): string {
  const o = opcoesDe(p);
  return o ? o.join("  |  ") : escalaStr;
}

/** Uma resposta de exemplo: a pior, a do meio ou a melhor daquela pergunta. */
function exemploResposta(
  p: QpsPergunta,
  qual: "melhor" | "meio" | "pior",
  tipo: QpsTipo,
): string | number {
  const o = opcoesDe(p);
  if (!o) {
    const meio = Math.round((tipo.escala_min + tipo.escala_max) / 2);
    // Sem alternativas, "melhor/pior" é o extremo da escala; a lógica de cada
    // pergunta é que diz qual extremo é bom, e o modelo não precisa opinar.
    return qual === "melhor" ? tipo.escala_max : qual === "pior" ? tipo.escala_min : meio;
  }
  // Com alternativas, a ORDEM é que manda: a primeira é uma ponta e a última é
  // a outra. `logica` diz qual delas é a ruim.
  const primeiraEhPior = p.logica === "invertida";
  if (qual === "meio") return o[Math.floor((o.length - 1) / 2)];
  const querUltima = qual === (primeiraEhPior ? "melhor" : "pior");
  return querUltima ? o[o.length - 1] : o[0];
}

// ─── Excel modelo (.xlsx) ──────────────────────────────────────────────────────

export function gerarModeloExcelQps(
  perguntasOrdenadas: QpsPergunta[],
  categorias: QpsCategoria[],
  tipo: QpsTipo
): { buffer: ArrayBuffer; nomeArquivo: string } {
  const escalaStr = `${tipo.escala_min} a ${tipo.escala_max}`;
  const temAlternativas = perguntasOrdenadas.some((p) => opcoesDe(p));
  const labels = labelsEscala(tipo.escala_min, tipo.escala_max);
  const legendaEscala = labels
    .map((l, i) => `${tipo.escala_min + i} = ${l}`)
    .join("  |  ");

  const wb = XLSX.utils.book_new();

  // ── Aba 1: Respostas ──────────────────────────────────────────────────────
  const linhaContexto = [
    temAlternativas
      ? `Tipo: ${tipo.nome}  |  Perguntas com alternativas próprias respondem com o TEXTO da alternativa (ver a linha de referência abaixo do cabeçalho). As demais usam a escala ${escalaStr}.`
      : `Tipo: ${tipo.nome}  |  Escala: ${escalaStr}  |  ${legendaEscala}`,
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
    ...perguntasOrdenadas.map((p) => `← ${comoResponder(p, escalaStr)} →`),
  ];
  const exemplos = [
    ["01/01/2024 09:00:00", "Administrativo", "Analista",
      ...perguntasOrdenadas.map((p) => exemploResposta(p, "melhor", tipo))],
    ["01/01/2024 09:10:00", "Operacional",    "Operador",
      ...perguntasOrdenadas.map((p) => exemploResposta(p, "meio", tipo))],
    ["01/01/2024 09:20:00", "Comercial",      "Gerente",
      ...perguntasOrdenadas.map((p) => exemploResposta(p, "pior", tipo))],
  ];

  const wsImport = XLSX.utils.aoa_to_sheet([linhaContexto, cabecalho, linhaEscala, ...exemplos]);
  wsImport["!cols"] = [
    { wch: 24 }, { wch: 20 }, { wch: 18 },
    ...perguntasOrdenadas.map((p) => ({ wch: opcoesDe(p) ? 22 : 12 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsImport, "Respostas");

  // ── Aba 2: Referência das perguntas ───────────────────────────────────────
  const refLinhas: (string | number)[][] = [
    ["Nº Col", "Categoria", "Pergunta", "Lógica", "Como responder"],
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
        opcoesDe(p)
          ? p.logica === "direta"
            ? "1ª alternativa = menor exposição"
            : "1ª alternativa = maior exposição"
          : p.logica === "direta"
          ? "Direta (↑ = mais exposição)"
          : "Invertida (↑ = menos exposição)",
        comoResponder(p, `${tipo.escala_min} – ${tipo.escala_max}`),
      ]);
      numCol++;
    }
  }
  const wsRef = XLSX.utils.aoa_to_sheet(refLinhas);
  wsRef["!cols"] = [{ wch: 8 }, { wch: 26 }, { wch: 60 }, { wch: 32 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Referência Perguntas");

  // ── Aba 3: Legenda da escala ──────────────────────────────────────────────
  const comAlternativas = perguntasOrdenadas.filter((p) => opcoesDe(p));
  const semAlternativas = perguntasOrdenadas.filter((p) => !opcoesDe(p));

  const legLinhas: (string | number)[][] = [[`LEGENDA — ${tipo.nome}`], []];

  if (comAlternativas.length > 0) {
    // Numa pergunta de alternativas o "valor" não existe para quem responde: a
    // posição é o valor. A legenda mostra a posição para quem for conferir o
    // cálculo depois, mas a coluna que importa para o Forms é a do texto.
    legLinhas.push(
      ["Perguntas com alternativas próprias:", String(comAlternativas.length)],
      [],
      ["Pergunta", "Posição", "Alternativa"],
    );
    for (const p of comAlternativas) {
      const o = opcoesDe(p) as string[];
      const col = perguntasOrdenadas.indexOf(p) + 4;
      o.forEach((alt, i) =>
        legLinhas.push([i === 0 ? `Col ${col}: ${p.texto}` : "", i + 1, alt]),
      );
      legLinhas.push([]);
    }
  }

  if (semAlternativas.length > 0) {
    legLinhas.push(
      comAlternativas.length > 0
        ? ["Demais perguntas — escala numérica:", escalaStr]
        : ["Escala de resposta:", escalaStr],
      [],
      ["Valor", "Significado"],
      ...labels.map((l, i) => [tipo.escala_min + i, l]),
    );
  }

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
  wsLeg["!cols"] = [{ wch: 46 }, { wch: 10 }, { wch: 40 }];
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
  const nComAlternativas = perguntasOrdenadas.filter((p) => opcoesDe(p)).length;
  if (nComAlternativas > 0) {
    linhas.push(
      `${nComAlternativas} de ${perguntasOrdenadas.length} pergunta(s) têm alternativas próprias`,
    );
    if (nComAlternativas < perguntasOrdenadas.length) {
      linhas.push(
        `As demais usam a escala ${tipo.escala_min} (mínimo) a ${tipo.escala_max} (máximo)`,
      );
    }
  } else {
    linhas.push(`Escala: ${tipo.escala_min} (mínimo) a ${tipo.escala_max} (máximo)`);
  }
  linhas.push(`Total de perguntas: ${perguntasOrdenadas.length}`);
  linhas.push(``);

  linhas.push(`=== ESTRUTURA DO FORMULÁRIO ===`);
  linhas.push(`Col 1: Carimbo de data/hora (gerado automaticamente pelo Google Forms)`);
  linhas.push(`Col 2: SETOR — pergunta de resposta curta, obrigatória`);
  linhas.push(`Col 3: CARGO — pergunta de resposta curta, opcional`);
  linhas.push(
    perguntasOrdenadas.some((p) => opcoesDe(p))
      ? `Col 4 a ${perguntasOrdenadas.length + 3}: as perguntas. As que têm alternativas próprias são de MÚLTIPLA ESCOLHA, com as alternativas na ordem listada abaixo; as demais são de escala linear (${tipo.escala_min}–${tipo.escala_max})`
      : `Col 4 a ${perguntasOrdenadas.length + 3}: Perguntas de escala linear (${tipo.escala_min}–${tipo.escala_max})`
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
      const o = opcoesDe(p);
      if (o) {
        // A ordem aqui NÃO é enfeite: é ela que o painel lê como nota. Trocar
        // duas alternativas de lugar no Forms inverte a resposta no cálculo.
        linhas.push(`           Alternativas, NESTA ORDEM:`);
        o.forEach((alt, i) => linhas.push(`             ${i + 1}. ${alt}`));
      }
      numCol++;
    }
    linhas.push(``);
  }

  linhas.push(`=== AVISO IMPORTANTE ===`);
  linhas.push(`As perguntas DEVEM estar na mesma ordem que aparece neste guia.`);
  linhas.push(`Nas perguntas de múltipla escolha, o texto de cada alternativa tem`);
  linhas.push(`que ser IGUAL ao cadastrado no painel — acento e maiúscula não`);
  linhas.push(`atrapalham, mas palavra diferente faz a resposta ser descartada.`);
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
