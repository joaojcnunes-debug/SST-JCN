"use client";

// Biblioteca psicossocial (v272): leitura para todos, edição só Admin.
// Ver lib/aep/biblioteca.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { mensagemErro } from "@/lib/errors";
import { montarBiblioteca, type FatorBiblioteca } from "@/lib/aep/biblioteca";

const KEY = ["psi-biblioteca"] as const;

// A tabela da v272 ainda não está no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createSupabaseBrowserClient() as any;

export function useBibliotecaPsi() {
  return useQuery({
    queryKey: KEY,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db().from("psi_biblioteca_fatores").select("*").order("ordem");
      if (error) throw error;
      return montarBiblioteca(data as unknown[]);
    },
  });
}

export function useSalvarFatorBiblioteca() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (f: FatorBiblioteca) => {
      const { fator, ...resto } = f;
      const { data, error } = await db()
        .from("psi_biblioteca_fatores")
        .update({
          descricao_risco: resto.descricao_risco,
          danos_saude: resto.danos_saude,
          meio_propagacao: resto.meio_propagacao,
          situacao_padrao: resto.situacao_padrao,
          tempo_exposicao_padrao: resto.tempo_exposicao_padrao,
          medidas_controle_verificar: resto.medidas_controle_verificar,
          fontes_geradoras: resto.fontes_geradoras,
          sugestoes_iniciais: resto.sugestoes_iniciais,
          acoes: resto.acoes,
          atualizado_em: new Date().toISOString(),
          atualizado_por: user?.nome ?? user?.email ?? null,
        })
        .eq("fator", fator)
        .select("fator");
      if (error) throw error;
      // RLS barra sem erro (0 linhas) quem não é Admin.
      if (!data?.length) throw new Error("Só o perfil Admin pode editar a biblioteca.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Biblioteca atualizada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao salvar a biblioteca")),
  });
}
