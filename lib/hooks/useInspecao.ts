"use client";

import { useMemo } from "react";
import { contarPilulas, separarSelecao, type FiltroInspecao, type LinhaContagem } from "@/lib/inspecoes/pilulas";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { filtroPeriodo } from "@/lib/inspecoes/periodo";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type {
  Cargo,
  Complemento,
  EpiEpc,
  Extintor,
  Foto,
  Inspecao,
  InspecaoMaquina,
  PaeContato,
  Responsavel,
  Risco,
  Setor,
  TreinamentoNR,
  TreinamentoSetorRel,
  TreinamentoCargoRel,
  TreinamentoRiscoRel,
} from "@/lib/supabase/types";

export interface InspecaoFull {
  inspecao: Inspecao;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  epis: EpiEpc[];
  fotos: Foto[];
  responsaveis: Responsavel[];
  complementos: Complemento[];
  paeContatos: PaeContato[];
  treinamentos: TreinamentoNR[];
  treinamentosSetor: TreinamentoSetorRel[];
  treinamentosCargo: TreinamentoCargoRel[];
  treinamentosRisco: TreinamentoRiscoRel[];
  extintores: Extintor[];
  maquinas: InspecaoMaquina[];
}

/**
 * A busca no servidor, extraída para o `useInspecao` poder ter um plano B.
 *
 * Continua sendo exatamente a consulta de sempre — o que mudou é quem a chama.
 */
