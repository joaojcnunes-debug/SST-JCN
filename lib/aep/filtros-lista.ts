// Filtros da lista de Análises e do Dashboard da AEP (2026-10-05). Puro, para
// testar sem tela. A unidade ativa continua vindo do seletor do topo
// (`useUnidadeFiltro`) e a empresa, do seletor de empresa da própria página.

import { buscar } from "@/lib/busca/texto";
import { piorNivel } from "@/lib/aep/sinalizacao";
import type { AepRelatorio, StatusAEP } from "@/lib/supabase/types";

export interface FiltrosListaAep {
  busca: string;
  status: "" | StatusAEP;
  /** "sim" = algum setor com Necessita AET. */
  aet: "" | "sim" | "nao";
  /** Maior nível AIHA dos fatores organizacionais; "altos" = Alto ou Muito Alto. */
  nivel: string;
  inspecao: "" | "com" | "sem";
  responsavel: string;
  /** Data de elaboração, AAAA-MM-DD. */
  de: string;
  ate: string;
}

export const FILTROS_LISTA_VAZIOS: FiltrosListaAep = {
  busca: "",
  status: "",
  aet: "",
  nivel: "",
  inspecao: "",
  responsavel: "",
  de: "",
  ate: "",
};

export function filtrosListaAtivos(f: FiltrosListaAep): number {
  return Object.values(f).filter((v) => String(v).trim()).length;
}

/** Maior nível AIHA entre os fatores organizacionais de todos os setores. */
export function nivelAepRelatorio(rel: AepRelatorio): string | null {
  return piorNivel(
    (rel.setores ?? []).flatMap((s) => Object.values(s.aiha_organizacional ?? {}).map((a) => a?.nivel ?? null)),
  );
}

export function precisaAetRelatorio(rel: AepRelatorio): boolean {
  return (rel.setores ?? []).some((s) => s.necessita_aet);
}

/**
 * Aplica os filtros. `ignorar` deixa um filtro de fora — o Dashboard conta os
 * cartões de status com todos os outros filtros, menos o próprio status.
 */
export function filtrarAeps(
  lista: AepRelatorio[],
  f: FiltrosListaAep,
  ignorar: (keyof FiltrosListaAep)[] = [],
): AepRelatorio[] {
  const usa = (k: keyof FiltrosListaAep) => !ignorar.includes(k) && String(f[k]).trim() !== "";
  let r = lista;
  if (usa("busca")) {
    r = buscar(r, f.busca, (x) => {
      const emp = x.empresas as { nome_empresa?: string; cnpj?: string | null } | null;
      return [emp?.nome_empresa, emp?.cnpj, x.responsavel_elaboracao];
    }).itens;
  }
  return r.filter((x) => {
    if (usa("status") && x.status !== f.status) return false;
    if (usa("aet") && precisaAetRelatorio(x) !== (f.aet === "sim")) return false;
    if (usa("nivel")) {
      const n = nivelAepRelatorio(x);
      if (f.nivel === "altos" ? n !== "Alto" && n !== "Muito Alto" : n !== f.nivel) return false;
    }
    const temInsp = !!(x as { id_inspecao?: string | null }).id_inspecao;
    if (usa("inspecao") && temInsp !== (f.inspecao === "com")) return false;
    if (usa("responsavel") && (x.responsavel_elaboracao ?? "").trim() !== f.responsavel) return false;
    const data = (x.data_elaboracao ?? "").slice(0, 10);
    if (usa("de") && (!data || data < f.de)) return false;
    if (usa("ate") && (!data || data > f.ate)) return false;
    return true;
  });
}
