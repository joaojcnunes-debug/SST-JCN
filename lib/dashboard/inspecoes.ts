/**
 * Contagem de inspeções do dashboard — a régua, num lugar só.
 *
 * Levantamento de 2026-08-24: o card do dashboard e a sua PRÓPRIA tela de
 * detalhe mostravam números diferentes para o mesmo mês (219 × 220 em julho),
 * porque cada um tinha a sua cópia da conta. É a mesma armadilha de
 * `lib/aet/consolidar-psi.ts`: conta duplicada é conta que diverge.
 *
 * Daqui em diante as duas telas chamam as funções deste arquivo. Server-safe
 * (sem "use client") para poder ser testado sem browser.
 *
 * ─── As três perguntas que o painel responde, e que NÃO são a mesma ─────────
 *
 *  REALIZADA  — a visita aconteceu naquele mês (`data_inspecao`).
 *               É o que o técnico tem na cabeça quando diz "fiz 20 em maio".
 *  CONCLUÍDA  — a inspeção foi finalizada no sistema naquele mês
 *               (`concluida_em`). Pode ser meses depois da visita.
 *  ABERTA     — foi lançada no sistema naquele mês (`created_at`). Não é usada
 *               nos gráficos; fica registrada aqui para não ser confundida com
 *               "realizada", que era exatamente a confusão anterior.
 *
 * Misturar as duas primeiras foi o maior motivo da divergência relatada: em
 * maio/2026 o painel mostrava 16 (concluídas) onde houve 110 visitas.
 */

import { mesAbsDataSP, mesAbsSP } from "./mes";
import { canonicalizarTecnico } from "./tecnicos";

/** Só o que a contagem precisa de uma inspeção. */
export interface InspecaoContavel {
  /** Necessário só para juntar com a tabela `responsaveis`. */
  id_inspecao?: string;
  status: string;
  /** Data da VISITA — data pura "AAAA-MM-DD". */
  data_inspecao: string | null;
  /** Quando foi finalizada. Nulo em registro antigo. */
  concluida_em: string | null;
  created_at: string;
  /** "BRANCO" (visita nova) | "COPIA_EMPRESA" | "REVISAO" | "RENOVACAO" */
  tipo_criacao: string | null;
  responsavel?: string | null;
  /**
   * Estado do DOCUMENTO (SGG) que nasce desta inspeção: "CONCLUIDO" quando foi
   * entregue ao cliente. É outro trabalho, feito por outra equipe — entra aqui
   * só para o técnico enxergar o destino da visita dele.
   */
  elaboracao_status?: string | null;
}

/**
 * A inspeção nasceu de uma cópia ou de uma revisão de outra?
 *
 * Não é visita nova: copiar uma inspeção para outra empresa gera um registro
 * novo, e o painel somava tudo junto. São 13% da base (67 cópias + 5 revisões
 * em 537). Contar continua contando — mas separado, senão 40 vira a leitura de
 * 40 visitas onde houve 18.
 */
export function ehCopiaOuRevisao(tipoCriacao: string | null | undefined): boolean {
  const t = (tipoCriacao ?? "").trim().toUpperCase();
  return t !== "" && t !== "BRANCO" && t !== RENOVACAO;
}

/** Valor de `tipo_criacao` do registro de renovação (23/09). */
export const RENOVACAO = "RENOVACAO";

/**
 * O registro é uma RENOVAÇÃO de documento, e não uma inspeção?
 *
 * Pedido de 22–23/09: o administrativo abre "inspeção" só para cadastrar a
 * empresa ou atualizar a data dos documentos dela — não houve visita. Em
 * 15–21/09 foram 48 concluídas assim, 1 em cada 3 do mês, e todas entravam nos
 * gráficos como trabalho de campo.
 *
 * Diferente da cópia, que conta SEPARADO: renovação não conta em nenhum
 * gráfico de inspeção (nem visita, nem concluída, nem por técnico). O
 * registro continua existindo — na lista, na ficha da empresa e na parte de
 * documentos do dashboard, que é outra régua (`lib/dashboard/documentos`).
 */
export function ehRenovacao(tipoCriacao: string | null | undefined): boolean {
  return (tipoCriacao ?? "").trim().toUpperCase() === RENOVACAO;
}

