/**
 * Atalhos de teclado do quadro (item 14 da comparação, v0.3.922 — como no Trello). Com o mouse sobre um cartão:
 * Espaço entra/sai como responsável, D muda o prazo, L as etiquetas, Enter abre. Em qualquer ponto do quadro:
 * N nova tarefa, / busca, ? lista os atalhos. Nada dispara enquanto se digita ou com uma janela aberta.
 * Função pura — testada offline.
 */

export type AcaoAtalho = "me_atribuir" | "prazo" | "etiqueta" | "abrir" | "nova" | "buscar" | "ajuda";

export const ATALHOS: { teclas: string[]; acao: AcaoAtalho; texto: string; noCartao: boolean }[] = [
  { teclas: ["Espaço"], acao: "me_atribuir", texto: "Entrar ou sair como responsável", noCartao: true },
  { teclas: ["D"], acao: "prazo", texto: "Mudar o prazo (término)", noCartao: true },
  { teclas: ["L"], acao: "etiqueta", texto: "Marcar etiquetas", noCartao: true },
  { teclas: ["Enter"], acao: "abrir", texto: "Abrir a tarefa", noCartao: true },
  { teclas: ["N"], acao: "nova", texto: "Nova tarefa", noCartao: false },
  { teclas: ["/"], acao: "buscar", texto: "Buscar tarefa", noCartao: false },
  { teclas: ["?"], acao: "ajuda", texto: "Mostrar os atalhos", noCartao: false },
];

export interface EventoTecla {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  /** Onde o foco está: tag (INPUT, BUTTON…), se é editável e o role. */
  alvo?: { tagName?: string; isContentEditable?: boolean; role?: string | null } | null;
}

const DIGITACAO = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const CLICAVEL = new Set(["BUTTON", "A", "SUMMARY"]);

/** Qual atalho a tecla dispara (null = nenhum: deixa o navegador seguir). */
export function acaoDaTecla(e: EventoTecla, temCartao: boolean): AcaoAtalho | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  const tag = (e.alvo?.tagName ?? "").toUpperCase();
  if (DIGITACAO.has(tag) || e.alvo?.isContentEditable) return null;
  // Espaço/Enter num botão ou link focado é o clique dele — não rouba.
  const clicavel = CLICAVEL.has(tag) || e.alvo?.role === "button" || e.alvo?.role === "menuitem";
  const k = e.key;
  if (k === " " || k === "Spacebar") return temCartao && !clicavel ? "me_atribuir" : null;
  if (k === "Enter") return temCartao && !clicavel ? "abrir" : null;
  const l = k.length === 1 ? k.toLowerCase() : "";
  if (l === "d") return temCartao ? "prazo" : null;
  if (l === "l") return temCartao ? "etiqueta" : null;
  if (l === "n") return "nova";
  if (k === "/") return "buscar";
  if (k === "?") return "ajuda";
  return null;
}