async function carregarDoServidor(inspId: string): Promise<InspecaoFull> {
      const supabase = createSupabaseBrowserClient();

      const [
        inspRes,
        setoresRes,
        cargosRes,
        riscosRes,
        episRes,
        fotosRes,
        respRes,
        compRes,
        paeRes,
        treinaRes,
        extintoresRes,
        maquinasRes,
      ] = await Promise.all([
        supabase.from("inspecoes").select("*").eq("id_inspecao", inspId).single(),
        supabase.from("setores").select("*").eq("id_inspecao", inspId).order("setor_ghe"),
        supabase.from("cargos").select("*").eq("id_inspecao", inspId).order("cargo"),
        supabase.from("riscos").select("*").eq("id_inspecao", inspId),
        supabase.from("epi_epc").select("*").eq("id_inspecao", inspId),
        supabase.from("fotos").select("*").eq("id_inspecao", inspId).order("data_upload"),
        supabase.from("responsaveis").select("*").eq("id_inspecao", inspId),
        supabase.from("complementos").select("*").eq("id_inspecao", inspId),
        supabase.from("pae_contatos").select("*").eq("id_inspecao", inspId).order("ordem"),
        supabase.from("treinamentos_nr").select("*").eq("id_inspecao", inspId).order("ordem"),
        supabase.from("extintores").select("*").eq("id_inspecao", inspId).order("ordem"),
        // v160: os setores da máquina vêm embedados da tabela de ligação. A
        // junção não tem id_inspecao, então filtrar por ela direto exigiria uma
        // segunda ida ao banco — o embed resolve numa consulta só.
        supabase
          .from("inspecao_maquinas")
          .select("*, inspecao_maquinas_setores(id_setor)")
          .eq("id_inspecao", inspId)
          .order("ordem")
          .order("created_at"),
      ]);

      if (inspRes.error) throw inspRes.error;

      const treinamentos = (treinaRes.data ?? []) as unknown as TreinamentoNR[];
      const idsTreina = treinamentos.map((t) => t.id_treinamento);

      // Relações M:N só carregam se há treinamentos (evita query inútil)
      const [setRelRes, carRelRes, risRelRes] = idsTreina.length
        ? await Promise.all([
            supabase.from("treinamentos_setor").select("*").in("id_treinamento", idsTreina),
            supabase.from("treinamentos_cargo").select("*").in("id_treinamento", idsTreina),
            supabase.from("treinamentos_risco").select("*").in("id_treinamento", idsTreina),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

      return {
        inspecao: inspRes.data as unknown as Inspecao,
        setores: (setoresRes.data ?? []) as unknown as Setor[],
        cargos: (cargosRes.data ?? []) as unknown as Cargo[],
        riscos: (riscosRes.data ?? []) as unknown as Risco[],
        epis: (episRes.data ?? []) as unknown as EpiEpc[],
        fotos: (fotosRes.data ?? []) as unknown as Foto[],
        responsaveis: (respRes.data ?? []) as unknown as Responsavel[],
        complementos: (compRes.data ?? []) as unknown as Complemento[],
        paeContatos: (paeRes.data ?? []) as unknown as PaeContato[],
        treinamentos,
        treinamentosSetor: (setRelRes.data ?? []) as unknown as TreinamentoSetorRel[],
        treinamentosCargo: (carRelRes.data ?? []) as unknown as TreinamentoCargoRel[],
        treinamentosRisco: (risRelRes.data ?? []) as unknown as TreinamentoRiscoRel[],
        extintores: (extintoresRes.data ?? []) as unknown as Extintor[],
        // Achata o embed em `ids_setores` para o resto do app não precisar
        // conhecer o formato da tabela de ligação.
        maquinas: ((maquinasRes.data ?? []) as Record<string, unknown>[]).map((m) => {
          const vinculos = Array.isArray(m.inspecao_maquinas_setores)
            ? (m.inspecao_maquinas_setores as { id_setor: string }[])
            : [];
          const { inspecao_maquinas_setores: _embed, ...resto } = m;
          return {
            ...resto,
            ids_setores: vinculos.map((v) => v.id_setor).filter(Boolean),
          };
        }) as unknown as InspecaoMaquina[],
      };
}

/**
 * Mantém fresca a cópia que o técnico já levou — e SÓ ela.
 *
 * Guardar toda inspeção que alguém abre encheria o aparelho com o que ninguém
 * pediu e daria a ilusão de cobertura: o técnico sairia da base achando que está
 * coberto porque "abriu a tela". A decisão de levar continua sendo do botão; o
 * que isto faz é impedir que a cópia levada envelheça enquanto ele ainda tem
 * sinal.
 */
async function manterCacheFresco(inspId: string, dados: InspecaoFull): Promise<void> {
  const jaLevada = await lerDocumentoCache(inspId);
  if (jaLevada) await guardarDocumentoCache(inspId, dados);
}

export function useInspecao(id: string | null | undefined) {
  return useQuery({
    queryKey: ["inspecao", id],
    enabled: !!id,
    staleTime: 2 * 60 * 1000,

    /**
     * Sem rede, insistir é perder tempo do técnico olhando um spinner. O plano B
     * está dentro da `queryFn` e responde na primeira tentativa; repetir só faz
     * sentido para erro que não é de rede.
     */
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<InspecaoFull> => {
      const inspId = id!;
      try {
        const dados = await carregarDoServidor(inspId);
        // Sem `await`: a tela não deve esperar a gravação do cache para pintar.
        void manterCacheFresco(inspId, dados);
        return dados;
      } catch (e) {
        // Recusa do banco ou inspeção inexistente continuam sendo erro — cair no
        // cache aqui esconderia o problema e mostraria dado velho como se fosse
        // o atual.
        if (!ehErroDeRede(e)) throw e;

        const guardada = await lerDocumentoCache<InspecaoFull>(inspId);
        if (guardada) return guardada.dados;

        // Não foi levada para o campo. Melhor o erro honesto que uma tela vazia
        // sem explicação.
        throw e;
      }
    },
  });
}

/**
 * Atualiza a elaboração do documento (etapa do ADM) numa inspeção.
 * "assumir" → EM_ELABORACAO com o nome do ADM; "concluir" → CONCLUIDO + data;
 * "limpar" → volta a PENDENTE.
 */
export function useSalvarElaboracao(idInspecao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      elaboracao_status: "PENDENTE" | "EM_ELABORACAO" | "CONCLUIDO";
      elaboracao_responsavel?: string | null;
      elaboracao_concluida_em?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      // RPC SECURITY DEFINER: altera só os 3 campos de elaboração e libera
      // Visualizadores (que não têm pode_editar). Evita abrir o UPDATE da inspeção.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_elaboracao_documento", {
        p_id_inspecao: idInspecao,
        p_status: patch.elaboracao_status,
        p_responsavel: patch.elaboracao_responsavel ?? null,
        p_concluida_em: patch.elaboracao_concluida_em ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      qc.invalidateQueries({ queryKey: ["dashboard-documentos-adm"] });
    },
  });
}

