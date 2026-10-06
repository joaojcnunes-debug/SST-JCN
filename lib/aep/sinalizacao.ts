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
import { DRPS_POR_RECEIO, temReceioManifestacao, type SetorColeta } from "@/lib/aep/coleta";
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
 * Desde 2026-10-06 (`DRPS_POR_RECEIO`), também quando algum setor tem N/I por
 * receio de manifestação ou sinais de inibição na coleta: o trabalhador que
 * não fala na entrevista precisa de um instrumento em que possa responder.
 */
export function recomendaQuestionario(setores: AepRelatorio["setores"]): boolean {
  if (totalAlertasOrganizacionais(setores) >= MIN_ALERTAS_QUESTIONARIO) return true;
  return DRPS_POR_RECEIO && (setores ?? []).some((s) => temReceioManifestacao(s as unknown as SetorColeta));
}

/** Situação do DRPS/Questionário Psicossocial que a empresa JÁ TEM. */
export interface SituacaoQuestionario {
  /** "concluido" = concluído ou enviado ao cliente; "andamento" = rascunho/em andamento. */
  fase: "concluido" | "andamento" | null;
  /** Qual documento define a frase: DRPS ou Questionário. */
  doc: "DRPS" | "Questionário" | null;
  /** Data do documento mais recente dessa fase (envio/conclusão/elaboração). */
  data?: string | null;
}

/** Um DRPS/QPS: só o status (legado) ou status + data. */
export type DocQuestionario = string | null | { status: string | null; data?: string | null };

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
export function situacaoQuestionario(drps: DocQuestionario[], qps: DocQuestionario[]): SituacaoQuestionario {
  const norm = (l: DocQuestionario[]) =>
    l.map((d) => (d && typeof d === "object" ? { status: d.status, data: d.data ?? null } : { status: d, data: null }));
  const D = norm(drps);
  const Q = norm(qps);
  // Data mais recente entre os documentos daquela fase.
  const achar = (lista: { status: string | null; data: string | null }[], f: "concluido" | "andamento") => {
    const da = lista.filter((x) => FASE_DOC[x.status ?? ""] === f);
    if (da.length === 0) return undefined;
    return da.map((x) => x.data).filter((x): x is string => !!x).sort().pop() ?? null;
  };
  for (const f of ["concluido", "andamento"] as const) {
    const dD = achar(D, f);
    if (dD !== undefined) return { fase: f, doc: "DRPS", data: dD };
    const dQ = achar(Q, f);
    if (dQ !== undefined) return { fase: f, doc: "Questionário", data: dQ };
  }
  return { fase: null, doc: null, data: null };
}

/** "2026-10-05..." → "05/10/2026" (puro, sem fuso). */
export function dataBR(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export type TomLeitura = "ok" | "alerta" | "info" | "perigo" | "neutro";

export interface LeituraQuestionario {
  /** Frase curta: Não / Necessário / Revisão recomendada / Atendido. */
  rotulo: string;
  /** Explicação embaixo, com o documento e a data. */
  detalhe: string | null;
  tom: TomLeitura;
  /** Ainda falta algo para atender a recomendação da AEP. */
  pendente: boolean;
}

/**
 * O que dizer sobre DRPS/Questionário diante da AEP (2026-10-05): "Necessário"
 * + "concluído" confundia. Agora:
 *   • não recomendado           → "Não" (e o que a empresa tiver, só informativo);
 *   • recomendado, nenhum feito → "Necessário" · "Nenhum DRPS/Questionário feito";
 *   • recomendado, em andamento → "Necessário" · "DRPS em andamento desde …";
 *   • recomendado, concluído ANTES da AEP → "Revisão recomendada" · "DRPS
 *     concluído em …, antes da AEP de …" — a AEP trouxe fatores novos;
 *   • recomendado, concluído na data da AEP ou depois → "Atendido".
 */
export function leituraQuestionario(
  precisa: boolean,
  s: SituacaoQuestionario | undefined,
  dataAep: string | null | undefined,
): LeituraQuestionario {
  const doc = s?.doc ?? "DRPS/Questionário";
  const quando = s?.data ? dataBR(s.data) : "";
  if (!precisa) {
    const detalhe =
      s?.fase === "concluido" ? `${doc} concluído${quando ? ` em ${quando}` : ""}` : s?.fase === "andamento" ? `${doc} em andamento` : null;
    return { rotulo: "Não", detalhe, tom: "neutro", pendente: false };
  }
  if (!s?.fase) return { rotulo: "Necessário", detalhe: "Nenhum DRPS/Questionário feito", tom: "perigo", pendente: true };
  if (s.fase === "andamento") {
    return { rotulo: "Necessário", detalhe: `${doc} em andamento${quando ? ` desde ${quando}` : ""}`, tom: "info", pendente: true };
  }
  const dia = (x: string | null | undefined) => (x ?? "").slice(0, 10);
  if (s.data && dataAep && dia(s.data) < dia(dataAep)) {
    return {
      rotulo: "Revisão recomendada",
      detalhe: `${doc} concluído em ${quando}, antes da AEP de ${dataBR(dataAep)}`,
      tom: "alerta",
      pendente: true,
    };
  }
  return { rotulo: "Atendido", detalhe: `${doc} concluído${quando ? ` em ${quando}` : ""}`, tom: "ok", pendente: false };
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
