// Membros e acessos da Gestão (v305) — regras puras da tela: a árvore Espaço › Pasta › Lista
// em que se dá acesso, as regras agrupadas por recurso, a origem que manda no acesso efetivo e o
// plano de "copiar acessos de outra pessoa". Sem banco: as abas chamam com o que já carregaram.

import type { GestaoNivel } from "./niveis";

export type TipoRecurso = "space" | "folder" | "list";

export interface EspacoArv { id: string; nome: string; ordem?: number }
export interface PastaArv { id: string; id_espaco: string; nome: string; ordem?: number }
export interface ListaArv { id_quadro: string; nome: string; id_espaco: string | null; id_pasta: string | null; dono_email?: string | null }

export interface NoLista { tipo: "list"; id: string; nome: string }
export interface NoPasta { tipo: "folder"; id: string; nome: string; listas: NoLista[] }
export interface NoEspaco { tipo: "space"; id: string; nome: string; pastas: NoPasta[]; listas: NoLista[] }

/** "list:QDR-…" — a chave de um recurso nas seleções. */
export const chaveRecurso = (tipo: TipoRecurso, id: string) => `${tipo}:${id}`;
export function lerChave(chave: string): { tipo: TipoRecurso; id: string } {
  const i = chave.indexOf(":");
  return { tipo: chave.slice(0, i) as TipoRecurso, id: chave.slice(i + 1) };
}

const SEM_ESPACO = "__sem_espaco__";

/**
 * Árvore para dar acesso. Quadro pessoal (Meu Quadro, `dono_email`) fica de fora: o acesso dele
 * é do dono e do supervisor, nunca por grant. Lista sem espaço vai para um grupo "Sem espaço"
 * (que não é um recurso: lá só as listas são marcáveis).
 */
