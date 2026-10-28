"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GestaoNivel } from "@/lib/gestao/niveis";
import type { TipoRecurso } from "@/lib/gestao/acessos";

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };

export type Passo =
  | { op: "membro"; email: string }
  | { op: "pessoa"; email: string; tipo: TipoRecurso; id: string; nivel: GestaoNivel | null }
  | { op: "equipe"; id_equipe: string; tipo: TipoRecurso; id: string; nivel: GestaoNivel | null }
  | { op: "entrar_equipe"; id_equipe: string; email: string; papel: "membro" | "supervisor" };

/**
 * Executa uma lista de passos de acesso pelas mesmas RPCs logadas de sempre
 * (gestao_definir_membro, gestao_alterar_acesso, gestao_equipe_alterar_acesso,
 * gestao_equipe_definir_membro), em ordem, com UM toast no fim. `nivel: null` revoga.
 * Um passo que falha não interrompe os outros: o toast conta as falhas e mostra a 1ª.
 */
export function useGravarAcessos() {
  const qc = useQueryClient();
  const [gravando, setGravando] = useState(false);

  async function executar(passos: Passo[], motivo: string, sucesso: string) {
    if (!passos.length) return true;
    setGravando(true);
    const sb = createSupabaseBrowserClient() as unknown as Rpc;
    const erros: string[] = [];
    try {
      for (const p of passos) {
        const r =
          p.op === "membro"
            ? await sb.rpc("gestao_definir_membro", { p_alvo: p.email, p_papel: "membro", p_ativo: true, p_motivo: motivo })
            : p.op === "pessoa"
              ? await sb.rpc("gestao_alterar_acesso", {
                  p_alvo: p.email, p_acao: p.nivel ? "concedeu" : "revogou", p_recurso_tipo: p.tipo, p_recurso_id: p.id,
                  p_nivel_novo: p.nivel ?? "view", p_motivo: motivo,
                })
              : p.op === "equipe"
                ? await sb.rpc("gestao_equipe_alterar_acesso", { p_id_equipe: p.id_equipe, p_recurso_tipo: p.tipo, p_recurso_id: p.id, p_nivel: p.nivel, p_motivo: motivo })
                : await sb.rpc("gestao_equipe_definir_membro", { p_id_equipe: p.id_equipe, p_email: p.email, p_papel: p.papel, p_ativo: true });
        if (r.error) erros.push(r.error.message);
      }
    } finally {
      setGravando(false);
      for (const k of ["gestao-acessos", "gestao-meu-nivel", "gestao-meus-acessos", "gestao-membros", "gestao-meu-papel", "gestao-equipes", "gestao-equipe-membros", "gestao-colaboradores", "gestao-quadros", "gestao-espacos", "gestao-pastas"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    }
    if (erros.length) {
      toast.error(`${erros.length} de ${passos.length} alteração(ões) não foram gravadas: ${erros[0]}`);
      return false;
    }
    toast.success(sucesso);
    return true;
  }

  return { executar, gravando };
}
