"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Mapas para enriquecer a "Atividade recente" da Visão geral:
 * - nome da empresa por id_empresa;
 * - técnico(s) vinculado(s) a cada empresa (usuarios.empresas_vinculadas).
 *
 * `empresas_vinculadas` vazio = usuário vê TODAS (não é "vínculo" a uma empresa
 * específica), então só entram aqui os usuários com vínculos explícitos. A
 * leitura de `usuarios` pode ser restrita por RLS (degrada para vazio sem erro).
 */
export interface AtividadeContexto {
  nomePorEmpresa: Map<string, string>;
  tecnicoPorEmpresa: Map<string, string>;
}

export function useAtividadeContexto() {
  return useQuery<AtividadeContexto>({
    queryKey: ["atividade-contexto"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const [empRes, usrRes] = await Promise.all([
        sb.from("empresas").select("id_empresa, nome_empresa"),
        sb.from("usuarios").select("nome, empresas_vinculadas"),
      ]);

      const nomePorEmpresa = new Map<string, string>();
      for (const e of (empRes.data ?? []) as { id_empresa: string; nome_empresa: string }[]) {
        nomePorEmpresa.set(e.id_empresa, e.nome_empresa);
      }

      // Técnicos por empresa — só usuários com vínculo explícito. Se RLS bloquear
      // a leitura de usuarios, fica vazio (sem quebrar).
      const tecnicosPorEmpresa = new Map<string, string[]>();
      if (!usrRes.error) {
        for (const u of (usrRes.data ?? []) as { nome: string | null; empresas_vinculadas: string[] | null }[]) {
          const vinc = u.empresas_vinculadas ?? [];
          if (!u.nome || vinc.length === 0) continue;
          for (const id of vinc) {
            const arr = tecnicosPorEmpresa.get(id) ?? [];
            arr.push(u.nome);
            tecnicosPorEmpresa.set(id, arr);
          }
        }
      }
      const tecnicoPorEmpresa = new Map<string, string>();
      for (const [id, nomes] of tecnicosPorEmpresa) {
        tecnicoPorEmpresa.set(id, nomes.join(", "));
      }

      return { nomePorEmpresa, tecnicoPorEmpresa };
    },
  });
}
