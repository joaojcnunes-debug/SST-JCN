"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que devolve as AEPs entregues ao cliente, a última inspeção concluída (v268)
// e a situação dos documentos de cada empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.
// Desde a v321/v322 também traz as conciliações fechadas, os atendimentos e as intervenções de
// Consolidação › Liberar para o Comercial, que lê daqui e grava pelas funções do banco.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AlvoConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { mensagemErro } from "@/lib/errors";
import { normalizarRelatorio } from "@/lib/hooks/useAep";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { perfilEscreveNaRls } from "@/lib/acesso/linha-por-unidade";
import { useUserStore } from "@/lib/store";
import { anexarPlanos, type MetodoModalidade, type MetodoTexto, type PlanoIntervencoes } from "@/lib/comercial/plano";
import {
  montarComercial,
  type CertificadoEmpresa,
  type DocEmpresa,
  type EmpresaComercial,
  type InspecaoComercial,
} from "@/lib/comercial/oportunidades";
import {
  aplicarGrupos,
  type AtendimentoGrupo,
  aplicarVendas,
  visaoDoVendedor,
  type AtendimentoComercial,
  type ColunaTopico,
  type ConciliacaoFechada,
  type TopicoIntervencao,
  type IntervencaoIndicada,
  type VendaRegistrada,
} from "@/lib/comercial/liberacao";

const CHAVE = "comercial-dados";

// As tabelas da v321 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createSupabaseBrowserClient() as any;

interface DadosComercial {
  lista: EmpresaComercial[];
  conciliacoes: ConciliacaoFechada[];
  atendimentos: AtendimentoComercial[];
  indicadas: IntervencaoIndicada[];
  vendas: VendaRegistrada[];
  /** v356: atendimentos da Conciliação por grupo (o vendedor só recebe os liberados). */
  grupos: AtendimentoGrupo[];
  /** v372: o Plano de intervenções de cada empresa/grupo e o texto dos métodos, para o vendedor. */
  planos: PlanoIntervencoes[];
  metodos: MetodoModalidade[];
  /** v373: o texto do método de cada intervenção do catálogo. */
  metodosIntervencao: Record<string, Record<string, Partial<MetodoTexto>>>;
}

function useDadosComercial<T>(select: (d: DadosComercial) => T) {
  return useQuery({
    queryKey: [CHAVE],
    queryFn: async (): Promise<DadosComercial> => {
      const { data, error } = await createSupabaseBrowserClient().rpc("comercial_dados" as never);
      if (error) throw error;
      const r = (data ?? {}) as {
        aeps?: unknown[];
        docs?: DocEmpresa[];
        inspecoes?: InspecaoComercial[];
        certificados?: CertificadoEmpresa[];
        conciliacoes?: ConciliacaoFechada[];
        atendimentos?: AtendimentoComercial[];
        intervencoes?: IntervencaoIndicada[];
        vendas?: VendaRegistrada[];
        grupos?: AtendimentoGrupo[];
        planos?: PlanoIntervencoes[];
        metodos?: MetodoModalidade[];
        metodos_intervencao?: Record<string, Record<string, Partial<MetodoTexto>>>;
      };
      const aeps = (r.aeps ?? []).map((a) => {
        const x = a as { entregue_em?: string | null; enviado_por?: string | null };
        // normalizarRelatorio mantém os demais campos (inclusive liberado_comercial_*).
        return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
      });
      return {
        lista: montarComercial(aeps, r.docs ?? [], r.inspecoes ?? [], r.certificados ?? []),
        conciliacoes: r.conciliacoes ?? [],
        atendimentos: r.atendimentos ?? [],
        indicadas: r.intervencoes ?? [],
        vendas: r.vendas ?? [],
        grupos: r.grupos ?? [],
        planos: r.planos ?? [],
        metodos: r.metodos ?? [],
        metodosIntervencao: r.metodos_intervencao ?? {},
      };
    },
    select,
  });
}

/** O atendimento, as intervenções e as conciliações que valem para o vendedor: o grupo liberado substitui a empresa (v356). */
function efetivos(d: DadosComercial) {
  return aplicarGrupos(d.atendimentos, d.indicadas, d.conciliacoes, d.grupos);
}

/** O que o vendedor vê: inspeção e AEP liberadas, mais o que saiu de atendimento concluído (da empresa ou do grupo). */
export function useComercial() {
  return useDadosComercial<EmpresaComercial[]>((d) => {
    const e = efetivos(d);
    // 0.3.328: o método de cada intervenção e o Plano de intervenções vão junto para o vendedor.
    return anexarPlanos(aplicarVendas(visaoDoVendedor(d.lista, e.atendimentos, e.indicadas, e.conciliacoes), d.vendas), e.indicadas, d.planos, d.metodos, d.grupos, d.metodosIntervencao);
  });
}

