/**
 * Detalhe de cada fator organizacional "Sim" e o INVENTÁRIO PSICOSSOCIAL da
 * AEP (2026-10-06). Uma linha por setor × fator "Sim", nas colunas do plano —
 * para lançamento no SGG (XLSX e CSV).
 *
 * Cada tópico sai da BIBLIOTECA (lib/aep/biblioteca.ts — base de opções) mais
 * o que é próprio da AEP:
 *   • fontes geradoras  = lacunas do checklist de gestão + opções marcadas;
 *   • evidências        = sinais do catálogo (contam na matriz) + opções de
 *                         evidência marcadas (NÃO contam na matriz);
 *   • medidas de controle existentes = itens evidenciados do checklist de
 *                         gestão + opções marcadas;
 *   • medidas de controle recomendadas (v277) = opções marcadas;
 *   • os demais tópicos = opções marcadas.
 * Mais os itens MANUAIS do técnico em cada tópico.
 *
 * Seleção por fator, no setor (`setor.inventario[fator]`):
 *   sel[tópico]   = ids das opções marcadas (ausente = as marcadas por padrão)
 *   extra[tópico] = textos manuais
 * Matriz AIHA, origem da evidência e confiança vêm de fora (não se editam
 * aqui). Módulo PURO: tela, laudo, PDF e IA usam o mesmo.
 */

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import { idsPadrao, itensDe, rotuloItem, type Biblioteca, type TopicoBib } from "@/lib/aep/biblioteca";
import {
  SEM_MEDIDAS,
  lacunasDoFator,
  medidasExistentesDoFator,
  rotuloLacuna,
  type ChecklistGestao,
} from "@/lib/aep/checklist-gestao";
import { confiancaDoFator, origensEfetivas, rotuloOrigem, type Confianca } from "@/lib/aep/evidencia";
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/** Seleção do inventário de UM fator num setor. */
export interface InventarioFator {
  /** Ids das opções da biblioteca marcadas; tópico ausente = padrão. */
  sel?: Partial<Record<TopicoBib, string[]>>;
  /** Itens manuais por tópico. */
  extra?: Partial<Record<TopicoBib, string[]>>;
}

const listaLimpa = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()))] : null;

/** `{fator: InventarioFator}` limpo (jsonb pode trazer lixo). */
export function normalizarInventario(raw: unknown): Record<string, InventarioFator> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, InventarioFator> = {};
  for (const [fator, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const f: InventarioFator = {};
    for (const campo of ["sel", "extra"] as const) {
      const m = o[campo];
      if (typeof m !== "object" || m === null) continue;
      const limpo: Partial<Record<TopicoBib, string[]>> = {};
      for (const [t, lista] of Object.entries(m as Record<string, unknown>)) {
        const l = listaLimpa(lista);
        if (l) limpo[t as TopicoBib] = l;
      }
      f[campo] = limpo;
    }
    out[fator] = f;
  }
  return out;
}

/** Recorte do setor lido aqui (casa com AepSetor e AepSetorLocal). */
export interface SetorInventario {
  nome_setor?: string | null;
  ghe?: string | null;
  checklist_organizacional?: object | null;
  sinais_organizacional?: Record<string, string[]> | null;
  aiha_organizacional?: Record<string, { probabilidade?: string; severidade?: string; nivel?: string | null } | undefined> | null;
  origem_evidencia?: Record<string, string[]> | null;
  /** Legado (Fase 2): códigos de fonte marcados. Vale quando não há seleção de fontes. */
  fontes_geradoras?: Record<string, string[]> | null;
  inventario?: Record<string, InventarioFator> | null;
}

export interface DetalheFator {
  key: string;
  label: string;
  sinais: string[];
  descricao: string;
  danos: string;
  meio: string;
  situacao: string;
  tempo: string;
  /** Lacunas do checklist de gestão + fontes marcadas + manuais. */
  fontes: string[];
  medidasExistentes: string[];
  /** Medidas de controle recomendadas (v277): opções marcadas + manuais. */
  medidasRecomendadas: string[];
  origens: string[];
  confianca: Confianca | null;
  probabilidade: string;
  severidade: string;
  nivel: string;
  sugestoes: string[];
  acoes: string[];
}

/**
 * Ids marcados no tópico: a seleção do técnico ou o padrão. Só opções que
 * ainda existem e estão ativas (item excluído/recusado some sozinho).
 */
