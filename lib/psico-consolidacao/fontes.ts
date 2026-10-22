// Consolidação Psicossocial de Grupo (v295) — documentos do grupo → linhas.
//
// Uma linha = empresa × setor (como está no documento) × fator × origem. É a forma
// que o motor de regras (fase 4) recebe. Aqui não se decide nada: a AEP vira
// "Identificado" (fator marcado "Sim"), o DRPS/QPS traz o nível da matriz como está
// no laudo (Baixo, Médio, Alto, Crítico) — inclusive o Baixo, que o motor descarta.
//
// Funções puras: o carregamento (rede) fica em `carregar-grupo.ts`.

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import type { AvaliacaoRisco } from "@/lib/riscos-psicossociais/carregar";
import type { AepRelatorio } from "@/lib/supabase/types";
import type { OrigemFonte } from "./fatores";

export type NivelConsolidacao = "Baixo" | "Médio" | "Alto" | "Crítico" | "Identificado";

/** Confiança da AEP pelo nº de origens de evidência do fator (só exibida, não muda o nível). */
export type ConfiancaAep = "Baixa" | "Média" | "Alta";

export function confiancaPorOrigens(n: number): ConfiancaAep | null {
  if (n <= 0) return null;
  return n === 1 ? "Baixa" : n === 2 ? "Média" : "Alta";
}

/** O que não vira risco mas precisa aparecer: N/I na AEP, categoria sem resposta no QPS. */
export interface PendenciaFonte {
  idEmpresa: string;
  origem: OrigemFonte;
  idDocumento: string;
  setorOriginal: string;
  fatorOriginal: string;
  tipo: "nao_identificado" | "sem_base";
}

export interface LinhaFonte {
  idEmpresa: string;
  origem: OrigemFonte;
  idDocumento: string;
  setorOriginal: string;
  /** Nome do fator como está no documento (AEP: a chave; DRPS/QPS: o nome do tópico/categoria). */
  fatorOriginal: string;
  nivel: NivelConsolidacao;
  /** AEP: rótulos dos sinais observados marcados. */
  sinais: string[];
  /** AEP: fator "Sim" sem NENHUM sinal marcado (alerta de qualidade). Sinal da lista
   *  anterior conta como marcado — é o critério da análise do caso de origem (3 casos). */
  semSinal: boolean;
  /** AEP: nível da matriz AIHA gravado no setor (não é recalculado aqui). */
  nivelAiha: string | null;
  /** AEP: confiança pelas origens de evidência marcadas. */
  confianca: ConfiancaAep | null;
  /** DRPS/QPS: a probabilidade foi gravada pela psicóloga (false = valeu o padrão Baixa). */
  probabilidadeInformada: boolean | null;
  /** DRPS/QPS: respondentes do setor. */
  respondentes: number | null;
}

export interface DocumentoFonte {
  id: string;
  origem: OrigemFonte;
  idEmpresa: string;
  titulo: string;
  status: string;
  /** Data de referência (conclusão, elaboração ou última edição). */
  data: string | null;
  responsavel: string | null;
  /** AEP: algum setor indica AET. */
  necessitaAet: boolean | null;
  setores: number;
}

/** Fatores organizacionais marcados "Sim" em cada setor da AEP. */
export function linhasDaAep(rel: Pick<AepRelatorio, "id_relatorio" | "id_empresa" | "setores">): LinhaFonte[] {
  const out: LinhaFonte[] = [];
  for (const s of rel.setores ?? []) {
    const setor = (s.nome_setor ?? "").trim();
    if (!setor) continue;
    for (const { key } of ITENS_ORGANIZACIONAL) {
      if (s.checklist_organizacional?.[key] !== "sim") continue;
      out.push({
        idEmpresa: rel.id_empresa,
        origem: "AEP",
        idDocumento: rel.id_relatorio,
        setorOriginal: setor,
        fatorOriginal: key,
        nivel: "Identificado",
        sinais: rotulosDosSinais(key, s.sinais_organizacional),
        semSinal: rotulosDosSinais(key, s.sinais_organizacional).length === 0,
        nivelAiha: s.aiha_organizacional?.[key]?.nivel ?? null,
        confianca: confiancaPorOrigens(s.origem_evidencia?.[key]?.length ?? 0),
        probabilidadeInformada: null,
        respondentes: null,
      });
    }
  }
  return out;
}