/**
 * Mês em que a inspeção foi CONCLUÍDA.
 *
 * `concluida_em` só existe a partir da v154; registro anterior cai no
 * `created_at`. Esse fallback já estava escrito nas duas telas, mas no card do
 * dashboard ele era CÓDIGO MORTO: a consulta filtrava por `concluida_em >= X`,
 * e linha com valor nulo nunca passa numa comparação — era descartada antes de
 * o fallback ter chance. Por isso uma inspeção sumia do gráfico e aparecia na
 * tela de detalhe. Aqui a decisão é uma só, e nenhuma consulta filtra por
 * coluna que pode ser nula.
 */
export function mesDeConclusao(i: InspecaoContavel): number | null {
  if (i.status !== "CONCLUIDA") return null;
  // Renovação não é inspeção concluída — sai daqui e, por aqui, de toda tela
  // que conta concluídas pelo mês.
  if (ehRenovacao(i.tipo_criacao)) return null;
  return mesAbsSP(i.concluida_em || i.created_at);
}

/**
 * Quando a coluna `concluida_em` passou a existir (migration v154, aplicada na
 * produção em 04/08/2026 16:47 UTC).
 *
 * ⚠️ É a fronteira entre um número medido e um número estimado. A v154 fez
 * backfill das inspeções JÁ concluídas com `updated_at` — a última alteração,
 * que não é a conclusão: uma inspeção concluída em maio e editada em julho
 * ficou registrada como concluída em julho.
 *
 * Medido em 2026-08-27: de 492 concluídas, **371 têm data de backfill** e só
 * 121 têm carimbo real. Por mês, julho aparece com 220 conclusões (219 delas
 * estimadas) contra 148 visitas realizadas — mais conclusões que visitas, que é
 * o sinal do estrago. De agosto em diante o número é o momento real em que o
 * técnico finalizou.
 *
 * Data fixa de propósito: é um fato do passado, não um parâmetro. Ver
 * `supabase/migrations/v154_inspecoes_concluida_em.sql`.
 */
export const BACKFILL_V154 = Date.parse("2026-08-04T16:47:48Z");

/**
 * A data de conclusão desta inspeção é estimada (backfill) em vez de carimbada?
 *
 * Vale para o registro sem `concluida_em` (cai no `created_at`, que é quando a
 * inspeção foi lançada) e para tudo que foi concluído antes da v154.
 */
export function conclusaoEhAproximada(i: InspecaoContavel): boolean {
  if (i.status !== "CONCLUIDA") return false;
  if (!i.concluida_em) return true;
  return Date.parse(i.concluida_em) < BACKFILL_V154;
}

/** Mês em que a VISITA aconteceu. Data pura — nunca passa por fuso. */
export function mesDeRealizacao(i: InspecaoContavel): number | null {
  // Renovação não foi visita: a data dela é a do documento, não a de campo.
  if (ehRenovacao(i.tipo_criacao)) return null;
  return mesAbsDataSP(i.data_inspecao);
}

export interface MesInspecoes {
  /** Mês absoluto (ano*12 + mês), para casar com o rótulo. */
  chave: number;
  mes: string;
  /** Visitas novas realizadas no mês (exclui cópia/revisão). */
  novas: number;
  /** Cópias e revisões com data de visita no mês. */
  copias: number;
  /** novas + copias — o total realizado no mês. */
  realizadas: number;
  /** Inspeções finalizadas no mês (independe de quando a visita foi). */
  concluidas: number;
  /** Das `concluidas`, as que têm carimbo real de finalização. */
  concluidasReais: number;
  /** Das `concluidas`, as que herdaram data estimada do backfill da v154. */
  concluidasAprox: number;
  /**
   * A SAFRA do mês, pelo estado de HOJE — outra pergunta, e é de propósito.
   *
   * `concluidas` acima é por data de FINALIZAÇÃO: uma visita de maio fechada em
   * agosto conta em agosto. Estes dois contam no mês da VISITA e olham o status
   * atual, então respondem "das que fizemos em maio, quantas já fecharam?".
   *
   * Por isso `safraConcluidas + safraEmAberto === realizadas` sempre — o que
   * NÃO vale entre `realizadas` e `concluidas`, que são coortes diferentes.
   * Subtrair uma da outra dá negativo em julho, e foi para não convidar a essa
   * subtração que as duas parcelas moram aqui prontas.
   *
   * ⚠️ Desde 15/09 NENHUMA tela desenha a safra: o card do dashboard voltou a
   * mostrar `concluidas` (a pedido — o card dizia 140 e o "Ver detalhe" 153
   * para agosto, e a explicação não cabia num cartão). Os campos ficam, com o
   * teste do invariante, porque a pergunta continua válida e é barata.
   */
  safraConcluidas: number;
  /** O resto da safra: Rascunho e Em andamento. `DELETADA` nunca entra. */
  safraEmAberto: number;
}