export function idsSelecionados(
  setor: SetorInventario,
  fator: string,
  topico: TopicoBib,
  biblioteca: Biblioteca | null | undefined,
): string[] {
  const opcoes = itensDe(biblioteca, fator, topico);
  const sel = setor.inventario?.[fator]?.sel?.[topico];
  if (sel) return opcoes.filter((i) => sel.includes(i.id_item)).map((i) => i.id_item);
  if (topico === "fonte" && setor.fontes_geradoras?.[fator]?.length) {
    const codigos = setor.fontes_geradoras[fator];
    return opcoes.filter((i) => i.codigo && codigos.includes(i.codigo)).map((i) => i.id_item);
  }
  return idsPadrao(biblioteca, fator, topico);
}

export function detalhesDoSetor(
  setor: SetorInventario,
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): DetalheFator[] {
  const cl = (setor.checklist_organizacional ?? {}) as Record<string, string>;
  return ITENS_ORGANIZACIONAL.filter(({ key }) => cl[key] === "sim").map(({ key, label }) => {
    const lacunas = lacunasDoFator(gestao, key);
    const a = setor.aiha_organizacional?.[key];
    const extra = setor.inventario?.[key]?.extra ?? {};
    const textos = (t: TopicoBib) => {
      const ids = idsSelecionados(setor, key, t, biblioteca);
      const marcadas = itensDe(biblioteca, key, t)
        .filter((i) => ids.includes(i.id_item))
        .map(rotuloItem);
      return [...marcadas, ...(extra[t] ?? [])];
    };
    const perigo = textos("perigo");
    return {
      key,
      label: perigo.length ? perigo.join(" / ") : label,
      sinais: [
        ...rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional ?? undefined),
        ...textos("evidencia"),
      ],
      descricao: textos("descricao").join(" "),
      danos: textos("danos").join("; "),
      meio: textos("meio").join("; "),
      situacao: textos("situacao").join("; "),
      tempo: textos("tempo").join("; "),
      fontes: [...lacunas.map(rotuloLacuna), ...textos("fonte")],
      medidasExistentes: [...medidasExistentesDoFator(gestao, key).map((i) => `${i.codigo} — ${i.label}`), ...textos("medida")],
      medidasRecomendadas: textos("medida_recomendada"),
      origens: origensEfetivas(setor.origem_evidencia?.[key], lacunas.length > 0).map(rotuloOrigem),
      confianca: confiancaDoFator(setor.origem_evidencia?.[key], lacunas.length > 0),
      probabilidade: a?.nivel ? (a.probabilidade ?? "") : "",
      severidade: a?.nivel ? (a.severidade ?? "") : "",
      nivel: a?.nivel ?? "",
      sugestoes: textos("sugestao"),
      acoes: textos("acao"),
    };
  });
}

export const COLUNAS_INVENTARIO = [
  "Setor",
  "GHE",
  "Perigo",
  "Fontes geradoras",
  "Evidências (sinais)",
  "Meio de propagação",
  "Situação",
  "Tempo de exposição",
  "Medidas de controle existentes",
  "Medidas de controle recomendadas",
  "Descrição do risco",
  "Danos à saúde",
  "Probabilidade",
  "Severidade",
  "Nível AIHA",
  "Confiança",
  "Sugestões iniciais",
  "Ações",
] as const;

export function linhasInventario(
  setores: SetorInventario[],
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): string[][] {
  const linhas: string[][] = [];
  for (const s of setores) {
    for (const d of detalhesDoSetor(s, gestao, biblioteca)) {
      linhas.push([
        s.nome_setor || "Setor sem nome",
        s.ghe ?? "",
        d.label,
        d.fontes.join("; "),
        d.sinais.join("; "),
        d.meio,
        d.situacao,
        d.tempo,
        d.medidasExistentes.length ? d.medidasExistentes.join("; ") : SEM_MEDIDAS,
        d.medidasRecomendadas.join("; "),
        d.descricao,
        d.danos,
        d.probabilidade,
        d.severidade,
        d.nivel,
        d.confianca ?? "",
        d.sugestoes.join("; "),
        d.acoes.join("; "),
      ]);
    }
  }
  return linhas;
}

/** CSV com ";" (o Excel em pt-BR abre direto) e BOM para os acentos. */
export function csvInventario(linhas: string[][]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [COLUNAS_INVENTARIO as readonly string[], ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
}