export function useInspecoesByEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["inspecoes", idEmpresa],
    enabled: !!idEmpresa,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*, empresas(nome_empresa)")
        .eq("id_empresa", idEmpresa!)
        // Excluída (lixeira) não é inspeção da empresa: a ficha contava e a
        // lista não (07/10). A Lixeira tem consulta própria.
        .neq("status", "DELETADA")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });
}

export function useInspecoesByTecnico(tecnico: string) {
  const termo = tecnico.trim();
  return useQuery({
    queryKey: ["inspecoes-tecnico", termo],
    enabled: termo.length >= 2,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*, empresas(nome_empresa)")
        .ilike("responsavel", `%${termo}%`)
        .neq("status", "DELETADA")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });
}

// ─── Paginação server-side para a listagem principal ────────────────────────

export type { FiltroInspecao, ContagensInspecoes } from "@/lib/inspecoes/pilulas";
export type OrdemInspecao = import("@/lib/inspecoes/filtros-url").OrdemLista;

interface InspecoesPaginadasParams {
  idEmpresa: string | null;
  tecnico: string;
  /** Nome (ou pedaço) de quem está associado à elaboração ou é o responsável. */
  associado: string;
  idUnidade?: string | null;
  dataIni?: string;
  dataFim?: string;
  /** Pílulas marcadas (vazio = Todos). Ver lib/inspecoes/pilulas. */
  filtros: FiltroInspecao[];
  ordem: OrdemInspecao;
  page: number;
  pageSize: number;
  /** v306: busca por ID da inspeção ou nome da empresa. */
  busca?: string;
  /** v306: só estas inspeções ("Só as minhas"); null = sem restrição. */
  ids?: string[] | null;
  /** v306: situação do documento (coluna calculada situacao_documento). */
  documento?: string[];
  /** v306: prioridade efetiva (coluna calculada prioridade_efetiva). */
  prioridade?: string[];
  /** v306: espera mínima em dias (coluna calculada dias_espera). */
  esperaMin?: number;
  /** v308: complexidade marcada. */
  complexidade?: string[];
}

type LinhaContagemV306 = LinhaContagem & { situacao_documento: string | null; prioridade_efetiva: string | null; complexidade: string | null };

/** Colunas calculadas da v306 que a lista pede pelo nome. */
export const COLUNAS_PRIORIDADE = "situacao_documento, atribuido_em, dias_espera, prioridade_auto, prioridade_efetiva";

/** Ids das empresas cujo nome casa com a busca (para "buscar por empresa" sem join). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function idsEmpresaPorNome(supabase: any, termo: string): Promise<string[]> {
  const { data } = await supabase.from("empresas").select("id_empresa").ilike("nome_empresa", `%${termo}%`).limit(300);
  return ((data ?? []) as { id_empresa: string }[]).map((e) => e.id_empresa);
}

/**
 * Filtros da v306 (busca, "só as minhas", documento, prioridade, espera) — síncronos sobre o
 * builder; o que precisa de pré-busca (ids de empresa) chega pronto.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltrosV306(q: any, p: { busca?: string; idsEmpresa?: string[] | null; ids?: string[] | null; documento?: string[]; prioridade?: string[]; esperaMin?: number; complexidade?: string[] }) {
  let query = q;
  const termo = (p.busca ?? "").trim().replace(/[(),*%]/g, " ").trim();
  if (termo) {
    const partes = [`id_inspecao.ilike.*${termo}*`];
    if (p.idsEmpresa?.length) partes.push(`id_empresa.in.(${p.idsEmpresa.join(",")})`);
    query = query.or(partes.join(","));
  }
  if (p.ids) query = p.ids.length ? query.in("id_inspecao", p.ids) : query.eq("id_inspecao", "__nenhuma__");
  if (p.documento?.length) query = query.in("situacao_documento", p.documento);
  if (p.prioridade?.length) query = query.in("prioridade_efetiva", p.prioridade);
  if (p.esperaMin && p.esperaMin > 0) query = query.gte("dias_espera", p.esperaMin);
  if (p.complexidade?.length) query = query.in("complexidade", p.complexidade);
  return query;
}

// Filtro por associado à elaboração (cross-table). Separado em dois passos:
// idsPorAssociado (ASYNC, pré-busca) NÃO pode devolver o query-builder — uma função
// async que retorna um thenable (o builder) o executa cedo. Por isso retorna só os ids
// (ou null = sem filtro), e aplicarFiltroAssociado (SÍNCRONO) devolve o builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function idsPorAssociado(supabase: any, associado: string): Promise<string[] | null> {
  const term = associado.trim();
  if (term.length < 2) return null;
  const { data } = await supabase
    .from("inspecao_associados")
    .select("id_inspecao")
    .ilike("nome", `%${term}%`);
  return [...new Set(((data ?? []) as { id_inspecao: string }[]).map((r) => r.id_inspecao))];
}

// Aplica o filtro: casa quem está em inspecao_associados OU quem assumiu a elaboração
// (elaboracao_responsavel). `ids === null` → sem filtro. Síncrono → devolve o builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltroAssociado(q: any, associado: string, ids: string[] | null) {
  if (ids === null) return q;
  const t = associado.trim().replace(/[(),*]/g, " ");
  if (ids.length > 0) {
    return q.or(`id_inspecao.in.(${ids.join(",")}),elaboracao_responsavel.ilike.*${t}*`);
  }
  return q.ilike("elaboracao_responsavel", `%${t}%`);
}

/** Minúsculo e sem acento — o mesmo formato da `tecnicos_busca` (v284). */
function termoSemAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