/** O que foi vendido, para Consolidação › Vendas (0.3.245): o mesmo que o vendedor via na oportunidade. */
export interface DetalheVenda {
  /** Os itens que justificaram a oportunidade (setores, máquinas, agentes, treinamentos…). */
  detalhes: string[];
  origens: string[];
  setoresAet: { nome: string; expostos: number }[];
  /** Intervenções psicossociais: as linhas da etapa Intervenções da Conciliação. */
  intervencoes: IntervencaoIndicada[];
  /** Parecer da equipe no atendimento concluído. */
  parecer: string | null;
}

export type VendaComDetalhe = VendaRegistrada & { detalhe: DetalheVenda | null };

/**
 * Consolidação › Vendas: a mais recente primeiro, cada uma com o que foi vendido. O detalhe é o de agora:
 * sem a oportunidade (por exemplo, atendimento reaberto), vem null e a tela avisa.
 */
export function useVendasComercial() {
  return useDadosComercial<VendaComDetalhe[]>((d) => {
    const e = efetivos(d);
    const visao = new Map(visaoDoVendedor(d.lista, e.atendimentos, e.indicadas, e.conciliacoes).map((c) => [c.empresa.idEmpresa, c]));
    return [...d.vendas]
      .sort((a, b) => b.vendido_em.localeCompare(a.vendido_em))
      .map((v) => {
        const emp = visao.get(v.id_empresa);
        const op = emp?.oportunidades.find((o) => o.produto === v.produto);
        const psico = v.produto === "Intervenção psicossocial";
        // 0.3.247: venda de uma intervenção só mostra essa intervenção.
        const intervencoes = psico
          ? // Venda é histórico: a intervenção vendida é procurada nas da empresa E nas do grupo, mesmo quando o grupo
            // substitui a empresa no Comercial (0.3.290) — senão a venda antiga da empresa perdia o detalhe.
            [...d.indicadas, ...e.indicadas.filter((i) => i.id_item.startsWith("CGI-"))].filter(
              (i) => i.id_empresa === v.id_empresa && (!v.id_item || i.id_item === v.id_item),
            )
          : [];
        if (v.id_item && intervencoes.length === 0) return { ...v, detalhe: null };
        // Intervenção vendida que ainda existe: tem detalhe mesmo sem a oportunidade na tela (o grupo pode ter substituído).
        if (!op && !(psico && v.id_item)) return { ...v, detalhe: null };
        return {
          ...v,
          detalhe: {
            detalhes: op?.detalhes ?? [],
            origens: op?.origens ?? ["Conciliação"],
            setoresAet: (op?.setores ?? []).map((s) => ({ nome: s.nome, expostos: s.expostos })),
            intervencoes,
            // Intervenção da liberação própria da empresa (não do grupo): o parecer é o dela.
            parecer: psico
              ? ((v.id_item && !v.id_item.startsWith("CGI-") ? d.atendimentos.find((a) => a.id_empresa === v.id_empresa)?.parecer : null) ??
                emp?.parecerEquipe ??
                null)
              : null,
          },
        };
      });
  });
}

/** idItem: venda de uma intervenção psicossocial só (v329); sem ele, o serviço inteiro. */
export function useRegistrarVenda() {
  return useGravar<{ idEmpresa: string; produto: string; observacao: string | null; idItem?: string }>(
    "comercial_venda_registrar",
    (d) => ({ p_id_empresa: d.idEmpresa, p_produto: d.produto, p_observacao: d.observacao, p_id_item: d.idItem ?? null }),
    () => "Venda registrada",
    "Falha ao registrar a venda",
  );
}

export function useDesfazerVenda() {
  return useGravar<{ idEmpresa: string; produto: string; idItem?: string }>(
    "comercial_venda_desfazer",
    (d) => ({ p_id_empresa: d.idEmpresa, p_produto: d.produto, p_id_item: d.idItem ?? null }),
    () => "Venda desfeita",
    "Falha ao desfazer a venda",
  );
}

/** Tudo o que a liberação precisa: conciliações fechadas, atendimentos e intervenções (da empresa e dos grupos). */
export function useLiberacaoServicos() {
  return useDadosComercial((d) => ({
    conciliacoes: d.conciliacoes,
    atendimentos: d.atendimentos,
    indicadas: d.indicadas,
    grupos: d.grupos,
  }));
}

