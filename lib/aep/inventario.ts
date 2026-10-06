/**
 * Detalhe de cada fator organizacional "Sim" e o INVENTÁRIO PSICOSSOCIAL da
 * AEP (Fase 2, 2026-10-06). Uma linha por setor × fator "Sim", nas colunas do
 * plano — para lançamento no SGG (XLSX e CSV).
 *
 * Junta: matriz AIHA gravada, sinais, biblioteca (descrição, danos, meio,
 * situação, tempo, sugestões, ações), fontes geradoras (lacunas do checklist
 * de gestão + fontes da biblioteca marcadas pelo técnico), medidas de
 * controle existentes (itens evidenciados do checklist de gestão) e origem
 * da evidência / confiança. Módulo PURO: tela, laudo, PDF e IA usam o mesmo.
 *
 * AJUSTES DO TÉCNICO (2026-10-06): cada tópico do inventário pode ser editado
 * por fator, no setor (`setor.inventario[fator]`): textos próprios (perigo,
 * meio, situação, tempo, descrição, danos), itens manuais a mais (fontes,
 * evidências, medidas, sugestões, ações) e a seleção das sugestões/ações da
 * biblioteca. Sem ajuste, vale o padrão (biblioteca + gestão + sinais).
 * Itens manuais de evidência NÃO contam para a matriz AIHA (só os sinais do
 * catálogo contam).
 */

/** Ajustes do inventário de UM fator num setor. Tudo opcional. */
export interface InventarioFator {
  perigo?: string;
  meio?: string;
  situacao?: string;
  tempo?: string;
  descricao?: string;
  danos?: string;
  fontes_extra?: string[];
  sinais_extra?: string[];
  medidas_extra?: string[];
  /** Sugestões da biblioteca escolhidas; ausente = todas. */
  sugestoes?: string[];
  sugestoes_extra?: string[];
  /** Ações da biblioteca escolhidas; ausente = todas. */
  acoes?: string[];
  acoes_extra?: string[];
}

const TEXTOS_INV = ["perigo", "meio", "situacao", "tempo", "descricao", "danos"] as const;
const LISTAS_INV = ["fontes_extra", "sinais_extra", "medidas_extra", "sugestoes", "sugestoes_extra", "acoes", "acoes_extra"] as const;

/** `{fator: InventarioFator}` limpo (jsonb pode trazer lixo). */
export function normalizarInventario(raw: unknown): Record<string, InventarioFator> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, InventarioFator> = {};
  for (const [fator, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const f: InventarioFator = {};
    for (const k of TEXTOS_INV) if (typeof o[k] === "string") f[k] = o[k] as string;
    for (const k of LISTAS_INV) {
      if (Array.isArray(o[k])) f[k] = [...new Set((o[k] as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()))];
    }
    out[fator] = f;
  }
  return out;
}

/** Texto ajustado (não vazio) ou o padrão. */
const ou = (ajuste: string | undefined, padrao: string) => (ajuste?.trim() ? ajuste.trim() : padrao);

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import { fontesMarcadas, type Biblioteca } from "@/lib/aep/biblioteca";
import {
  SEM_MEDIDAS,
  lacunasDoFator,
  medidasExistentesDoFator,
  rotuloLacuna,
  type ChecklistGestao,
} from "@/lib/aep/checklist-gestao";
import { confiancaDoFator, origensEfetivas, rotuloOrigem, type Confianca } from "@/lib/aep/evidencia";
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/** Recorte do setor lido aqui (casa com AepSetor e AepSetorLocal). */
export interface SetorInventario {
  nome_setor?: string | null;
  ghe?: string | null;
  checklist_organizacional?: object | null;
  sinais_organizacional?: Record<string, string[]> | null;
  aiha_organizacional?: Record<string, { probabilidade?: string; severidade?: string; nivel?: string | null } | undefined> | null;
  origem_evidencia?: Record<string, string[]> | null;
  fontes_geradoras?: Record<string, string[]> | null;
  /** Ajustes do inventário por fator (2026-10-06). */
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
  /** Lacunas do checklist de gestão + fontes da biblioteca marcadas. */
  fontes: string[];
  medidasExistentes: string[];
  origens: string[];
  confianca: Confianca | null;
  probabilidade: string;
  severidade: string;
  nivel: string;
  sugestoes: string[];
  acoes: string[];
}

export function detalhesDoSetor(
  setor: SetorInventario,
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): DetalheFator[] {
  const cl = (setor.checklist_organizacional ?? {}) as Record<string, string>;
  return ITENS_ORGANIZACIONAL.filter(({ key }) => cl[key] === "sim").map(({ key, label }) => {
    const b = biblioteca?.[key];
    const lacunas = lacunasDoFator(gestao, key);
    const a = setor.aiha_organizacional?.[key];
    const aj = setor.inventario?.[key] ?? {};
    const escolhidas = (todas: string[], sel: string[] | undefined) => (sel ? todas.filter((x) => sel.includes(x)) : todas);
    return {
      key,
      label: ou(aj.perigo, label),
      sinais: [
        ...rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional ?? undefined),
        ...(aj.sinais_extra ?? []),
      ],
      descricao: ou(aj.descricao, b?.descricao_risco ?? ""),
      danos: ou(aj.danos, b?.danos_saude ?? ""),
      meio: ou(aj.meio, b?.meio_propagacao ?? ""),
      situacao: ou(aj.situacao, b?.situacao_padrao ?? ""),
      tempo: ou(aj.tempo, b?.tempo_exposicao_padrao ?? ""),
      fontes: [
        ...lacunas.map(rotuloLacuna),
        ...fontesMarcadas(biblioteca, key, setor.fontes_geradoras?.[key]),
        ...(aj.fontes_extra ?? []),
      ],
      medidasExistentes: [
        ...medidasExistentesDoFator(gestao, key).map((i) => `${i.codigo} — ${i.label}`),
        ...(aj.medidas_extra ?? []),
      ],
      origens: origensEfetivas(setor.origem_evidencia?.[key], lacunas.length > 0).map(rotuloOrigem),
      confianca: confiancaDoFator(setor.origem_evidencia?.[key], lacunas.length > 0),
      probabilidade: a?.nivel ? (a.probabilidade ?? "") : "",
      severidade: a?.nivel ? (a.severidade ?? "") : "",
      nivel: a?.nivel ?? "",
      sugestoes: [...escolhidas(b?.sugestoes_iniciais ?? [], aj.sugestoes), ...(aj.sugestoes_extra ?? [])],
      acoes: [...escolhidas(b?.acoes ?? [], aj.acoes), ...(aj.acoes_extra ?? [])],
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
