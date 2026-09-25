"use client";

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

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { montarBlocosPorSetor } from "@/lib/drps/blocos";
import { calcularAnaliseSetor, listarSetoresQps } from "@/lib/qps/gravidade";
import type { DrpsProbabilidade, DrpsRespondente, NivelMatriz } from "@/lib/drps/types";
import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";

// drps_* e qps_* não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export const STATUS_CONCLUIDOS = ["CONCLUIDO", "ENVIADO_CLIENTE"] as const;

/** Do menor para o maior — o índice serve de peso para achar o pior. */
export const NIVEIS: NivelMatriz[] = ["Baixo", "Médio", "Alto", "Crítico"];

export interface FatorRisco {
  nome: string;
  nivel: NivelMatriz;
}

export interface SetorRisco {
  setor: string;
  respondentes: number;
  fatores: FatorRisco[];
  contagem: Record<NivelMatriz, number>;
  pior: NivelMatriz | null;
}

export interface AvaliacaoRisco {
  fonte: "DRPS" | "Questionário";
  id: string;
  titulo: string;
  status: string;
  /** Data de referência para ordenar (conclusão, elaboração ou última edição). */
  data: string | null;
  responsavel: string | null;
  href: string;
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

function todasAsLinhas<T>(tabela: string, coluna: string, ids: string[], select = "*") {
  return porLotes(ids, (lote) =>
    fetchAllRows<T>((de, ate) => db().from(tabela).select(select).in(coluna, lote).range(de, ate))
  );
}

function resumirSetor(setor: string, respondentes: number, fatores: FatorRisco[]): SetorRisco {
  const contagem: Record<NivelMatriz, number> = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 };
  let pior: NivelMatriz | null = null;
  for (const f of fatores) {
    contagem[f.nivel]++;
    if (!pior || NIVEIS.indexOf(f.nivel) > NIVEIS.indexOf(pior)) pior = f.nivel;
  }
  return { setor, respondentes, fatores, contagem, pior };
}

async function carregarDrps(): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; empresas: EmpresaMin[] }> {
  const { data, error } = await db()
    .from("drps_relatorios")
    .select(
      "id_relatorio, id_empresa, revisao, status, data_elaboracao, data_conclusao, responsavel_tecnico, updated_at, empresas(id_empresa, nome_empresa, cnpj, municipio, uf)"
    )
    .in("status", STATUS_CONCLUIDOS);
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
    empresas: EmpresaMin | null;
  }>;
  const ids = relatorios.map((r) => r.id_relatorio);
  if (ids.length === 0) return { avaliacoes: [], empresas: [] };

  const [respondentes, probabilidades] = await Promise.all([
    todasAsLinhas<DrpsRespondente>("drps_respondentes", "id_relatorio", ids),
    todasAsLinhas<DrpsProbabilidade>("drps_probabilidades", "id_relatorio", ids),
  ]);

  const avaliacoes = relatorios.map((r) => {
    const resp = respondentes.filter((x) => x.id_relatorio === r.id_relatorio);
    const probs = probabilidades.filter((x) => x.id_relatorio === r.id_relatorio);
    const setores = montarBlocosPorSetor(resp, probs).map((b) =>
      resumirSetor(
        b.setor,
        b.totalRespondentes,
        b.topicos.map((t) => ({ nome: t.nome, nivel: t.matriz }))
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
      href: `/psicossocial/${r.id_relatorio}/analise`,
      setores,
    };
  });
  const empresas = relatorios.map((r) => r.empresas).filter((e): e is EmpresaMin => !!e);
  return { avaliacoes, empresas };
}

async function carregarQps(): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; idsEmpresa: string[] }> {
  const { data, error } = await db()
    .from("qps_aplicacoes")
    .select("*")
    .in("status", STATUS_CONCLUIDOS);
  if (error) throw error;
  const aplicacoes = (data ?? []) as QpsAplicacao[];
  const ids = aplicacoes.map((a) => a.id_aplicacao);
  if (ids.length === 0) return { avaliacoes: [], idsEmpresa: [] };

  const [tiposRes, catsRes, pergsRes, respondentes, probabilidades] = await Promise.all([
    db().from("qps_tipos").select("*"),
    db().from("qps_categorias").select("*").order("ordem"),
    fetchAllRows<QpsPergunta>((de, ate) =>
      db().from("qps_perguntas").select("*").eq("ativo", true).order("ordem").range(de, ate)
    ),
    todasAsLinhas<QpsRespondente>("qps_respondentes", "id_aplicacao", ids),
    todasAsLinhas<QpsProbabilidade>("qps_probabilidades", "id_aplicacao", ids),
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
          return resumirSetor(
            s,
            n,
            // Categoria sem resposta no setor não tem nível — não vira "Baixo".
            analise.filter((c) => c.matriz).map((c) => ({ nome: c.nome, nivel: c.matriz! }))
          );
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
      href: `/questionarios-psicossociais/${ap.id_aplicacao}/analise`,
      setores,
    };
  });
  return { avaliacoes, idsEmpresa: [...new Set(aplicacoes.map((a) => a.id_empresa))] };
}

export function useRiscosPsicossociais() {
  return useQuery({
    queryKey: ["riscos-psicossociais"],
    staleTime: 60_000,
    queryFn: async (): Promise<EmpresaRisco[]> => {
      const [drps, qps] = await Promise.all([carregarDrps(), carregarQps()]);

      const empresaPorId = new Map(drps.empresas.map((e) => [e.id_empresa, e]));
      const faltando = qps.idsEmpresa.filter((id) => id && !empresaPorId.has(id));
      if (faltando.length > 0) {
        const emps = await porLotes(faltando, async (lote) => {
          const { data, error } = await db()
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
        const { idEmpresa, ...avaliacao } = av;
        let alvo = porEmpresa.get(idEmpresa);
        if (!alvo) {
          const e = empresaPorId.get(idEmpresa);
          alvo = {
            idEmpresa,
            nome: e?.nome_empresa ?? "Empresa sem cadastro",
            cnpj: e?.cnpj ?? null,
            municipio: e?.municipio ?? null,
            uf: e?.uf ?? null,
            avaliacoes: [],
          };
          porEmpresa.set(idEmpresa, alvo);
        }
        alvo.avaliacoes.push(avaliacao);
      }
      const lista = [...porEmpresa.values()];
      for (const e of lista) {
        e.avaliacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
      }
      return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
