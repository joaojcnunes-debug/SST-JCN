// Consolidação Psicossocial de Grupo — as três planilhas do pedido (fase 6, seção 6):
//  • Análise:       Visão geral, Matriz resumo, Unânimes, Intermediários, Exclusivos,
//                   Pontos de atenção, Base (as contagens da Matriz são FÓRMULAS sobre a Base);
//  • Confronto:     Resumo, Matriz, Lista, Base AEP, Base DRPS;
//  • Harmonização:  Parecer, Perfil do setor, Matriz por empresa, Lacunas, Sim-Não setor,
//                   Sim-Não empresa.
// Montadas com o resultado do motor que a tela já calculou (o arquivo é a tela).
// `exceljs` (e não o `xlsx` do resto do painel) porque o pedido quer as células coloridas.

import type ExcelJS from "exceljs";
import { nivelAihaEfetivo, type ClasseConfronto, type ItemMotor, type ResultadoMotor } from "./motor";
import type { DocumentoFonte } from "./fontes";

export interface DadosPlanilha {
  grupo: string;
  r: ResultadoMotor;
  itens: ItemMotor[];
  nomeEmpresa: (id: string) => string;
  nomeFator: (id: string) => string;
  documentos: DocumentoFonte[];
  empresasInfo: Array<{ idEmpresa: string; cnpj: string | null; municipio: string | null; uf: string | null }>;
}

const VERDE = "FF0284C7";
const COR_NIVEL: Record<string, [string, string]> = {
  Crítico: ["FFDC2626", "FFFFFFFF"],
  Alto: ["FFF97316", "FFFFFFFF"],
  Médio: ["FFFCD34D", "FF451A03"],
  Identificado: ["FFE0E7FF", "FF3730A3"],
  Baixo: ["FFDCFCE7", "FF166534"],
  Incluir: ["FFFEE2E2", "FF991B1B"],
  "Revisar nível": ["FFFEF3C7", "FF92400E"],
  OK: ["FFF0FDF4", "FF15803D"],
  "Alterar nível": ["FFFEF3C7", "FF92400E"],
  "Conferir (já consta)": ["FFF0FDF4", "FF15803D"],
  Sim: ["FFFEE2E2", "FF991B1B"],
  Convergente: ["FFEF4444", "FFFFFFFF"],
  Divergente: ["FF8B5CF6", "FFFFFFFF"],
  "Só AEP": ["FFC7D2FE", "FF312E81"],
  "Só DRPS": ["FFFCD34D", "FF451A03"],
  "Sem indicação": ["FFF3F4F6", "FF9CA3AF"],
  Unânime: ["FFFEE2E2", "FF991B1B"],
  Parcial: ["FFFEF3C7", "FF92400E"],
  Exclusivo: ["FFF3F4F6", "FF374151"],
};

export type Celula = string | number | null | { formula: string; result?: number };

export function pintar(c: ExcelJS.Cell, chave: string) {
  const cor = COR_NIVEL[chave];
  if (!cor) return;
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor[0] } };
  c.font = { ...(c.font ?? {}), bold: true, color: { argb: cor[1] } };
  c.alignment = { ...(c.alignment ?? {}), horizontal: "center", vertical: "middle" };
}

/** Aba com cabeçalho verde, congelado, com filtro, larguras e quebra de linha. */
export function aba(
  wb: ExcelJS.Workbook,
  nome: string,
  cab: string[],
  linhas: Celula[][],
  opts: { larguras?: number[]; colorir?: number[]; filtro?: boolean; cabVertical?: boolean } = {},
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1, xSplit: opts.colorir?.length ? 1 : 0 }] });
  ws.addRow(cab);
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  h.alignment = { vertical: "bottom", wrapText: true, ...(opts.cabVertical ? { textRotation: 90 } : {}) };
  if (opts.cabVertical) h.height = 120;
  for (const l of linhas) ws.addRow(l);
  cab.forEach((_, i) => {
    ws.getColumn(i + 1).width = opts.larguras?.[i] ?? (i === 0 ? 30 : 16);
    ws.getColumn(i + 1).alignment = { vertical: "top", wrapText: true };
  });
  if (opts.cabVertical) h.getCell(1).alignment = { vertical: "bottom", wrapText: true };
  if (opts.colorir) {
    for (let r = 2; r <= ws.rowCount; r++) for (const c of opts.colorir) pintar(ws.getCell(r, c), String(ws.getCell(r, c).value ?? ""));
  }
  if (opts.filtro !== false && linhas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } };
  return ws;
}

