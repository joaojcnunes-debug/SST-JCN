"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GrauRiscoInspecaoMaquina } from "@/lib/supabase/types";

/**
 * Relação de Máquinas (NR-12 item 1.7 "a") — lida da ABA MÁQUINAS DAS INSPEÇÕES.
 *
 * 30/09/2026, passo 2 da remoção do inventário: até aqui a relação lia
 * `inventario_maquinas`, uma cópia parada (50 máquinas, última edição em
 * junho) do que os técnicos atualizam todo mês em `inspecao_maquinas` (641
 * máquinas, 131 empresas). Agora a máquina mora num lugar só: para corrigir,
 * abre-se a inspeção.
 *
 * UMA INSPEÇÃO POR EMPRESA. A renovação cria uma inspeção nova com as mesmas
 * máquinas; somar as duas duplicaria a relação. Vale a inspeção mais recente
 * (por `data_inspecao`) que tenha máquina — e a linha diz de qual inspeção veio.
 */

export interface MaquinaRelacao {
  id: string;
  id_inspecao: string;
  id_empresa: string | null;
  data_inspecao: string | null;
  nome: string;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  tag: string | null;
  ano_fabricacao: number | null;
  setores: string[];
  necessita_adequacao_nr12: boolean | null;
  grau_risco: GrauRiscoInspecaoMaquina | null;
  /** Ordem da aba Máquinas da inspeção — a relação sai na mesma sequência. */
  ordem: number;
}

type LinhaMaquina = {
  id_maquina_inspecao: string;
  id_inspecao: string;
  id_empresa: string | null;
  id_setor: string | null;
  nome: string;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  tag: string | null;
  ano_fabricacao: number | null;
  necessita_adequacao_nr12: boolean | null;
  grau_risco: GrauRiscoInspecaoMaquina | null;
  ordem: number | null;
  inspecao_maquinas_setores: { id_setor: string }[] | null;
  inspecao: { id_empresa: string | null; data_inspecao: string | null; status: string | null } | null;
};

/** O PostgREST devolve no máximo 1.000 linhas por vez; a relação já tem 641. */
const PAGINA = 1000;

async function carregar(): Promise<MaquinaRelacao[]> {
  const sb = createSupabaseBrowserClient();
  const linhas: LinhaMaquina[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await sb
      .from("inspecao_maquinas")
      .select(
        "id_maquina_inspecao, id_inspecao, id_empresa, id_setor, nome, tipo, marca, modelo, " +
          "numero_serie, tag, ano_fabricacao, necessita_adequacao_nr12, grau_risco, ordem, " +
          "inspecao_maquinas_setores(id_setor), " +
          "inspecao:inspecoes!inner(id_empresa, data_inspecao, status)",
      )
      .eq("ativo", true)
      .neq("inspecao.status", "DELETADA")
      .order("id_maquina_inspecao")
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as LinhaMaquina[];
    linhas.push(...lote);
    if (lote.length < PAGINA) break;
  }

  // Inspeção mais recente de cada empresa, entre as que têm máquina.
  const maisRecente = new Map<string, { id: string; data: string }>();
  for (const l of linhas) {
    const emp = l.inspecao?.id_empresa ?? l.id_empresa ?? "";
    const data = l.inspecao?.data_inspecao ?? "";
    const atual = maisRecente.get(emp);
    if (!atual || data > atual.data || (data === atual.data && l.id_inspecao > atual.id)) {
      maisRecente.set(emp, { id: l.id_inspecao, data });
    }
  }
  const validas = linhas.filter(
    (l) => maisRecente.get(l.inspecao?.id_empresa ?? l.id_empresa ?? "")?.id === l.id_inspecao,
  );

  // Nome dos setores (v160: a máquina pode estar em vários; `id_setor` é o legado).
  const idsSetor = new Set<string>();
  for (const l of validas) {
    for (const s of l.inspecao_maquinas_setores ?? []) idsSetor.add(s.id_setor);
    if (l.id_setor) idsSetor.add(l.id_setor);
  }
  const nomeSetor = new Map<string, string>();
  const ids = [...idsSetor];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from("setores")
      .select("id_setor, setor_ghe")
      .in("id_setor", ids.slice(i, i + 200));
    if (error) throw error;
    for (const s of (data ?? []) as { id_setor: string; setor_ghe: string | null }[]) {
      if (s.setor_ghe) nomeSetor.set(s.id_setor, s.setor_ghe);
    }
  }

  return validas
    .map((l): MaquinaRelacao => {
      const idsDaMaquina = l.inspecao_maquinas_setores?.length
        ? l.inspecao_maquinas_setores.map((s) => s.id_setor)
        : l.id_setor
          ? [l.id_setor]
          : [];
      return {
        id: l.id_maquina_inspecao,
        id_inspecao: l.id_inspecao,
        id_empresa: l.inspecao?.id_empresa ?? l.id_empresa,
        data_inspecao: l.inspecao?.data_inspecao ?? null,
        nome: l.nome,
        tipo: l.tipo,
        marca: l.marca,
        modelo: l.modelo,
        numero_serie: l.numero_serie,
        tag: l.tag,
        ano_fabricacao: l.ano_fabricacao,
        setores: idsDaMaquina.map((id) => nomeSetor.get(id)).filter((n): n is string => !!n),
        necessita_adequacao_nr12: l.necessita_adequacao_nr12,
        grau_risco: l.grau_risco,
        ordem: l.ordem ?? 0,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function useRelacaoMaquinas() {
  return useQuery({
    queryKey: ["relacao-maquinas"] as const,
    queryFn: carregar,
    staleTime: 60_000,
  });
}
