/**
 * Regras puras do formulário público da Gestão (F1.5 / GESTAO-KANBAN-03), compartilhadas
 * pela rota /api/gestao/form (servidor) e pelo FormularioPublico (cliente): visibilidade
 * condicional, composição do título e normalização de etiqueta. Sem I/O, testável offline.
 */

export type RespostaForm = string | string[];

export interface PerguntaBase {
  id?: string;
  label: string;
  obrigatorio: boolean;
  tipo?: string;
  opcoes?: string[];
  ajuda?: string;
  condicao?: { pergunta: string; opcao: string } | null;
  pendente_anexo?: boolean;
}

const vazia = (r: RespostaForm | undefined) =>
  Array.isArray(r) ? r.filter((x) => (x ?? "").trim()).length === 0 : !(r ?? "").trim();

/** Índice da pergunta pelo `id` estável (perguntas antigas sem id nunca são origem de condição). */
function indicePorId(perguntas: PerguntaBase[], id: string): number {
  return perguntas.findIndex((p) => p.id === id);
}

/**
 * Uma pergunta condicional só aparece quando a pergunta de origem tem a opção escolhida
 * (seleção única = igual; múltipla = contém). Origem inexistente/oculta → oculta também
 * (a condição não "vaza" por cadeia quebrada). Sem condição → visível.
 */
export function perguntaVisivel(p: PerguntaBase, perguntas: PerguntaBase[], respostas: (RespostaForm | undefined)[], visitados: Set<string> = new Set()): boolean {
  const c = p.condicao;
  if (!c || !c.pergunta) return true;
  // Ciclo (A depende de B que depende de A, ou auto-referência) = oculta, nunca estoura a pilha.
  const chave = p.id ?? `#${perguntas.indexOf(p)}`;
  if (visitados.has(chave)) return false;
  visitados.add(chave);
  const i = indicePorId(perguntas, c.pergunta);
  if (i < 0) return false;
  const origem = perguntas[i];
  if (!perguntaVisivel(origem, perguntas, respostas, visitados)) return false;
  const r = respostas[i];
  if (Array.isArray(r)) return r.includes(c.opcao);
  return (r ?? "") === c.opcao;
}

/** Ids das perguntas que dependem (direta ou transitivamente) de `id` — não podem ser origem dela. */
export function dependentesDe(id: string, perguntas: PerguntaBase[]): Set<string> {
  const out = new Set<string>();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const q of perguntas) {
      const src = q.condicao?.pergunta;
      if (q.id && !out.has(q.id) && src && (src === id || out.has(src))) { out.add(q.id); mudou = true; }
    }
  }
  return out;
}

/** true se alguma pergunta está num ciclo de condição (inclui auto-referência). */
export function temCiclo(perguntas: PerguntaBase[]): boolean {
  return perguntas.some((p) => p.id && dependentesDe(p.id, perguntas).has(p.id));
}

/** Perguntas obrigatórias E visíveis sem resposta (as ocultas não contam). */
export function faltando(perguntas: PerguntaBase[], respostas: (RespostaForm | undefined)[]): PerguntaBase[] {
  return perguntas.filter((p, i) => p.obrigatorio && perguntaVisivel(p, perguntas, respostas) && vazia(respostas[i]));
}

/**
 * Título da tarefa a partir dos tokens ("form_title" | "p:<id>"), como o
 * `task_title_composition_pattern` do Runrun. Partes vazias somem; se nada sobrar, usa o
 * título do formulário. Separador " - " (o que o Runrun mostra na lista).
 */
export function comporTitulo(
  tokens: string[] | null | undefined,
  tituloForm: string,
  perguntas: PerguntaBase[],
  respostas: (RespostaForm | undefined)[],
): string {
  if (!tokens || tokens.length === 0) return "";
  const partes: string[] = [];
  for (const t of tokens) {
    if (t === "form_title") { partes.push(tituloForm.trim()); continue; }
    if (t.startsWith("p:")) {
      const i = indicePorId(perguntas, t.slice(2));
      if (i < 0) continue;
      const r = respostas[i];
      const v = (Array.isArray(r) ? r.join(", ") : (r ?? "")).trim();
      if (v) partes.push(v);
    }
  }
  const s = partes.filter(Boolean).join(" - ").slice(0, 200);
  return s || tituloForm.trim();
}

/**
 * Etiqueta gravada na tarefa a partir da resposta: minúsculas, sem acento, espaços colapsados
 * (mantém o espaço — as automações de roteamento usam "nova friburgo", não "nova-friburgo").
 * "Teresópolis" → "teresopolis"; "Nova Friburgo" → "nova friburgo".
 */
export function normalizarEtiquetaForm(v: string): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ordem de exibição: cada pergunta condicional aparece logo DEPOIS da sua origem (e as que
 * dependem dela, em cadeia), em vez da posição em que foi cadastrada. Devolve índices da
 * lista original; toda pergunta aparece exatamente uma vez (órfãs/ciclos ficam no fim).
 */
export function ordemExibicao(perguntas: PerguntaBase[]): number[] {
  const out: number[] = [];
  const feito = new Set<number>();
  const filhosDe = (id: string | undefined) => (id ? perguntas.map((q, i) => (q.condicao?.pergunta === id ? i : -1)).filter((i) => i >= 0) : []);
  const visita = (i: number) => {
    if (feito.has(i)) return;
    feito.add(i); out.push(i);
    for (const f of filhosDe(perguntas[i].id)) visita(f);
  };
  perguntas.forEach((q, i) => { if (!q.condicao?.pergunta) visita(i); });
  perguntas.forEach((_, i) => visita(i)); // sobras (condição órfã/ciclo)
  return out;
}
