// Riscos Psicossociais por empresa, setorizados — a visão consolidada do
// Painel SST sobre o que o DRPS e o Questionário (QPS) já concluíram.
//
// Regra do pedido (2026-09-25): só entra avaliação que chegou à coluna
// "Concluídos" do quadro — status CONCLUIDO, ou ENVIADO_CLIENTE, que é a
// coluna seguinte (passou por Concluídos). Rascunho e em andamento ficam de
// fora porque a probabilidade ainda pode mudar.
//
// Nada é recalculado de um jeito novo: cada setor passa pelas MESMAS funções
// das telas de Análise (`montarBlocosPorSetor` no DRPS, `calcularAnaliseSetor`
// no QPS), então o nível mostrado aqui é o que está no laudo.

import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { montarBlocosPorSetor } from "@/lib/drps/blocos";
import { calcularAnaliseSetor, listarSetoresQps } from "@/lib/qps/gravidade";
import { aplicarFontesQps } from "@/lib/qps/laudo";
import type { DrpsProbabilidade, DrpsRespondente, NivelMatriz } from "@/lib/drps/types";
import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";

// drps_* e qps_* não estão no tipo `Database`. O client vem de fora: o hook
// passa o do navegador e a rota do PDF o do servidor (RLS de quem pede).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

/** Uma empresa, várias (lista) ou todas (undefined). Lista vazia = nenhuma. */
type FiltroEmpresa = string | string[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filtrarEmpresa(q: any, filtro?: FiltroEmpresa) {
  if (Array.isArray(filtro)) return q.in("id_empresa", filtro.length ? filtro : ["-"]);
  return filtro ? q.eq("id_empresa", filtro) : q;
}

export const STATUS_CONCLUIDOS = ["CONCLUIDO", "ENVIADO_CLIENTE"] as const;

/** Do menor para o maior — o índice serve de peso para achar o pior. */
export const NIVEIS: NivelMatriz[] = ["Baixo", "Médio", "Alto", "Crítico"];

export interface FatorRisco {
  nome: string;
  /** Fonte geradora do risco (texto do tópico no DRPS / da categoria no QPS). */
  fonteGeradora: string | null;
  nivel: NivelMatriz;
  /** O psicólogo gravou a probabilidade deste setor × fator? false = valeu o padrão Baixa (1).
   *  Opcional: só a Consolidação de Grupo usa, para alertar (painel v0.3.759). */
  probabilidadeInformada?: boolean;
}

export interface SetorRisco {
  setor: string;
  respondentes: number;
  fatores: FatorRisco[];
  /** "Possíveis agravos à saúde mental" da tela de Análise, um item por linha. */
  agravos: string[];
  /** "Medidas de controle recomendadas", um item por linha. */
  medidas: string[];
  contagem: Record<NivelMatriz, number>;
  pior: NivelMatriz | null;
  /** QPS: categorias sem nenhuma resposta no setor ("sem base" — não é Baixo). */
  semBase?: string[];
}

export interface AvaliacaoRisco {
  fonte: "DRPS" | "Questionário";
  id: string;
  titulo: string;
  status: string;
  /** Data de referência para ordenar (conclusão, elaboração ou última edição). */
  data: string | null;
  responsavel: string | null;
  setores: SetorRisco[];
}

export interface EmpresaRisco {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacoes: AvaliacaoRisco[];
}

interface EmpresaMin {
  id_empresa: string;
  nome_empresa: string | null;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
}

/** `.in()` com centenas de ids estoura a URL — busca em lotes. */
async function porLotes<T>(
  ids: string[],
  busca: (lote: string[]) => Promise<T[]>,
  tamanho = 100
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += tamanho) {
    out.push(...(await busca(ids.slice(i, i + tamanho))));
  }
  return out;
}

function todasAsLinhas<T>(sb: Sb, tabela: string, coluna: string, ids: string[], select = "*") {
  return porLotes(ids, (lote) =>
    fetchAllRows<T>((de, ate) => sb.from(tabela).select(select).in(coluna, lote).range(de, ate))
  );
}

/**
 * Os textos por setor da Análise são gravados como texto livre, um item por
 * linha (às vezes com "•" ou "-" na frente). Vira lista limpa, sem repetidos.
 */
export function itensDoTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const itens = texto
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*[•\-*·]\s*/, "").trim())
    .filter(Boolean);
  return [...new Set(itens)];
}

