/**
 * Quem trabalhou no DOCUMENTO (SGG) — a régua, num lugar só.
 *
 * ─── O que esta conta NÃO é ────────────────────────────────────────────────
 *
 * Não é produção de campo. Medido em 2026-08-27: as 17 pessoas que aparecem
 * nesta contagem são TODAS do administrativo (Auxiliar/Assistente
 * Administrativo e supervisão). A primeira colocada, com 83, é Auxiliar
 * Administrativo e tem **zero** inspeções a campo e **zero** inspeções abertas
 * por ela no sistema — o que ela faz é elaborar o documento depois da visita.
 *
 * Foi exatamente essa leitura que gerou a queixa: a tela dizia "inspeções" e
 * quem lia entendia ranking de técnico. É o mesmo defeito de 24/08, quando o
 * card somava conclusões sob o título de inspeções. Aqui o número estava
 * certo; errado era o nome dele. Para produção de campo existe
 * `/dashboard/inspecoes-concluidas`, que conta quem foi à visita.
 *
 * ─── As três regras, e o que cada uma conserta ─────────────────────────────
 *
 * 1. **O crédito é de quem está com o documento.** Se alguém pegou, não
 *    concluiu e outra pessoa assumiu, o documento conta para a NOVA — regra
 *    dada pelo Sanmyo em 27/08. Antes contava para as duas, porque a linha em
 *    `inspecao_associados` fica para sempre: ela é histórico de quem passou
 *    pelo documento, não título de propriedade. Hoje isso são 2 documentos
 *    (Emília −1, Gabriel −1); a regra existe para o dia em que forem 200.
 *
 * 2. **Sem ninguém com o documento, o crédito é de quem se associou.** São 6
 *    documentos hoje. Descartá-los apagaria trabalho registrado.
 *
 * 3. **Entregue ≠ assumido.** Os dois continuam contados em separado
 *    (`total` × `entregues`), e a queixa de 27/08 é o motivo: o topo do
 *    ranking aparecia com 95 documentos, dos quais 38 (40%) estavam assumidos
 *    sem entregar.
 *
 *    ⚠️ De 27/08 a 15/09 a TELA desenhava `entregues`. Em 15/09 ele pediu o
 *    contrário: "apenas quantos documentos o usuário foi associado" — e que o
 *    donut do dashboard e a tela de detalhe mostrem O MESMO número. Desde
 *    então as duas desenham `total` (regras 1 e 2 intactas — é por elas que a
 *    Ana Luiza, com 86 linhas de associação preservadas pela v202, NÃO volta
 *    ao ranking) e a ordenação é por `total`. `entregues` segue calculado,
 *    sem consumidor de tela.
 *
 * ─── Por que a conta mora aqui ─────────────────────────────────────────────
 *
 * Porque estava escrita duas vezes e as duas divergiam — a armadilha de
 * `lib/aet/consolidar-psi.ts` outra vez: o donut do dashboard unia as duas
 * fontes e a tela de detalhe usava só `inspecao_associados`, perdendo 109
 * documentos. Não era só um total menor: a ORDEM mudava, e quem abria o
 * detalhe via um pódio diferente do da página anterior.
 */

import {
  situacaoDocumento,
  type ChaveDocumento,
  type LinhaDocumento,
} from "@/lib/inspecoes/documento";

/** Uma linha de `inspecao_associados`. */
export interface AssociacaoDoc {
  id_inspecao: string;
  nome: string | null;
  /** Quando a pessoa entrou no documento. */
  created_at: string | null;
}

/** Só o que a contagem precisa de uma inspeção. */
export interface DocumentoContavel {
  id_inspecao: string;
  status: string;
  /** Quem está com a elaboração AGORA. É ele quem recebe o crédito. */
  elaboracao_responsavel: string | null;
  /** "CONCLUIDO" = entregue ao cliente. O resto é trabalho em aberto. */
  elaboracao_status: string | null;
}

