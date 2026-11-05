"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que devolve as AEPs entregues ao cliente, a última inspeção concluída (v268)
// e a situação dos documentos de cada empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.
// Desde a v321 também traz as decisões da fila de liberação e o corte da fila.

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
import { montarFila, visaoDoVendedor, type DecisaoServico, type ServicoNaFila, type StatusDecisao } from "@/lib/comercial/liberacao";

interface DadosComercial {
  lista: EmpresaComercial[];
  decisoes: DecisaoServico[];
  corte: string | null;
}

function useDadosComercial<T>(select: (d: DadosComercial) => T) {
  return useQuery({
    queryKey: ["comercial-dados"],
    queryFn: async (): Promise<DadosComercial> => {
      const { data, error } = await createSupabaseBrowserClient().rpc("comercial_dados" as never);
      if (error) throw error;
      const r = (data ?? {}) as {
        aeps?: unknown[];
        docs?: DocEmpresa[];
        inspecoes?: InspecaoComercial[];
        certificados?: CertificadoEmpresa[];
        liberacoes?: DecisaoServico[];
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
      };
    },
    select,
  });
}

/** O que o vendedor vê: só os serviços liberados (e os de antes da fila). */
export function useComercial() {
  return useDadosComercial<EmpresaComercial[]>((d) => visaoDoVendedor(d.lista, d.decisoes, d.corte));
}

/** Todos os serviços com o que vender e o estado de cada um (Comercial › Liberar serviços). */
export function useFilaComercial() {
  return useDadosComercial<ServicoNaFila[]>((d) => montarFila(d.lista, d.decisoes, d.corte));
}

/**
 * Quem decide: quem edita (0.3.233). As RPCs da v321 conferem `caller_pode_editar()`, que olha o
 * perfil; o `pode_editar` da conta sozinho não basta.
 */
export function usePodeLiberarServicos(): boolean {
  const podeEditar = useCanEdit();
  const user = useUserStore((s) => s.user);
  return podeEditar && perfilEscreveNaRls(user?.perfil);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: NovaDecisao) => {
      const { error } = await createSupabaseBrowserClient().rpc(
        "comercial_decidir" as never,
        {
          p_id_empresa: d.idEmpresa,
          p_produtos: d.produtos,
          p_status: d.status,
          p_modalidades: d.modalidades ?? [],
          p_orientacao: d.orientacao ?? null,
          p_motivo: d.motivo ?? null,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: ["comercial-dados"] });
      const n = d.produtos.length;
      const verbo = d.status === "LIBERADO" ? "liberado" : "segurado";
      toast.success(n === 1 ? `Serviço ${verbo}` : `${n} serviços ${verbo}s`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao gravar a decisão")),
  });
}

export function useDesfazerDecisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: { idEmpresa: string; produto: Produto }) => {
      const { error } = await createSupabaseBrowserClient().rpc(
        "comercial_desfazer_decisao" as never,
        { p_id_empresa: d.idEmpresa, p_produto: d.produto } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comercial-dados"] });
      toast.success("Serviço de volta à fila");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao desfazer a decisão")),
  });
}
