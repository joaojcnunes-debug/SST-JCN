// Catálogo de setores e cargos que a empresa JÁ TEM no sistema (2026-10-05),
// para o editor da AEP sugerir: vem dos setores/cargos das inspeções da empresa
// (não deletadas). Nomes repetidos entre inspeções viram um só, sem diferenciar
// maiúsculas, acentos e espaços; os cargos de cada setor são somados.

export interface CargoCatalogo {
  cargo: string;
  descricao: string;
}

export interface SetorCatalogo {
  nome: string;
  descricao: string;
  cargos: CargoCatalogo[];
}

/** "  Produção  " e "PRODUCAO" viram a mesma chave. */
export function chaveNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function montarCatalogoSetores(
  setores: { id_setor: string; setor_ghe: string | null; descricao: string | null }[],
  cargos: { id_setor: string | null; cargo: string | null; descricao: string | null }[],
): SetorCatalogo[] {
  const nomePorId = new Map<string, string>();
  const porChave = new Map<string, SetorCatalogo & { _cargos: Map<string, CargoCatalogo> }>();

  for (const s of setores) {
    const nome = (s.setor_ghe ?? "").replace(/\s+/g, " ").trim();
    const k = chaveNome(nome);
    if (!k) continue;
    nomePorId.set(s.id_setor, k);
    const atual = porChave.get(k);
    if (!atual) {
      porChave.set(k, { nome, descricao: (s.descricao ?? "").trim(), cargos: [], _cargos: new Map() });
    } else if (!atual.descricao && s.descricao?.trim()) {
      atual.descricao = s.descricao.trim();
    }
  }

  for (const c of cargos) {
    const k = c.id_setor ? nomePorId.get(c.id_setor) : undefined;
    const alvo = k ? porChave.get(k) : undefined;
    const cargo = (c.cargo ?? "").replace(/\s+/g, " ").trim();
    if (!alvo || !cargo) continue;
    const kc = chaveNome(cargo);
    const ja = alvo._cargos.get(kc);
    if (!ja) alvo._cargos.set(kc, { cargo, descricao: (c.descricao ?? "").trim() });
    else if (!ja.descricao && c.descricao?.trim()) ja.descricao = c.descricao.trim();
  }

  return [...porChave.values()]
    .map(({ _cargos, ...s }) => ({
      ...s,
      cargos: [..._cargos.values()].sort((a, b) => a.cargo.localeCompare(b.cargo, "pt-BR")),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
