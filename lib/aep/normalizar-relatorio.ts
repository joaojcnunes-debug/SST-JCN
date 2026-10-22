// Normalização da linha crua de `aep_relatorios` (jsonb dos setores) — PURA,
// sem React/Supabase, para o servidor usar também (PDF da página AEP › empresa).
// Morava em lib/hooks/useAep.ts, que é "use client"; o hook reexporta
// (painel v0.3.731). O corpo é o do JCN — inclui os campos que só o JCN tem.

import { sinaisValidos } from "@/lib/aep/sinais-organizacional";
import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta";
import { normalizarMapaLista } from "@/lib/aep/evidencia";
import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
import { normalizarInventario } from "@/lib/aep/inventario";
import type {
  AepCargoSetor,
  AepChecklistCognitiva,
  AepChecklistFisica,
  AepChecklistOrganizacional,
  AepRelatorio,
  AepRisco,
  AepSetor,
  RespostaChecklist,
  RespostaChecklistAep,
} from "@/lib/supabase/types";

// ─── Helpers de normalização ──────────────────────────────────────────────────

function toResposta(v: unknown): RespostaChecklist {
  if (v === true || v === "sim") return "sim";
  if (v === "nao_aplica") return "nao_aplica";
  return "nao";
}

/**
 * Só a Ergonomia Organizacional aceita "N/I — não identificável". Precisa de um
 * normalizador próprio: o `toResposta` acima derruba qualquer valor
 * desconhecido para "nao", e o N/I gravado no jsonb sumiria na leitura.
 */
function toRespostaOrg(v: unknown): RespostaChecklistAep {
  if (v === "nao_identificado") return "nao_identificado";
  return toResposta(v);
}

function normalizarChecklistFisica(raw: unknown): AepChecklistFisica {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    postura: toResposta(c.postura),
    repetitividade: toResposta(c.repetitividade),
    levantamento_carga: toResposta(c.levantamento_carga),
    mobiliario: toResposta(c.mobiliario),
    esforco_fisico: toResposta(c.esforco_fisico),
    iluminacao: toResposta(c.iluminacao),
    ruido: toResposta(c.ruido),
    vibracao: toResposta(c.vibracao),
    desconforto_termico: toResposta(c.desconforto_termico),
  };
}

function normalizarChecklistCognitiva(raw: unknown): AepChecklistCognitiva {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    atencao_continua: toResposta(c.atencao_continua),
    sobrecarga_mental: toResposta(c.sobrecarga_mental),
    pressao_psicologica: toResposta(c.pressao_psicologica),
    excesso_informacoes: toResposta(c.excesso_informacoes),
    ritmo_mental: toResposta(c.ritmo_mental),
  };
}

function normalizarChecklistOrganizacional(raw: unknown): AepChecklistOrganizacional {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    assedio: toRespostaOrg(c.assedio),
    falta_suporte: toRespostaOrg(c.falta_suporte),
    gestao_mudancas: toRespostaOrg(c.gestao_mudancas),
    clareza_papel: toRespostaOrg(c.clareza_papel),
    recompensas: toRespostaOrg(c.recompensas),
    baixo_controle: toRespostaOrg(c.baixo_controle),
    justica_organizacional: toRespostaOrg(c.justica_organizacional),
    eventos_traumaticos: toRespostaOrg(c.eventos_traumaticos),
    subcarga: toRespostaOrg(c.subcarga),
    sobrecarga: toRespostaOrg(c.sobrecarga),
    maus_relacionamentos: toRespostaOrg(c.maus_relacionamentos),
    comunicacao_dificil: toRespostaOrg(c.comunicacao_dificil),
    trabalho_remoto: toRespostaOrg(c.trabalho_remoto),
  };
}

function normalizarSetor(s: unknown): AepSetor {
  const setor = (s ?? {}) as Record<string, unknown>;
  return {
    id: (setor.id as string) ?? crypto.randomUUID(),
    nome_setor: (setor.nome_setor as string) ?? "",
    unidade: (setor.unidade as string) ?? "",
    ghe: (setor.ghe as string) ?? "",
    cargo: (setor.cargo as string) ?? "",
    funcao: (setor.funcao as string) ?? "",
    jornada: (setor.jornada as string) ?? "",
    qtd_expostos: typeof setor.qtd_expostos === "number" ? setor.qtd_expostos : 0,
    descricao_atividade: (setor.descricao_atividade as string) ?? "",
    metodo_coleta: (setor.metodo_coleta as string) ?? "",
    trabalhadores_consultados: (setor.trabalhadores_consultados as string) ?? "",
    cargos: Array.isArray(setor.cargos) ? (setor.cargos as AepCargoSetor[]) : [],
    observacoes_checklist: (typeof setor.observacoes_checklist === "object" && setor.observacoes_checklist !== null)
      ? (setor.observacoes_checklist as Record<string, string>)
      : {},
    riscos: Array.isArray(setor.riscos) ? (setor.riscos as AepRisco[]) : [],
    checklist_fisica: normalizarChecklistFisica(setor.checklist_fisica),
    checklist_cognitiva: normalizarChecklistCognitiva(setor.checklist_cognitiva),
    checklist_organizacional: normalizarChecklistOrganizacional(setor.checklist_organizacional),
    // ⚠️ Este normalizador reconstrói o setor campo a campo — o que não estiver
    // aqui é DESCARTADO em toda leitura. Foi por isso que os sinais precisaram
    // entrar explicitamente. Só aceita array de string, para lixo no jsonb não
    // virar erro de tela.
    sinais_organizacional: (() => {
      const bruto = setor.sinais_organizacional;
      if (typeof bruto !== "object" || bruto === null) return {};
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
        // Só chaves do catálogo atual: sinal que saiu da lista (troca de
        // 2026-10-06) some aqui e no próximo salvamento.
        if (Array.isArray(v)) out[k] = sinaisValidos(k, v.filter((x): x is string => typeof x === "string"));
      }
      return out;
    })(),
    // Motivo do N/I e condições da coleta (2026-10-06) — mesmo cuidado.
    motivo_ni: normalizarMotivoNi(setor.motivo_ni),
    condicoes_coleta: normalizarCondicoesColeta(setor.condicoes_coleta),
    // Origem da evidência e fontes geradoras marcadas (2026-10-06).
    origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
    fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
    inventario: normalizarInventario(setor.inventario),
    // ⚠️ Mesmo cuidado dos sinais: campo fora daqui some em toda leitura.
    aiha_organizacional:
      typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
        ? (setor.aiha_organizacional as AepSetor["aiha_organizacional"])
        : {},
    parecer_tecnico: (setor.parecer_tecnico as string) ?? "",
    recomendacoes: (setor.recomendacoes as string) ?? "",
    necessita_aet: Boolean(setor.necessita_aet),
  };
}

export function normalizarRelatorio(data: unknown): AepRelatorio {
  const rel = data as Record<string, unknown>;
  return {
    ...rel,
    setores: Array.isArray(rel.setores) ? rel.setores.map(normalizarSetor) : [],
    checklist_gestao: normalizarChecklistGestao(rel.checklist_gestao),
  } as AepRelatorio;
}