function resumirSetor(
  setor: string,
  respondentes: number,
  fatores: FatorRisco[],
  textos: { agravos?: string | null; medidas?: string | null } = {}
): SetorRisco {
  const contagem: Record<NivelMatriz, number> = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 };
  let pior: NivelMatriz | null = null;
  for (const f of fatores) {
    contagem[f.nivel]++;
    if (!pior || NIVEIS.indexOf(f.nivel) > NIVEIS.indexOf(pior)) pior = f.nivel;
  }
  return {
    setor,
    respondentes,
    fatores,
    agravos: itensDoTexto(textos.agravos),
    medidas: itensDoTexto(textos.medidas),
    contagem,
    pior,
  };
}

async function carregarDrps(sb: Sb, idEmpresa?: FiltroEmpresa): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; empresas: EmpresaMin[] }> {
  let q = sb
    .from("drps_relatorios")
    .select(
      "id_relatorio, id_empresa, revisao, status, data_elaboracao, data_conclusao, responsavel_tecnico, updated_at, agravos_por_setor, medidas_por_setor, fontes_por_setor, empresas(id_empresa, nome_empresa, cnpj, municipio, uf)"
    )
    .in("status", STATUS_CONCLUIDOS);
  q = filtrarEmpresa(q, idEmpresa);
  const { data, error } = await q;
  if (error) throw error;
  const relatorios = (data ?? []) as Array<{
    id_relatorio: string;
    id_empresa: string;
    revisao: number | string | null;
    status: string;
    data_elaboracao: string | null;
    data_conclusao: string | null;
    responsavel_tecnico: string | null;
    updated_at: string | null;
    agravos_por_setor: Record<string, string> | null;
    medidas_por_setor: Record<string, string> | null;
    fontes_por_setor: Record<string, Record<string, string[]>> | null;
    empresas: EmpresaMin | null;
  }>;
  const ids = relatorios.map((r) => r.id_relatorio);
  if (ids.length === 0) return { avaliacoes: [], empresas: [] };

  const [respondentes, probabilidades] = await Promise.all([
    todasAsLinhas<DrpsRespondente>(sb, "drps_respondentes", "id_relatorio", ids),
    todasAsLinhas<DrpsProbabilidade>(sb, "drps_probabilidades", "id_relatorio", ids),
  ]);

  const avaliacoes = relatorios.map((r) => {
    const resp = respondentes.filter((x) => x.id_relatorio === r.id_relatorio);
    const probs = probabilidades.filter((x) => x.id_relatorio === r.id_relatorio);
    const setores = montarBlocosPorSetor(resp, probs, undefined, r.fontes_por_setor).map((b) =>
      resumirSetor(
        b.setor,
        b.totalRespondentes,
        b.topicos.map((t) => ({
          nome: t.nome,
          fonteGeradora: t.fonteGeradora || null,
          nivel: t.matriz,
          probabilidadeInformada: probs.some((p) => p.setor === b.setor && p.topico_idx === t.idx),
        })),
        { agravos: r.agravos_por_setor?.[b.setor], medidas: r.medidas_por_setor?.[b.setor] }
      )
    );
    return {
      idEmpresa: r.id_empresa,
      fonte: "DRPS" as const,
      id: r.id_relatorio,
      titulo: `DRPS · Revisão ${r.revisao ?? 0}`,
      status: r.status,
      data: r.data_conclusao ?? r.data_elaboracao ?? r.updated_at,
      responsavel: r.responsavel_tecnico,
      setores,
    };
  });
  const empresas = relatorios.map((r) => r.empresas).filter((e): e is EmpresaMin => !!e);
  return { avaliacoes, empresas };
}

