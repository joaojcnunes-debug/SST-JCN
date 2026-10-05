// Sinalização de Fatores Psicossociais — montagem pura dos dados (2026-10-02).
//
// Mesma organização da página Riscos Psicossociais: lista de EMPRESAS → página
// da empresa com cada AEP e, dentro dela, os SETORES com os fatores
// organizacionais marcados "Sim" (nível na matriz AIHA, probabilidade,
// severidade e sinais observados). Sem link para o editor da AEP, de propósito.
//
// 2026-10-05: só entram AEPs ENTREGUES ao cliente — registradas numa inspeção
// cujo documento o associado concluiu (`useAepsEntregues`). A data mostrada é
// a da entrega (`entregue_em`); sem ela, cai na data de elaboração.

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import type { AepChecklistOrganizacional, AepRelatorio } from "@/lib/supabase/types";

/** Ordem de gravidade dos níveis da matriz — o mais grave primeiro. */
export const PESO_NIVEL: Record<string, number> = { "Muito Alto": 5, Alto: 4, Moderado: 3, Baixo: 2, Trivial: 1 };

export interface FatorSinalizado {
  key: string;
  label: string;
  /** null = sem sinal observado marcado (não calculado) ou AEP ainda não salva. */
  nivel: string | null;
  probabilidade: string | null;
  severidade: string | null;
  sinais: string[];
  observacao: string | null;
}

export interface SetorSinalizado {
  id: string;
  nome: string;
  fatores: FatorSinalizado[];
  pior: string | null;
}

export interface AvaliacaoSinalizada {
  idRelatorio: string;
  /** Data da entrega ao cliente; sem ela, a data de elaboração. */
  data: string | null;
  idInspecao: string | null;
  responsavel: string | null;
  /** Associado que enviou (concluiu o documento da inspeção); null sem inspeção. */
  enviadoPor: string | null;
  /** Algum setor com "Necessita AET". */
  precisaAet: boolean;
  /** 3+ alertas organizacionais: recomenda DRPS/Questionário. */
  precisaQuestionario: boolean;
  status: string;
  setores: SetorSinalizado[];
}

export interface EmpresaSinalizada {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  avaliacoes: AvaliacaoSinalizada[];
  totalSetores: number;
  totalAlertas: number;
  totalAltos: number;
  pior: string | null;
  ultimaData: string | null;
  /** Da AEP entregue mais recente da empresa. */
  precisaAet: boolean;
  precisaQuestionario: boolean;
  realizadaPor: string | null;
  enviadoPor: string | null;
  temInspecao: boolean;
  /** Cadastro da empresa: unidade (= região no SGG) e município/UF. */
  idUnidade: string | null;
  municipio: string | null;
  uf: string | null;
}

/** Mínimo de alertas organizacionais ("Sim") na AEP para recomendar DRPS/Questionário. */
export const MIN_ALERTAS_QUESTIONARIO = 3;

/** Total de fatores organizacionais marcados "Sim" em todos os setores da AEP. */
export function totalAlertasOrganizacionais(setores: AepRelatorio["setores"]): number {
  return (setores ?? []).reduce(
    (n, s) =>
      n + Object.values((s.checklist_organizacional ?? {}) as unknown as Record<string, string>).filter((v) => v === "sim").length,
    0,
  );
}

/**
 * A AEP recomenda aprofundar com DRPS/Questionário Psicossocial (NR-01) quando
 * há 3+ alertas organizacionais — a mesma regra do aviso do editor da AEP.
 */
export function recomendaQuestionario(setores: AepRelatorio["setores"]): boolean {
  return totalAlertasOrganizacionais(setores) >= MIN_ALERTAS_QUESTIONARIO;
}

/** Situação do DRPS/Questionário Psicossocial que a empresa JÁ TEM. */
export interface SituacaoQuestionario {
  /** "concluido" = concluído ou enviado ao cliente; "andamento" = rascunho/em andamento. */
  fase: "concluido" | "andamento" | null;
  /** Qual documento define a frase: DRPS ou Questionário. */
  doc: "DRPS" | "Questionário" | null;
}

const FASE_DOC: Record<string, "concluido" | "andamento"> = {
  CONCLUIDO: "concluido",
  ENVIADO_CLIENTE: "concluido",
  RASCUNHO: "andamento",
  EM_ANDAMENTO: "andamento",
};

/**
 * O melhor estado entre os DRPS e Questionários (QPS) da empresa: concluído
 * vence andamento; DRPS vem antes do Questionário no empate. Deletados e
 * outros status não contam (mesma régua do quadro Documentos da empresa).
 */