export interface PessoaDocumentos {
  nome: string;
  /** Documentos distintos em que a pessoa trabalhou. */
  total: number;
  /** Documentos ENTREGUES (elaboração concluída). */
  entregues: number;
  /** Assumidos e ainda não entregues (soma dos dois de baixo). */
  emAberto: number;
  /** A pessoa está com ele na mão agora. */
  emElaboracao: number;
  /**
   * Creditado a ela, mas ninguém está com o documento.
   *
   * Até 28/09 era "passou pelo documento sem clicar em Assumir" (6 em 27/08,
   * 75 em 22/09) e ficava fora do "em elaboração" para não parecer trabalho em
   * curso. A decisão dele de 22/09 — quem está no chip conta como tendo
   * assumido — virou regra aqui também: como todo documento creditado tem
   * alguém, este número fica em ZERO por pessoa. Mantido no tipo porque as
   * telas o leem.
   */
  semDono: number;
  /**
   * Quantos dos `total` foram creditados sem linha na tabela de associados.
   *
   * Exposto de propósito: esses documentos não têm data de entrada e por isso
   * somem quando se filtra por mês. Esconder isso faria a soma dos meses não
   * fechar com o total sem explicação nenhuma.
   */
  semAssociacao: number;
}

/** Nomes iguais escritos com caixa diferente são a mesma pessoa. */
function chave(nome: string): string {
  return nome.trim().toLowerCase();
}

/**
 * Entregue, em elaboração ou sem ninguém — pela MESMA regra da lista de
 * inspeções (`situacaoDocumento`). Desde 28/09: quem está no documento conta
 * como tendo assumido, mesmo sem ter clicado em "Assumir". Antes o Dashboard
 * lia só `elaboracao_status` e 75 documentos com gente no chip caíam em "sem
 * dono" aqui enquanto a lista dizia "Em elaboração".
 */
function situacao(d: DocumentoContavel, donos: readonly { nome: string }[]): ChaveDocumento {
  return situacaoDocumento(
    {
      status: d.status,
      elaboracao_status: d.elaboracao_status as LinhaDocumento["elaboracao_status"],
      elaboracao_responsavel: d.elaboracao_responsavel,
      elaboracao_concluida_em: null,
    },
    donos.map((x) => x.nome),
    "longo",
  )!.chave;
}

/** Quem entrou em cada documento, sem repetir pessoa: id → (chave → entrada). */
type EntradasPorDoc = Map<string, Map<string, { nome: string; entrouEm: string | null }>>;

function indexarAssociacoes(associacoes: readonly AssociacaoDoc[]): EntradasPorDoc {
  const porDoc: EntradasPorDoc = new Map();
  for (const a of associacoes) {
    const nome = (a.nome ?? "").trim();
    if (!nome || !a.id_inspecao) continue;
    const doDoc = porDoc.get(a.id_inspecao) ?? new Map();
    const k = chave(nome);
    const atual = doDoc.get(k);
    // A pessoa pode ter mais de uma linha no mesmo documento; vale a PRIMEIRA
    // vez que ela entrou, senão o recorte por mês mudaria a cada reentrada.
    const maisAntiga =
      !atual || (a.created_at && (!atual.entrouEm || a.created_at < atual.entrouEm));
    if (maisAntiga) doDoc.set(k, { nome, entrouEm: a.created_at ?? null });
    porDoc.set(a.id_inspecao, doDoc);
  }
  return porDoc;
}

/** De quem é o documento, e desde quando. Ver regras 1 e 2 no cabeçalho. */
function donosDo(
  d: DocumentoContavel,
  entradas: EntradasPorDoc,
): { nome: string; entrouEm: string | null }[] {
  const doDoc = entradas.get(d.id_inspecao);
  const responsavel = (d.elaboracao_responsavel ?? "").trim();
  if (responsavel) {
    // Quem está com ele agora — sozinho, mesmo que outros tenham passado antes.
    return [{ nome: responsavel, entrouEm: doDoc?.get(chave(responsavel))?.entrouEm ?? null }];
  }
  return doDoc ? [...doDoc.values()] : [];
}

interface OpcoesPorAssociado {
  /**
   * Mês absoluto para recortar. Só quem tem linha de associação tem data de
   * entrada, então o recorte deixa de fora o crédito sem registro — e a tela
   * avisa quantos são.
   */
  mes?: number | null;
  /** Converte o `created_at` da associação em mês absoluto. */
  mesDe: (iso: string) => number;
}