async function carregarQps(sb: Sb, idEmpresa?: FiltroEmpresa): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; idsEmpresa: string[] }> {
  let q = sb
    .from("qps_aplicacoes")
    .select("*")
    .in("status", STATUS_CONCLUIDOS);
  q = filtrarEmpresa(q, idEmpresa);
  const { data, error } = await q;
  if (error) throw error;
  const aplicacoes = (data ?? []) as QpsAplicacao[];
  const ids = aplicacoes.map((a) => a.id_aplicacao);
  if (ids.length === 0) return { avaliacoes: [], idsEmpresa: [] };

  const [tiposRes, catsRes, pergsRes, respondentes, probabilidades] = await Promise.all([
    sb.from("qps_tipos").select("*"),
    sb.from("qps_categorias").select("*").order("ordem"),
    fetchAllRows<QpsPergunta>((de, ate) =>
      sb.from("qps_perguntas").select("*").eq("ativo", true).order("ordem").range(de, ate)
    ),
    todasAsLinhas<QpsRespondente>(sb, "qps_respondentes", "id_aplicacao", ids),
    todasAsLinhas<QpsProbabilidade>(sb, "qps_probabilidades", "id_aplicacao", ids),
  ]);
  if (tiposRes.error) throw tiposRes.error;
  if (catsRes.error) throw catsRes.error;
  const tipos = new Map(((tiposRes.data ?? []) as QpsTipo[]).map((t) => [t.id_tipo, t]));
  const categorias = (catsRes.data ?? []) as QpsCategoria[];
  const perguntas = pergsRes;

  const avaliacoes = aplicacoes.map((ap) => {
    const tipo = tipos.get(ap.id_tipo);
    const cats = categorias.filter((c) => c.id_tipo === ap.id_tipo);
    const resp = respondentes
      .filter((r) => r.id_aplicacao === ap.id_aplicacao)
      .map((r) => ({ setor: r.setor, respostas: r.respostas ?? {} }));
    const probs = probabilidades.filter((p) => p.id_aplicacao === ap.id_aplicacao);
    const setores = tipo
      ? listarSetoresQps(resp).map((s) => {
          const analise = calcularAnaliseSetor(s, cats, perguntas, resp, probs, tipo.escala_min, tipo.escala_max);
          const n = resp.filter((r) => (r.setor ?? "").trim() === s).length;
          const resumo = resumirSetor(
            s,
            n,
            // Categoria sem resposta no setor não tem nível — não vira "Baixo".
            analise
              .filter((c) => c.matriz)
              .map((c) => ({
                nome: c.nome,
                fonteGeradora: aplicarFontesQps([c], ap.fontes_por_setor, s)[0].fonteGeradora,
                nivel: c.matriz!,
                probabilidadeInformada: c.probabilidadeOrigem !== "padrao",
              })),
            // No QPS, "*" guarda o texto da aplicação inteira: vale quando o setor não tem o seu.
            {
              agravos: ap.agravos_por_setor?.[s] || ap.agravos_por_setor?.["*"],
              medidas: ap.medidas_por_setor?.[s] || ap.medidas_por_setor?.["*"],
            }
          );
          return { ...resumo, semBase: analise.filter((c) => c.semBase).map((c) => c.nome) };
        })
      : [];
    return {
      idEmpresa: ap.id_empresa,
      fonte: "Questionário" as const,
      id: ap.id_aplicacao,
      titulo: ap.titulo || "Questionário",
      status: ap.status,
      data: ap.data_elaboracao ?? ap.atualizado_em ?? ap.criado_em,
      responsavel: ap.responsavel ?? ap.usuario_nome,
      setores,
    };
  });
  return { avaliacoes, idsEmpresa: [...new Set(aplicacoes.map((a) => a.id_empresa))] };
}

/** Empresas com DRPS/Questionário concluído e o nível de cada risco por setor;
 *  com `idEmpresa`, só aquela (a lista volta com 0 ou 1 item); com uma lista de
 *  ids, só essas (Consolidação de Grupo, v295). */
export async function carregarRiscosPsicossociais(sb: Sb, idEmpresa?: FiltroEmpresa): Promise<EmpresaRisco[]> {
  const [drps, qps] = await Promise.all([carregarDrps(sb, idEmpresa), carregarQps(sb, idEmpresa)]);

  const empresaPorId = new Map(drps.empresas.map((e) => [e.id_empresa, e]));
  const faltando = qps.idsEmpresa.filter((id) => id && !empresaPorId.has(id));
  if (faltando.length > 0) {
    const emps = await porLotes(faltando, async (lote) => {
      const { data, error } = await sb
        .from("empresas")
        .select("id_empresa, nome_empresa, cnpj, municipio, uf")
        .in("id_empresa", lote);
      if (error) throw error;
      return (data ?? []) as EmpresaMin[];
    });
    for (const e of emps) empresaPorId.set(e.id_empresa, e);
  }

  const porEmpresa = new Map<string, EmpresaRisco>();
  for (const av of [...drps.avaliacoes, ...qps.avaliacoes]) {
    const { idEmpresa: idDaEmpresa, ...avaliacao } = av;
    let alvo = porEmpresa.get(idDaEmpresa);
    if (!alvo) {
      const e = empresaPorId.get(idDaEmpresa);
      alvo = {
        idEmpresa: idDaEmpresa,
        nome: e?.nome_empresa ?? "Empresa sem cadastro",
        cnpj: e?.cnpj ?? null,
        municipio: e?.municipio ?? null,
        uf: e?.uf ?? null,
        avaliacoes: [],
      };
      porEmpresa.set(idDaEmpresa, alvo);
    }
    alvo.avaliacoes.push(avaliacao);
  }
  const lista = [...porEmpresa.values()];
  for (const e of lista) {
    e.avaliacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