/**
 * Quem libera: Admin, ou Técnico que edita, com o módulo Consolidação (a rota já exige o módulo).
 * A `comercial_pode_liberar()` do banco olha o perfil; o `pode_editar` da conta sozinho não basta.
 */
export function usePodeLiberarServicos(): boolean {
  const podeEditar = useCanEdit();
  const user = useUserStore((s) => s.user);
  return podeEditar && perfilEscreveNaRls(user?.perfil);
}

function useGravar<V>(rpc: string | ((v: V) => string), params: (v: V) => object, sucesso: ((v: V) => string) | null, falha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await sb().rpc(typeof rpc === "function" ? rpc(v) : rpc, params(v));
      if (error) throw error;
    },
    onSuccess: (_: unknown, v: V) => {
      // Concluir e reabrir mudam também as sessões e o histórico.
      for (const k of [CHAVE, "documento-sessoes", "comercial-eventos"]) qc.invalidateQueries({ queryKey: [k] });
      if (sucesso) toast.success(sucesso(v));
    },
    onError: (e: Error) => toast.error(mensagemErro(e, falha)),
  });
}

/**
 * De quem é o atendimento (v0.3.290): a empresa (comercial_*) ou o grupo (comercial_grupo_*, banco v356). As funções do
 * grupo têm os mesmos parâmetros, com p_id_grupo no lugar de p_id_empresa.
 */
const rpcDe = (alvo: AlvoConciliacao, empresa: string, grupo: string) => (alvo.tipo === "grupo" ? grupo : empresa);
const chaveDe = (alvo: AlvoConciliacao) => (alvo.tipo === "grupo" ? { p_id_grupo: alvo.id } : { p_id_empresa: alvo.id });

export interface LinhaIntervencao {
  idItem: string | null;
  alvo: AlvoConciliacao;
  /** Só no grupo: as empresas do setor (o vendedor vê a intervenção nelas). */
  empresas?: string[];
  setorChave: string;
  setorNome: string;
  idFator: string;
  fatorNome: string;
  idIntervencao: string | null;
  nome: string;
  modalidade: string | null;
  responsavel: string | null;
  prazoDias: number | null;
}

/** Grava uma linha da tabela a cada campo alterado, sem aviso: a linha já mostra o que foi salvo. */
export function useSalvarIntervencaoIndicada() {
  return useGravar<LinhaIntervencao>(
    (d) => rpcDe(d.alvo, "comercial_intervencao_salvar", "comercial_grupo_intervencao_salvar"),
    (d) => ({
      p_id_item: d.idItem,
      ...chaveDe(d.alvo),
      ...(d.alvo.tipo === "grupo" ? { p_empresas: d.empresas ?? [] } : {}),
      p_setor_chave: d.setorChave,
      p_setor_nome: d.setorNome,
      p_id_fator: d.idFator,
      p_fator_nome: d.fatorNome,
      p_id_intervencao: d.idIntervencao,
      p_nome: d.nome,
      p_modalidade: d.modalidade,
      p_responsavel: d.responsavel,
      p_prazo_dias: d.prazoDias,
    }),
    null,
    "Falha ao salvar a intervenção",
  );
}

export function useRetirarIntervencao() {
  return useGravar<{ alvo: AlvoConciliacao; idItem: string }>(
    (d) => rpcDe(d.alvo, "comercial_intervencao_retirar", "comercial_grupo_intervencao_retirar"),
    (d) => ({ ...chaveDe(d.alvo), p_id_item: d.idItem }),
    () => "Intervenção retirada",
    "Falha ao retirar a intervenção",
  );
}

export function useSalvarParecerComercial() {
  return useGravar<{ alvo: AlvoConciliacao; parecer: string }>(
    (d) => rpcDe(d.alvo, "comercial_salvar_parecer", "comercial_grupo_salvar_parecer"),
    (d) => ({ ...chaveDe(d.alvo), p_parecer: d.parecer }),
    () => "Parecer salvo",
    "Falha ao salvar o parecer",
  );
}

export function useConcluirAtendimento() {
  return useGravar<{ alvo: AlvoConciliacao; parecer: string }>(
    (d) => rpcDe(d.alvo, "comercial_concluir", "comercial_grupo_concluir"),
    (d) => ({ ...chaveDe(d.alvo), p_parecer: d.parecer }),
    () => "Liberado para o Comercial",
    "Falha ao liberar",
  );
}

export function useReabrirAtendimento() {
  return useGravar<{ alvo: AlvoConciliacao; motivo: string }>(
    (d) => rpcDe(d.alvo, "comercial_reabrir", "comercial_grupo_reabrir"),
    (d) => ({ ...chaveDe(d.alvo), p_motivo: d.motivo }),
    () => "Retirado do Comercial",
    "Falha ao retirar",
  );
}

