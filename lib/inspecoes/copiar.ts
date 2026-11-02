/**
 * Cópia de uma inspeção para outra (outra empresa, ou revisão na mesma).
 *
 * POR QUE EXISTE. A Nova Inspeção (Cópia de outra empresa / Revisão) e o botão
 * "Copiar para outra empresa" tinham, cada um, a sua lista de colunas escrita à
 * mão — e só de setores, cargos, riscos, EPIs, responsáveis e fotos. Toda coluna
 * nova (fotos do EPI, situação do extintor…) e toda aba nova (Treinamentos,
 * Complementos, PAE, Extintores, Máquinas) ficava de fora da cópia sem ninguém
 * perceber. Queixa de 22/10: "não está puxando todas as informações".
 *
 * COMO. Cada linha é copiada INTEIRA (`...linha`) e só se troca o que amarra a
 * linha à inspeção de origem: o próprio id, `id_inspecao`, `id_empresa` e os ids
 * de setor/cargo/risco/treinamento/contato, que passam pelos mapas antigo → novo.
 * Assim coluna nova entra na cópia sozinha.
 *
 * Vínculo com algo que NÃO foi copiado vira `null` (ou a linha de ligação some):
 * apontar para o setor da inspeção de origem misturaria as duas inspeções.
 *
 * Ergonomia (AEP/AET) é laudo do módulo, só ligado à inspeção: a cópia dele mora
 * em lib/inspecoes/copiar-ergonomia.ts (opção `ergonomia`, ignorada aqui).
 *
 * `montarCopia` é pura (testada em copiar.test.ts); `gravarCopia` só insere.
 */

export interface OpcoesCopia {
  setores: boolean;
  cargos: boolean;
  riscos: boolean;
  epis: boolean;
  treinamentos: boolean;
  complementos: boolean;
  pae: boolean;
  extintores: boolean;
  maquinas: boolean;
  ergonomia: boolean;
  responsaveis: boolean;
  fotos: boolean;
}

export const OPCOES_COPIA_PADRAO: OpcoesCopia = {
  setores: true,
  cargos: true,
  riscos: true,
  epis: true,
  treinamentos: true,
  complementos: true,
  pae: true,
  extintores: true,
  maquinas: true,
  ergonomia: true,
  responsaveis: false,
  fotos: false,
};

/** Rótulos e dependências, na ordem em que aparecem nas telas. */
export const ITENS_COPIA: { chave: keyof OpcoesCopia; rotulo: string; precisa?: keyof OpcoesCopia }[] = [
  { chave: "setores", rotulo: "Setores" },
  { chave: "cargos", rotulo: "Cargos", precisa: "setores" },
  { chave: "riscos", rotulo: "Riscos" },
  { chave: "epis", rotulo: "EPIs/EPCs", precisa: "riscos" },
  { chave: "treinamentos", rotulo: "Treinamentos" },
  { chave: "complementos", rotulo: "Complementos" },
  { chave: "pae", rotulo: "PAE (contatos)" },
  { chave: "extintores", rotulo: "Extintores" },
  { chave: "maquinas", rotulo: "Máquinas" },
  { chave: "ergonomia", rotulo: "Ergonomia (AEP/AET)" },
  { chave: "responsaveis", rotulo: "Responsáveis" },
  { chave: "fotos", rotulo: "Fotos" },
];

type Linha = Record<string, unknown>;

/** O que a cópia lê da inspeção de origem (o formato do `useInspecao`). */
export interface OrigemCopia {
  setores: readonly object[];
  cargos: readonly object[];
  riscos: readonly object[];
  epis: readonly object[];
  fotos: readonly object[];
  responsaveis: readonly object[];
  complementos: readonly object[];
  paeContatos: readonly object[];
  treinamentos: readonly object[];
  treinamentosSetor: readonly object[];
  treinamentosCargo: readonly object[];
  treinamentosRisco: readonly object[];
  extintores: readonly object[];
  maquinas: readonly object[];
}

export interface ParametrosCopia {
  idInspecao: string;
  idEmpresa: string;
  opcoes: OpcoesCopia;
  usuarioEmail: string | null;
  agora: string;
  gerarId: (prefixo: string) => string;
  gerarUuid: () => string;
}

