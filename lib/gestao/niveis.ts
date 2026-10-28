// Níveis de acesso da Gestão (v304) — dois eixos que antes estavam misturados num rótulo só:
//   o que a pessoa VÊ   → só as tarefas em que está (vinculada/criou) ou todas do quadro
//   o que a pessoa FAZ  → ver, comentar ou editar
// Espelho de gestao_nivel_ord / gestao_nivel_ve_todas no banco. Antes da v304, "Visualizador
// total" era o `full` — que EDITA tudo — e "Pode editar" via menos que ele.

export type GestaoNivel = "view" | "comment" | "edit" | "full" | "view_all" | "comment_all";
export type AlcanceNivel = "proprias" | "todas";
export type AcaoNivel = "ver" | "comentar" | "editar";

const TABELA: Record<GestaoNivel, { alcance: AlcanceNivel; acao: AcaoNivel }> = {
  view: { alcance: "proprias", acao: "ver" },
  comment: { alcance: "proprias", acao: "comentar" },
  edit: { alcance: "proprias", acao: "editar" },
  view_all: { alcance: "todas", acao: "ver" },
  comment_all: { alcance: "todas", acao: "comentar" },
  full: { alcance: "todas", acao: "editar" },
};

export const ROTULO_ALCANCE: Record<AlcanceNivel, string> = {
  todas: "Vê todas as tarefas do quadro",
  proprias: "Vê só as tarefas em que está",
};
const ROTULO_ACAO: Record<AcaoNivel, string> = { ver: "só ver", comentar: "ver e comentar", editar: "ver e editar" };

/** Os 6 níveis na ordem da tela: primeiro quem vê todas, do menor ao maior poder. */
export const NIVEIS_ORDENADOS: GestaoNivel[] = ["view_all", "comment_all", "full", "view", "comment", "edit"];

export function eixosDoNivel(n: GestaoNivel) {
  return TABELA[n];
}

export function nivelDosEixos(alcance: AlcanceNivel, acao: AcaoNivel): GestaoNivel {
  return (Object.keys(TABELA) as GestaoNivel[]).find((n) => TABELA[n].alcance === alcance && TABELA[n].acao === acao)!;
}

/** "Todas as tarefas · ver e editar" — o texto curto das linhas de acesso. */
export function rotuloNivel(n: GestaoNivel): string {
  const e = TABELA[n];
  if (!e) return n;
  return `${e.alcance === "todas" ? "Todas as tarefas" : "Só as próprias"} · ${ROTULO_ACAO[e.acao]}`;
}

export function nivelVeTodas(n: GestaoNivel | null | undefined): boolean {
  return !!n && TABELA[n]?.alcance === "todas";
}
export function nivelPodeVer(n: GestaoNivel | null | undefined): boolean {
  return !!n && n in TABELA;
}
export function nivelPodeComentar(n: GestaoNivel | null | undefined): boolean {
  return !!n && (TABELA[n]?.acao === "comentar" || TABELA[n]?.acao === "editar");
}
export function nivelPodeEditar(n: GestaoNivel | null | undefined): boolean {
  return !!n && TABELA[n]?.acao === "editar";
}