interface FiltrosBase {
  idEmpresa: string | null;
  tecnico: string;
  idUnidade?: string | null;
  dataIni?: string;
  dataFim?: string;
}

// Aplica os filtros comuns (empresa, técnico, unidade, período) a uma query de inspeções.
// `select` muda quando há filtro por unidade (inner join em empresas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(q: any, { idEmpresa, tecnico, idUnidade, dataIni, dataFim }: FiltrosBase) {
  let query = q.neq("status", "DELETADA");
  if (idEmpresa) query = query.eq("id_empresa", idEmpresa);
  // Era `else if`: com empresa escolhida, o Técnico digitado sumia sem aviso (07/10).
  //
  // Procura QUEM FOI A CAMPO (aba Responsáveis) e, só quando ninguém está lá,
  // quem lançou — a regra do dashboard, pela coluna calculada `tecnicos_busca`
  // (v284), que já vem minúscula e sem acento. Antes era `responsavel`
  // (quem lançou) e "Ledimo" não achava "Lédimo".
  const termo = termoSemAcento(tecnico);
  if (termo.length >= 2) query = query.ilike("tecnicos_busca", `%${termo}%`);
  if (idUnidade) query = query.eq("empresas.id_unidade", idUnidade);
  // Concluída cai no período pela data de CONCLUSÃO; as demais pela data da
  // visita (07/10) — a mesma régua do dashboard. Ver lib/inspecoes/periodo.
  const periodo = filtroPeriodo(dataIni, dataFim);
  if (periodo) query = query.or(periodo);
  return query;
}