export interface EventoAtendimento {
  id_evento: number;
  tipo: "CONCLUIDO" | "REABERTO";
  motivo: string | null;
  parecer: string | null;
  por: string | null;
  em: string;
}

export function useEventosAtendimento(alvo: AlvoConciliacao) {
  return useQuery({
    queryKey: ["comercial-eventos", alvo.tipo, alvo.id],
    enabled: !!alvo.id,
    queryFn: async () => {
      const grupo = alvo.tipo === "grupo";
      const { data, error } = await sb()
        .from(grupo ? "comercial_atendimento_grupo_eventos" : "comercial_atendimento_eventos")
        .select("id_evento, tipo, motivo, parecer, por, em")
        .eq(grupo ? "id_grupo" : "id_empresa", alvo.id)
        .order("em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventoAtendimento[];
    },
  });
}

// ─── Catálogo de intervenções ──────────────────────────────────────────────

export interface IntervencaoCatalogo {
  id_intervencao: string;
  nome: string;
  modalidades: string[];
  observacao: string | null;
  /** O primeiro é o que a intervenção traz ao ser escolhida (v327). */
  responsaveis: string[];
  ativo: boolean;
  ordem: number;
  /** 0.3.330 (v373): o texto do método da intervenção, por modalidade (só os campos próprios dela). */
  metodos?: Record<string, Partial<MetodoTexto>>;
}

const CHAVE_CATALOGO = "comercial-intervencoes";

export function useCatalogoIntervencoes() {
  return useQuery({
    queryKey: [CHAVE_CATALOGO],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("comercial_intervencoes")
        .select("id_intervencao, nome, modalidades, observacao, responsaveis, ativo, ordem, metodos")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as IntervencaoCatalogo[];
    },
  });
}

/** Tópicos inseridos pelo título das colunas Modalidades e Responsável (0.3.242, banco v328). */
export function useTopicosIntervencao() {
  return useQuery({
    // Debaixo da chave do catálogo: o que invalida o catálogo também relê os tópicos.
    queryKey: [CHAVE_CATALOGO, "topicos"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("comercial_intervencao_topicos")
        .select("id_topico, coluna, valor")
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as TopicoIntervencao[];
    },
  });
}

export function useInserirTopico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { coluna: ColunaTopico; valor: string }) => {
      const { error } = await sb().from("comercial_intervencao_topicos").insert(t);
      if (error) throw error;
    },
    onSuccess: async (_d, t) => {
      toast.success(`${t.valor} entrou na lista`);
      await qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
    },
    onError: (e: Error & { code?: string }) =>
      toast.error(e.code === "23505" ? "Esse tópico já está na lista." : mensagemErro(e, "Falha ao inserir o tópico")),
  });
}

export function useExcluirTopico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: TopicoIntervencao) => {
      const { error } = await sb().from("comercial_intervencao_topicos").delete().eq("id_topico", t.id_topico);
      if (error) throw error;
    },
    onSuccess: async (_d, t) => {
      toast.success(`${t.valor} saiu da lista`);
      await qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir o tópico")),
  });
}

export function useSalvarIntervencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Omit<IntervencaoCatalogo, "id_intervencao"> & { id_intervencao?: string }) => {
      const { id_intervencao, ...resto } = f;
      const campos = camposCatalogo(resto);
      const q = id_intervencao
        ? sb().from("comercial_intervencoes").update(campos).eq("id_intervencao", id_intervencao)
        : sb().from("comercial_intervencoes").insert(campos);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
      toast.success("Intervenção salva");
    },
    onError: (e: Error & { code?: string }) =>
      toast.error(e.code === "23505" ? "Já existe uma intervenção com este nome." : mensagemErro(e, "Falha ao salvar a intervenção")),
  });
}

/** A coluna antiga `responsavel` acompanha o primeiro da lista, até sair do banco. */
function camposCatalogo<T extends { responsaveis: string[] }>(f: T) {
  return { ...f, responsavel: f.responsaveis[0] ?? null };
}

/** Intervenção digitada na etapa da Conciliação: entra no catálogo e já volta com o id. */
export function useCriarIntervencaoNoCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { nome: string; modalidades: string[]; responsaveis: string[]; ordem: number }) => {
      const { data, error } = await sb()
        .from("comercial_intervencoes")
        .insert(camposCatalogo({ ...f, ativo: true, observacao: null }))
        .select("id_intervencao, nome, modalidades, observacao, responsaveis, ativo, ordem")
        .single();
      if (error) throw error;
      return data as IntervencaoCatalogo;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
      toast.success(`${c.nome} entrou no catálogo de Intervenções`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao registrar no catálogo")),
  });
}

