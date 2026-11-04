"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Leva um nome renomeado nas Configurações para os registros que guardam o NOME (0.3.229).
 * Só Admin chega às Configurações, e a RLS de riscos/itens aceita a escrita do Admin.
 * Cada par é uma instrução; devolve quantos registros mudaram.
 */

/** Tipo de risco: `riscos.tipo_risco` guarda o nome do tipo. */
export async function levarNomeDoTipo(de: string, para: string): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("riscos")
    .update({ tipo_risco: para } as never)
    .eq("tipo_risco", de)
    .select("id_risco");
  if (error) throw error;
  return (data ?? []).length;
}

/**
 * Probabilidade/severidade: os riscos das inspeções (ligados a esta matriz, ou sem matriz
 * quando ela é a ativa — o formulário usa a ativa nesse caso) e os itens da Apreciação de
 * Máquinas ligados a esta matriz.
 */
export async function levarNomeDaMatriz(
  idMatriz: string,
  ativa: boolean,
  campo: "probabilidade" | "severidade",
  pares: { de: string; para: string }[],
): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  let total = 0;
  for (const { de, para } of pares) {
    let q = supabase
      .from("riscos")
      .update({ [campo]: para } as never)
      .eq(campo, de);
    q = ativa ? q.or(`id_matriz.eq.${idMatriz},id_matriz.is.null`) : q.eq("id_matriz", idMatriz);
    const r = await q.select("id_risco");
    if (r.error) throw r.error;
    total += (r.data ?? []).length;

    const a = await supabase
      .from("apreciacoes_maquinas_itens")
      .update({ [campo]: para } as never)
      .eq(campo, de)
      .eq("id_matriz", idMatriz)
      .select("id_matriz");
    if (a.error) throw a.error;
    total += (a.data ?? []).length;
  }
  return total;
}
