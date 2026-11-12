// Botão "Minhas" do quadro (12/11/2026): as tarefas que criei, em que estou alocado(a) e que sigo. Pedido do usuário:
// "quando clicar no minhas apareça as tarefas que eu crie, as tarefas que me alocaram e as tarefas que estou seguindo".
// Antes só valia o NOME no campo responsável — e a importação do Runrun grava como responsável só o 1º alocado (os
// outros alocados e quem criou viram seguidores), então a Emilia não achava 7 tarefas dela em Teresópolis.

import { temResponsavel } from "@/lib/gestao/responsaveis";

export interface CtxMinhas {
  /** Meu e-mail, em minúsculas. */
  email: string | null;
  nome: string | null;
  /** Vínculos da tarefa (responsável e seguidor), por e-mail. */
  vinculadosDe: (idTarefa: string) => readonly { usuario_email: string }[];
  /** Chave de quem criou (`criadorDe`): `e:<email>` quando se sabe o e-mail. */
  chaveCriador: (t: MinhaCandidata) => string | null;
  /** Por subtarefa aberta em que estou alocado(a) — responsável ou alocado do Runrun: a tarefa-mãe e a janela da
   *  subtarefa, quando já foi aberta. */
  tarefasPorSubtarefa: ReadonlySet<string>;
  /** As próprias subtarefas abertas (id de gestao_subtarefas), para o "Mostrar: subtarefas". */
  subtarefasMinhas: ReadonlySet<string>;
}

export interface MinhaCandidata {
  id_tarefa: string;
  responsavel: string | null;
  created_by: string | null;
  origem?: Record<string, unknown> | null;
  sub_linha?: string | null;
}

/** A tarefa é "minha": criei, sou responsável, sigo ou estou alocado(a) numa subtarefa aberta dela. */
export function ehMinha(t: MinhaCandidata, c: CtxMinhas): boolean {
  if (temResponsavel(t.responsavel, c.nome)) return true;
  const eu = (c.email ?? "").trim().toLowerCase();
  if (!eu) return false;
  // Linha de subtarefa do "Mostrar": herda criador e vínculos da mãe, então vale só a própria subtarefa.
  if (t.sub_linha) return c.subtarefasMinhas.has(t.sub_linha);
  if (c.vinculadosDe(t.id_tarefa).some((v) => v.usuario_email.toLowerCase() === eu)) return true;
  if (c.chaveCriador(t) === `e:${eu}`) return true;
  return c.tarefasPorSubtarefa.has(t.id_tarefa);
}