/** Tabelas na ordem de inserção (pais antes dos filhos). */
export interface LinhasCopia {
  setores: Linha[];
  cargos: Linha[];
  riscos: Linha[];
  epi_epc: Linha[];
  treinamentos_nr: Linha[];
  treinamentos_setor: Linha[];
  treinamentos_cargo: Linha[];
  treinamentos_risco: Linha[];
  complementos: Linha[];
  pae_contatos: Linha[];
  extintores: Linha[];
  inspecao_maquinas: Linha[];
  inspecao_maquinas_setores: Linha[];
  responsaveis: Linha[];
  fotos: Linha[];
}

export function montarCopia(origem: OrigemCopia, p: ParametrosCopia): LinhasCopia {
  const o = p.opcoes;
  const copiaCargos = o.cargos && o.setores;
  const copiaEpis = o.epis && o.riscos;

  const mapaSetor = new Map<string, string>();
  const mapaCargo = new Map<string, string>();
  const mapaRisco = new Map<string, string>();
  const mapaTreina = new Map<string, string>();
  const mapaContato = new Map<string, string>();
  const mapaMaquina = new Map<string, string>();

  const linhas = (xs: readonly object[]) => xs as readonly Linha[];
  const via = (mapa: Map<string, string>, id: unknown) =>
    typeof id === "string" ? mapa.get(id) ?? null : null;

  /** Linha inteira, com o novo dono e as datas de criação renovadas. */
  const base = (l: Linha): Linha => {
    const nova: Linha = { ...l, id_inspecao: p.idInspecao, id_empresa: p.idEmpresa };
    if ("created_at" in l) nova.created_at = p.agora;
    if ("updated_at" in l) nova.updated_at = p.agora;
    return nova;
  };

  // Gera todos os ids antes, para os vínculos resolverem em qualquer ordem
  // (ex.: contato do PAE cujo pai vem depois na lista).
  if (o.setores) for (const s of linhas(origem.setores)) mapaSetor.set(s.id_setor as string, p.gerarId("SET"));
  if (copiaCargos) for (const c of linhas(origem.cargos)) mapaCargo.set(c.id_cargo as string, p.gerarId("CGO"));
  if (o.riscos) for (const r of linhas(origem.riscos)) mapaRisco.set(r.id_risco as string, p.gerarId("RSC"));
  if (o.treinamentos) for (const t of linhas(origem.treinamentos)) mapaTreina.set(t.id_treinamento as string, p.gerarId("TRE"));
  if (o.pae) for (const c of linhas(origem.paeContatos)) mapaContato.set(c.id_contato as string, p.gerarId("PAE"));
  if (o.maquinas) for (const m of linhas(origem.maquinas)) mapaMaquina.set(m.id_maquina_inspecao as string, p.gerarUuid());

  const setores = o.setores
    ? linhas(origem.setores).map((s) => ({ ...base(s), id_setor: mapaSetor.get(s.id_setor as string) }))
    : [];

  // cargos.id_setor é obrigatório: cargo cujo setor não veio fica de fora.
  const cargos = copiaCargos
    ? linhas(origem.cargos)
        .filter((c) => mapaSetor.has(c.id_setor as string))
        .map((c) => ({
          ...base(c),
          id_cargo: mapaCargo.get(c.id_cargo as string),
          id_setor: mapaSetor.get(c.id_setor as string),
        }))
    : [];

  const riscos = o.riscos
    ? linhas(origem.riscos).map((r) => ({
        ...base(r),
        id_risco: mapaRisco.get(r.id_risco as string),
        id_setor: via(mapaSetor, r.id_setor),
        id_cargo: via(mapaCargo, r.id_cargo),
      }))
    : [];

  // epi_epc.id_risco é obrigatório: EPI cujo risco não veio fica de fora.
  const epi_epc = copiaEpis
    ? linhas(origem.epis)
        .filter((e) => mapaRisco.has(e.id_risco as string))
        .map((e) => ({
          ...base(e),
          id_protecao: p.gerarId("EPI"),
          id_risco: mapaRisco.get(e.id_risco as string),
          id_setor: via(mapaSetor, e.id_setor),
        }))
    : [];

  const treinamentos_nr = o.treinamentos
    ? linhas(origem.treinamentos).map((t) => ({
        ...base(t),
        id_treinamento: mapaTreina.get(t.id_treinamento as string),
      }))
    : [];

  /** Linha de ligação M:N: só entra se as duas pontas foram copiadas. */
  const ligacao = (
    xs: readonly object[],
    campo: string,
    mapa: Map<string, string>,
  ): Linha[] =>
    o.treinamentos
      ? linhas(xs)
          .filter((l) => mapaTreina.has(l.id_treinamento as string) && mapa.has(l[campo] as string))
          .map((l) => ({
            ...l,
            id_treinamento: mapaTreina.get(l.id_treinamento as string),
            [campo]: mapa.get(l[campo] as string),
          }))
      : [];

  const complementos = o.complementos
    ? linhas(origem.complementos).map((c) => ({
        ...base(c),
        id_complemento: p.gerarId("CMP"),
        id_setor: via(mapaSetor, c.id_setor),
      }))
    : [];

  const pae_contatos = o.pae
    ? linhas(origem.paeContatos).map((c) => ({
        ...base(c),
        id_contato: mapaContato.get(c.id_contato as string),
        id_parent: via(mapaContato, c.id_parent),
      }))
    : [];

  const extintores = o.extintores
    ? linhas(origem.extintores).map((e) => ({
        ...base(e),
        id_extintor: p.gerarId("EXT"),
        id_setor: via(mapaSetor, e.id_setor),
      }))
    : [];

  const inspecao_maquinas: Linha[] = [];
  const inspecao_maquinas_setores: Linha[] = [];
  if (o.maquinas) {
    for (const m of linhas(origem.maquinas)) {
      // `ids_setores` é o embed achatado pelo useInspecao, não uma coluna.
      const { ids_setores, ...resto } = m;
      const novoId = mapaMaquina.get(m.id_maquina_inspecao as string)!;
      inspecao_maquinas.push({
        ...base(resto),
        id_maquina_inspecao: novoId,
        id_setor: via(mapaSetor, m.id_setor),
      });
      for (const idSetor of Array.isArray(ids_setores) ? ids_setores : []) {
        const novoSetor = via(mapaSetor, idSetor);
        if (novoSetor) inspecao_maquinas_setores.push({ id_maquina_inspecao: novoId, id_setor: novoSetor });
      }
    }
  }

  const responsaveis = o.responsaveis
    ? linhas(origem.responsaveis).map((r) => ({
        ...base(r),
        id_responsavel: p.gerarId("RSP"),
      }))
    : [];

  // Fotos: clona o registro apontando para o MESMO arquivo (URL pública compartilhada).
  const fotos = o.fotos
    ? linhas(origem.fotos).map((f) => ({
        ...base(f),
        id_foto: p.gerarId("FOTO"),
        id_setor: via(mapaSetor, f.id_setor),
        data_upload: p.agora,
        usuario: p.usuarioEmail,
      }))
    : [];

  return {
    setores,
    cargos,
    riscos,
    epi_epc,
    treinamentos_nr,
    treinamentos_setor: ligacao(origem.treinamentosSetor, "id_setor", mapaSetor),
    treinamentos_cargo: ligacao(origem.treinamentosCargo, "id_cargo", mapaCargo),
    treinamentos_risco: ligacao(origem.treinamentosRisco, "id_risco", mapaRisco),
    complementos,
    pae_contatos,
    extintores,
    inspecao_maquinas,
    inspecao_maquinas_setores,
    responsaveis,
    fotos,
  };
}

/** Grava as linhas na ordem de `LinhasCopia` (pais antes dos filhos). */
export async function gravarCopia(
  supabase: { from: (tabela: string) => { insert: (linhas: never) => PromiseLike<{ error: unknown }> } },
  linhas: LinhasCopia,
): Promise<void> {
  for (const [tabela, xs] of Object.entries(linhas) as [string, Linha[]][]) {
    if (xs.length === 0) continue;
    const { error } = await supabase.from(tabela).insert(xs as never);
    if (error) throw error;
  }
}
