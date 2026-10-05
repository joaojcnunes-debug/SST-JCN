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
}

export function piorNivel(niveis: (string | null | undefined)[]): string | null {
  let pior: string | null = null;
  for (const n of niveis) {
    if (n && (PESO_NIVEL[n] ?? 0) > (PESO_NIVEL[pior ?? ""] ?? 0)) pior = n;
  }
  return pior;
}

/** AEP com a data em que o documento da inspeção foi entregue ao cliente. */
export type AepEntregue = AepRelatorio & { entregue_em?: string | null };

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
    let alvo = porEmpresa.get(id);
    if (!alvo) {
      alvo = {
        idEmpresa: id,
        nome: rel.empresas?.nome_empresa ?? "Empresa sem cadastro",
        cnpj: rel.empresas?.cnpj ?? null,
        avaliacoes: [],
        totalSetores: 0,
        totalAlertas: 0,
        totalAltos: 0,
        pior: null,
        ultimaData: null,
      };
      porEmpresa.set(id, alvo);
    }
    alvo.avaliacoes.push({
      idRelatorio: rel.id_relatorio,
      data: rel.entregue_em ?? rel.data_elaboracao,
      idInspecao: (rel as { id_inspecao?: string | null }).id_inspecao ?? null,
      responsavel: rel.responsavel_elaboracao || null,
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
  }
  // Mais grave primeiro; empate pelo nome.
  return lista.sort(
    (a, b) => (PESO_NIVEL[b.pior ?? ""] ?? 0) - (PESO_NIVEL[a.pior ?? ""] ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