const col = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

export async function novo(): Promise<ExcelJS.Workbook> {
  const { default: Excel } = await import("exceljs");
  const wb = new Excel.Workbook();
  wb.creator = "SST JCN Consultoria";
  wb.created = new Date();
  return wb;
}

const porNome = (nome: (id: string) => string) => (a: string, b: string) => nome(a).localeCompare(nome(b), "pt-BR");

function linhasBaseAep(d: DadosPlanilha): Celula[][] {
  return d.itens
    .filter((i) => i.origem === "AEP" && d.r.fatores.some((f) => f.id_fator === i.idFator))
    .map((i) => {
      const a = nivelAihaEfetivo(i);
      return [
        d.nomeEmpresa(i.idEmpresa), i.setorOriginal, i.setor, d.nomeFator(i.idFator),
        a.nivel, a.pelaRegra ? "pela regra" : "gravado", i.sinais.length, i.sinais.join("\n"), i.confianca ?? "",
      ];
    });
}
const CAB_BASE_AEP = ["Empresa", "Setor no documento", "Setor padronizado", "Fator", "Nível AIHA", "AIHA", "Nº sinais", "Sinais observados", "Confiança"];

// ── 1. Análise ───────────────────────────────────────────────────────────────
export async function planilhaAnalise(d: DadosPlanilha): Promise<ArrayBuffer> {
  const wb = await novo();
  const { r } = d;
  const info = new Map(d.empresasInfo.map((e) => [e.idEmpresa, e]));
  const empresasAep = [...r.comparativoAep.empresas].sort(porNome(d.nomeEmpresa));

  aba(
    wb,
    "Visão geral",
    ["Empresa", "CNPJ", "Município", "Data", "Responsável", "AET necessária", "Setores", "Fatores distintos"],
    d.documentos
      .filter((x) => x.origem === "AEP")
      .sort((a, b) => porNome(d.nomeEmpresa)(a.idEmpresa, b.idEmpresa))
      .map((x) => {
        const e = info.get(x.idEmpresa);
        return [
          d.nomeEmpresa(x.idEmpresa), e?.cnpj ?? "", e?.municipio ? `${e.municipio}${e.uf ? `/${e.uf}` : ""}` : "",
          x.data ? x.data.slice(0, 10).split("-").reverse().join("/") : "", x.responsavel ?? "", x.necessitaAet ? "Sim" : "Não",
          x.setores, new Set(d.itens.filter((i) => i.origem === "AEP" && i.idEmpresa === x.idEmpresa).map((i) => i.idFator)).size,
        ];
      }),
    { larguras: [44, 20, 20, 12, 24, 14, 10, 14] },
  );

  // Matriz resumo: nº de setores com o fator em cada empresa = CONT.SES na Base.
  const base = linhasBaseAep(d);
  const nBase = base.length + 1;
  const cont = (fator: string, emp: string) =>
    base.filter((l) => l[3] === fator && l[0] === emp).length;
  const ws = aba(
    wb,
    "Matriz resumo",
    ["Fator", ...empresasAep.map(d.nomeEmpresa), "Nº de empresas", "Classe"],
    r.comparativoAep.fatores.map((f, i) => {
      const linha = i + 2;
      const nomeF = d.nomeFator(f.idFator);
      return [
        nomeF,
        ...empresasAep.map((e, j) => ({
          formula: `COUNTIFS(Base!$D$2:$D$${nBase},$A${linha},Base!$A$2:$A$${nBase},${col(j + 2)}$1)`,
          result: cont(nomeF, d.nomeEmpresa(e)),
        })),
        { formula: `COUNTIF(B${linha}:${col(empresasAep.length + 1)}${linha},">0")`, result: f.empresas.length },
        f.classe,
      ];
    }),
    { larguras: [40, ...empresasAep.map(() => 14), 12, 12], colorir: [empresasAep.length + 3], cabVertical: true },
  );
  ws.getCell(ws.rowCount + 2, 1).value = "Cada célula: nº de setores da empresa em que o fator foi marcado na AEP (calculado da aba Base).";

  const fatorLinhas = (classe: string) =>
    r.comparativoAep.fatores
      .filter((f) => f.classe === classe)
      .flatMap((f) =>
        (f.sinais.length ? f.sinais : [{ sinal: "(nenhum sinal marcado)", empresas: [] as string[] }]).map((s, i) => [
          i === 0 ? d.nomeFator(f.idFator) : "",
          i === 0 ? f.empresas.length : "",
          i === 0 ? f.empresas.map(d.nomeEmpresa).sort().join("\n") : "",
          s.sinal,
          s.empresas.length || "",
          s.empresas.map(d.nomeEmpresa).sort().join("\n"),
          f.empresas.length >= 2 && s.empresas.length === 1 ? "exclusivo" : "",
        ]),
      );
  const cabSinais = ["Fator", "Nº empresas", "Empresas", "Sinal observado", "Nº empresas c/ sinal", "Empresas c/ sinal", "Sinal exclusivo"];
  const largSinais = [36, 10, 36, 50, 10, 36, 12];
  aba(wb, "Unânimes", cabSinais, fatorLinhas("Unânime"), { larguras: largSinais, filtro: false });
  aba(wb, "Intermediários", cabSinais, fatorLinhas("Parcial"), { larguras: largSinais, filtro: false });
  aba(wb, "Exclusivos", cabSinais, fatorLinhas("Exclusivo"), { larguras: largSinais, filtro: false });

  aba(
    wb,
    "Pontos de atenção",
    ["Tipo", "Empresa", "Setor (no documento)", "Fator", "Descrição"],
    r.alertas.map((a) => [a.tipo.replace(/_/g, " "), d.nomeEmpresa(a.idEmpresa), a.setor ?? "", a.idFator ? d.nomeFator(a.idFator) : "", a.texto]),
    { larguras: [26, 40, 28, 32, 70] },
  );
  aba(wb, "Base", CAB_BASE_AEP, base, { larguras: [40, 28, 24, 36, 12, 11, 9, 60, 11], colorir: [] });
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

// ── 2. Confronto ─────────────────────────────────────────────────────────────
const CLASSES: ClasseConfronto[] = ["Convergente", "Divergente", "Só AEP", "Só DRPS", "Sem indicação"];
const REGRA: Record<ClasseConfronto, string> = {
  Convergente: "AEP apontou e o DRPS teve Médio ou pior em ao menos uma avaliação",
  Divergente: "AEP apontou, mas o setor só teve Baixo no DRPS",
  "Só AEP": "AEP apontou e o setor não foi avaliado no DRPS",
  "Só DRPS": "DRPS teve Médio ou pior e a AEP não apontou (ou não avaliou o setor)",
  "Sem indicação": "Nenhuma das duas fontes aponta",
};

export async function planilhaConfronto(d: DadosPlanilha): Promise<ArrayBuffer> {
  const wb = await novo();
  const { r } = d;
  const n = r.confronto.celulas.length + 1;
  const ws = aba(
    wb,
    "Resumo",
    ["Classificação", "Células", "Regra"],
    CLASSES.map((c) => [c, { formula: `COUNTIF(Lista!$C$2:$C$${n},A${CLASSES.indexOf(c) + 2})`, result: r.confronto.totais[c] }, REGRA[c]]),
    { larguras: [18, 10, 80], colorir: [1], filtro: false },
  );
  ws.addRow([]);
  ws.addRow(["Atenção: a AEP e o DRPS podem ser de empresas diferentes do grupo. O confronto mede a coerência no grupo, não na mesma empresa."]);
  ws.addRow([]);
  const hp = ws.addRow(["Fator", "Em qual fonte aparece"]);
  hp.font = { bold: true };
  for (const p of r.confronto.porFator) ws.addRow([d.nomeFator(p.idFator), p.idFator === "trabalho_remoto" ? "Sem correspondência no DRPS" : p.presenca]);

  const setores = r.setores.map((s) => s.setor);
  const cel = new Map(r.confronto.celulas.map((c) => [`${c.idFator}|${c.setor}`, c.classe]));
  aba(
    wb,
    "Matriz",
    ["Fator", ...setores],
    r.fatores.map((f) => [d.nomeFator(f.id_fator), ...setores.map((s) => cel.get(`${f.id_fator}|${s}`) ?? "Sem indicação")]),
    { larguras: [40, ...setores.map(() => 13)], colorir: setores.map((_, i) => i + 2), cabVertical: true, filtro: false },
  );
  aba(
    wb,
    "Lista",
    ["Fator", "Setor", "Classificação"],
    r.confronto.celulas.map((c) => [d.nomeFator(c.idFator), c.setor, c.classe]),
    { larguras: [40, 26, 16], colorir: [3] },
  );
  aba(wb, "Base AEP", CAB_BASE_AEP, linhasBaseAep(d), { larguras: [40, 28, 24, 36, 12, 11, 9, 60, 11] });
  aba(
    wb,
    "Base DRPS",
    ["Empresa", "Origem", "Setor no documento", "Setor padronizado", "Fator", "Nível", "Respondentes", "Probabilidade informada"],
    d.itens
      .filter((i) => i.origem !== "AEP" && r.fatores.some((f) => f.id_fator === i.idFator))
      .map((i) => [
        d.nomeEmpresa(i.idEmpresa), i.origem === "QPS" ? "Questionário" : "DRPS", i.setorOriginal, i.setor, d.nomeFator(i.idFator), i.nivel,
        i.respondentes ?? "", i.probabilidadeInformada == null ? "" : i.probabilidadeInformada ? "Sim" : "Não (vale Baixa)",
      ]),
    { larguras: [40, 13, 28, 24, 36, 10, 12, 18], colorir: [6] },
  );
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

// ── 3. Harmonização ──────────────────────────────────────────────────────────
export async function planilhaHarmonizacao(d: DadosPlanilha): Promise<ArrayBuffer> {
  const wb = await novo();
  const { r } = d;
  const fatores = r.fatores;
  const fontesTexto = (f: { idEmpresa: string; nivel: string }[]) =>
    f.map((x) => `${d.nomeEmpresa(x.idEmpresa)} (${x.nivel === "Identificado" ? "AEP" : x.nivel})`).join("; ");

  const top = (chave: (l: (typeof r.lacunas)[number]) => string, nome: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const l of r.lacunas) if (l.acao !== "OK") m.set(chave(l), (m.get(chave(l)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [nome(k), n] as Celula[]);
  };
  const p = wb.addWorksheet("Parecer");
  p.getColumn(1).width = 60;
  p.getColumn(2).width = 14;
  const t = p.addRow([`Consolidação Psicossocial — ${d.grupo}`]);
  t.font = { bold: true, size: 14, color: { argb: VERDE } };
  p.addRow([`Gerado em ${new Date().toLocaleString("pt-BR")}`]);
  p.addRow([]);
  for (const [rot, val] of [
    ["Setores padronizados", r.setores.length],
    ["Setores comuns (2 ou mais empresas e que transitam)", r.setores.filter((s) => s.comum).length],
    ["Fatores considerados", fatores.length],
    ["Inclusões (fator do perfil ausente ou só Baixo na empresa)", r.resumo.incluir],
    ["Revisões de nível (empresa abaixo do perfil)", r.resumo.revisar],
    ["Já de acordo (OK)", r.resumo.ok],
  ] as const) p.addRow([rot, val]);
  p.addRow([]);
  p.addRow(["Regra: setor em 2 ou mais empresas tem um perfil único — todo fator presente em qualquer empresa, no maior nível — que vale para todas as empresas com o setor. Setor de uma empresa só (¹) mantém a avaliação própria. DRPS Baixo não conta (fica em monitoramento); fator marcado na AEP conta como Identificado."]).alignment = { wrapText: true };
  p.getRow(p.rowCount).height = 60;
  p.addRow([]);
  const cabTop = (s: string) => {
    const x = p.addRow([s, "Ajustes"]);
    x.font = { bold: true };
  };
  cabTop("Fatores que mais faltam");
  for (const l of top((x) => x.idFator, d.nomeFator)) p.addRow(l);
  p.addRow([]);
  cabTop("Empresas com mais ajustes");
  for (const l of top((x) => x.idEmpresa, d.nomeEmpresa)) p.addRow(l);

  const perfil = new Map([...r.perfil, ...r.avaliacaoPropria].map((x) => [`${x.setor}|${x.idFator}`, x]));
  const setoresPerfil = r.setores.filter((s) => fatores.some((f) => perfil.has(`${s.setor}|${f.id_fator}`)));
  aba(
    wb,
    "Perfil do setor",
    ["Setor", "Empresas", ...fatores.map((f) => d.nomeFator(f.id_fator))],
    setoresPerfil.map((s) => [
      s.setor + (s.comum ? "" : " ¹"), s.empresas.length,
      ...fatores.map((f) => perfil.get(`${s.setor}|${f.id_fator}`)?.nivel ?? ""),
    ]),
    { larguras: [30, 9, ...fatores.map(() => 13)], colorir: fatores.map((_, i) => i + 3), cabVertical: true, filtro: false },
  );

  const porEmpSetor = new Map<string, Map<string, string>>();
  for (const l of r.lacunas) {
    const k = `${l.idEmpresa}|${l.setor}`;
    if (!porEmpSetor.has(k)) porEmpSetor.set(k, new Map());
    porEmpSetor.get(k)!.set(l.idFator, l.acao);
  }
  const chavesEmp = [...porEmpSetor.keys()].sort((a, b) => {
    const [ea, sa] = a.split("|");
    const [eb, sb] = b.split("|");
    return d.nomeEmpresa(ea).localeCompare(d.nomeEmpresa(eb), "pt-BR") || sa.localeCompare(sb, "pt-BR");
  });
  aba(
    wb,
    "Matriz por empresa",
    ["Empresa", "Setor", ...fatores.map((f) => d.nomeFator(f.id_fator))],
    chavesEmp.map((k) => {
      const [e, s] = k.split("|");
      return [d.nomeEmpresa(e), s, ...fatores.map((f) => porEmpSetor.get(k)!.get(f.id_fator) ?? "")];
    }),
    { larguras: [40, 24, ...fatores.map(() => 13)], colorir: fatores.map((_, i) => i + 3), cabVertical: true },
  );

  const ordem = new Map(fatores.map((f) => [f.id_fator, f.ordem]));
  aba(
    wb,
    "Lacunas",
    ["Empresa", "Setor", "Fator", "Ação", "Na empresa", "Perfil", "Onde foi identificado"],
    r.lacunas
      .filter((l) => l.acao !== "OK")
      .sort(
        (a, b) =>
          d.nomeEmpresa(a.idEmpresa).localeCompare(d.nomeEmpresa(b.idEmpresa), "pt-BR") ||
          a.setor.localeCompare(b.setor, "pt-BR") ||
          (ordem.get(a.idFator) ?? 0) - (ordem.get(b.idFator) ?? 0),
      )
      .map((l) => [d.nomeEmpresa(l.idEmpresa), l.setor, d.nomeFator(l.idFator), l.acao, l.situacao ?? "ausente", l.perfil, fontesTexto(l.fontes)]),
    { larguras: [40, 24, 36, 13, 12, 12, 70], colorir: [4, 5, 6] },
  );

  aba(
    wb,
    "Sim-Não setor",
    ["Setor", ...fatores.map((f) => d.nomeFator(f.id_fator))],
    r.simNaoSetor.map((s) => [s.setor + (s.unicaEmpresa ? " ¹" : ""), ...fatores.map((f) => (s.fatores[f.id_fator] ? "Sim" : "Não"))]),
    { larguras: [30, ...fatores.map(() => 11)], colorir: fatores.map((_, i) => i + 2), cabVertical: true, filtro: false },
  );
  aba(
    wb,
    "Sim-Não empresa",
    ["Empresa", "Setor", ...fatores.map((f) => d.nomeFator(f.id_fator))],
    r.simNaoEmpresa.map((l) => [
      d.nomeEmpresa(l.idEmpresa), l.setor + (l.unicaEmpresa ? " ¹" : ""), ...fatores.map((f) => (l.fatores[f.id_fator] ? "Sim" : "Não")),
    ]),
    { larguras: [40, 24, ...fatores.map(() => 11)], colorir: fatores.map((_, i) => i + 3), cabVertical: true },
  );
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Baixa o arquivo no navegador. */
export function baixarXlsx(buf: ArrayBuffer, nome: string) {
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
