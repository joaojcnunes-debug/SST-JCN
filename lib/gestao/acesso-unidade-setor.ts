// v294 — Gestão: colunas "Unidades" e "Setores" da tela de usuários. FUNÇÕES PURAS.
//
// Setor = quadro sem unidade (Recepção, Enfermagem…). Unidade = uma das 6 da gestao_unidades;
// marcar a unidade também libera o(s) quadro(s) dela (Teresópolis, Petrópolis…).
// Marcar concede nível TOTAL no quadro (é o que deixa ver todas as tarefas — gestao_ve_tarefa);
// desmarcar revoga o grant INDIVIDUAL. Grant de equipe não se mexe por aqui.

export interface QuadroAcesso {
  id_quadro: string;
  nome: string;
  id_unidade: string | null;
  dono_email: string | null;
}

export interface GrantQuadro {
  id_quadro: string;
  usuario_email: string | null;
  id_equipe?: string | null;
}

/** Quadros de setor (sem unidade, não pessoais), por nome. */
export function quadrosDeSetor(quadros: QuadroAcesso[]): QuadroAcesso[] {
  return quadros
    .filter((q) => !q.dono_email && !q.id_unidade)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Quadros que o usuário tem por grant INDIVIDUAL. */
export function quadrosIndividuais(grants: GrantQuadro[], email: string): Set<string> {
  const e = email.trim().toLowerCase();
  return new Set(grants.filter((g) => (g.usuario_email ?? "").toLowerCase() === e).map((g) => g.id_quadro));
}

/** Quadros que o usuário recebe por alguma das equipes. */
export function quadrosViaEquipe(grants: GrantQuadro[], equipes: Set<string>): Set<string> {
  return new Set(grants.filter((g) => g.id_equipe && equipes.has(g.id_equipe)).map((g) => g.id_quadro));
}

/**
 * Unidades marcadas ao abrir: as gravadas no membro; se ainda não tem (null/vazio = sem
 * restrição), as unidades cujos quadros ele já acessa — o que a tela mostra bate com o que vê.
 */
export function unidadesIniciais(
  gravadas: string[] | null | undefined,
  quadros: QuadroAcesso[],
  acessa: Set<string>,
): Set<string> {
  if (gravadas && gravadas.length > 0) return new Set(gravadas);
  const s = new Set<string>();
  for (const q of quadros) if (q.id_unidade && !q.dono_email && acessa.has(q.id_quadro)) s.add(q.id_unidade);
  return s;
}

/** Diferença entre o que estava e o que ficou: quadros a conceder (total) e a revogar. */
export function planoAcessoQuadros(p: {
  quadros: QuadroAcesso[];
  individuais: Set<string>;
  viaEquipe: Set<string>;
  unidadesSel: Set<string>;
  setoresSel: Set<string>;
}): { conceder: string[]; revogar: string[] } {
  const desejados = new Set<string>(p.setoresSel);
  for (const q of p.quadros) if (q.id_unidade && !q.dono_email && p.unidadesSel.has(q.id_unidade)) desejados.add(q.id_quadro);

  const conceder: string[] = [];
  const revogar: string[] = [];
  for (const q of p.quadros) {
    if (q.dono_email) continue; // Meu Quadro não entra
    const quer = desejados.has(q.id_quadro);
    const tem = p.individuais.has(q.id_quadro);
    if (quer && !tem && !p.viaEquipe.has(q.id_quadro)) conceder.push(q.id_quadro);
    if (!quer && tem) revogar.push(q.id_quadro);
  }
  return { conceder, revogar };
}

export function mesmoConjunto(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
