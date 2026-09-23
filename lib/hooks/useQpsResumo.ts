"use client";

// QPS — dados agregados da tela de Resumo.
//
// Diferente de `useQpsAplicacoes`, este hook NÃO recebe empresa: o Resumo é a
// única tela da área que enxerga a carteira inteira (decisão do usuário em
// 2026-08-10). Todo o resto de Questionários só mostra algo depois de escolher
// uma empresa no seletor.
//
// Busca em bloco, não por aplicação: 7 consultas fixas em vez de 3 por laudo.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { calcularMatriz, type CelulaMatriz } from "@/lib/qps/matriz";
import { etapaDaAplicacao, type EtapaQps } from "@/lib/qps/etapa";
import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsPlanoAcao5w2h,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";

// As tabelas qps_* ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qpsDb() { return createSupabaseBrowserClient() as any; }

// A etapa REAL da aplicação mora em `lib/qps/etapa.ts` desde 2026-09-10 — é
// regra, e regra precisa de teste. Reexportada aqui porque as telas já
// importavam o tipo deste arquivo.
export type { EtapaQps };

export interface AplicacaoResumo {
  aplicacao: QpsAplicacao;
  empresaNome: string;
  /** Do cadastro da empresa — o cartão do quadro de status mostra os três. */
  empresaCnpj: string | null;
  empresaMunicipio: string | null;
  empresaUf: string | null;
  tipoNome: string;
  etapa: EtapaQps;
  nRespondentes: number;
  setores: string[];
  cargos: string[];
  /** Células da matriz (setores × categorias do tipo). Vazio sem respondente. */
  celulas: CelulaMatriz[];
  /** Células que o psicólogo revisou à mão (linha em qps_probabilidades). */
  nRevisadas: number;
  nPlanos: number;
  /** Células ALTO sem nenhuma ação no mesmo setor + categoria. */
  altosSemPlano: CelulaMatriz[];
  diasParado: number;
  /** v201 — quantos deveriam responder. NULL quando ninguém informou. */
  previstos: number | null;
  /** Fração 0..1. NULL quando falta o denominador — nunca 0, que significaria
   *  "ninguém respondeu" e é afirmação diferente de "não sei". */
  taxaParticipacao: number | null;
}

export interface TipoResumo {
  tipo: QpsTipo;
  nCategorias: number;
  nPerguntas: number;
  nAplicacoes: number;
}

export interface DimensaoCritica {
  idCategoria: string;
  nome: string;
  alto: number;
  moderado: number;
  baixo: number;
}

