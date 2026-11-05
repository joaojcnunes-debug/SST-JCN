"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que devolve as AEPs entregues ao cliente, a última inspeção concluída (v268)
// e a situação dos documentos de cada empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.
// Desde a v321 também traz os atendimentos, as decisões e as intervenções de
// Consolidação › Liberar para o Comercial, que lê daqui e grava pelas funções do banco.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { normalizarRelatorio } from "@/lib/hooks/useAep";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { perfilEscreveNaRls } from "@/lib/acesso/linha-por-unidade";
import { useUserStore } from "@/lib/store";
import {
  montarComercial,
  type CertificadoEmpresa,
  type DocEmpresa,
  type EmpresaComercial,
  type InspecaoComercial,
  type Produto,
} from "@/lib/comercial/oportunidades";
import {
  montarFila,
  visaoDoVendedor,
  type AtendimentoComercial,
  type DecisaoServico,
  type IntervencaoIndicada,
  type StatusDecisao,
} from "@/lib/comercial/liberacao";

const CHAVE = "comercial-dados";

// As tabelas da v321 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createSupabaseBrowserClient() as any;

interface DadosComercial {
  lista: EmpresaComercial[];
  decisoes: DecisaoServico[];
  corte: string | null;
  atendimentos: AtendimentoComercial[];
  indicadas: IntervencaoIndicada[];
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
        liberacoes?: DecisaoServico[];
        atendimentos?: AtendimentoComercial[];
        intervencoes?: IntervencaoIndicada[];
        corte?: string | null;
      };
      const aeps = (r.aeps ?? []).map((a) => {
        const x = a as { entregue_em?: string | null; enviado_por?: string | null };
        // normalizarRelatorio mantém os demais campos (inclusive liberado_comercial_*).
        return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
      });
      return {
        lista: montarComercial(aeps, r.docs ?? [], r.inspecoes ?? [], r.certificados ?? []),
        decisoes: r.liberacoes ?? [],
        corte: r.corte ?? null,
        atendimentos: r.atendimentos ?? [],
        indicadas: r.intervencoes ?? [],
      };
    },
    select,
  });
}

/** O que o vendedor vê: só os serviços liberados (e os de antes da fila). */
export function useComercial() {
  return useDadosComercial<EmpresaComercial[]>((d) => visaoDoVendedor(d.lista, d.decisoes, d.corte, d.atendimentos, d.indicadas));
}

/** Tudo o que a liberação precisa: a fila com o estado de cada serviço e os atendimentos. */
export function useLiberacaoServicos() {
  return useDadosComercial((d) => ({
    fila: montarFila(d.lista, d.decisoes, d.corte),
    atendimentos: d.atendimentos,
    indicadas: d.indicadas,
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

function useGravar<V>(rpc: string, params: (v: V) => object, sucesso: (v: V) => string, falha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await sb().rpc(rpc, params(v));
      if (error) throw error;
    },
    onSuccess: (_: unknown, v: V) => {
      // Concluir e reabrir mudam também as sessões e o histórico.
      for (const k of [CHAVE, "documento-sessoes", "comercial-eventos"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success(sucesso(v));
    },
    onError: (e: Error) => toast.error(mensagemErro(e, falha)),
  });
}

export interface NovaDecisao {
  idEmpresa: string;
  produtos: Produto[];
  status: StatusDecisao;
  modalidades?: string[];
  orientacao?: string | null;
  motivo?: string | null;
}

export function useDecidirServico() {
  return useGravar<NovaDecisao>(
    "comercial_decidir",
    (d) => ({
      p_id_empresa: d.idEmpresa,
      p_produtos: d.produtos,
      p_status: d.status,
      p_modalidades: d.modalidades ?? [],
      p_orientacao: d.orientacao ?? null,
      p_motivo: d.motivo ?? null,
    }),
    (d) => {
      const verbo = d.status === "LIBERADO" ? "liberado" : "segurado";
      return d.produtos.length === 1 ? `Serviço ${verbo}` : `${d.produtos.length} serviços ${verbo}s`;
    },
    "Falha ao gravar a decisão",
  );
}

export function useDesfazerDecisao() {
  return useGravar<{ idEmpresa: string; produto: Produto }>(
    "comercial_desfazer_decisao",
    (d) => ({ p_id_empresa: d.idEmpresa, p_produto: d.produto }),
    () => "Decisão desfeita",
    "Falha ao desfazer a decisão",
  );
}

export function useIndicarIntervencao() {
  return useGravar<{ idEmpresa: string; idIntervencao: string; modalidades: string[]; orientacao: string | null }>(
    "comercial_intervencao_indicar",
    (d) => ({ p_id_empresa: d.idEmpresa, p_id_intervencao: d.idIntervencao, p_modalidades: d.modalidades, p_orientacao: d.orientacao }),
    () => "Intervenção indicada",
    "Falha ao indicar a intervenção",
  );
}

export function useRetirarIntervencao() {
  return useGravar<{ idEmpresa: string; idIntervencao: string }>(
    "comercial_intervencao_retirar",
    (d) => ({ p_id_empresa: d.idEmpresa, p_id_intervencao: d.idIntervencao }),
    () => "Intervenção retirada",
    "Falha ao retirar a intervenção",
  );
}

export function useSalvarParecerComercial() {
  return useGravar<{ idEmpresa: string; parecer: string }>(
    "comercial_salvar_parecer",
    (d) => ({ p_id_empresa: d.idEmpresa, p_parecer: d.parecer }),
    () => "Parecer salvo",
    "Falha ao salvar o parecer",
  );
}

export function useConcluirAtendimento() {
  return useGravar<{ idEmpresa: string; parecer: string }>(
    "comercial_concluir",
    (d) => ({ p_id_empresa: d.idEmpresa, p_parecer: d.parecer }),
    () => "Atendimento concluído",
    "Falha ao concluir",
  );
}

export function useReabrirAtendimento() {
  return useGravar<{ idEmpresa: string; motivo: string }>(
    "comercial_reabrir",
    (d) => ({ p_id_empresa: d.idEmpresa, p_motivo: d.motivo }),
    () => "Atendimento reaberto",
    "Falha ao reabrir",
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

export function useEventosAtendimento(idEmpresa: string) {
  return useQuery({
    queryKey: ["comercial-eventos", idEmpresa],
    enabled: !!idEmpresa,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("comercial_atendimento_eventos")
        .select("id_evento, tipo, motivo, parecer, por, em")
        .eq("id_empresa", idEmpresa)
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
  responsavel: string | null;
  ativo: boolean;
  ordem: number;
}

const CHAVE_CATALOGO = "comercial-intervencoes";

export function useCatalogoIntervencoes() {
  return useQuery({
    queryKey: [CHAVE_CATALOGO],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("comercial_intervencoes")
        .select("id_intervencao, nome, modalidades, observacao, responsavel, ativo, ordem")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as IntervencaoCatalogo[];
    },
  });
}

export function useSalvarIntervencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Omit<IntervencaoCatalogo, "id_intervencao"> & { id_intervencao?: string }) => {
      const { id_intervencao, ...campos } = f;
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
