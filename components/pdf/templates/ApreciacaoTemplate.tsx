import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import {
  POD_HRN_LABELS,
  FEP_HRN_LABELS,
  GPD_HRN_LABELS,
  CLASSIFICACAO_HRN_LABELS,
  calcularIndiceHrn,
  type PodHrn,
  type FepHrn,
  type GpdHrn,
  type ClassificacaoRiscoHrn,
} from "@/lib/supabase/types";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { TP_STYLE, renderEditaveis, temSecoesSistema, renderUnificado, numerarCapitulos, numLabel } from "./shared";
import {
  CATEGORIAS_NR12_LABELS,
  CATEGORIAS_NR12_ORDEM,
  type CategoriaNR12,
} from "@/lib/apreciacao-maquinas/catalogo-nr12";

export interface ApreciacaoItemLocal {
  id_item: string;
  /** Máquina a que o item pertence (v148). Null só em laudo pré-v148. */
  id_ficha: string | null;
  item_codigo: string;
  item_categoria: string;
  item_titulo: string;
  item_descricao: string | null;
  item_origem: string | null;
  situacao: string;
  observacao: string | null;
  recomendacao: string | null;
  probabilidade: string | null;
  severidade: string | null;
  nivel_risco_calculado: string | null;
  foto_urls: string[];
  foto_legendas: string[];
}

export interface ApreciacaoAcaoLocal {
  id_acao: string;
  what_acao: string;
  why_justificativa: string | null;
  where_local: string | null;
  when_prazo: string | null;
  who_responsavel: string | null;
  how_metodo: string | null;
  how_much_custo: string | null;
  status: string;
  prioridade: string;
  origem_label: string | null;
}

/** Uma linha da tabela de risco da ficha (seção 4 do laudo). */
export interface RiscoFichaLocal {
  id_risco: string;
  /** Máquina a que o perigo pertence (v148) — usado para agrupar. */
  id_ficha: string | null;
  tipo_perigo: string;
  origem: string | null;
  potenciais_consequencias: string | null;
  item_nr12: string | null;
  /** V149 — itens da norma como lista; `item_nr12` é o legado. */
  itens_nr12: string[] | null;
  /** V149 — categoria de segurança (NBR 14153), sai junto das medidas. */
  categoria_seguranca: string | null;
  pod: string | null;
  fep: string | null;
  gpd: string | null;
  classificacao_risco: string | null;
  medidas_engenharia: string | null;
  medidas_administrativas: string | null;
  /** Legado pré-v146: só é impresso quando Eng./Adm. estão vazias. */
  medidas_preventivas: string | null;
  pod_residual: string | null;
  fep_residual: string | null;
  gpd_residual: string | null;
  classificacao_residual: string | null;
}

/** Bloco "Inventário" da ficha — vem do cadastro da máquina. */
export interface FichaMaquinaLocal {
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: string | null;
  capacidade: string | null;
  setor: string | null;
  operadores: string | null;
  fotos: string[];
}

/** Uma máquina do laudo, com o que ela imprime. */
export interface FichaPdfLocal {
  id_ficha: string;
  numero_ordem: number;
  nome: string;
  tipo: string | null;
  modelo: string | null;
  fabricante: string | null;
  serie: string | null;
  ano: string | null;
  capacidade: string | null;
  setor: string | null;
  operadores: { nome: string; cargo: string }[] | null;
  constatacoes_inspecao: string | null;
  parecer_tecnico: string | null;
  fotos: string[];
  riscos: RiscoFichaLocal[];
}

/**
 * Agrupa por setor: setores na ordem da 1ª aparição, máquinas por `numero_ordem`.
 * A numeração impressa (4.1, 4.2…) é a posição na lista achatada — por isso ela
 * acompanha o agrupamento e não o `numero_ordem` cru.
 */
function agruparPorSetor(fichas: FichaPdfLocal[]) {
  const SEM_SETOR = "Sem setor";
  const ordem: string[] = [];
  const mapa = new Map<string, FichaPdfLocal[]>();
  for (const f of [...fichas].sort((a, b) => (a.numero_ordem ?? 0) - (b.numero_ordem ?? 0))) {
    const setor = (f.setor ?? "").trim() || SEM_SETOR;
    if (!mapa.has(setor)) {
      mapa.set(setor, []);
      ordem.push(setor);
    }
    mapa.get(setor)!.push(f);
  }
  const grupos = ordem.map((setor) => ({ setor, fichas: mapa.get(setor)! }));
  const flat = grupos.flatMap((g) => g.fichas);
  const pos = new Map(flat.map((f, i) => [f.id_ficha, i + 1]));
  return { grupos, flat, seqDe: (f: FichaPdfLocal) => pos.get(f.id_ficha) ?? 0 };
}

/** Maior risco (residual quando houver, senão o inicial) de uma máquina. */
function maiorRisco(f: FichaPdfLocal): { indice: number; classe: string } | null {
  let melhor: { indice: number; classe: string } | null = null;
  for (const r of f.riscos) {
    const temResidual = r.pod_residual && r.fep_residual && r.gpd_residual;
    const indice = temResidual
      ? calcularIndiceHrn(r.pod_residual, r.fep_residual, r.gpd_residual)
      : calcularIndiceHrn(r.pod, r.fep, r.gpd);
    const classeBruta = temResidual ? r.classificacao_residual : r.classificacao_risco;
    if (indice === null) continue;
    const classe = classeBruta
      ? CLASSIFICACAO_HRN_LABELS[classeBruta as ClassificacaoRiscoHrn]
      : "";
    if (!melhor || indice > melhor.indice) melhor = { indice, classe };
  }
  return melhor;
}

export interface ApreciacaoTemplateProps {
  apreciacao: {
    titulo: string | null;
    setor: string | null;
    cidade: string | null;
    responsavel: string | null;
    responsavel_empresa: string | null;
    data_apreciacao: string | null;
    risco_residual: string | null;
    observacoes_gerais: string | null;
    conclusao_tecnica: string | null;
    recomendacoes: string | null;
    constatacoes_inspecao: string | null;
  };
  maquinaNome: string;
  empresa?: Partial<Empresa> | null;
  itens: ApreciacaoItemLocal[];
  acoes: ApreciacaoAcaoLocal[];
  riscos: RiscoFichaLocal[];
  maquina: FichaMaquinaLocal | null;
  /** Máquinas do laudo (v148). Vazio = laudo antigo, sem ficha. */
  fichas: FichaPdfLocal[];
  notificacaoSit: string | null;
  /** v153: imprime também o checklist de 37 itens (além da ficha HRN). */
  incluirChecklist?: boolean;
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const LARANJA = "#c2410c";

const SITUACAO_LABELS: Record<string, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_APLICAVEL: "Não aplicável",
  PENDENTE: "Pendente",
};