export function situacaoQuestionario(statusDrps: (string | null)[], statusQps: (string | null)[]): SituacaoQuestionario {
  const fase = (lista: (string | null)[], f: "concluido" | "andamento") => lista.some((s) => FASE_DOC[s ?? ""] === f);
  for (const f of ["concluido", "andamento"] as const) {
    if (fase(statusDrps, f)) return { fase: f, doc: "DRPS" };
    if (fase(statusQps, f)) return { fase: f, doc: "Questionário" };
  }
  return { fase: null, doc: null };
}

export function piorNivel(niveis: (string | null | undefined)[]): string | null {
  let pior: string | null = null;
  for (const n of niveis) {
    if (n && (PESO_NIVEL[n] ?? 0) > (PESO_NIVEL[pior ?? ""] ?? 0)) pior = n;
  }
  return pior;
}

/** AEP com a data em que o documento da inspeção foi entregue ao cliente. */
export type AepEntregue = AepRelatorio & {
  entregue_em?: string | null;
  /** Associado que concluiu (enviou) o documento da inspeção; null sem inspeção. */
  enviado_por?: string | null;
};

export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[] {
  const porEmpresa = new Map<string, EmpresaSinalizada>();

  for (const rel of relatorios) {
    const setores: SetorSinalizado[] = (rel.setores ?? [])
      .map((setor) => {
        const cl = setor.checklist_organizacional as unknown as Record<string, string>;
        const fatores: FatorSinalizado[] = ITENS_ORGANIZACIONAL.filter(({ key }) => cl?.[key] === "sim")
          .map(({ key, label }) => {
            const a = setor.aiha_organizacional?.[key];
            return {
              key,
              label,
              nivel: a?.nivel ?? null,
              probabilidade: a?.nivel ? a.probabilidade : null,
              severidade: a?.nivel ? a.severidade : null,
              sinais: rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional),
              observacao: setor.observacoes_checklist?.[key]?.trim() || null,
            };
          })
          .sort((x, y) => (PESO_NIVEL[y.nivel ?? ""] ?? 0) - (PESO_NIVEL[x.nivel ?? ""] ?? 0));
        return {
          id: setor.id,
          nome: setor.nome_setor || "Setor sem nome",
          fatores,
          pior: piorNivel(fatores.map((f) => f.nivel)),
        };
      })
      .filter((s) => s.fatores.length > 0);

    if (setores.length === 0) continue;

    const id = rel.id_empresa;
    const cad = rel.empresas as { id_unidade?: string | null; municipio?: string | null; uf?: string | null } | null;
    let alvo = porEmpresa.get(id);
    if (!alvo) {
      alvo = {
        idEmpresa: id,
        nome: rel.empresas?.nome_empresa ?? "Empresa sem cadastro",
        cnpj: rel.empresas?.cnpj ?? null,
        idUnidade: cad?.id_unidade ?? null,
        municipio: cad?.municipio ?? null,
        uf: cad?.uf ?? null,
        avaliacoes: [],
        totalSetores: 0,
        totalAlertas: 0,
        totalAltos: 0,
        pior: null,
        ultimaData: null,
        precisaAet: false,
        precisaQuestionario: false,
        realizadaPor: null,
        enviadoPor: null,
        temInspecao: false,
      };
      porEmpresa.set(id, alvo);
    }
    alvo.avaliacoes.push({
      idRelatorio: rel.id_relatorio,
      data: rel.entregue_em ?? rel.data_elaboracao,
      idInspecao: (rel as { id_inspecao?: string | null }).id_inspecao ?? null,
      responsavel: rel.responsavel_elaboracao || null,
      enviadoPor: rel.enviado_por?.trim() || null,
      precisaAet: (rel.setores ?? []).some((s) => s.necessita_aet),
      precisaQuestionario: recomendaQuestionario(rel.setores),
      status: rel.status,
      setores,
    });
  }

  const lista = [...porEmpresa.values()];
  for (const e of lista) {
    e.avaliacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
    const todos = e.avaliacoes.flatMap((a) => a.setores);
    e.totalSetores = todos.length;
    e.totalAlertas = todos.reduce((n, s) => n + s.fatores.length, 0);
    e.totalAltos = todos.reduce(
      (n, s) => n + s.fatores.filter((f) => f.nivel === "Alto" || f.nivel === "Muito Alto").length,
      0,
    );
    e.pior = piorNivel(todos.map((s) => s.pior));
    e.ultimaData = e.avaliacoes[0]?.data ?? null;
    const ultima = e.avaliacoes[0];
    e.precisaAet = ultima?.precisaAet ?? false;
    e.precisaQuestionario = ultima?.precisaQuestionario ?? false;
    e.realizadaPor = ultima?.responsavel ?? null;
    e.enviadoPor = ultima?.enviadoPor ?? null;
    e.temInspecao = !!ultima?.idInspecao;
  }
  // Mais grave primeiro; empate pelo nome.
  return lista.sort(
    (a, b) => (PESO_NIVEL[b.pior ?? ""] ?? 0) - (PESO_NIVEL[a.pior ?? ""] ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
