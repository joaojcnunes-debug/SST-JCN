/**
 * "Ordenar por" de cada coluna do quadro (menu "…" da coluna, como no Runrun). Preferência de quem
 * olha (localStorage, por quadro), não do quadro: cada pessoa ordena do seu jeito sem mexer na ordem
 * dos outros. "manual" = a ordem do quadro (arrastar), que continua sendo a padrão.
 * Cliente, Projeto e Tipo existem nas tarefas que vieram do Runrun (origem.client/project/tipo,
 * mantidos pela sincronização); na tarefa criada na Gestão o Tipo cai na prioridade.
 * Valor vazio vai sempre para o fim, nos dois sentidos. Sem I/O, testável offline.
 */

export type CampoOrdem = "manual" | "inicio" | "entrega" | "criada" | "cliente" | "projeto" | "tipo" | "titulo";
export interface OrdemColuna { campo: CampoOrdem; dir: "asc" | "desc" }

export const OPCOES_ORDEM: { campo: Exclude<CampoOrdem, "manual">; label: string }[] = [
  { campo: "inicio", label: "Início desejado" },
  { campo: "entrega", label: "Entrega desejada" },
  { campo: "criada", label: "Criada em" },
  { campo: "cliente", label: "Cliente" },
  { campo: "projeto", label: "Projeto" },
  { campo: "tipo", label: "Tipo" },
  { campo: "titulo", label: "Título" },
];

/** O mínimo da tarefa que a ordenação lê (GestaoTarefa satisfaz). */
export interface TarefaOrdenavel {
  titulo: string;
  prazo: string | null;
  data_inicio: string | null;
  created_at: string;
  prioridade?: string | null;
  origem?: Record<string, unknown> | null;
}

const ROTULO_PRIORIDADE: Record<string, string> = { Baixa: "Baixa", Media: "Média", Alta: "Alta", Urgente: "Urgente" };
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Valor de ordenação da tarefa no campo ("" = vazio, vai para o fim). */
export function valorOrdem(t: TarefaOrdenavel, campo: CampoOrdem): string {
  switch (campo) {
    case "inicio": return t.data_inicio ?? "";
    case "entrega": return t.prazo ?? "";
    case "criada": return t.created_at ?? "";
    case "cliente": return texto(t.origem?.client);
    case "projeto": return texto(t.origem?.project);
    case "tipo": return texto(t.origem?.tipo) || texto(t.origem?.type) || ROTULO_PRIORIDADE[t.prioridade ?? ""] || "";
    case "titulo": return texto(t.titulo);
    default: return "";
  }
}

const colar = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Nova lista ordenada (estável: empate mantém a ordem do quadro). "manual" devolve como veio. */
export function ordenarTarefas<T extends TarefaOrdenavel>(lista: T[], ordem: OrdemColuna | null | undefined): T[] {
  if (!ordem || ordem.campo === "manual") return lista;
  const sinal = ordem.dir === "desc" ? -1 : 1;
  return lista
    .map((t, i) => ({ t, i, v: valorOrdem(t, ordem.campo) }))
    .sort((a, b) => {
      if (!a.v !== !b.v) return a.v ? -1 : 1;           // vazio sempre no fim
      const c = a.v && b.v ? colar.compare(a.v, b.v) * sinal : 0;
      return c || a.i - b.i;
    })
    .map((x) => x.t);
}

/** Clicar de novo no campo já escolhido inverte o sentido; outro campo começa crescente. */
export function proximaOrdem(atual: OrdemColuna | null | undefined, campo: CampoOrdem): OrdemColuna | null {
  if (campo === "manual") return null;
  if (atual?.campo === campo) return { campo, dir: atual.dir === "asc" ? "desc" : "asc" };
  return { campo, dir: "asc" };
}

/** O campo tem valor em alguma tarefa? (Cliente/Projeto só aparecem no menu quando o quadro usa.) */
export function campoTemValor(lista: TarefaOrdenavel[], campo: CampoOrdem): boolean {
  return lista.some((t) => valorOrdem(t, campo) !== "");
}