/** Documentos por pessoa. Percorre DOCUMENTOS, para contar cada um uma vez só. */
export function porAssociado(
  associacoes: readonly AssociacaoDoc[],
  documentos: readonly DocumentoContavel[],
  opcoes: OpcoesPorAssociado,
): PessoaDocumentos[] {
  const { mes = null, mesDe } = opcoes;
  const entradas = indexarAssociacoes(associacoes);

  const pessoas = new Map<
    string,
    {
      nome: string;
      docs: Set<string>;
      entregues: Set<string>;
      emElaboracao: Set<string>;
      semAssoc: Set<string>;
    }
  >();

  for (const d of documentos) {
    if (d.status === "DELETADA") continue;
    const donos = donosDo(d, entradas);
    const sit = situacao(d, donos);
    for (const dono of donos) {
      if (mes != null && (!dono.entrouEm || mesDe(dono.entrouEm) !== mes)) continue;

      const k = chave(dono.nome);
      const e =
        pessoas.get(k) ??
        {
          nome: dono.nome,
          docs: new Set<string>(),
          entregues: new Set<string>(),
          emElaboracao: new Set<string>(),
          semAssoc: new Set<string>(),
        };
      e.docs.add(d.id_inspecao);
      if (sit === "ENTREGUE") e.entregues.add(d.id_inspecao);
      else if (sit === "EM_ELABORACAO") e.emElaboracao.add(d.id_inspecao);
      if (!dono.entrouEm) e.semAssoc.add(d.id_inspecao);
      pessoas.set(k, e);
    }
  }

  return [...pessoas.values()]
    .map((e) => ({
      nome: e.nome,
      total: e.docs.size,
      entregues: e.entregues.size,
      emAberto: e.docs.size - e.entregues.size,
      emElaboracao: e.emElaboracao.size,
      semDono: e.docs.size - e.entregues.size - e.emElaboracao.size,
      semAssociacao: e.semAssoc.size,
    }))
    // Ordena pelo TOTAL de documentos associados (pedido de 15/09; até então
    // era por entregue). Nome desempata, para a ordem não embaralhar entre
    // duas aberturas da tela.
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Quantos documentos têm dono, e quantos desses foram creditados sem registro
 * de associação (por isso ficam fora do recorte por mês).
 */
export function resumoAssociacao(
  associacoes: readonly AssociacaoDoc[],
  documentos: readonly DocumentoContavel[],
): { comAssociacao: number; semAssociacao: number } {
  const entradas = indexarAssociacoes(associacoes);
  let comAssociacao = 0;
  let semAssociacao = 0;
  for (const d of documentos) {
    if (d.status === "DELETADA") continue;
    const donos = donosDo(d, entradas);
    if (donos.length === 0) continue;
    if (donos.some((x) => x.entrouEm)) comAssociacao++;
    else semAssociacao++;
  }
  return { comAssociacao, semAssociacao };
}

export interface MesDocumentos {
  chave: number;
  mes: string;
  /** Dos que entraram no mês, quantos JÁ foram entregues. */
  entregues: number;
  /** Dos que entraram no mês, quantos ainda estão com alguém. */
  emElaboracao: number;
  /** Dos que entraram no mês, quantos voltaram para a fila sem dono. */
  semDono: number;
  /** Documentos que entraram no mês, no total. */
  total: number;
}

/**
 * Série mensal por SAFRA: o mês é quando o documento entrou na fila, e a barra
 * mede quantos daqueles já saíram.
 *
 * Duas decisões que a versão anterior não tinha:
 *
 * 1. **Vale a PRIMEIRA entrada**, não qualquer uma. Antes, um documento que
 *    recebeu gente em julho e agosto aparecia nos dois meses e a soma dos
 *    meses não fechava com nada.
 * 2. **A barra mede o entregue**, como a de pessoa — decisão do Sanmyo em
 *    27/08. Barra de painel que mede trabalho assumido acaba lida como
 *    trabalho feito, que foi a origem desta frente inteira.
 *
 * O que ficou pelo caminho não some: vai para o bloco do hover.
 */
export function serieMensalAssociacoes(
  associacoes: readonly AssociacaoDoc[],
  documentos: readonly DocumentoContavel[],
  mesAtual: number,
  nMeses: number,
  rotulo: (abs: number) => string,
  mesDe: (iso: string) => number,
): MesDocumentos[] {
  const vivos = new Map(
    documentos.filter((d) => d.status !== "DELETADA").map((d) => [d.id_inspecao, d]),
  );
  const entradas = indexarAssociacoes(associacoes);

  // Quando cada documento entrou na fila = a associação mais antiga dele.
  const entrouEm = new Map<string, string>();
  for (const a of associacoes) {
    if (!a.created_at || !a.id_inspecao || !vivos.has(a.id_inspecao)) continue;
    const atual = entrouEm.get(a.id_inspecao);
    if (!atual || a.created_at < atual) entrouEm.set(a.id_inspecao, a.created_at);
  }

  const primeiro = mesAtual - (nMeses - 1);
  const meses: MesDocumentos[] = Array.from({ length: nMeses }, (_, i) => ({
    chave: primeiro + i,
    mes: rotulo(primeiro + i),
    entregues: 0,
    emElaboracao: 0,
    semDono: 0,
    total: 0,
  }));

  for (const [id, quando] of entrouEm) {
    const i = mesDe(quando) - primeiro;
    if (i < 0 || i >= nMeses) continue;
    const d = vivos.get(id)!;
    meses[i].total++;
    const sit = situacao(d, donosDo(d, entradas));
    if (sit === "ENTREGUE") meses[i].entregues++;
    else if (sit === "EM_ELABORACAO") meses[i].emElaboracao++;
    else meses[i].semDono++;
  }

  return meses;
}

/**
 * Quantos documentos com dono NÃO aparecem nas barras do gráfico mensal, e por
 * quê. Cartão do Notion dele (22/09/2026): o cabeçalho dizia 550 e as barras
 * somavam 441, sem nada na tela explicando os 109 de diferença.
 *
 * Os dois motivos:
 *  - `semRegistro`: o documento foi assumido ("Assumir elaboração") sem linha
 *    em `inspecao_associados` — sem data de entrada, não tem mês;
 *  - `antesDoPeriodo`: tem data, mas a primeira entrada é anterior à janela
 *    do gráfico (12 meses na tela de detalhe).
 *
 * `total` = documentos com dono − soma das barras; os dois motivos fecham com ele.
 */
export function foraDoGraficoMensal(
  associacoes: readonly AssociacaoDoc[],
  documentos: readonly DocumentoContavel[],
  serie: readonly MesDocumentos[],
): { total: number; semRegistro: number; antesDoPeriodo: number } {
  const entradas = indexarAssociacoes(associacoes);
  const comAlgumaData = new Set(
    associacoes.filter((a) => a.created_at && a.id_inspecao).map((a) => a.id_inspecao),
  );
  let comDono = 0;
  let semRegistro = 0;
  for (const d of documentos) {
    if (d.status === "DELETADA") continue;
    if (donosDo(d, entradas).length === 0) continue;
    comDono++;
    if (!comAlgumaData.has(d.id_inspecao)) semRegistro++;
  }
  const nasBarras = serie.reduce((n, m) => n + m.total, 0);
  const total = comDono - nasBarras;
  return { total, semRegistro, antesDoPeriodo: total - semRegistro };
}

/**
 * Donut "Documentos por Situação" do dashboard — pela MESMA regra da lista
 * (`situacaoDocumento`, decisão de 22/09): gente no documento (associado ou
 * responsável) conta como assumido, mesmo sem clicar em "Assumir". Até
 * 13/10 o donut lia só `elaboracao_status`, e ~100 documentos que a lista
 * mostrava "Em elaboração · Fulano" apareciam aqui como Pendentes.
 *
 * Pendente = inspeção já concluída em campo e ninguém no documento; com a
 * inspeção ainda em campo e sem ninguém, não há documento a cobrar.
 */
export function porSituacao(
  associacoes: readonly AssociacaoDoc[],
  documentos: readonly DocumentoContavel[],
): { pendentes: number; assumidos: number; concluidos: number } {
  const entradas = indexarAssociacoes(associacoes);
  let pendentes = 0;
  let assumidos = 0;
  let concluidos = 0;
  for (const d of documentos) {
    if (d.status === "DELETADA") continue;
    const sit = situacao(d, donosDo(d, entradas));
    if (sit === "ENTREGUE") concluidos++;
    else if (sit === "EM_ELABORACAO") assumidos++;
    else if (d.status === "CONCLUIDA") pendentes++;
  }
  return { pendentes, assumidos, concluidos };
}

// ─── Documentos CONCLUÍDOS pelo ADM (card "Documentos por Mês" + detalhe) ───
//
// Outra pergunta, outra régua: aqui não é quem se associou, é quem ENTREGOU —
// `elaboracao_status = CONCLUIDO`, no mês de `elaboracao_concluida_em`, para
// `elaboracao_responsavel`. O card do dashboard e a tela
// /dashboard/documentos-emitidos contavam cada um por conta própria. Medido em
// 09/10/2026 os dois batiam (jun 69, jul 118, ago 81, set 120, out 82), mas só
// por sorte: o card lia uma página só, não tirava inspeção excluída e usava
// outra chave de cache, que ninguém mandava atualizar — ficava até 5 min atrás
// do detalhe depois de cada conclusão. Renovação entra: é documento entregue
// de verdade (mediana de ~16 dias entre criar e concluir).

/** Uma linha de `inspecoes` com a elaboração concluída. */
export interface DocumentoConcluido {
  status: string | null;
  elaboracao_concluida_em: string | null;
  elaboracao_responsavel: string | null;
  /**
   * v295: a PRIMEIRA conclusão do documento e o responsável naquele momento, travados no banco.
   * Pedido de 26/10: mesma regra das inspeções — reabrir e concluir de novo não muda o mês nem a
   * pessoa. Quando existem, valem no lugar das colunas acima.
   */
  primeira_elaboracao_em?: string | null;
  primeira_elaboracao_por?: string | null;
  id_inspecao?: string;
}

/** O instante que decide o mês do documento concluído (1ª conclusão, se houver). */
export function dataConclusaoDoc(l: DocumentoConcluido): string | null {
  return l.primeira_elaboracao_em || l.elaboracao_concluida_em || null;
}

/** Quem leva o documento concluído (o responsável na 1ª conclusão, se houver). */
export function admDoDoc(l: DocumentoConcluido): string {
  return ((l.primeira_elaboracao_por || l.elaboracao_responsavel) ?? "").replace(/\s+/g, " ").trim() || SEM_RESPONSAVEL;
}

export const SEM_RESPONSAVEL = "Sem responsável";

/** Os que contam: inspeção não excluída e com data de conclusão. */
export function concluidosValidos<T extends DocumentoConcluido>(linhas: readonly T[]): T[] {
  return linhas.filter((l) => l.status !== "DELETADA" && !!dataConclusaoDoc(l));
}

/** Quantos documentos foram concluídos em cada um dos últimos `nMeses`. */
export function concluidosPorMes(
  linhas: readonly DocumentoConcluido[],
  mesAtual: number,
  nMeses: number,
  mesDe: (iso: string) => number,
): { chave: number; total: number }[] {
  const primeiro = mesAtual - (nMeses - 1);
  const meses = Array.from({ length: nMeses }, (_, i) => ({ chave: primeiro + i, total: 0 }));
  for (const l of concluidosValidos(linhas)) {
    const i = mesDe(dataConclusaoDoc(l)!) - primeiro;
    if (i >= 0 && i < nMeses) meses[i].total++;
  }
  return meses;
}

/** Chave de agrupamento do nome: sem caixa, sem acento, espaços colapsados. */
export function chaveNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Concluídos por ADM, no mês `mes` (mês absoluto) ou em todos (`null`).
 * "Ana Luiza" e "ana luíza" são a mesma pessoa: agrupa sem caixa e sem acento
 * e mostra a grafia mais usada.
 */
export function concluidosPorAdm(
  linhas: readonly DocumentoConcluido[],
  mes: number | null,
  mesDe: (iso: string) => number,
): { adm: string; total: number }[] {
  const grupos = new Map<string, { total: number; grafias: Map<string, number> }>();
  for (const l of concluidosValidos(linhas)) {
    if (mes !== null && mesDe(dataConclusaoDoc(l)!) !== mes) continue;
    const nome = admDoDoc(l);
    const k = chaveNome(nome);
    const g = grupos.get(k) ?? { total: 0, grafias: new Map<string, number>() };
    g.total++;
    g.grafias.set(nome, (g.grafias.get(nome) ?? 0) + 1);
    grupos.set(k, g);
  }
  return Array.from(grupos.values())
    .map((g) => ({
      adm: [...g.grafias.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0],
      total: g.total,
    }))
    .sort((a, b) => b.total - a.total || a.adm.localeCompare(b.adm, "pt-BR"));
}