/**
 * Série mensal dos últimos `nMeses`, terminando no mês corrente.
 *
 * `rotulo` vem de fora só para o chamador escolher entre "Ago" e "Ago/26".
 */
export function serieMensal(
  inspecoes: InspecaoContavel[],
  mesAtual: number,
  nMeses: number,
  rotulo: (abs: number) => string,
): MesInspecoes[] {
  const primeiro = mesAtual - (nMeses - 1);
  const meses: MesInspecoes[] = Array.from({ length: nMeses }, (_, i) => {
    const chave = primeiro + i;
    return {
      chave,
      mes: rotulo(chave),
      novas: 0,
      copias: 0,
      realizadas: 0,
      concluidas: 0,
      concluidasReais: 0,
      concluidasAprox: 0,
      safraConcluidas: 0,
      safraEmAberto: 0,
    };
  });
  const indice = (abs: number | null) =>
    abs == null || abs < primeiro || abs > mesAtual ? -1 : abs - primeiro;

  for (const i of inspecoes) {
    if (i.status === "DELETADA") continue;

    const iReal = indice(mesDeRealizacao(i));
    if (iReal >= 0) {
      if (ehCopiaOuRevisao(i.tipo_criacao)) meses[iReal].copias++;
      else meses[iReal].novas++;
      meses[iReal].realizadas++;
      // O estado de hoje da mesma visita. Fica no mês da VISITA, não no da
      // finalização — é o que faz as duas parcelas fecharem com `realizadas`.
      if (i.status === "CONCLUIDA") meses[iReal].safraConcluidas++;
      else meses[iReal].safraEmAberto++;
    }

    const iConc = indice(mesDeConclusao(i));
    if (iConc >= 0) {
      meses[iConc].concluidas++;
      if (conclusaoEhAproximada(i)) meses[iConc].concluidasAprox++;
      else meses[iConc].concluidasReais++;
    }
  }

  return meses;
}

export interface TecnicoInspecoes {
  tecnico: string;
  novas: number;
  copias: number;
  total: number;
  /**
   * O destino, no administrativo, das inspeções creditadas a esta pessoa.
   *
   * Não mede o trabalho dela: mede o que aconteceu com o que ela levantou em
   * campo. A pergunta que responde é "a minha visita virou documento?", que
   * antes só dava para responder abrindo inspeção por inspeção.
   *
   * São TRÊS estados, e não dois, porque juntar "alguém está fazendo" com
   * "ninguém pegou" esconde o gargalo — o mesmo erro que fazia o ranking do
   * administrativo somar assumido com entregue. Medido em 27/08: das 493
   * concluídas, 260 entregues, 103 em elaboração e **132 que ninguém pegou**.
   */
  docEntregue: number;
  docEmElaboracao: number;
  docNaoIniciado: number;
  /**
   * Quantas das `total` foram creditadas por falta de técnico de campo
   * registrado — ou seja, pelo nome de quem abriu no sistema.
   *
   * Fica exposto de propósito: é o buraco de preenchimento, e escondê-lo
   * faria o número parecer melhor do que é.
   */
  semRegistro: number;
}

/** Como cada inspeção foi creditada, para a tela poder explicar o número. */
export interface ResumoCredito {
  /** Inspeções que tinham técnico de campo registrado. */
  comRegistro: number;
  /** Inspeções creditadas a quem abriu no sistema, por falta do registro. */
  semRegistro: number;
}