const STYLE_BLOCK = `
* { box-sizing: border-box; }
${TP_STYLE}
.sec-titulo { font-size: 13pt; font-weight: 700; color: ${LARANJA}; border-bottom: 2px solid ${LARANJA}; padding-bottom: 3px; margin: 14pt 0 8pt; }
.cat-titulo { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #9a3412; border-bottom: 1px solid #fdba74; padding-bottom: 2px; margin: 10pt 0 6pt; }
.dados { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 8pt; }
.dados td { border: 1px solid #e5e7eb; padding: 4px 8px; vertical-align: top; }
.dados .rot { width: 28%; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
.ap-item { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
.ap-item .cab { display: flex; align-items: flex-start; gap: 8px; }
.ap-cod { font-family: monospace; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 6px; background: #f3f4f6; color: #4b5563; white-space: nowrap; }
.ap-cod.livre { background: #f3e8ff; color: #7e22ce; }
.sit { font-size: 9px; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.risco { margin-top: 6px; border: 1px solid #fed7aa; background: #fff7ed; border-radius: 6px; padding: 6px 8px; font-size: 10pt; }
.risco .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #9a3412; margin: 0 0 2px; }
.campo { margin-top: 6px; }
.campo .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin: 0; }
.campo .rot.rec { color: #b91c1c; }
.campo .val { font-size: 10pt; color: #111827; white-space: pre-wrap; margin: 2px 0 0; }
.fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.fotos .f { width: 120px; }
.fotos img { width: 120px; height: 90px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 4px; }
.fotos .leg { font-size: 8px; color: #6b7280; text-align: center; margin: 2px 0 0; line-height: 1.2; }
.acao { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; page-break-inside: avoid; }
.acao .top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.prio { font-size: 8px; font-weight: 700; border-radius: 4px; padding: 1px 5px; }
.acao .what { font-size: 10.5pt; font-weight: 600; color: #111827; }
.acao .meta { font-size: 9pt; color: #4b5563; margin: 3px 0 0; }
.stat { font-size: 8px; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 1px 6px; }

/* ── Ficha de risco por máquina (seção 4 do laudo) ─────────────────────── */
.ficha-maq { font-size: 12pt; font-weight: 700; color: #111827; margin: 0 0 6pt; }
.ficha-rot { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #6b7280; margin: 0 0 3pt; }
.inv-grid { display: flex; flex-wrap: wrap; border: 1px solid #e5e7eb; margin-bottom: 8pt; }
.inv-campo { flex: 1 1 110px; border-right: 1px solid #e5e7eb; padding: 3px 7px; }
.inv-campo:last-child { border-right: 0; }
.inv-k { display: block; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
.inv-v { font-size: 9.5pt; color: #111827; }
/* Cabeca da ficha por maquina: inventario NA VERTICAL a esquerda, fotos a direita.
   E este arranjo que faz a ficha caber em A4 retrato — a faixa horizontal de 7
   campos (.inv-grid) atravessava a folha e obrigava paisagem. Espelha o laudo de
   referencia do RT. O .inv-grid segue intocado para a secao legada (FichaSection). */
.ficha-topo { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8pt; }
.ficha-topo .col-inv { flex: 1 1 58%; min-width: 0; }
.ficha-topo .col-fotos { flex: 0 0 36%; }
.inv-lista { border: 1px solid #e5e7eb; }
.inv-linha { display: flex; border-bottom: 1px solid #e5e7eb; }
.inv-linha:last-child { border-bottom: 0; }
.inv-linha:nth-child(odd) { background: #f9fafb; }
.inv-linha .k { flex: 0 0 36%; padding: 3px 7px; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-right: 1px solid #e5e7eb; align-self: stretch; }
.inv-linha .v { flex: 1 1 auto; min-width: 0; padding: 3px 7px; font-size: 9pt; color: #111827; overflow-wrap: break-word; }
.col-fotos .f { margin-bottom: 5px; }
.col-fotos .f:last-child { margin-bottom: 0; }
/* Altura casada com a lista de inventario (7 linhas ~ 190px): 3 fotos empilhadas
   a 112px estouravam a folha e empurravam o parecer para a pagina seguinte. */
.col-fotos img { display: block; width: 100%; height: 90px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 4px; }
/* Rotulo e texto do parecer andam juntos — sem isso o "PARECER TECNICO" fica
   orfao no rodape e o texto comeca na folha seguinte. */
.ficha-parecer { break-inside: avoid; page-break-inside: avoid; }
.ficha-linha { font-size: 9.5pt; margin: 0 0 7pt; line-height: 1.45; }
.ficha-linha .rot { font-weight: 700; }
.hrn { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 3pt; }
.hrn th { background: #fff7ed; border: 1px solid #d1d5db; padding: 4px 5px; text-align: left; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #9a3412; }
.hrn td { border: 1px solid #e5e7eb; padding: 4px 5px; vertical-align: top; }
.hrn tr { page-break-inside: avoid; }
.hrn .idx { font-family: monospace; font-weight: 700; white-space: nowrap; }
.med-k { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }

/* ── Orientação por capítulo (opt-in no renderUnificado) ────────────────── */
@page paisagem { size: A4 landscape; }
.cap-paisagem { page: paisagem; }

/* ── Agrupamento por setor ──────────────────────────────────────────────── */
.setor-row td { background: #f3f4f6; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: .06em; color: #4b5563; }
.setor-titulo { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: ${LARANJA}; border-bottom: 1px solid #fdba74; padding-bottom: 2px; margin: 0 0 8pt; }
.ficha-bloco { page-break-inside: auto; }
.ficha-bloco.quebra { page-break-before: always; }

/* ── Checklist NR-12 agrupado por máquina ───────────────────────────────── */
/* O checklist vem depois das fichas HRN, no mesmo capítulo: sem esta quebra a
   primeira máquina do checklist nasce colada no rodapé da última ficha. */
.checklist-bloco { page-break-before: always; }
.chk-maq { page-break-inside: auto; }
.chk-maq.quebra { page-break-before: always; }
.chk-cont { font-size: 9pt; font-weight: 400; color: #6b7280; }
/* Operadores da máquina em tabela. Compacta de propósito: a ficha tem de caber
   numa folha junto com inventário, fotos, tabela HRN e parecer. */
.oper-bloco { margin-bottom: 7pt; break-inside: avoid; page-break-inside: avoid; }
.oper-tab { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.oper-tab th { background: #f9fafb; border: 1px solid #e5e7eb; padding: 2px 5px; text-align: left; font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
.oper-tab td { border: 1px solid #e5e7eb; padding: 2px 5px; vertical-align: top; }
.oper-tab tr { page-break-inside: avoid; }
.oper-tab .idx { font-family: monospace; color: #6b7280; white-space: nowrap; }

/* Tabela de referência normativa: sai uma vez, antes das máquinas. */
.ref-bloco { margin-bottom: 10pt; }
.ref-nota { font-size: 9pt; color: #4b5563; margin: 0 0 6pt; }
.ref-tab { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.ref-tab th { background: #fff7ed; border: 1px solid #d1d5db; padding: 4px 5px; text-align: left; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #9a3412; }
.ref-tab td { border: 1px solid #e5e7eb; padding: 4px 5px; vertical-align: top; }
.ref-tab tr { page-break-inside: avoid; }
.ref-tab .idx { font-family: monospace; font-weight: 700; white-space: nowrap; }
`;