export function useInspecoesPaginadas({
  idEmpresa,
  tecnico,
  associado,
  idUnidade,
  dataIni,
  dataFim,
  filtros,
  ordem,
  page,
  pageSize,
  busca = "",
  ids = null,
  documento = [],
  prioridade = [],
  esperaMin = 0,
  complexidade = [],
}: InspecoesPaginadasParams) {
  // Lista todas as inspeções por padrão (paginadas); filtros são opcionais.
  const base: FiltrosBase = { idEmpresa, tecnico, idUnidade, dataIni, dataFim };
  // Quando filtra por unidade, precisa de inner join em empresas para o eq funcionar.
  // `tecnicos_campo` e as da v306 são colunas calculadas: o `*` não as traz sozinho.
  const selLista = idUnidade
    ? `*, tecnicos_campo, ${COLUNAS_PRIORIDADE}, empresas!inner(nome_empresa, id_unidade)`
    : `*, tecnicos_campo, ${COLUNAS_PRIORIDADE}, empresas(nome_empresa)`;
  const v306 = { busca, ids, documento, prioridade, esperaMin, complexidade };

  const lista = useQuery({
    queryKey: ["inspecoes-lista", idEmpresa, tecnico, associado, idUnidade, dataIni, dataFim, filtros, ordem, page, pageSize, v306],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const idsAssoc = await idsPorAssociado(supabase, associado);
      const idsEmpresa = busca.trim().length >= 2 ? await idsEmpresaPorNome(supabase, busca.trim()) : null;
      let q = aplicarFiltros(supabase.from("inspecoes").select(selLista, { count: "exact" }), base);
      q = aplicarFiltroAssociado(q, associado, idsAssoc);
      q = aplicarFiltrosV306(q, { ...v306, idsEmpresa });
      // Pílulas marcadas: status somam entre si (in), associação pela coluna
      // calculada do banco (v239) — há alguém no documento, linha em
      // inspecao_associados ou elaboracao_responsavel. Os dois grupos se cruzam.
      const sel = separarSelecao(filtros);
      if (sel.status.length > 0) q = q.in("status", sel.status);
      if (sel.associacao.length === 1) q = q.is("tem_associado", sel.associacao[0] === "ASSOCIADOS");
      if (ordem === "recentes") q = q.order("created_at", { ascending: false });
      else if (ordem === "antigas") q = q.order("created_at", { ascending: true });
      // v306: pelas colunas calculadas — mais urgente / esperando há mais tempo / prazo mais perto
      else if (ordem === "prioridade") q = q.order("prioridade_ord", { ascending: false }).order("dias_espera", { ascending: false, nullsFirst: false });
      else if (ordem === "espera") q = q.order("dias_espera", { ascending: false, nullsFirst: false }).order("created_at", { ascending: true });
      else if (ordem === "prazo") q = q.order("prazo", { ascending: true, nullsFirst: false }).order("prioridade_ord", { ascending: false });
      else q = q.order("revisao", { ascending: false }).order("created_at", { ascending: false });
      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: (data ?? []) as unknown as Inspecao[], total: count ?? 0 };
    },
  });

  // Linhas para as pílulas: só status e quem está no documento, com os filtros
  // de base (empresa/técnico/unidade/período). A pílula ativa e a caixa de
  // associado ficam de fora de propósito — a conta é em memória
  // (contarPilulas), para trocar de pílula ou digitar não ir ao banco de novo.
  // v306: as contagens também levam a situação do documento e a prioridade (colunas
  // calculadas) — contadas em memória sobre os mesmos filtros de base + busca e "só as minhas".
  const selCounts = idUnidade
    ? "status, elaboracao_responsavel, situacao_documento, prioridade_efetiva, complexidade, inspecao_associados(nome), empresas!inner(id_unidade)"
    : "status, elaboracao_responsavel, situacao_documento, prioridade_efetiva, complexidade, inspecao_associados(nome)";
  const baseV306 = { busca, ids };
  const linhas = useQuery({
    queryKey: ["inspecoes-counts", idEmpresa, tecnico, idUnidade, dataIni, dataFim, baseV306],
    staleTime: 30_000,
    queryFn: async (): Promise<LinhaContagemV306[]> => {
      const supabase = createSupabaseBrowserClient();
      const idsEmpresa = busca.trim().length >= 2 ? await idsEmpresaPorNome(supabase, busca.trim()) : null;
      // Paginado: sem isso o PostgREST para em 1000 linhas e "Todos (N)" fica
      // menor que o total da própria lista (07/10).
      return fetchAllRows<LinhaContagemV306>((de, ate) =>
        aplicarFiltrosV306(aplicarFiltros(supabase.from("inspecoes").select(selCounts), base), { ...baseV306, idsEmpresa })
          .order("id_inspecao")
          .range(de, ate),
      );
    },
  });

  const contagens = useMemo(
    () => (linhas.data ? contarPilulas(linhas.data, associado, separarSelecao(filtros)) : undefined),
    [linhas.data, associado, filtros],
  );
  // Documento, prioridade e complexidade: quantas há de cada (sobre os filtros de base, sem as pílulas).
  const extras = useMemo(() => {
    if (!linhas.data) return undefined;
    const doc: Record<string, number> = {};
    const pri: Record<string, number> = {};
    const cpx: Record<string, number> = {};
    for (const l of linhas.data) {
      if (l.situacao_documento) doc[l.situacao_documento] = (doc[l.situacao_documento] ?? 0) + 1;
      if (l.prioridade_efetiva) pri[l.prioridade_efetiva] = (pri[l.prioridade_efetiva] ?? 0) + 1;
      if (l.complexidade) cpx[l.complexidade] = (cpx[l.complexidade] ?? 0) + 1;
    }
    return { documento: doc, prioridade: pri, complexidade: cpx };
  }, [linhas.data]);

  return { lista, counts: { data: contagens, extras } };
}
