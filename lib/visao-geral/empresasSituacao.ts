/**
 * Painel de empresas da Visão geral (Etapa 5 do docs/plano-skin-viva-jcn.md) — no lugar do mapa,
 * que fica para quando houver mais empresas (decisão do João, 03/11/2026: hoje são 2, na mesma
 * cidade, e o cadastro não tem coordenadas).
 *
 * A situação de cada empresa é a do PIOR documento dela com validade:
 *   vencido  → algum documento com validade passada;
 *   atencao  → algum vence em até 60 dias (a mesma janela do anel "Saúde dos documentos");
 *   em_dia   → todos com validade em dia;
 *   sem_doc  → nenhum documento com validade informada.
 * As empresas vêm agrupadas por cidade (município/UF), as em pior situação primeiro.
 * Testado em empresasSituacao.test.ts.
 */

export type SituacaoEmpresa = "vencido" | "atencao" | "em_dia" | "sem_doc";

export interface EmpresaBase {
  id_empresa: string;
  nome_empresa: string;
  municipio?: string | null;
  uf?: string | null;
}

export interface DocValidade {
  idEmpresa?: string | null;
  data_validade: string | null;
}

export interface EmpresaSituacao {
  id: string;
  nome: string;
  situacao: SituacaoEmpresa;
  vencidos: number;
  aVencer: number;
}

export interface GrupoCidade {
  cidade: string;
  empresas: EmpresaSituacao[];
}

export const DIAS_ATENCAO = 60;

const ORDEM: Record<SituacaoEmpresa, number> = { vencido: 0, atencao: 1, em_dia: 2, sem_doc: 3 };

function dias(dataISO: string, hojeISO: string): number {
  return Math.round((Date.parse(`${dataISO.slice(0, 10)}T00:00:00Z`) - Date.parse(`${hojeISO.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

export function situacaoDasEmpresas(
  empresas: readonly EmpresaBase[],
  docs: readonly DocValidade[],
  hojeISO: string,
): GrupoCidade[] {
  const conta = new Map<string, { vencidos: number; aVencer: number; emDia: number }>();
  for (const d of docs) {
    if (!d.idEmpresa || !d.data_validade) continue;
    const c = conta.get(d.idEmpresa) ?? { vencidos: 0, aVencer: 0, emDia: 0 };
    const n = dias(d.data_validade, hojeISO);
    if (n < 0) c.vencidos++;
    else if (n <= DIAS_ATENCAO) c.aVencer++;
    else c.emDia++;
    conta.set(d.idEmpresa, c);
  }

  const grupos = new Map<string, EmpresaSituacao[]>();
  for (const e of empresas) {
    const c = conta.get(e.id_empresa);
    const situacao: SituacaoEmpresa = !c
      ? "sem_doc"
      : c.vencidos > 0
        ? "vencido"
        : c.aVencer > 0
          ? "atencao"
          : "em_dia";
    const cidade = [e.municipio?.trim(), e.uf?.trim()].filter(Boolean).join("/") || "Sem cidade informada";
    const lista = grupos.get(cidade) ?? [];
    lista.push({ id: e.id_empresa, nome: e.nome_empresa, situacao, vencidos: c?.vencidos ?? 0, aVencer: c?.aVencer ?? 0 });
    grupos.set(cidade, lista);
  }

  const pior = (l: EmpresaSituacao[]) => Math.min(...l.map((x) => ORDEM[x.situacao]));
  return [...grupos.entries()]
    .map(([cidade, lista]) => ({
      cidade,
      empresas: lista.sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR")),
    }))
    .sort((a, b) => pior(a.empresas) - pior(b.empresas) || b.empresas.length - a.empresas.length || a.cidade.localeCompare(b.cidade, "pt-BR"));
}
