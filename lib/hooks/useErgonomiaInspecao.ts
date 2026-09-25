"use client";

// AEP e AET preenchidas dentro da inspeção (v259).
//
// O laudo nasce na tabela do próprio módulo (aep_relatorios / aet_relatorios)
// com `id_inspecao`, e as abas da inspeção usam os MESMOS editores do módulo.
// Enquanto `enviado_modulo_em` for NULL, o laudo só aparece na inspeção; o
// botão "Enviar para o módulo" o libera nas listas do AEP/AET. É o mesmo
// registro dos dois lados — editar em um reflete no outro na hora.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { setorVazioAep } from "@/lib/hooks/useAep";
import { setorVazio as setorVazioAet } from "@/lib/hooks/useAet";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
import type { Cargo, Empresa, InspecaoMaquina, Setor } from "@/lib/supabase/types";

export type TipoErgo = "aep" | "aet";

export const ROTULO_ERGO: Record<TipoErgo, string> = { aep: "AEP", aet: "AET" };
export const NOME_ERGO: Record<TipoErgo, string> = {
  aep: "Análise Ergonômica Preliminar",
  aet: "Análise Ergonômica do Trabalho",
};

export interface LaudoErgoDaInspecao {
  id_relatorio: string;
  status: string;
  enviado_modulo_em: string | null;
  updated_at: string | null;
}

const tabela = (t: TipoErgo) => `${t}_relatorios` as const;

// As colunas da v259 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export function useLaudoErgoDaInspecao(tipo: TipoErgo, idInspecao: string) {
  return useQuery({
    queryKey: ["ergo-inspecao", tipo, idInspecao],
    queryFn: async (): Promise<LaudoErgoDaInspecao | null> => {
      const { data, error } = await db()
        .from(tabela(tipo))
        .select("id_relatorio, status, enviado_modulo_em, updated_at")
        .eq("id_inspecao", idInspecao)
        .maybeSingle();
      if (error) throw error;
      return (data as LaudoErgoDaInspecao | null) ?? null;
    },
    enabled: !!idInspecao,
  });
}

/** Setores do laudo já preenchidos com o que a inspeção levantou. */
function setoresIniciais(
  tipo: TipoErgo,
  setores: Setor[],
  cargos: Cargo[],
  maquinas: InspecaoMaquina[]
) {
  return setores.map((s) => {
    const doSetor = cargos.filter((c) => c.id_setor === s.id_setor);
    if (tipo === "aep") {
      return {
        ...setorVazioAep(),
        nome_setor: s.setor_ghe,
        descricao_atividade: s.descricao ?? "",
        cargo: doSetor.map((c) => c.cargo).join(", "),
        cargos: doSetor.map((c) => ({
          id: crypto.randomUUID(),
          cargo: c.cargo,
          descricao: c.descricao ?? "",
          quantidade: 0,
        })),
      };
    }
    const maqs = maquinas
      .filter((m) => (m.ids_setores ?? []).includes(s.id_setor) || m.id_setor === s.id_setor)
      .map((m) => m.nome)
      .filter(Boolean);
    return {
      ...setorVazioAet(),
      nome_setor: s.setor_ghe,
      descricao_atividade: s.descricao ?? "",
      funcao: doSetor.map((c) => c.cargo).join(", "),
      maquinas_equipamentos: maqs.join(", "),
      cargos: doSetor.map((c) => ({ nome: c.cargo, descricao: c.descricao ?? "", quantidade: 0 })),
    };
  });
}

export function useIniciarLaudoErgo(tipo: TipoErgo) {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (args: {
      idInspecao: string;
      idEmpresa: string;
      empresa: Empresa | null | undefined;
      setores: Setor[];
      cargos: Cargo[];
      maquinas: InspecaoMaquina[];
    }) => {
      const sb = db();
      const { data: auth } = await sb.auth.getUser();
      const hoje = new Date().toISOString().slice(0, 10);
      const linha: Record<string, unknown> = {
        id_empresa: args.idEmpresa,
        id_inspecao: args.idInspecao,
        responsavel_elaboracao: user?.nome ?? "",
        titulo_profissional: user?.cargo ?? "",
        registro_profissional: user?.registro_mte ?? "",
        endereco_empresa: montarEnderecoEmpresa(args.empresa) || null,
        data_elaboracao: hoje,
        status: "RASCUNHO",
        setores: setoresIniciais(tipo, args.setores, args.cargos, args.maquinas),
        usuario: auth?.user?.id ?? null,
      };
      if (tipo === "aet") linha.consideracoes_finais = "";
      const { data, error } = await sb.from(tabela(tipo)).insert(linha).select("id_relatorio").single();
      if (error) {
        if (String(error.code) === "23505") {
          throw new Error(`Esta inspeção já tem uma ${ROTULO_ERGO[tipo]}. Recarregue a página.`);
        }
        throw error;
      }
      return data as { id_relatorio: string };
    },
    onSuccess: (_d, args) => {
      qc.invalidateQueries({ queryKey: ["ergo-inspecao", tipo, args.idInspecao] });
      toast.success(`${ROTULO_ERGO[tipo]} iniciada com os setores e cargos da inspeção`);
    },
    onError: (e: Error) => toast.error(e.message || `Falha ao iniciar a ${ROTULO_ERGO[tipo]}`),
  });
}

export function useEnviarLaudoErgoModulo(tipo: TipoErgo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { idRelatorio: string; idInspecao: string }) => {
      const { error } = await db()
        .from(tabela(tipo))
        .update({ enviado_modulo_em: new Date().toISOString() })
        .eq("id_relatorio", args.idRelatorio);
      if (error) throw error;
    },
    onSuccess: (_d, args) => {
      qc.invalidateQueries({ queryKey: ["ergo-inspecao", tipo, args.idInspecao] });
      qc.invalidateQueries({ queryKey: [`${tipo}-relatorios`] });
      qc.invalidateQueries({ queryKey: [`home-stats-${tipo}`] });
      toast.success(`${ROTULO_ERGO[tipo]} enviada — já está disponível no módulo ${ROTULO_ERGO[tipo]}`);
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao enviar para o módulo"),
  });
}