export interface QpsResumo {
  aplicacoes: AplicacaoResumo[];
  tipos: TipoResumo[];
  dimensoes: DimensaoCritica[];
  totais: {
    aplicacoes: number;
    rascunho: number;
    emAndamento: number;
    concluido: number;
    /** v206 — aplicações entregues ao cliente. */
    enviado: number;
    respondentes: number;
    setores: number;
    cargos: number;
    celulas: number;
    celulasRevisadas: number;
    celulasSemBase: number;
    alto: number;
    moderado: number;
    baixo: number;
    altosSemPlano: number;
    semRespondente: number;
    /** Taxa da carteira, 0..1 — só sobre aplicações que TÊM denominador. */
    taxaParticipacao: number | null;
    /** Quantas aplicações entraram nessa conta (o resto é invisível para ela). */
    aplicacoesComPrevistos: number;
    /** Aplicações com respondentes mas SEM denominador — a lacuna a fechar. */
    semPrevistos: number;
    /** A PIOR taxa individual. Existe porque média esconde caso ruim. */
    piorParticipacao: { titulo: string; taxa: number } | null;
  };
}

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function useQpsResumo() {
  return useQuery({
    queryKey: ["qps-resumo"],
    staleTime: 60_000,
    queryFn: async (): Promise<QpsResumo> => {
      const sb = qpsDb();

      const [apRes, tiposRes, catsRes, pergsRes, respRes, probsRes, planos5w2hRes] =
        await Promise.all([
          sb.from("qps_aplicacoes").select("*").neq("status", "DELETADO").order("criado_em", { ascending: false }),
          sb.from("qps_tipos").select("*"),
          sb.from("qps_categorias").select("*").order("ordem"),
          sb.from("qps_perguntas").select("*").eq("ativo", true).order("ordem"),
          sb.from("qps_respondentes").select("*"),
          sb.from("qps_probabilidades").select("*"),
          // v225/v226 — o Plano de Ação 5W2H é o único plano (o simples foi apagado).
          sb.from("qps_plano_acao_5w2h").select("id_aplicacao,onde"),
        ]);

      for (const r of [apRes, tiposRes, catsRes, pergsRes, respRes, probsRes, planos5w2hRes]) {
        if (r.error) throw r.error;
      }

      const aplicacoes = (apRes.data ?? []) as QpsAplicacao[];
      const tipos = (tiposRes.data ?? []) as QpsTipo[];
      const categorias = (catsRes.data ?? []) as QpsCategoria[];
      const perguntas = (pergsRes.data ?? []) as QpsPergunta[];
      const respondentes = (respRes.data ?? []) as QpsRespondente[];
      const probabilidades = (probsRes.data ?? []) as QpsProbabilidade[];
      const planos5w2h = (planos5w2hRes.data ?? []) as Pick<QpsPlanoAcao5w2h, "id_aplicacao" | "onde">[];

      // Nomes das empresas — só as citadas, a base tem centenas.
      const idsEmpresa = [...new Set(aplicacoes.map((a) => a.id_empresa))].filter(Boolean);
      interface EmpresaMin {
        id_empresa: string;
        nome_empresa: string | null;
        razao_social: string | null;
        cnpj: string | null;
        municipio: string | null;
        uf: string | null;
      }
      let empresaPorId = new Map<string, EmpresaMin>();
      if (idsEmpresa.length > 0) {
        const { data: emps } = await sb
          .from("empresas")
          .select("id_empresa, nome_empresa, razao_social, cnpj, municipio, uf")
          .in("id_empresa", idsEmpresa);
        empresaPorId = new Map(
          (emps ?? []).map((e: EmpresaMin) => [e.id_empresa, e] as const)
        );
      }

      const tipoPorId = new Map(tipos.map((t) => [t.id_tipo, t]));
      const catsPorTipo = new Map<string, QpsCategoria[]>();
      for (const c of categorias) {
        const arr = catsPorTipo.get(c.id_tipo) ?? [];
        arr.push(c);
        catsPorTipo.set(c.id_tipo, arr);
      }

      const linhas: AplicacaoResumo[] = aplicacoes.map((ap) => {
        const resp = respondentes.filter((r) => r.id_aplicacao === ap.id_aplicacao);
        const probs = probabilidades.filter((p) => p.id_aplicacao === ap.id_aplicacao);
        const acoes5w2h = planos5w2h.filter((p) => p.id_aplicacao === ap.id_aplicacao);
        const tipo = tipoPorId.get(ap.id_tipo);
        const cats = catsPorTipo.get(ap.id_tipo) ?? [];

        // Os setores saem dos próprios respondentes — não há cadastro de setor
        // nesta área. Sem respondente importado, não há matriz possível.
        const setores = [...new Set(resp.map((r) => r.setor).filter(Boolean))].sort();
        const cargos = [...new Set(resp.map((r) => r.cargo).filter(Boolean))].sort() as string[];

        const celulas =
          tipo && setores.length > 0 && cats.length > 0
            ? calcularMatriz(
                setores,
                cats,
                perguntas,
                resp.map((r) => ({ setor: r.setor, respostas: r.respostas ?? {} })),
                probs,
                tipo.escala_min,
                tipo.escala_max
              )
            : [];

        // v201. Denominador ausente vira NULL, jamais 0: "não sei quantos
        // deveriam" é afirmação diferente de "ninguém respondeu". O CHECK do
        // banco já garante > 0, então não há divisão por zero aqui.
        const previstos = ap.trabalhadores_previstos ?? null;
        const taxaParticipacao = previstos ? resp.length / previstos : null;

        // A ação 5W2H não tem categoria: "Onde" lista setores por vírgula (ou
        // "Todos os setores"), e cobre todas as categorias desses setores.
        const setoresCom5w2h = new Set<string>();
        let cobreTodosSetores = false;
        for (const a of acoes5w2h) {
          for (const s of (a.onde ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
            if (s === "Todos os setores") cobreTodosSetores = true;
            else setoresCom5w2h.add(s);
          }
        }
        const altosSemPlano = celulas.filter(
          (c) => c.risco === "ALTO" && !cobreTodosSetores && !setoresCom5w2h.has(c.setor)
        );

        const etapa = etapaDaAplicacao({
          status: ap.status,
          nRespondentes: resp.length,
          nPlanos: acoes5w2h.length,
        });

        const emp = empresaPorId.get(ap.id_empresa);

        return {
          aplicacao: ap,
          empresaNome: emp?.nome_empresa || emp?.razao_social || "—",
          empresaCnpj: emp?.cnpj ?? null,
          empresaMunicipio: emp?.municipio ?? null,
          empresaUf: emp?.uf ?? null,
          tipoNome: tipo?.nome ?? "—",
          etapa,
          nRespondentes: resp.length,
          setores,
          cargos,
          celulas,
          nRevisadas: probs.length,
          nPlanos: acoes5w2h.length,
          altosSemPlano,
          previstos,
          taxaParticipacao,
          diasParado: diasDesde(ap.atualizado_em ?? ap.criado_em),
        };
      });

      // ─── Dimensões mais críticas da carteira ──────────────────────────────
      // Só existe aqui: a tela de uma aplicação nunca cruza as outras.
      const porCategoria = new Map<string, DimensaoCritica>();
      for (const l of linhas) {
        for (const c of l.celulas) {
          if (c.semBase) continue; // não contar célula que ninguém respondeu
          const atual =
            porCategoria.get(c.categoria.id_categoria) ??
            { idCategoria: c.categoria.id_categoria, nome: c.categoria.nome, alto: 0, moderado: 0, baixo: 0 };
          if (c.risco === "ALTO") atual.alto += 1;
          else if (c.risco === "MODERADO") atual.moderado += 1;
          else atual.baixo += 1;
          porCategoria.set(c.categoria.id_categoria, atual);
        }
      }
      const dimensoes = [...porCategoria.values()].sort(
        (a, b) => b.alto - a.alto || b.moderado - a.moderado || a.nome.localeCompare(b.nome)
      );

      // ─── Saúde do catálogo ────────────────────────────────────────────────
      const tiposResumo: TipoResumo[] = tipos.map((t) => {
        const cats = catsPorTipo.get(t.id_tipo) ?? [];
        const idsCat = new Set(cats.map((c) => c.id_categoria));
        return {
          tipo: t,
          nCategorias: cats.length,
          nPerguntas: perguntas.filter((p) => idsCat.has(p.id_categoria)).length,
          nAplicacoes: aplicacoes.filter((a) => a.id_tipo === t.id_tipo).length,
        };
      });

      const todasCelulas = linhas.flatMap((l) => l.celulas);
      const comBase = todasCelulas.filter((c) => !c.semBase);

      // 🔑 A taxa da carteira soma só o que TEM denominador — misturar quem não
      // informou inflaria o numerador com respondentes sem par no denominador.
      // E devolvemos junto a PIOR taxa individual, porque a média da carteira
      // esconde a aplicação que foi mal: é a mesma armadilha que o detector de
      // frescor de documentos documentou ao trocar max() por min().
      const comPrevistos = linhas.filter((l) => l.previstos !== null);
      const somaPrevistos = comPrevistos.reduce((n, l) => n + (l.previstos ?? 0), 0);
      const somaRespComPrevistos = comPrevistos.reduce((n, l) => n + l.nRespondentes, 0);
      const piores = comPrevistos
        .filter((l) => l.taxaParticipacao !== null)
        .sort((a, b) => (a.taxaParticipacao ?? 1) - (b.taxaParticipacao ?? 1));

      return {
        aplicacoes: linhas,
        tipos: tiposResumo,
        dimensoes,
        totais: {
          aplicacoes: aplicacoes.length,
          rascunho: aplicacoes.filter((a) => a.status === "RASCUNHO").length,
          emAndamento: aplicacoes.filter((a) => a.status === "EM_ANDAMENTO").length,
          concluido: aplicacoes.filter((a) => a.status === "CONCLUIDO").length,
          enviado: aplicacoes.filter((a) => a.status === "ENVIADO_CLIENTE").length,
          respondentes: respondentes.length,
          setores: new Set(linhas.flatMap((l) => l.setores)).size,
          cargos: new Set(linhas.flatMap((l) => l.cargos)).size,
          celulas: todasCelulas.length,
          celulasRevisadas: probabilidades.length,
          celulasSemBase: todasCelulas.filter((c) => c.semBase).length,
          alto: comBase.filter((c) => c.risco === "ALTO").length,
          moderado: comBase.filter((c) => c.risco === "MODERADO").length,
          baixo: comBase.filter((c) => c.risco === "BAIXO").length,
          altosSemPlano: linhas.reduce((n, l) => n + l.altosSemPlano.length, 0),
          semRespondente: linhas.filter((l) => l.nRespondentes === 0).length,
          taxaParticipacao: somaPrevistos > 0 ? somaRespComPrevistos / somaPrevistos : null,
          aplicacoesComPrevistos: comPrevistos.length,
          semPrevistos: linhas.filter((l) => l.previstos === null && l.nRespondentes > 0).length,
          piorParticipacao: piores[0]
            ? { titulo: piores[0].aplicacao.titulo, taxa: piores[0].taxaParticipacao as number }
            : null,
        },
      };
    },
  });
}
