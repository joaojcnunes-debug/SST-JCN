"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que devolve as AEPs entregues ao cliente, a última inspeção concluída (v268)
// e a situação dos documentos de cada empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.
// Desde a v321/v322 também traz as conciliações fechadas, os atendimentos e as intervenções de
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
} from "@/lib/comercial/oportunidades";
import {
  aplicarVendas,
  visaoDoVendedor,
  type AtendimentoComercial,
  type ConciliacaoFechada,
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
      };
    },
    select,
  });
}

/** O que o vendedor vê: inspeção e AEP liberadas, mais o que saiu de atendimento concluído. */
export function useComercial() {
  return useDadosComercial<EmpresaComercial[]>((d) =>
    aplicarVendas(visaoDoVendedor(d.lista, d.atendimentos, d.indicadas, d.conciliacoes), d.vendas),
  );
}

/** Consolidação › Vendas: a mais recente primeiro. */
export function useVendasComercial() {
  return useDadosComercial<VendaRegistrada[]>((d) => [...d.vendas].sort((a, b) => b.vendido_em.localeCompare(a.vendido_em)));
}

export function useRegistrarVenda() {
  return useGravar<{ idEmpresa: string; produto: string; observacao: string | null }>(
    "comercial_venda_registrar",
    (d) => ({ p_id_empresa: d.idEmpresa, p_produto: d.produto, p_observacao: d.observacao }),
    () => "Venda registrada",
    "Falha ao registrar a venda",
  );
}

export function useDesfazerVenda() {
  return useGravar<{ idEmpresa: string; produto: string }>(
    "comercial_venda_desfazer",
    (d) => ({ p_id_empresa: d.idEmpresa, p_produto: d.produto }),
    () => "Venda desfeita",
    "Falha ao desfazer a venda",
  );
}

/** Tudo o que a liberação precisa: conciliações fechadas, atendimentos e intervenções. */
export function useLiberacaoServicos() {
  return useDadosComercial((d) => ({
    conciliacoes: d.conciliacoes,
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

function useGravar<V>(rpc: string, params: (v: V) => object, sucesso: ((v: V) => string) | null, falha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await sb().rpc(rpc, params(v));
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

export interface LinhaIntervencao {
  idItem: string | null;
  idEmpresa: string;
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
    "comercial_intervencao_salvar",
    (d) => ({
      p_id_item: d.idItem,
      p_id_empresa: d.idEmpresa,
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
  return useGravar<{ idEmpresa: string; idItem: string }>(
    "comercial_intervencao_retirar",
    (d) => ({ p_id_empresa: d.idEmpresa, p_id_item: d.idItem }),
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
    () => "Liberado para o Comercial",
    "Falha ao liberar",
  );
}

export function useReabrirAtendimento() {
  return useGravar<{ idEmpresa: string; motivo: string }>(
    "comercial_reabrir",
    (d) => ({ p_id_empresa: d.idEmpresa, p_motivo: d.motivo }),
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