/** Modalidade ou responsável digitado na etapa da Conciliação: entra na lista da intervenção. */
export function useAtualizarListasDoCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { idIntervencao: string; modalidades: string[]; responsaveis: string[] }) => {
      const { error } = await sb()
        .from("comercial_intervencoes")
        .update(camposCatalogo({ modalidades: f.modalidades, responsaveis: f.responsaveis }))
        .eq("id_intervencao", f.idIntervencao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
      toast.success("Registrado no catálogo de Intervenções");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao registrar no catálogo")),
  });
}

/**
 * Edição na própria linha da página Intervenções (0.3.241): grava só o campo mexido, para não
 * sobrescrever com dado velho o que outro campo da mesma linha acabou de gravar.
 */
export function useAtualizarIntervencaoNaLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      idIntervencao,
      campos,
    }: {
      idIntervencao: string;
      campos: Partial<Pick<IntervencaoCatalogo, "nome" | "observacao" | "modalidades" | "responsaveis" | "metodos">>;
    }) => {
      const linha = campos.responsaveis ? camposCatalogo({ ...campos, responsaveis: campos.responsaveis }) : campos;
      const { error } = await sb().from("comercial_intervencoes").update(linha).eq("id_intervencao", idIntervencao);
      if (error) throw error;
    },
    // Devolver a promessa faz o mutateAsync esperar o catálogo novo: o próximo clique já parte dele.
    onSuccess: async () => {
      toast.success("Salvo");
      await qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
    },
    onError: (e: Error & { code?: string }) =>
      toast.error(e.code === "23505" ? "Já existe uma intervenção com este nome." : mensagemErro(e, "Falha ao salvar a intervenção")),
  });
}

export function useExcluirIntervencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("comercial_intervencoes").delete().eq("id_intervencao", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO] });
      toast.success("Intervenção excluída");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir a intervenção")),
  });
}

// ── Plano de intervenções (0.3.321, banco v370) ────────────────────────────────────────────────

/** O texto padrão de cada método (EAD, Ao vivo = online, Presencial…), editado no Catálogo de intervenções. */
export function useMetodosModalidade() {
  return useQuery({
    queryKey: ["comercial-metodos"],
    queryFn: async () => {
      const { data, error } = await sb().from("comercial_metodos").select("modalidade, forma, duracao, avaliacao, certificado, ordem").order("ordem").order("modalidade");
      if (error) throw error;
      return (data ?? []) as MetodoModalidade[];
    },
  });
}

export function useSalvarMetodoModalidade() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (m: MetodoModalidade) => {
      const { error } = await sb().from("comercial_metodos").upsert({ ...m, atualizado_em: new Date().toISOString(), atualizado_por: email });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial-metodos"] }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao salvar o método")),
  });
}

export function useExcluirMetodoModalidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modalidade: string) => {
      const { error } = await sb().from("comercial_metodos").delete().eq("modalidade", modalidade);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial-metodos"] }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir o método")),
  });
}

/** O plano da empresa ou do grupo (null = ainda não salvo; a tela usa o padrão). */
export function usePlanoIntervencoes(alvo: AlvoConciliacao) {
  return useQuery({
    queryKey: ["comercial-plano", alvo.tipo, alvo.id],
    queryFn: async () => {
      const { data, error } = await sb().from("comercial_planos").select("id_alvo, tipo_alvo, planejamento, inicio, meses, temas, metodos").eq("id_alvo", alvo.id).maybeSingle();
      if (error) throw error;
      return (data ?? null) as PlanoIntervencoes | null;
    },
  });
}

/** Grava o plano inteiro (cada mudança na tela manda o plano já com ela). */
export function useSalvarPlanoIntervencoes() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: PlanoIntervencoes) => {
      const { error } = await sb().from("comercial_planos").upsert({ ...p, atualizado_em: new Date().toISOString(), atualizado_por: email });
      if (error) throw error;
    },
    onMutate: async (p) => {
      // Otimista: a tela já mostra a mudança (o select não pisca enquanto grava).
      qc.setQueryData(["comercial-plano", p.tipo_alvo, p.id_alvo], p);
    },
    onSettled: (_r, _e, p) => qc.invalidateQueries({ queryKey: ["comercial-plano", p.tipo_alvo, p.id_alvo] }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao salvar o plano")),
  });
}