/** Fatores marcados N/I (não identificável) em cada setor da AEP: pendência de avaliação. */
export function pendenciasDaAep(rel: Pick<AepRelatorio, "id_relatorio" | "id_empresa" | "setores">): PendenciaFonte[] {
  const out: PendenciaFonte[] = [];
  for (const s of rel.setores ?? []) {
    const setor = (s.nome_setor ?? "").trim();
    if (!setor) continue;
    for (const { key } of ITENS_ORGANIZACIONAL) {
      if (s.checklist_organizacional?.[key] !== "nao_identificado") continue;
      out.push({ idEmpresa: rel.id_empresa, origem: "AEP", idDocumento: rel.id_relatorio, setorOriginal: setor, fatorOriginal: key, tipo: "nao_identificado" });
    }
  }
  return out;
}

export function documentoDaAep(
  rel: Pick<AepRelatorio, "id_relatorio" | "id_empresa" | "status" | "setores" | "responsavel_elaboracao" | "data_elaboracao" | "updated_at"> & {
    concluido_em?: string | null;
  },
): DocumentoFonte {
  return {
    id: rel.id_relatorio,
    origem: "AEP",
    idEmpresa: rel.id_empresa,
    titulo: "AEP",
    status: rel.status,
    data: rel.data_elaboracao ?? rel.concluido_em ?? rel.updated_at ?? null,
    responsavel: rel.responsavel_elaboracao || null,
    necessitaAet: (rel.setores ?? []).some((s) => s.necessita_aet),
    setores: (rel.setores ?? []).filter((s) => (s.nome_setor ?? "").trim()).length,
  };
}

const ORIGEM_AVALIACAO: Record<AvaliacaoRisco["fonte"], OrigemFonte> = { DRPS: "DRPS", "Questionário": "QPS" };

/** Cada fator com nível de cada setor de um DRPS/QPS concluído. */
export function linhasDaAvaliacao(idEmpresa: string, av: AvaliacaoRisco): LinhaFonte[] {
  const origem = ORIGEM_AVALIACAO[av.fonte];
  return av.setores.flatMap((s) =>
    s.fatores.map((f) => ({
      idEmpresa,
      origem,
      idDocumento: av.id,
      setorOriginal: s.setor.trim(),
      fatorOriginal: f.nome,
      nivel: f.nivel,
      sinais: [],
      semSinal: false,
      nivelAiha: null,
      confianca: null,
      probabilidadeInformada: f.probabilidadeInformada ?? null,
      respondentes: s.respondentes,
    })),
  );
}

/** QPS: categorias sem nenhuma resposta no setor — exibidas como "sem base", não contam. */
export function pendenciasDaAvaliacao(idEmpresa: string, av: AvaliacaoRisco): PendenciaFonte[] {
  const origem = ORIGEM_AVALIACAO[av.fonte];
  return av.setores.flatMap((s) =>
    (s.semBase ?? []).map((nome) => ({
      idEmpresa,
      origem,
      idDocumento: av.id,
      setorOriginal: s.setor.trim(),
      fatorOriginal: nome,
      tipo: "sem_base" as const,
    })),
  );
}

export function documentoDaAvaliacao(idEmpresa: string, av: AvaliacaoRisco): DocumentoFonte {
  return {
    id: av.id,
    origem: ORIGEM_AVALIACAO[av.fonte],
    idEmpresa,
    titulo: av.titulo,
    status: av.status,
    data: av.data,
    responsavel: av.responsavel,
    necessitaAet: null,
    setores: av.setores.length,
  };
}

/**
 * Documentos usados por padrão: o mais recente de cada empresa em cada origem
 * (uma AEP, um DRPS, um QPS). O técnico pode trocar na tela de Fontes.
 */
export function documentosPadrao(docs: DocumentoFonte[]): Set<string> {
  const melhor = new Map<string, DocumentoFonte>();
  for (const d of docs) {
    const k = `${d.idEmpresa}|${d.origem}`;
    const atual = melhor.get(k);
    if (!atual || (d.data ?? "") > (atual.data ?? "")) melhor.set(k, d);
  }
  return new Set([...melhor.values()].map((d) => d.id));
}
