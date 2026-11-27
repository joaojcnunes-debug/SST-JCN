"use client";

// Riscos da AEP/AET para a aba Riscos da inspeção (0.3.308, banco v363). A regra (o que vira risco, a chave, novo ×
// atualizar × igual) está em lib/ergonomia/riscos-do-laudo.ts; aqui só a busca dos setores do laudo e a gravação.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { chaveSetor, type DestinoSetor, type ItemDoLaudo, type OrigemLaudo, type SetorDoLaudo } from "@/lib/ergonomia/riscos-do-laudo";

// aep_relatorios/aet_relatorios e as colunas da v363 não estão todas no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export interface LaudoComSetores {
  origem: OrigemLaudo;
  id_relatorio: string;
  setores: SetorDoLaudo[];
}

/** A AEP e a AET desta inspeção (as que existirem), com os setores do laudo. */
export function useLaudosComSetores(idInspecao: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["riscos-do-laudo", idInspecao],
    enabled: habilitado && !!idInspecao,
    queryFn: async (): Promise<LaudoComSetores[]> => {
      const out: LaudoComSetores[] = [];
      for (const origem of ["AEP", "AET"] as const) {
        const { data, error } = await db()
          .from(`${origem.toLowerCase()}_relatorios`)
          .select("id_relatorio, setores")
          .eq("id_inspecao", idInspecao)
          .maybeSingle();
        if (error) throw error;
        if (data) out.push({ origem, id_relatorio: data.id_relatorio, setores: (data.setores ?? []) as SetorDoLaudo[] });
      }
      return out;
    },
  });
}

/**
 * Grava os itens escolhidos na prévia: os novos entram, os que mudaram no laudo são atualizados. 0.3.331: o destino de cada
 * item pode ser um setor que a inspeção já tem ou "criar" — os setores a criar entram antes (um por nome), na inspeção.
 */
export function useAplicarRiscosDoLaudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { idInspecao: string; idEmpresa: string; itens: (ItemDoLaudo & { destino: DestinoSetor })[] }) => {
      const sb = db();
      const agora = new Date().toISOString();
      // Os setores a criar, um por nome (sem acento e sem caixa).
      const criados = new Map<string, string>();
      for (const i of args.itens) {
        if (i.destino.tipo !== "criar") continue;
        const k = chaveSetor(i.destino.nome);
        if (criados.has(k)) continue;
        const id = gerarId("SET");
        const { error } = await sb.from("setores").insert({
          id_setor: id, id_inspecao: args.idInspecao, id_empresa: args.idEmpresa, setor_ghe: i.destino.nome.trim(), descricao: i.destino.descricao,
        });
        if (error) throw error;
        criados.set(k, id);
      }
      const idDo = (d: DestinoSetor) => (d.tipo === "existente" ? d.idSetor : criados.get(chaveSetor(d.nome))!);
      const novos = args.itens.filter((i) => i.situacao === "novo");
      const mudaram = args.itens.filter((i) => i.situacao === "atualizar" && i.idRisco);
      if (novos.length) {
        const linhas = novos.map((i) => ({
          id_risco: gerarId("RSC"),
          id_inspecao: args.idInspecao,
          id_empresa: args.idEmpresa,
          id_setor: idDo(i.destino),
          ...i.dados,
          origem: i.origem,
          origem_chave: i.chave,
          created_at: agora,
          updated_at: agora,
        }));
        const { error } = await sb.from("riscos").insert(linhas);
        if (error) {
          if (String(error.code) === "23505") throw new Error("Alguns destes riscos já foram trazidos. Feche e abra a prévia de novo.");
          throw error;
        }
      }
      for (const i of mudaram) {
        const { error } = await sb.from("riscos").update({ ...i.dados, updated_at: agora }).eq("id_risco", i.idRisco);
        if (error) throw error;
      }
      return { novos: novos.length, atualizados: mudaram.length, setores: criados.size };
    },
    onSuccess: (r, args) => {
      qc.invalidateQueries({ queryKey: ["inspecao", args.idInspecao] });
      const partes = [
        r.novos ? `${r.novos} risco${r.novos > 1 ? "s" : ""} trazido${r.novos > 1 ? "s" : ""}` : "",
        r.atualizados ? `${r.atualizados} atualizado${r.atualizados > 1 ? "s" : ""}` : "",
        r.setores ? `${r.setores} setor${r.setores > 1 ? "es" : ""} criado${r.setores > 1 ? "s" : ""}` : "",
      ].filter(Boolean);
      toast.success(partes.join(" · ") || "Nada a trazer");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao trazer os riscos"),
  });
}
