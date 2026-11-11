// REGRA DA CONTAGEM DE TAREFAS FEITAS (decidida em 11/11/2026):
//   • subtarefa vale o mesmo que uma tarefa — fechar uma subtarefa conta 1 tarefa feita;
//   • a tarefa-mãe também conta quando fecha (mãe com 3 subtarefas, tudo concluído = 4);
//   • o crédito vai para o responsável da SUBTAREFA; sem responsável nela, para o da mãe.
// Vale sempre, independente do filtro "Mostrar" do quadro.

import type { GestaoStatus, GestaoTarefa } from "@/lib/hooks/useGestao";
import { nomesResponsaveis } from "@/lib/gestao/responsaveis";

/** Tarefas + subtarefas que entram na contagem, sem repetir, com o responsável que leva o crédito.
 *  `subtarefas` = saída de montarSubtarefas (linhas e filhas já abertas). */
export function itensDaContagem(tarefas: GestaoTarefa[], subtarefas: GestaoTarefa[]): GestaoTarefa[] {
  const maes = new Map(tarefas.map((t) => [t.id_tarefa, t]));
  const vistos = new Set<string>();
  const out: GestaoTarefa[] = [];
  for (const t of tarefas) {
    if (vistos.has(t.id_tarefa)) continue;
    vistos.add(t.id_tarefa);
    out.push(t);
  }
  for (const s of subtarefas) {
    if (vistos.has(s.id_tarefa)) continue;
    vistos.add(s.id_tarefa);
    const mae = s.id_tarefa_pai ? maes.get(s.id_tarefa_pai) : undefined;
    const temProprio = nomesResponsaveis(s.responsavel).length > 0;
    out.push(temProprio || !mae ? s : { ...s, responsavel: mae.responsavel });
  }
  return out;
}

export interface Contagem {
  total: number;
  concluidas: number;
  /** quantas das concluídas são subtarefas */
  subtarefasConcluidas: number;
  porPessoa: { nome: string; concluidas: number }[];
}

/** Conta os itens já passados por itensDaContagem (e pelos filtros da tela). */
export function contarConcluidas(itens: GestaoTarefa[], statuses: Pick<GestaoStatus, "slug" | "tipo">[]): Contagem {
  const tipo = new Map(statuses.map((s) => [s.slug, s.tipo]));
  const feitos = itens.filter((t) => tipo.get(t.status) === "concluido");
  const m = new Map<string, number>();
  for (const t of feitos) {
    const nomes = nomesResponsaveis(t.responsavel);
    for (const n of nomes.length ? nomes : ["Sem responsável"]) m.set(n, (m.get(n) ?? 0) + 1);
  }
  return {
    total: itens.length,
    concluidas: feitos.length,
    subtarefasConcluidas: feitos.filter((t) => !!t.id_tarefa_pai).length,
    porPessoa: [...m.entries()]
      .map(([nome, concluidas]) => ({ nome, concluidas }))
      .sort((a, b) => b.concluidas - a.concluidas || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}