export function montarArvore(espacos: EspacoArv[], pastas: PastaArv[], listas: ListaArv[]): NoEspaco[] {
  const porOrdem = <T extends { nome: string; ordem?: number }>(a: T, b: T) =>
    (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt-BR");
  const validas = listas.filter((l) => !l.dono_email);
  const arv: NoEspaco[] = [...espacos].sort(porOrdem).map((e) => ({
    tipo: "space",
    id: e.id,
    nome: e.nome,
    pastas: pastas
      .filter((p) => p.id_espaco === e.id)
      .sort(porOrdem)
      .map((p) => ({
        tipo: "folder" as const,
        id: p.id,
        nome: p.nome,
        listas: validas.filter((l) => l.id_pasta === p.id).map((l) => ({ tipo: "list" as const, id: l.id_quadro, nome: l.nome })),
      })),
    listas: validas
      .filter((l) => l.id_espaco === e.id && !l.id_pasta)
      .map((l) => ({ tipo: "list" as const, id: l.id_quadro, nome: l.nome })),
  }));
  const ids = new Set(espacos.map((e) => e.id));
  const soltas = validas.filter((l) => !l.id_espaco || !ids.has(l.id_espaco));
  if (soltas.length) {
    arv.push({ tipo: "space", id: SEM_ESPACO, nome: "Sem espaço", pastas: [], listas: soltas.map((l) => ({ tipo: "list", id: l.id_quadro, nome: l.nome })) });
  }
  return arv;
}

export const ehGrupoSemEspaco = (e: NoEspaco) => e.id === SEM_ESPACO;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Filtra a árvore pela busca: um nó que casa mantém tudo abaixo dele; senão, só os filhos que casam. */
export function filtrarArvore(arv: NoEspaco[], busca: string): NoEspaco[] {
  const q = norm(busca);
  if (!q) return arv;
  const casa = (nome: string) => norm(nome).includes(q);
  return arv.flatMap((e) => {
    if (casa(e.nome)) return [e];
    const pastas = e.pastas.flatMap((p) => (casa(p.nome) ? [p] : p.listas.some((l) => casa(l.nome)) ? [{ ...p, listas: p.listas.filter((l) => casa(l.nome)) }] : []));
    const listas = e.listas.filter((l) => casa(l.nome));
    return pastas.length || listas.length ? [{ ...e, pastas, listas }] : [];
  });
}

/** Nome e caminho de cada recurso ("Unidades › Serra › Teresópolis"), para as regras e o histórico. */
export function indiceRecursos(arv: NoEspaco[]): Map<string, { nome: string; caminho: string; tipo: TipoRecurso }> {
  const m = new Map<string, { nome: string; caminho: string; tipo: TipoRecurso }>();
  for (const e of arv) {
    const semEsp = ehGrupoSemEspaco(e);
    if (!semEsp) m.set(chaveRecurso("space", e.id), { nome: e.nome, caminho: e.nome, tipo: "space" });
    for (const p of e.pastas) {
      m.set(chaveRecurso("folder", p.id), { nome: p.nome, caminho: `${e.nome} › ${p.nome}`, tipo: "folder" });
      for (const l of p.listas) m.set(chaveRecurso("list", l.id), { nome: l.nome, caminho: `${e.nome} › ${p.nome} › ${l.nome}`, tipo: "list" });
    }
    for (const l of e.listas) m.set(chaveRecurso("list", l.id), { nome: l.nome, caminho: semEsp ? l.nome : `${e.nome} › ${l.nome}`, tipo: "list" });
  }
  return m;
}

export const ROTULO_TIPO: Record<TipoRecurso, string> = { space: "Espaço", folder: "Pasta", list: "Lista" };

// ── Acesso efetivo (RPC gestao_acessos_efetivos) ─────────────────────────────────

export interface OrigemAcesso {
  tipo: "gestor" | "direto" | "equipe";
  equipe?: string | null;
  recurso?: TipoRecurso;
  nome_recurso?: string | null;
  nivel?: GestaoNivel;
  restritivo?: boolean;
}

const ESPEC: Record<TipoRecurso, number> = { list: 3, folder: 2, space: 1 };

/**
 * Marca qual origem MANDA no nível efetivo, como o banco decide (gestao_resolver_nivel): vale a
 * especificidade mais alta (lista > pasta > espaço) e, nela, os grants somam; as de especificidade
 * menor ficam "sem efeito". Restritivo é teto e sempre conta.
 */
export function origensComEfeito(origens: OrigemAcesso[]): Array<OrigemAcesso & { efeito: "vale" | "teto" | "sem_efeito" }> {
  const normais = origens.filter((o) => o.tipo !== "gestor" && !o.restritivo && o.recurso);
  const maior = normais.reduce((m, o) => Math.max(m, ESPEC[o.recurso!]), 0);
  return origens.map((o) => ({
    ...o,
    efeito: o.tipo === "gestor" ? "vale" : o.restritivo ? "teto" : o.recurso && ESPEC[o.recurso] === maior ? "vale" : "sem_efeito",
  }));
}

/** "Direto na pasta Serra", "Equipe Técnicos · no espaço Unidades", "Administrador". */
export function descreverOrigem(o: OrigemAcesso): string {
  if (o.tipo === "gestor") return "Administrador (vê tudo)";
  const onde = o.recurso ? `${o.recurso === "list" ? "na lista" : o.recurso === "folder" ? "na pasta" : "no espaço"} ${o.nome_recurso ?? ""}`.trim() : "";
  return o.tipo === "equipe" ? `Equipe ${o.equipe ?? "?"} · ${onde}` : `Direto ${onde}`;
}

// ── Copiar acessos de outra pessoa ───────────────────────────────────────────────

export interface GrantPessoa { usuario_email: string | null; recurso_tipo: TipoRecurso | "task"; recurso_id: string; nivel: GestaoNivel; restritivo?: boolean | null; id_equipe?: string | null }
export interface PassoCopia { alvo: string; tipo: TipoRecurso; id: string; nivel: GestaoNivel }

/**
 * O que gravar para dar às pessoas `alvos` os mesmos acessos DIRETOS de `origem` (espaço, pasta e
 * lista; restritivo e grant de tarefa não são copiados). Pula o que o alvo já tem igual e a própria
 * origem. Equipes não entram aqui: a tela oferece pôr nas mesmas equipes à parte.
 */
export function planoCopia(origem: string, alvos: string[], grants: GrantPessoa[]): PassoCopia[] {
  const o = origem.toLowerCase();
  const daOrigem = grants.filter(
    (g) => !g.id_equipe && !g.restritivo && g.usuario_email?.toLowerCase() === o && g.recurso_tipo !== "task",
  );
  const tem = new Set(
    grants.filter((g) => !g.id_equipe && g.usuario_email).map((g) => `${g.usuario_email!.toLowerCase()}|${g.recurso_tipo}|${g.recurso_id}|${g.nivel}`),
  );
  const passos: PassoCopia[] = [];
  for (const alvo of alvos) {
    const a = alvo.toLowerCase();
    if (a === o) continue;
    for (const g of daOrigem) {
      if (tem.has(`${a}|${g.recurso_tipo}|${g.recurso_id}|${g.nivel}`)) continue;
      passos.push({ alvo, tipo: g.recurso_tipo as TipoRecurso, id: g.recurso_id, nivel: g.nivel });
    }
  }
  return passos;
}