/**
 * Um técnico de campo, como a linha de `responsaveis` guarda.
 *
 * `idUsuario` é a v204: quando está preenchido, quem é a pessoa é um FATO
 * gravado, e não uma dedução em cima de texto digitado à mão.
 *
 * `string` puro continua aceito porque é o que a tela mandava antes da Fase B
 * — e é o que os testes de 25/08 mandam. Eles ficaram intocados de propósito:
 * são a prova de que o caminho antigo não mudou.
 */
export interface TecnicoDeCampo {
  digitado: string;
  idUsuario?: string | null;
}

/** Aceita as duas formas sem espalhar `typeof` pelo resto do arquivo. */
function comoTecnico(
  t: string | TecnicoDeCampo | null | undefined,
): TecnicoDeCampo {
  if (!t) return { digitado: "" };
  if (typeof t === "string") return { digitado: t };
  return { digitado: t.digitado ?? "", idUsuario: t.idUsuario ?? null };
}

export interface OpcoesPorTecnico {
  /** id_inspecao → técnicos da aba Responsáveis (podem ser vários). */
  tecnicosDeCampo?: ReadonlyMap<string, readonly (string | TecnicoDeCampo)[]>;
  /** Nomes dos usuários do painel, para canonicalizar a grafia. */
  cadastro?: readonly string[];
  /**
   * Contas do painel (id + nome), para traduzir o `idUsuario` gravado de volta
   * ao nome que é a CHAVE da barra do gráfico.
   *
   * Sem esta lista o vínculo é simplesmente ignorado e vale o caminho antigo.
   * É de propósito: ninguém pode sair do gráfico porque uma consulta a mais
   * não respondeu.
   */
  contas?: readonly { id_usuario: string; nome: string }[];
}

/**
 * Contagem por pessoa, para a tela de detalhe.
 *
 * ─── Qual "técnico" isto conta ─────────────────────────────────────────────
 *
 * Existem dois, e ATÉ 2026-08-25 esta função usava só o pior deles:
 * `inspecoes.responsavel`, que é quem ABRIU a inspeção no sistema — não
 * necessariamente quem foi a campo.
 *
 * Agora vale a regra que o Sanmyo fechou em 25/08:
 *
 *   1. Se a inspeção TEM técnico de campo registrado (aba Responsáveis),
 *      conta ele — e conta os DOIS quando foram dois, cada um com uma
 *      inspeção inteira. Trabalho dividido é trabalho dos dois.
 *   2. Se NÃO tem registro nenhum (116 inspeções da base), continua valendo
 *      quem abriu no sistema.
 *
 * O passo 2 não é preguiça: trocar a fonte por completo faria a Daniele Alves
 * cair de 41 inspeções para 1, porque em 40 delas ninguém preencheu a aba —
 * mentira maior que a de antes. O que se faz com esse buraco é MOSTRÁ-LO, e é
 * para isso que existe `semRegistro`.
 *
 * ⚠️ Com duas pessoas na mesma inspeção, a soma das barras passa do número de
 * inspeções. É o esperado — a tela precisa dizer isso no rótulo.
 */
/** A quem UMA inspeção é creditada, e por qual caminho. */
export interface CreditoDaInspecao {
  /** Nomes canônicos — vários quando a visita foi em dupla. */
  nomes: string[];
  /** true = ninguém registrado na aba Responsáveis; valeu quem abriu no sistema. */
  semRegistro: boolean;
}

/**
 * Quem leva o crédito de UMA inspeção — a regra do Sanmyo de 25/08, num lugar
 * só (ver `porTecnico` abaixo, que é quem a explica).
 *
 * Extraída em 16/09 porque a média de inspeções por técnico
 * (`lib/produtividade/media-inspecoes`) precisa da pessoa POR INSPEÇÃO, para
 * contar técnico-dias — e a regra não pode existir duas vezes: foi conta
 * duplicada que fez o card e o detalhe divergirem em julho.
 */
