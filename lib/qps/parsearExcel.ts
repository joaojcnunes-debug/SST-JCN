// Parser de planilha Excel para importação de Tipos e Perguntas QPS.
// Estrutura: aba = Tipo | Coluna A = Categoria | Coluna B = Pergunta
//            Coluna C = Lógica (opcional) | Colunas D em diante = alternativas
//
// As alternativas (v180) entram uma por coluna, NA ORDEM do formulário: a
// primeira é uma ponta da escala e a última é a outra; `logica` diz qual delas
// é a ruim. Sem elas, a pergunta segue a escala numérica do tipo.
//
// É por aqui que um questionário inteiro entra de uma vez. Digitar 20 perguntas
// × 5 alternativas na tela, uma a uma, é onde alguém troca duas de lugar — e
// trocar duas de lugar inverte a resposta no cálculo, sem aviso.

import * as XLSX from "xlsx";

export interface PerguntaExcel {
  categoria: string;
  texto: string;
  logica: "direta" | "invertida";
  /** Alternativas próprias, na ordem das colunas D+. `null` = escala do tipo. */
  opcoes: string[] | null;
}

export interface TipoExcel {
  nomeSheet: string;
  perguntas: PerguntaExcel[];
  categorias: string[];
  erros: string[];
}

function normLogica(v: string): "direta" | "invertida" {
  const n = v.toLowerCase().trim();
  if (n.startsWith("inv") || n === "i") return "invertida";
  return "direta";
}

const KEYWORDS_HEADER = ["categoria", "category", "dimensao", "dimensão", "pergunta", "question"];

function ehHeader(row: unknown[]): boolean {
  const first = String(row[0] ?? "").toLowerCase().trim();
  const second = String(row[1] ?? "").toLowerCase().trim();
  return KEYWORDS_HEADER.some((k) => first.includes(k) || second.includes(k));
}

export function parsearExcelQps(buffer: ArrayBuffer): TipoExcel[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const tipos: TipoExcel[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (rows.length === 0) continue;

    const erros: string[] = [];
    const perguntas: PerguntaExcel[] = [];
    const catSet = new Set<string>();
    const categorias: string[] = [];

    const dataStart = ehHeader(rows[0] as unknown[]) ? 1 : 0;

    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const categoria = String(row[0] ?? "").trim();
      const texto = String(row[1] ?? "").trim();
      const logicaRaw = String(row[2] ?? "").trim();
      // Alternativas: da coluna D até a última preenchida. Célula vazia no meio
      // encerra a lista — buraco no meio é engano de planilha, e continuar
      // depois dele deslocaria a ordem, que é justamente o que vira nota.
      const opcoes: string[] = [];
      for (let c = 3; c < row.length; c++) {
        const v = String(row[c] ?? "").trim();
        if (!v) break;
        opcoes.push(v);
      }

      if (!categoria && !texto) continue;

      if (!categoria) {
        erros.push(`Linha ${i + 1}: categoria vazia — ignorada`);
        continue;
      }
      if (!texto) {
        erros.push(`Linha ${i + 1}: texto da pergunta vazio — ignorada`);
        continue;
      }

      if (!catSet.has(categoria)) {
        catSet.add(categoria);
        categorias.push(categoria);
      }

      if (opcoes.length === 1) {
        erros.push(
          `Linha ${i + 1}: só uma alternativa ("${opcoes[0]}") — precisa de ao ` +
            `menos 2, ou nenhuma para usar a escala do tipo. A pergunta entrou ` +
            `com a escala do tipo.`,
        );
      }

      perguntas.push({
        categoria,
        texto,
        logica: normLogica(logicaRaw),
        opcoes: opcoes.length >= 2 ? opcoes : null,
      });
    }

    if (perguntas.length === 0 && erros.length === 0) continue;

    tipos.push({ nomeSheet: sheetName, perguntas, categorias, erros });
  }

  return tipos;
}

// ─── Template para download ────────────────────────────────────────────────────

export function gerarTemplateExcel(): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const dados = [
    ["Categoria", "Pergunta", "Lógica (direta/invertida)", "Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4", "Alternativa 5"],
    ["Demanda de Trabalho", "Sinto que tenho muito trabalho a fazer", "direta"],
    ["Demanda de Trabalho", "Consigo terminar minhas tarefas no horário", "invertida"],
    ["Demanda de Trabalho", "O ritmo de trabalho é acelerado", "direta"],
    ["Controle", "Tenho autonomia para decidir como realizar meu trabalho", "invertida"],
    ["Controle", "Posso escolher o ritmo do meu trabalho", "invertida"],
    ["Apoio Social", "Recebo apoio do meu supervisor quando necessário", "invertida"],
    ["Apoio Social", "Meu supervisor deixa claro o que espera de mim", "invertida"],
    ["Apoio Social", "Meus colegas me ajudam quando preciso", "invertida"],
    [],
    ["— Deixe da coluna D em diante VAZIO para a pergunta usar a escala numérica do tipo."],
    ["— Preenchendo, as alternativas entram NA ORDEM das colunas. Com lógica 'invertida' a primeira é a pior; com 'direta', a primeira é a melhor."],
    [],
    ["Ambiente", "A temperatura do local de trabalho está confortável?", "invertida", "Muito quente ou muito frio", "Às vezes desconfortável", "Dá para trabalhar, mas poderia ser melhor", "Geralmente boa", "Sempre agradável"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = [
    { wch: 28 }, { wch: 58 }, { wch: 22 },
    { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Exemplo de Tipo");

  // Segunda aba de exemplo
  const dados2 = [
    ["Categoria", "Pergunta", "Lógica (direta/invertida)"],
    ["Reconhecimento", "Sinto que meu trabalho é valorizado", "invertida"],
    ["Reconhecimento", "Recebo feedback sobre meu desempenho", "invertida"],
    ["Segurança", "Me sinto seguro no meu local de trabalho", "invertida"],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(dados2);
  ws2["!cols"] = [{ wch: 28 }, { wch: 58 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Outro Tipo");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