function corSituacao(s: string) {
  if (s === "CONFORME") return { bg: "#d1fae5", fg: "#047857", bd: "#6ee7b7" };
  if (s === "NAO_CONFORME") return { bg: "#fee2e2", fg: "#b91c1c", bd: "#fca5a5" };
  if (s === "NAO_APLICAVEL") return { bg: "#f3f4f6", fg: "#374151", bd: "#d1d5db" };
  return { bg: "#fef3c7", fg: "#b45309", bd: "#fcd34d" };
}

function corPrioridade(p: string) {
  if (p === "Critica") return { bg: "#fee2e2", fg: "#b91c1c" };
  if (p === "Alta") return { bg: "#ffedd5", fg: "#c2410c" };
  if (p === "Media") return { bg: "#fef3c7", fg: "#b45309" };
  return { bg: "#d1fae5", fg: "#047857" };
}

function corStatusAcao(s: string) {
  if (s === "Concluida") return { bg: "#d1fae5", fg: "#047857", bd: "#6ee7b7" };
  if (s === "Em Andamento") return { bg: "#dbeafe", fg: "#1d4ed8", bd: "#93c5fd" };
  if (s === "Cancelada") return { bg: "#f3f4f6", fg: "#6b7280", bd: "#d1d5db" };
  return { bg: "#fef3c7", fg: "#b45309", bd: "#fcd34d" };
}

/**
 * Checklist NR-12 — agrupado POR MÁQUINA e, dentro dela, por categoria.
 *
 * Antes agrupava SÓ por categoria. Com N máquinas no laudo, o mesmo requisito
 * saía N vezes seguidas — mesmo código, mesmo título, mesma descrição — e nada
 * dizia de qual máquina era cada situação: numa página apareciam "12.2.4
 * Conforme", "12.2.4 Pendente", "12.2.4 Conforme" e o leitor não tinha como
 * saber qual máquina estava pendente. Medido no PDF real em 2026-08-05.
 */
function ChecklistSection({
  itens,
  fichas,
  titulo,
}: {
  itens: ApreciacaoItemLocal[];
  fichas: FichaPdfLocal[];
  titulo: string;
}) {
  const { grupos, seqDe } = agruparPorSetor(fichas);

  const porFicha = new Map<string, ApreciacaoItemLocal[]>();
  for (const it of itens) {
    if (!it.id_ficha) continue;
    const lista = porFicha.get(it.id_ficha);
    if (lista) lista.push(it);
    else porFicha.set(it.id_ficha, [it]);
  }

  // Laudo pré-v148 (item sem ficha) ou item cuja ficha sumiu: sai numa lista
  // única no fim em vez de desaparecer do documento.
  const idsFicha = new Set(fichas.map((f) => f.id_ficha));
  const soltos = itens.filter((i) => !i.id_ficha || !idsFicha.has(i.id_ficha));

  let setorAnterior = "";

  return (
    <div className="checklist-bloco">
      <p className="sec-titulo">{titulo} ({itens.length})</p>
      <ReferenciasChecklist itens={itens} />
      {/* TODA máquina abre em folha nova, inclusive a primeira: sem isso ela
          nasce logo abaixo da tabela de referência e o cabeçalho (setor, nome da
          máquina, categoria) fica órfão no rodapé, porque o 1º cartão tem
          `page-break-inside: avoid` e pula para a página seguinte sozinho. */}
      {grupos.flatMap((g) =>
        g.fichas.map((f) => {
          const desta = porFicha.get(f.id_ficha) ?? [];
          if (desta.length === 0) return null;
          const abreSetor = g.setor !== setorAnterior;
          setorAnterior = g.setor;
          return (
            <div key={f.id_ficha} className="chk-maq quebra">
              {abreSetor && <p className="setor-titulo">Setor: {g.setor}</p>}
              <p className="ficha-maq">
                {seqDe(f)}. {f.nome || "Máquina"}{" "}
                <span className="chk-cont">({desta.length} itens)</span>
              </p>
              <CategoriasChecklist itens={desta} />
            </div>
          );
        }),
      )}
      {soltos.length > 0 && (
        <div className="chk-maq quebra">
          <p className="ficha-maq">Itens sem máquina vinculada ({soltos.length})</p>
          <CategoriasChecklist itens={soltos} />
        </div>
      )}
    </div>
  );
}

/**
 * Tabela de referência — o que a NR-12 exige em cada item, UMA vez só.
 *
 * O texto normativo é idêntico nas N máquinas (todas copiam o mesmo catálogo).
 * Repeti-lo em cada um dos 148 cartões inchava o laudo sem acrescentar
 * informação. Aqui ele sai uma vez, e o cartão de cada máquina fica com o que é
 * dela: situação, foto, observação e recomendação.
 */