export function tecnicosCreditados(
  i: InspecaoContavel,
  opcoes: OpcoesPorTecnico = {},
): CreditoDaInspecao {
  const { tecnicosDeCampo, cadastro = [], contas = [] } = opcoes;
  const digitados = i.id_inspecao
    ? tecnicosDeCampo?.get(i.id_inspecao) ?? []
    : [];

  const deCampo = [
    ...new Set(
      digitados
        .map((t) => {
          const { digitado, idUsuario } = comoTecnico(t);
          // 1º o FATO gravado pela v204. 2º a dedução em cima do texto.
          //
          // Esta ordem é a Fase B inteira: daqui para frente a contagem não
          // depende mais de acertar o que alguém digitou na recepção do
          // cliente. O tradutor continua ATRÁS, e não some: em 10/09 havia
          // 158 das 680 inspeções sem vínculo nenhum para preferir.
          const porVinculo = idUsuario
            ? (contas.find((c) => c.id_usuario === idUsuario)?.nome ?? "").trim()
            : "";
          if (porVinculo) return porVinculo;
          return canonicalizarTecnico(digitado, cadastro);
        })
        .filter((n): n is string => !!n),
    ),
  ];

  if (deCampo.length > 0) return { nomes: deCampo, semRegistro: false };

  const abriu =
    canonicalizarTecnico(i.responsavel, cadastro) ?? "Sem responsável";
  return { nomes: [abriu], semRegistro: true };
}

/**
 * Contagem por pessoa, para a tela de detalhe.
 *
 * ─── Qual "técnico" isto conta ─────────────────────────────────────────────
 *
 * Existem dois, e ATÉ 2026-08-25 esta função usava só o pior deles:
 * `inspecoes.responsavel`, que é quem ABRIU a inspeção no sistema — não
 * necessariamente quem foi a campo.
 *
 * Agora vale a regra que o Sanmyo fechou em 25/08:
 *
 *   1. Se a inspeção TEM técnico de campo registrado (aba Responsáveis),
 *      conta ele — e conta os DOIS quando foram dois, cada um com uma
 *      inspeção inteira. Trabalho dividido é trabalho dos dois.
 *   2. Se NÃO tem registro nenhum (116 inspeções da base), continua valendo
 *      quem abriu no sistema.
 *
 * O passo 2 não é preguiça: trocar a fonte por completo faria a Daniele Alves
 * cair de 41 inspeções para 1, porque em 40 delas ninguém preencheu a aba —
 * mentira maior que a de antes. O que se faz com esse buraco é MOSTRÁ-LO, e é
 * para isso que existe `semRegistro`.
 *
 * ⚠️ Com duas pessoas na mesma inspeção, a soma das barras passa do número de
 * inspeções. É o esperado — a tela precisa dizer isso no rótulo.
 */
export function porTecnico(
  inspecoes: InspecaoContavel[],
  opcoes: OpcoesPorTecnico = {},
): TecnicoInspecoes[] {
  const mapa = new Map<string, TecnicoInspecoes>();

  const creditar = (nome: string, i: InspecaoContavel, semRegistro: boolean) => {
    const e =
      mapa.get(nome) ??
      {
        tecnico: nome,
        novas: 0,
        copias: 0,
        total: 0,
        docEntregue: 0,
        docEmElaboracao: 0,
        docNaoIniciado: 0,
        semRegistro: 0,
      };
    if (ehCopiaOuRevisao(i.tipo_criacao)) e.copias++;
    else e.novas++;
    e.total++;
    if (i.elaboracao_status === "CONCLUIDO") e.docEntregue++;
    else if (i.elaboracao_status === "EM_ELABORACAO") e.docEmElaboracao++;
    else e.docNaoIniciado++;
    if (semRegistro) e.semRegistro++;
    mapa.set(nome, e);
  };

  for (const i of inspecoes) {
    if (ehRenovacao(i.tipo_criacao)) continue;
    const { nomes, semRegistro } = tecnicosCreditados(i, opcoes);
    for (const nome of nomes) creditar(nome, i, semRegistro);
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/** Quantas inspeções tinham (ou não) técnico de campo registrado. */
export function resumoCredito(
  inspecoes: InspecaoContavel[],
  tecnicosDeCampo?: ReadonlyMap<string, readonly (string | TecnicoDeCampo)[]>,
): ResumoCredito {
  let comRegistro = 0;
  for (const i of inspecoes) {
    const t = i.id_inspecao ? tecnicosDeCampo?.get(i.id_inspecao) ?? [] : [];
    if (t.some((x) => comoTecnico(x).digitado.trim() !== "")) comRegistro++;
  }
  return { comRegistro, semRegistro: inspecoes.length - comRegistro };
}