function ReferenciasChecklist({ itens }: { itens: ApreciacaoItemLocal[] }) {
  // Os itens vêm ordenados por `ordem`, que se repete a cada máquina — a
  // deduplicação por código na ordem de chegada devolve a sequência do catálogo.
  const vistos = new Set<string>();
  const unicos: ApreciacaoItemLocal[] = [];
  for (const i of itens) {
    if (vistos.has(i.item_codigo)) continue;
    vistos.add(i.item_codigo);
    unicos.push(i);
  }

  const grupos = CATEGORIAS_NR12_ORDEM.map((cat) => ({
    categoria: cat as CategoriaNR12,
    label: CATEGORIAS_NR12_LABELS[cat as CategoriaNR12],
    itens: unicos.filter((i) => i.item_categoria === cat),
  })).filter((g) => g.itens.length > 0);

  const semCategoria = unicos.filter(
    (i) => !CATEGORIAS_NR12_ORDEM.includes(i.item_categoria as CategoriaNR12),
  );

  if (unicos.length === 0) return null;

  return (
    <div className="ref-bloco">
      <p className="ficha-rot">
        Referências normativas dos itens ({unicos.length} requisitos)
      </p>
      <p className="ref-nota">
        O que a norma exige em cada item, listado uma única vez. Nas máquinas a
        seguir, cada item traz a situação constatada em campo.
      </p>
      <table className="ref-tab">
        <thead>
          <tr>
            <th style={{ width: "11%" }}>Cód.</th>
            <th style={{ width: "31%" }}>Requisito</th>
            <th style={{ width: "58%" }}>O que a norma exige</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <React.Fragment key={g.categoria}>
              <tr className="setor-row">
                <td colSpan={3}>{g.label} ({g.itens.length})</td>
              </tr>
              {g.itens.map((i) => (
                <tr key={i.item_codigo}>
                  <td className="idx">{i.item_codigo}</td>
                  <td>{i.item_titulo}</td>
                  <td>{i.item_descricao || "—"}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
          {semCategoria.length > 0 && (
            <React.Fragment>
              <tr className="setor-row">
                <td colSpan={3}>Outros ({semCategoria.length})</td>
              </tr>
              {semCategoria.map((i) => (
                <tr key={i.item_codigo}>
                  <td className="idx">{i.item_codigo}</td>
                  <td>{i.item_titulo}</td>
                  <td>{i.item_descricao || "—"}</td>
                </tr>
              ))}
            </React.Fragment>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** As categorias do checklist de UMA máquina. */
function CategoriasChecklist({ itens }: { itens: ApreciacaoItemLocal[] }) {
  const grupos = CATEGORIAS_NR12_ORDEM.map((cat) => ({
    categoria: cat as CategoriaNR12,
    label: CATEGORIAS_NR12_LABELS[cat as CategoriaNR12],
    itens: itens.filter((i) => i.item_categoria === cat),
  })).filter((g) => g.itens.length > 0);

  return (
    <>
      {grupos.map((g) => (
        <div key={g.categoria}>
          <p className="cat-titulo">{g.label} ({g.itens.length})</p>
          {g.itens.map((item) => (
            <ItemChecklistPdf key={item.id_item} item={item} />
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * Emenda as quebras de linha que são só rebordo do texto digitado.
 *
 * 97 das 148 observações do laudo da Green Fruit vêm com "\n" gravado, e 75
 * delas com a quebra no MEIO da frase. Como o PDF usa `white-space: pre-wrap`,
 * elas eram respeitadas e a frase partia no meio da página ("...materiais
 * soltos ou ⏎ obstáculos que..."). O texto gravado NÃO é alterado — só a
 * renderização.
 *
 * Como distinguir rebordo de quebra intencional: medido na base, 93 das 94
 * quebras internas caem depois de uma linha de 80+ caracteres (mediana na
 * coluna 117, máximo 128) — assinatura de quebra automática, ninguém escreve
 * parágrafo de uma linha só com 117 caracteres exatos. Então:
 *   - linha anterior longa (>= 80) → é rebordo, emenda;
 *   - linha curta → só emenda se ela não fechar frase e a seguinte começar em
 *     minúscula;
 *   - lista ("- item", "1. item") e linha terminada em ":" nunca são emendadas;
 *   - parágrafo de verdade (linha em branco) é preservado inteiro.
 */
function juntarQuebrasSoltas(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((paragrafo) => {
      const linhas = paragrafo.split("\n");
      let saida = linhas[0];
      for (let i = 1; i < linhas.length; i++) {
        const anterior = linhas[i - 1].trimEnd();
        const atual = linhas[i];
        const ehLista = /^\s*([-–—•*]|\d+[.)])\s/.test(atual);
        const rebordo =
          !ehLista
          && !/:$/.test(anterior)
          && (anterior.length >= 80
            || (!/[.;!?]$/.test(anterior) && /^\s*\p{Ll}/u.test(atual)));
        saida += rebordo ? ` ${atual.trimStart()}` : `\n${atual}`;
      }
      return saida;
    })
    .join("\n\n")
    .trim();
}

/** Um item do checklist: código, situação, fotos, observação e recomendação. */
function ItemChecklistPdf({ item }: { item: ApreciacaoItemLocal }) {
  const cs = corSituacao(item.situacao);
  const ehLivre = item.item_origem === "LIVRE";
  const temRisco =
    item.situacao === "NAO_CONFORME"
    && (item.probabilidade || item.severidade || item.nivel_risco_calculado);

  return (
              <div className="ap-item">
                <div className="cab">
                  <span className={`ap-cod ${ehLivre ? "livre" : ""}`}>{item.item_codigo}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#111827" }}>
                      {item.item_titulo}{ehLivre ? " · Livre" : ""}
                    </p>
                    {/* A descrição normativa NÃO sai aqui: ela é idêntica nas N
                        máquinas e já foi impressa uma vez em ReferenciasChecklist.
                        Item LIVRE é a exceção — o texto é dele, não do catálogo. */}
                    {ehLivre && item.item_descricao && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "#4b5563" }}>{item.item_descricao}</p>
                    )}
                  </div>
                  <span className="sit" style={{ background: cs.bg, color: cs.fg, borderColor: cs.bd }}>
                    {SITUACAO_LABELS[item.situacao] ?? item.situacao}
                  </span>
                </div>

                {temRisco && (
                  <div className="risco">
                    <p className="rot">Avaliação de risco</p>
                    <span>Probabilidade: <strong>{item.probabilidade || "—"}</strong> · Severidade: <strong>{item.severidade || "—"}</strong>{item.nivel_risco_calculado ? <> · Nível: <strong>{item.nivel_risco_calculado}</strong></> : null}</span>
                  </div>
                )}

                {item.foto_urls.length > 0 && (
                  <div className="fotos">
                    {item.foto_urls.map((url, i) => (
                      <div key={`${url}-${i}`} className="f">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Foto ${item.item_codigo}`} />
                        {item.foto_legendas?.[i] ? <p className="leg">{item.foto_legendas[i]}</p> : null}
                      </div>
                    ))}
                  </div>
                )}

                {item.observacao && (
                  <div className="campo">
                    <p className="rot">Observação técnica</p>
                    <p className="val">{juntarQuebrasSoltas(item.observacao)}</p>
                  </div>
                )}
                {item.recomendacao && (
                  <div className="campo">
                    <p className="rot rec">Recomendação / ação corretiva</p>
                    <p className="val">{juntarQuebrasSoltas(item.recomendacao)}</p>
                  </div>
                )}
              </div>
  );
}

/**
 * Célula de risco no formato do laudo: os três fatores por extenso e, na linha
 * de baixo, "índice · CLASSIFICAÇÃO" (ex.: "24 · MÉDIO"). O índice é recalculado
 * na hora; a classificação é a que o técnico gravou — se ele sobrescreveu a
 * sugestão, o que sai impresso é a dele.
 */
function CelulaRisco({
  pod,
  fep,
  gpd,
  classificacao,
}: {
  pod: string | null;
  fep: string | null;
  gpd: string | null;
  classificacao: string | null;
}) {
  const fatores = [
    pod ? POD_HRN_LABELS[pod as PodHrn] : null,
    fep ? FEP_HRN_LABELS[fep as FepHrn] : null,
    gpd ? GPD_HRN_LABELS[gpd as GpdHrn] : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const indice = calcularIndiceHrn(pod, fep, gpd);
  const nome = classificacao
    ? CLASSIFICACAO_HRN_LABELS[classificacao as ClassificacaoRiscoHrn]
    : null;
  const resumo = [indice !== null ? String(indice) : null, nome ? nome.toUpperCase() : null]
    .filter(Boolean)
    .join(" · ");

  if (!fatores && !resumo) return <>—</>;
  return (
    <>
      {fatores}
      {fatores && resumo ? <br /> : null}
      {resumo ? <span className="idx">{resumo}</span> : null}
    </>
  );
}

/**
 * Ficha de risco da máquina — a seção 4 do laudo de referência: identificação
 * de inventário, foto, operadores, constatações de campo, tabela
 * perigo → risco inicial → medidas → risco residual e o parecer técnico.
 *
 * Ocupa a posição do capítulo "apreciacao_risco", que antes imprimia só a
 * conclusão técnica em texto livre (o parecer continua saindo, no fim da ficha).
 */
function FichaSection({
  titulo,
  maquinaNome,
  maquina,
  constatacoes,
  riscos,
  parecer,
  recomendacoes,
}: {
  titulo: string;
  maquinaNome: string;
  maquina: FichaMaquinaLocal | null;
  constatacoes: string | null;
  riscos: RiscoFichaLocal[];
  parecer: string | null;
  recomendacoes: string | null;
}) {
  const campos: [string, string | null][] = maquina
    ? [
        ["Tipo", maquina.tipo],
        ["Fabricante", maquina.marca],
        ["Modelo", maquina.modelo],
        ["Nº de Série", maquina.numero_serie],
        ["Ano", maquina.ano_fabricacao],
        ["Capacidade", maquina.capacidade],
        ["Setor", maquina.setor],
      ]
    : [];

  return (
    <div>
      <p className="sec-titulo">{titulo}</p>
      <p className="ficha-maq">{maquinaNome}</p>

      {campos.length > 0 && (
        <>
          <p className="ficha-rot">Inventário</p>
          <div className="inv-grid">
            {campos.map(([k, v]) => (
              <div key={k} className="inv-campo">
                <span className="inv-k">{k}</span>
                <span className="inv-v">{v && v.trim() ? v : "—"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {maquina && maquina.fotos.length > 0 && (
        <div className="fotos">
          {maquina.fotos.map((url, i) => (
            <div key={`${url}-${i}`} className="f">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto de ${maquinaNome}`} />
            </div>
          ))}
        </div>
      )}

      {maquina?.operadores && (
        <p className="ficha-linha">
          <span className="rot">Operadores / Responsáveis: </span>
          {maquina.operadores}
        </p>
      )}

      {constatacoes && (
        <p className="ficha-linha">
          <span className="rot">Constatações da inspeção: </span>
          {constatacoes}
        </p>
      )}

      {riscos.length > 0 && (
        <>
          <p className="ficha-rot">Apreciação de risco</p>
          <table className="hrn">
            <thead>
              <tr>
                <th style={{ width: "13%" }}>Perigo</th>
                <th style={{ width: "21%" }}>Origem / Consequências</th>
                <th style={{ width: "9%" }}>Item NR-12</th>
                <th style={{ width: "14%" }}>Risco Inicial</th>
                <th style={{ width: "29%" }}>Medidas de Controle</th>
                <th style={{ width: "14%" }}>Risco Residual</th>
              </tr>
            </thead>
            <tbody>
              {riscos.map((r) => {
                const origem = [r.origem, r.potenciais_consequencias].filter(Boolean).join(" → ");
                const temSeparadas = !!(r.medidas_engenharia || r.medidas_administrativas);
                return (
                  <tr key={r.id_risco}>
                    <td>{r.tipo_perigo || "—"}</td>
                    <td>{origem || "—"}</td>
                    <td>{r.item_nr12 || "—"}</td>
                    <td>
                      <CelulaRisco pod={r.pod} fep={r.fep} gpd={r.gpd} classificacao={r.classificacao_risco} />
                    </td>
                    <td>
                      {temSeparadas ? (
                        <>
                          {r.medidas_engenharia && (
                            <>
                              <span className="med-k">Eng.:</span> {r.medidas_engenharia}
                              {r.medidas_administrativas ? <br /> : null}
                            </>
                          )}
                          {r.medidas_administrativas && (
                            <>
                              <span className="med-k">Adm.:</span> {r.medidas_administrativas}
                            </>
                          )}
                        </>
                      ) : (
                        r.medidas_preventivas || "—"
                      )}
                    </td>
                    <td>
                      <CelulaRisco
                        pod={r.pod_residual}
                        fep={r.fep_residual}
                        gpd={r.gpd_residual}
                        classificacao={r.classificacao_residual}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {parecer && (
        <div className="campo">
          <p className="rot">Parecer técnico</p>
          <p className="val">{parecer}</p>
        </div>
      )}
      {recomendacoes && (
        <div className="campo">
          <p className="rot">Recomendações finais</p>
          <p className="val">{recomendacoes}</p>
        </div>
      )}
    </div>
  );
}

/** Seção "Método de Cálculo do Risco" — a régua que o laudo declara usar. */
function MetodoHrn({ titulo }: { titulo: string }) {
  const fatores: [string, string, [string, number][]][] = [
    ["POD", "Probabilidade de ocorrência do dano", (Object.entries(POD_HRN_LABELS) as [string, string][]).map(([, v], i) => [v, 4 - i] as [string, number])],
    ["FEP", "Frequência de exposição ao perigo", (Object.entries(FEP_HRN_LABELS) as [string, string][]).map(([, v], i) => [v, 4 - i] as [string, number])],
    ["GPD", "Gravidade potencial do dano", (Object.entries(GPD_HRN_LABELS) as [string, string][]).map(([, v], i) => [v, 4 - i] as [string, number])],
  ];

  return (
    <div>
      <p className="sec-titulo">{titulo}</p>
      <p style={{ fontSize: 10.5, color: "#374151", margin: "0 0 8pt" }}>
        A avaliação segue o método HRN (<em>Hazard Rating Number</em>), referenciado pela
        ABNT NBR ISO/TR 14121-2. O índice de risco é o produto de três fatores:
        <strong> POD × FEP × GPD</strong>, resultando num valor de 1 a 64.
      </p>

      <table className="hrn">
        <thead>
          <tr>
            <th style={{ width: "10%" }}>Fator</th>
            <th style={{ width: "38%" }}>Significado</th>
            <th style={{ width: "52%" }}>Níveis (pontuação)</th>
          </tr>
        </thead>
        <tbody>
          {fatores.map(([sigla, nome, niveis]) => (
            <tr key={sigla}>
              <td><strong>{sigla}</strong></td>
              <td>{nome}</td>
              <td>{niveis.map(([label, score]) => `${label} (${score})`).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="ficha-rot" style={{ marginTop: "8pt" }}>Faixas de classificação</p>
      <table className="hrn">
        <thead>
          <tr>
            <th style={{ width: "25%" }}>Índice</th>
            <th style={{ width: "25%" }}>Classificação</th>
            <th style={{ width: "50%" }}>Ação indicada</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="idx">1 a 8</td><td>DESPREZÍVEL</td><td>Manter as condições existentes e monitorar.</td></tr>
          <tr><td className="idx">9 a 18</td><td>BAIXO</td><td>Adotar medidas quando praticável; acompanhar.</td></tr>
          <tr><td className="idx">19 a 36</td><td>MÉDIO</td><td>Implementar medidas de controle em prazo definido.</td></tr>
          <tr><td className="idx">37 a 64</td><td>ALTO</td><td>Ação imediata; restringir a operação até o controle.</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 9, color: "#6b7280", margin: "4pt 0 0" }}>
        As faixas são critério do responsável técnico que assina — nenhuma norma as fixa.
        O risco residual é o mesmo cálculo refeito após as medidas de controle.
      </p>
    </div>
  );
}

/** Seção "Relação de Máquinas" — tabela consolidada, agrupada por setor. */
function RelacaoMaquinas({ fichas, titulo }: { fichas: FichaPdfLocal[]; titulo: string }) {
  const { grupos, seqDe } = agruparPorSetor(fichas);
  return (
    <div>
      <p className="sec-titulo">{titulo} ({fichas.length})</p>
      {fichas.length === 0 ? (
        <p style={{ fontSize: 10.5, color: "#6b7280" }}>Nenhuma máquina cadastrada no laudo.</p>
      ) : (
        <table className="hrn">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>Ref.</th>
              <th style={{ width: "26%" }}>Máquina / Equipamento</th>
              <th style={{ width: "16%" }}>Fabricante</th>
              <th style={{ width: "14%" }}>Modelo</th>
              <th style={{ width: "14%" }}>Nº de Série</th>
              <th style={{ width: "8%" }}>Ano</th>
              <th style={{ width: "16%" }}>Maior risco</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <React.Fragment key={g.setor}>
                <tr className="setor-row">
                  <td colSpan={7}>{g.setor} ({g.fichas.length})</td>
                </tr>
                {g.fichas.map((f) => {
                  const risco = maiorRisco(f);
                  return (
                    <tr key={f.id_ficha}>
                      <td className="idx">{seqDe(f)}</td>
                      <td>{f.nome || "—"}</td>
                      <td>{f.fabricante || "—"}</td>
                      <td>{f.modelo || "—"}</td>
                      <td>{f.serie || "—"}</td>
                      <td>{f.ano || "—"}</td>
                      <td>{risco ? <span className="idx">{risco.indice} · {risco.classe.toUpperCase()}</span> : "—"}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// v153: o capítulo `apreciacao_checklist` sempre imprime a "Apreciação de Risco
// por Máquina" (ficha HRN). O checklist de 37 itens é OPCIONAL, por laudo, via a
// prop `incluirChecklist` (coluna `apreciacoes_maquinas.incluir_checklist_pdf`):
// quando ligado, sai ADICIONALMENTE à ficha de risco.

/** Seção "Apreciação de Risco por Máquina" — uma ficha por página. */
function MaquinasSection({ fichas, titulo }: { fichas: FichaPdfLocal[]; titulo: string }) {
  const { grupos, seqDe } = agruparPorSetor(fichas);
  let setorAnterior = "";

  return (
    <div>
      <p className="sec-titulo">{titulo}</p>
      {fichas.length === 0 && (
        <p style={{ fontSize: 10.5, color: "#6b7280" }}>Nenhuma máquina cadastrada no laudo.</p>
      )}
      {grupos.flatMap((g) =>
        g.fichas.map((f, i) => {
          const abreSetor = g.setor !== setorAnterior;
          setorAnterior = g.setor;
          const primeira = seqDe(f) === 1;
          return (
            <div key={f.id_ficha} className={primeira ? "ficha-bloco" : "ficha-bloco quebra"}>
              {abreSetor && i === 0 && <p className="setor-titulo">Setor: {g.setor}</p>}
              <FichaMaquinaPdf ficha={f} seq={seqDe(f)} />
            </div>
          );
        }),
      )}
    </div>
  );
}

function FichaMaquinaPdf({ ficha, seq }: { ficha: FichaPdfLocal; seq: number }) {
  const campos: [string, string | null][] = [
    ["Tipo", ficha.tipo],
    ["Fabricante", ficha.fabricante],
    ["Modelo", ficha.modelo],
    ["Nº de Série", ficha.serie],
    ["Ano", ficha.ano],
    ["Capacidade", ficha.capacidade],
    ["Setor", ficha.setor],
  ];
  // Tabela, e não frase corrida: com 9 operadores a linha "Nome — Cargo; Nome —
  // Cargo; ..." virava um parágrafo de 5 linhas em CAIXA ALTA, ilegível e sem
  // como conferir quem é quem.
  const operadores = (ficha.operadores ?? []).filter(
    (o) => (o?.nome ?? "").trim() || (o?.cargo ?? "").trim(),
  );

  return (
    <div>
      <p className="ficha-maq">{seq}. {ficha.nome || "Máquina"}</p>

      <div className="ficha-topo">
        <div className="col-inv">
          <p className="ficha-rot">Inventário</p>
          <div className="inv-lista">
            {campos.map(([k, v]) => (
              <div key={k} className="inv-linha">
                <span className="k">{k}</span>
                <span className="v">{v && v.trim() ? v : "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {ficha.fotos.length > 0 && (
          <div className="col-fotos">
            {ficha.fotos.map((url, i) => (
              <div key={`${url}-${i}`} className="f">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto de ${ficha.nome}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {operadores.length > 0 && (
        <div className="oper-bloco">
          <p className="ficha-rot">Operadores / Responsáveis ({operadores.length})</p>
          <table className="oper-tab">
            <thead>
              <tr>
                <th style={{ width: "6%" }}>#</th>
                <th style={{ width: "56%" }}>Nome</th>
                <th style={{ width: "38%" }}>Função</th>
              </tr>
            </thead>
            <tbody>
              {operadores.map((o, i) => (
                <tr key={`${o.nome}-${i}`}>
                  <td className="idx">{i + 1}</td>
                  <td>{(o.nome ?? "").trim() || "—"}</td>
                  <td>{(o.cargo ?? "").trim() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ficha.constatacoes_inspecao && (
        <p className="ficha-linha">
          <span className="rot">Constatações da inspeção: </span>{ficha.constatacoes_inspecao}
        </p>
      )}

      {ficha.riscos.length > 0 && (
        <>
          <p className="ficha-rot">Apreciação de risco</p>
          <table className="hrn">
            <thead>
              <tr>
                <th style={{ width: "13%" }}>Perigo</th>
                <th style={{ width: "21%" }}>Origem / Consequências</th>
                <th style={{ width: "9%" }}>Item NR-12</th>
                <th style={{ width: "14%" }}>Risco Inicial</th>
                <th style={{ width: "29%" }}>Medidas de Controle</th>
                <th style={{ width: "14%" }}>Risco Residual</th>
              </tr>
            </thead>
            <tbody>
              {ficha.riscos.map((r) => {
                const origem = [r.origem, r.potenciais_consequencias].filter(Boolean).join(" → ");
                const itens = (r.itens_nr12 ?? (r.item_nr12 ? [r.item_nr12] : [])).join("; ");
                const temSeparadas = !!(r.medidas_engenharia || r.medidas_administrativas);
                return (
                  <tr key={r.id_risco}>
                    <td>{r.tipo_perigo || "—"}</td>
                    <td>{origem || "—"}</td>
                    <td>{itens || "—"}</td>
                    <td><CelulaRisco pod={r.pod} fep={r.fep} gpd={r.gpd} classificacao={r.classificacao_risco} /></td>
                    <td>
                      {temSeparadas ? (
                        <>
                          {r.medidas_engenharia && (
                            <>
                              <span className="med-k">Eng.:</span> {r.medidas_engenharia}
                              {r.medidas_administrativas ? <br /> : null}
                            </>
                          )}
                          {r.medidas_administrativas && (
                            <><span className="med-k">Adm.:</span> {r.medidas_administrativas}</>
                          )}
                        </>
                      ) : (
                        r.medidas_preventivas || "—"
                      )}
                      {r.categoria_seguranca && (
                        <>
                          <br />
                          <span className="med-k">Cat. segurança:</span> {r.categoria_seguranca}
                        </>
                      )}
                    </td>
                    <td>
                      <CelulaRisco
                        pod={r.pod_residual}
                        fep={r.fep_residual}
                        gpd={r.gpd_residual}
                        classificacao={r.classificacao_residual}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {ficha.parecer_tecnico && (
        <div className="campo ficha-parecer">
          <p className="rot">Parecer técnico</p>
          <p className="val">{ficha.parecer_tecnico}</p>
        </div>
      )}
    </div>
  );
}

/** Conclusão geral — resumo do risco residual do parque + máquinas críticas. */
function ConclusaoGeral({
  fichas,
  parecer,
  recomendacoes,
  titulo,
}: {
  fichas: FichaPdfLocal[];
  parecer: string | null;
  recomendacoes: string | null;
  titulo: string;
}) {
  const { flat, seqDe } = agruparPorSetor(fichas);
  const contagem: Record<string, number> = {};
  const criticas: { seq: number; nome: string; indice: number; classe: string }[] = [];

  for (const f of flat) {
    const risco = maiorRisco(f);
    if (!risco) continue;
    const classe = risco.classe || "—";
    contagem[classe] = (contagem[classe] ?? 0) + 1;
    if (risco.indice > 18) {
      criticas.push({ seq: seqDe(f), nome: f.nome, indice: risco.indice, classe });
    }
  }
  criticas.sort((a, b) => b.indice - a.indice);

  return (
    <div>
      <p className="sec-titulo">{titulo}</p>

      {flat.length > 0 && (
        <>
          <p style={{ fontSize: 10.5, color: "#374151", margin: "0 0 6pt" }}>
            Foram avaliadas <strong>{flat.length}</strong> máquina(s). A classificação abaixo
            considera, por máquina, o <strong>maior risco residual</strong> — ou o risco
            inicial, quando não há residual lançado.
          </p>
          <table className="hrn">
            <thead>
              <tr><th style={{ width: "50%" }}>Classificação</th><th style={{ width: "50%" }}>Máquinas</th></tr>
            </thead>
            <tbody>
              {Object.entries(contagem).map(([classe, n]) => (
                <tr key={classe}><td>{classe.toUpperCase()}</td><td className="idx">{n}</td></tr>
              ))}
            </tbody>
          </table>

          {criticas.length > 0 && (
            <>
              <p className="ficha-rot" style={{ marginTop: "8pt" }}>Máquinas que exigem ação prioritária</p>
              <p style={{ fontSize: 10, color: "#374151", margin: 0 }}>
                {criticas.map((c) => `${c.seq}. ${c.nome} (${c.indice} · ${c.classe.toUpperCase()})`).join(" · ")}
              </p>
            </>
          )}

          <p style={{ fontSize: 9.5, color: "#4b5563", margin: "8pt 0 0" }}>
            As medidas indicadas devem ser incorporadas ao inventário de riscos do PGR
            (NR-01) e, quando envolverem sistemas de segurança, atender à categoria de
            segurança apontada por máquina (ABNT NBR 14153).
          </p>
        </>
      )}

      {parecer && (
        <div className="campo"><p className="rot">Parecer técnico</p><p className="val">{parecer}</p></div>
      )}
      {recomendacoes && (
        <div className="campo"><p className="rot">Recomendações finais</p><p className="val">{recomendacoes}</p></div>
      )}
    </div>
  );
}

function PlanoAcaoSection({ acoes, titulo }: { acoes: ApreciacaoAcaoLocal[]; titulo: string }) {
  return (
    <div>
      <p className="sec-titulo">{titulo} ({acoes.length})</p>
      {acoes.length === 0 && (
        <p style={{ fontSize: 10.5, color: "#6b7280" }}>Nenhuma ação cadastrada.</p>
      )}
      {acoes.map((a) => {
        const cp = corPrioridade(a.prioridade);
        const cst = corStatusAcao(a.status);
        const prazo = a.when_prazo ? new Date(a.when_prazo + "T00:00").toLocaleDateString("pt-BR") : null;
        const detalhes = [
          a.why_justificativa && `Por quê: ${a.why_justificativa}`,
          a.how_metodo && `Como: ${a.how_metodo}`,
          a.where_local && `Onde: ${a.where_local}`,
          a.who_responsavel && `Quem: ${a.who_responsavel}`,
          prazo && `Quando: ${prazo}`,
          a.how_much_custo && `Quanto: ${a.how_much_custo}`,
        ].filter(Boolean);
        return (
          <div key={a.id_acao} className="acao">
            <div className="top">
              <span className="prio" style={{ background: cp.bg, color: cp.fg }}>{a.prioridade}</span>
              <span className="what" style={{ flex: 1 }}>{a.what_acao}</span>
              <span className="stat" style={{ background: cst.bg, color: cst.fg, borderColor: cst.bd }}>{a.status}</span>
            </div>
            {a.origem_label && <p className="meta">Origem: {a.origem_label}</p>}
            {detalhes.length > 0 && <p className="meta">{detalhes.join(" · ")}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function ApreciacaoTemplate({
  apreciacao,
  maquinaNome,
  empresa,
  itens,
  acoes,
  riscos,
  maquina,
  fichas,
  incluirChecklist,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: ApreciacaoTemplateProps) {
  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlug: Record<string, string> = {};
  for (const c of capitulos) if (c.slug_fixo) tituloPorSlug[c.slug_fixo] = c.titulo;

  // A ficha (antiga "Conclusão Técnica") só renderiza quando tem o que mostrar:
  // parecer, constatações, linhas de risco ou dados de inventário da máquina.
  const temConclusao = !!(
    apreciacao.conclusao_tecnica
    || apreciacao.recomendacoes
    || apreciacao.constatacoes_inspecao
    || riscos.length > 0
    || maquina
  );

  // Plano de Ação só entra no PDF quando há ao menos uma ação COM conteúdo.
  // Mesmo padrão do DRPS (drps_plano_acao_5w2h): salvar o plano em branco grava
  // uma linha vazia — filtra na renderização em vez de apagar o registro.
  const acoesComConteudo = acoes.filter((a) =>
    [a.what_acao, a.why_justificativa, a.where_local, a.when_prazo, a.who_responsavel, a.how_metodo, a.how_much_custo]
      .some((v) => (v ?? "").trim().length > 0),
  );

  // Um capítulo só entra no Sumário/numeração se renderiza seção numerada.
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "apreciacao_metodo":     return true;
      case "apreciacao_checklist":  return true;
      case "apreciacao_relacao":    return fichas.length > 0;
      case "apreciacao_risco":      return fichas.length > 0 || temConclusao;
      case "apreciacao_plano":      return acoesComConteudo.length > 0;
      case "apreciacao_assinatura": return true;
      // sumário não numera; apreciacao_identificacao não renderiza seção própria
      // (os dados da máquina ficam no cabeçalho fixo do topo).
      default:                      return false;
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado).
  const sumarioTitulos = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .filter((c) => renderizaNumerado(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valores),
    )
    .filter((t) => t && t.trim());

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "apreciacao_assinatura" && c.ativo !== false,
  );

  // Folha de assinaturas: quando há capítulo "apreciacao_assinatura", renderiza
  // na posição dele (numerada, quebra controlada pelo wrapper); senão, cai no
  // fim (fallback).
  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["apreciacao_assinatura"]}
    />
  );

  // Seções do sistema como nós nomeados (reutilizados nos dois modos).
  const checklistNode = (
    <ChecklistSection
      itens={itens}
      fichas={fichas}
      titulo="Checklist NR-12"
    />
  );
  const metodoNode = (
    <MetodoHrn
      titulo={numLabel(numPorSlug["apreciacao_metodo"], tituloPorSlug["apreciacao_metodo"] ?? "Método de Cálculo do Risco")}
    />
  );
  const relacaoNode = (
    <RelacaoMaquinas
      fichas={fichas}
      titulo={numLabel(numPorSlug["apreciacao_relacao"], tituloPorSlug["apreciacao_relacao"] ?? "Relação de Máquinas")}
    />
  );
  const maquinasNode = (
    <MaquinasSection
      fichas={fichas}
      titulo={numLabel(numPorSlug["apreciacao_checklist"], tituloPorSlug["apreciacao_checklist"] ?? "Apreciação de Risco por Máquina")}
    />
  );

  // Com máquinas, a seção vira a CONCLUSÃO GERAL do parque. Sem nenhuma ficha
  // (laudo que não passou pela v148), cai na ficha única de antes — assim
  // nenhum laudo fica sem seção.
  const conclusaoNode = fichas.length > 0 ? (
    <ConclusaoGeral
      fichas={fichas}
      parecer={apreciacao.conclusao_tecnica}
      recomendacoes={apreciacao.recomendacoes}
      titulo={numLabel(numPorSlug["apreciacao_risco"], tituloPorSlug["apreciacao_risco"] ?? "Conclusão Geral")}
    />
  ) : temConclusao ? (
    <FichaSection
      titulo={numLabel(
        numPorSlug["apreciacao_risco"],
        tituloPorSlug["apreciacao_risco"] ?? "Apreciação de Risco",
      )}
      maquinaNome={maquinaNome}
      maquina={maquina}
      constatacoes={apreciacao.constatacoes_inspecao}
      riscos={riscos}
      parecer={apreciacao.conclusao_tecnica}
      recomendacoes={apreciacao.recomendacoes}
    />
  ) : null;
  const planoNode = acoesComConteudo.length > 0 ? (
    <PlanoAcaoSection
      acoes={acoesComConteudo}
      titulo={numLabel(numPorSlug["apreciacao_plano"], tituloPorSlug["apreciacao_plano"] ?? "Plano de Ação")}
    />
  ) : null;

  // Mapeia os slugs fixos do módulo às seções (cabeçalho fica fixo no topo;
  // a folha de assinatura entra na posição do capítulo "apreciacao_assinatura").
  function renderSecaoApreciacao(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
      case "sumario":               return <SecaoSumario titulos={sumarioTitulos} />;
      case "apreciacao_metodo":     return metodoNode;
      case "apreciacao_checklist":  return incluirChecklist ? (<>{maquinasNode}{checklistNode}</>) : maquinasNode;
      case "apreciacao_relacao":    return relacaoNode;
      case "apreciacao_risco":      return conclusaoNode;
      case "apreciacao_plano":      return planoNode;
      case "apreciacao_assinatura": return folhaNode;
      default:                      return null;
    }
  }

  const corpo = temSecoesSistema(capitulos)
    ? renderUnificado(capitulos, valores, renderSecaoApreciacao, {
        numPorId,
        // Relação e ficha por máquina são tabelas largas — nascem em paisagem.
        orientacaoPorCapitulo: true,
      })
    : (
      <>
        {renderEditaveis(capitulos, valores, "inicio")}
        {metodoNode}
        {relacaoNode}
        {maquinasNode}
        {incluirChecklist ? checklistNode : null}
        {conclusaoNode}
        {planoNode}
        {renderEditaveis(capitulos, valores, "fim")}
      </>
    );

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {apreciacao.observacoes_gerais && (
        <div className="campo" style={{ marginBottom: 8 }}>
          <p className="rot">Observações gerais</p>
          <p className="val">{apreciacao.observacoes_gerais}</p>
        </div>
      )}

      {corpo}

      {/* Fallback: sem capítulo de assinatura ativo, renderiza a folha no fim. */}
      {!temAssinaturaFixo && (
        <FolhaAssinaturas
          signatarios={signatarios}
          empresa={folhaEmpresa}
          dataHoraAssinatura={dataHoraAssinatura}
          identificadorDocumento={identificadorDocumento}
        />
      )}
    </>
  );
}
