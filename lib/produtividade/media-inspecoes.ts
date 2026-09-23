/**
 * Média de inspeções por técnico por dia útil, por unidade — a conta do quadro
 * "Inspeções por dia útil" do Controle Mensal.
 *
 * Pedido de 15/09/2026: "precisamos criar uma média dos dias de inspeções,
 * pensando nos dias úteis". O desenho fechado no mesmo dia:
 *
 *   visitas da unidade no mês ÷ (técnicos de campo da unidade × dias úteis)
 *
 * ─── As decisões, e por quê ────────────────────────────────────────────────
 *
 *  • **Visita** = inspeção com `data_inspecao` no mês (data pura — nunca passa
 *    por fuso, ver `mesAbsDataSP`), não deletada, e que NÃO seja cópia nem
 *    revisão (`ehCopiaOuRevisao`): copiar uma inspeção para outra empresa não é
 *    ninguém indo a campo.
 *
 *  • **Unidade da visita** = `empresas.id_unidade` → `public.unidades`. É como
 *    o hub Início atribui, e é a única ligação que existe: a inspeção não tem
 *    unidade própria.
 *
 *  • **Divisor = a equipe cadastrada na Produtividade** (`prod_colaboradores`
 *    com `tipo = 'tecnico_campo'` e `ativo`). Os usuários do painel com perfil
 *    Técnico NÃO servem: o mesmo técnico está ligado a 5 unidades
 *    (`usuarios.unidades` é array), o que dá 10–16 "técnicos" por unidade.
 *    Medido e descartado em 15/09.
 *
 *  • `prod_unidades` é OUTRA tabela (uuid próprio, com `cidade`); casa com
 *    `public.unidades` PELO NOME. Unidade do painel sem par na Produtividade
 *    (hoje: "Conselheiro") vai para a linha "(sem equipe cadastrada)" — some
 *    do denominador, não da tela.
 *
 *  • **Equipe compartilhada** (`prod_unidades.id_unidade_equipe`, hoje Piabetá
 *    → Guapimirim) vira UMA linha: equipe contada uma vez, visitas somadas. É a
 *    mesma regra que a Projeções já usa.
 *
 *  • **Dias úteis** pela régua da Escala (`lib/produtividade/dias-uteis`),
 *    com o município da unidade DONA da equipe. Num grupo com dois municípios
 *    (Guapimirim + Piabetá/Magé) vale o da dona: é onde a equipe está lotada.
 *    Enquanto não houver feriado municipal cadastrado a diferença é zero.
 *
 *  • **Mês em curso conta só os dias úteis até hoje** (`hoje`, data pura no
 *    fuso do RJ, inclusive). Pedido dele em 17/09/2026: dividir pelo mês
 *    inteiro deflacionava o mês corrente (setembro em 16/09: 21 dias com 11
 *    vividos). Mês fechado não muda; mês futuro fica sem dia útil e sem razão.
 *
 *  • **Quem fez a visita** = a MESMA regra do Ver detalhe do dashboard
 *    (`tecnicosCreditados`: aba Responsáveis com o vínculo v204 na frente, quem
 *    abriu no sistema atrás). Serve para duas leituras que o divisor não dá:
 *    quantas pessoas de fato fizeram inspeção, e quantos técnico-dias houve.
 *
 * ─── As duas colunas ───────────────────────────────────────────────────────
 *
 *  `porTecnicoDiaUtil`  visitas ÷ (equipe × dias úteis). A pedida. Em agosto/26
 *                       ficou entre 0,17 e 1,19 — o técnico não vai a campo
 *                       todo dia útil (89 técnico-dias em 420 possíveis).
 *  `porDiaEmCampo`      visitas ÷ técnico-dias em que alguém saiu. Diz quantas
 *                       visitas rendem os dias em que se vai a campo (1,1–1,8,
 *                       estável entre unidades). Proposta minha; ele decide
 *                       vendo na tela.
 *
 * ⚠️ Quando **mais pessoas fizeram inspeção do que há cadastrado** como técnico
 * de campo (agosto: Nova Friburgo 4 × 1, Campos 2 × 1), o número por técnico
 * sai inflado. A linha marca isso (`maisPessoasQueEquipe`) e a tela mostra o
 * aviso — é o padrão do `semRegistro` das Inspeções Concluídas: o buraco de
 * cadastro aparece, não some.
 *
 * Server-safe, função pura: recebe tudo pronto e devolve o quadro. O hook
 * (`useMediaInspecoesUnidade`) só busca e entrega.
 */

import {
  ehCopiaOuRevisao,
  ehRenovacao,
  tecnicosCreditados,
  type InspecaoContavel,
  type OpcoesPorTecnico,
} from "@/lib/dashboard/inspecoes";
import { normalizarNome } from "@/lib/dashboard/tecnicos";
import { intervaloDoMes } from "@/lib/escala/datas";
import type { EscalaFeriado } from "@/lib/escala/tipos";
import { diasUteisDaUnidade, diasUteisDoMesGeral, temFeriadoMunicipalCadastrado } from "./dias-uteis";

/** Só o que a conta precisa de uma inspeção. */
export interface InspecaoDaMedia extends InspecaoContavel {
  id_inspecao: string;
  id_empresa: string | null;
}

export interface EmpresaDaMedia {
  id_empresa: string;
  id_unidade: string | null;
}

/** `public.unidades` já juntada com o município da config da escala. */
export interface UnidadeDaMedia {
  id_unidade: string;
  nome: string;
  municipio: string | null;
}

export interface ProdUnidadeDaMedia {
  id: string;
  nome: string;
  /** Preenchido = esta unidade usa a equipe da unidade referenciada. */
  id_unidade_equipe: string | null;
}

export interface ColaboradorDaMedia {
  id_unidade: string;
  tipo: string;
  ativo: boolean;
}

export interface EntradaMedia {
  ano: number;
  /** 1..12 */
  mes: number;
  inspecoes: InspecaoDaMedia[];
  empresas: EmpresaDaMedia[];
  unidades: UnidadeDaMedia[];
  prodUnidades: ProdUnidadeDaMedia[];
  colaboradores: ColaboradorDaMedia[];
  feriados: EscalaFeriado[];
  /** As mesmas opções do `porTecnico` — aba Responsáveis, contas, cadastro. */
  tecnicos?: OpcoesPorTecnico;
  /**
   * Hoje, como data pura no fuso do RJ (`hojeDataPura`). Se cair dentro do
   * mês, os dias úteis param aqui. Ausente = mês inteiro (os testes antigos).
   */
  hoje?: string | null;
}

export interface LinhaMedia {
  /** id da `prod_unidades` dona da equipe, ou `SEM_EQUIPE`. */
  chave: string;
  /** "Guapimirim + Piabetá" — os nomes das unidades que somam aqui. */
  equipe: string;
  /** Visitas novas no mês (cópia e revisão fora). */
  visitas: number;
  diasUteis: number;
  /** Feriados municipais descontados dos dias úteis desta linha. */
  feriadosMunicipais: number;
  /** Técnicos de campo ativos cadastrados na Produtividade. */
  tecnicos: number;
  /** Pessoas distintas creditadas em alguma visita da linha. */
  pessoasQueFizeram: number;
  /** Pares distintos (pessoa, dia) com visita — dias em que alguém saiu. */
  tecnicoDias: number;
  /** visitas ÷ (tecnicos × diasUteis). Nulo quando o divisor é zero. */
  porTecnicoDiaUtil: number | null;
  /** visitas ÷ tecnicoDias. Nulo sem técnico-dia. */
  porDiaEmCampo: number | null;
  /** Mais gente fez inspeção do que há cadastrado — o "por técnico" sai inflado. */
  maisPessoasQueEquipe: boolean;
}

export interface ResultadoMedia {
  /** Uma linha por equipe, na ordem de visitas; "(sem equipe cadastrada)" por último. */
  linhas: LinhaMedia[];
  /** A JCN Consultoria inteira — TODAS as visitas do mês, inclusive as sem unidade. */
  total: LinhaMedia;
  /**
   * Dias úteis gerais (nacional + estadual), sem desconto municipal — do mês
   * inteiro, ou só até hoje quando o mês está em curso.
   */
  diasUteisGerais: number;
  /** Os dias úteis gerais do mês INTEIRO — para a tela dizer "12 dos 21". */
  diasUteisMesInteiro: number;
  /**
   * A data em que os dias úteis pararam (hoje), quando o mês não está fechado.
   * Nulo = mês fechado, contou inteiro.
   */
  ateHoje: string | null;
  /** false = a conta saiu só com nacional + estadual; a tela avisa. */
  temFeriadoMunicipalCadastrado: boolean;
  /** Cópias e revisões com visita no mês, fora da conta. */
  copiasIgnoradas: number;
  /** Visitas de empresa sem unidade (ou inspeção sem empresa). Só no total. */
  visitasSemUnidade: number;
}

export const SEM_EQUIPE = "(sem equipe cadastrada)";

interface Acumulador {
  visitas: number;
  pessoas: Set<string>;
  tecnicoDias: Set<string>;
}

function novoAcumulador(): Acumulador {
  return { visitas: 0, pessoas: new Set(), tecnicoDias: new Set() };
}

function acumular(acc: Acumulador, data: string, nomes: string[]): void {
  acc.visitas++;
  for (const nome of nomes) {
    acc.pessoas.add(nome);
    acc.tecnicoDias.add(`${nome}|${data}`);
  }
}

function razao(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

function montarLinha(
  chave: string,
  equipe: string,
  acc: Acumulador,
  diasUteis: number,
  feriadosMunicipais: number,
  tecnicos: number,
): LinhaMedia {
  return {
    chave,
    equipe,
    visitas: acc.visitas,
    diasUteis,
    feriadosMunicipais,
    tecnicos,
    pessoasQueFizeram: acc.pessoas.size,
    tecnicoDias: acc.tecnicoDias.size,
    porTecnicoDiaUtil: razao(acc.visitas, tecnicos * diasUteis),
    porDiaEmCampo: razao(acc.visitas, acc.tecnicoDias.size),
    maisPessoasQueEquipe: acc.pessoas.size > tecnicos,
  };
}

export function mediaInspecoesPorUnidade(entrada: EntradaMedia): ResultadoMedia {
  const { ano, mes, feriados } = entrada;
  const { inicio, fim } = intervaloDoMes(ano, mes);

  // ── Quem é dono de equipe, e quem soma em quem ───────────────────────────
  // prod_unidades por nome normalizado → a DONA da equipe (ela mesma, ou a
  // referenciada em id_unidade_equipe).
  const prodPorId = new Map(entrada.prodUnidades.map((p) => [p.id, p]));
  const donaDe = (p: ProdUnidadeDaMedia): ProdUnidadeDaMedia =>
    (p.id_unidade_equipe && prodPorId.get(p.id_unidade_equipe)) || p;
  const prodPorNome = new Map(
    entrada.prodUnidades.map((p) => [normalizarNome(p.nome), p] as const),
  );

  // unidade do painel → chave da linha (id da dona) e o nome que ela contribui.
  const chaveDaUnidade = new Map<string, string>();
  const nomesPorChave = new Map<string, string[]>();
  const donaPorChave = new Map<string, { prod: ProdUnidadeDaMedia; unidade: UnidadeDaMedia | null }>();
  for (const u of entrada.unidades) {
    const prod = prodPorNome.get(normalizarNome(u.nome));
    if (!prod) {
      chaveDaUnidade.set(u.id_unidade, SEM_EQUIPE);
      continue;
    }
    const dona = donaDe(prod);
    chaveDaUnidade.set(u.id_unidade, dona.id);
    const nomes = nomesPorChave.get(dona.id) ?? [];
    // A dona vem primeiro no rótulo ("Guapimirim + Piabetá"), seja qual for a
    // ordem em que as unidades chegaram.
    if (prod.id === dona.id) nomes.unshift(u.nome);
    else nomes.push(u.nome);
    nomesPorChave.set(dona.id, nomes);
    const atual = donaPorChave.get(dona.id);
    if (!atual || prod.id === dona.id) {
      donaPorChave.set(dona.id, { prod: dona, unidade: prod.id === dona.id ? u : atual?.unidade ?? null });
    }
  }

  // Equipe cadastrada por dona. Colaborador lotado numa unidade que compartilha
  // equipe conta na dona — é onde a Unidades e Equipe o lista.
  const tecnicosPorChave = new Map<string, number>();
  let tecnicosTotal = 0;
  for (const c of entrada.colaboradores) {
    if (!c.ativo || c.tipo !== "tecnico_campo") continue;
    const prod = prodPorId.get(c.id_unidade);
    if (!prod) continue;
    const chave = donaDe(prod).id;
    tecnicosPorChave.set(chave, (tecnicosPorChave.get(chave) ?? 0) + 1);
    tecnicosTotal++;
  }

  // ── As visitas do mês ────────────────────────────────────────────────────
  const unidadeDaEmpresa = new Map(
    entrada.empresas.map((e) => [e.id_empresa, e.id_unidade] as const),
  );
  const porChave = new Map<string, Acumulador>();
  const total = novoAcumulador();
  let copiasIgnoradas = 0;
  let visitasSemUnidade = 0;

  for (const i of entrada.inspecoes) {
    if (i.status === "DELETADA") continue;
    const data = (i.data_inspecao ?? "").trim().slice(0, 10);
    if (!data || data < inicio || data > fim) continue;
    // Renovação de documento não é visita nem cópia de visita: fica fora sem
    // entrar no "N ficaram de fora", que fala de cópias e revisões.
    if (ehRenovacao(i.tipo_criacao)) continue;
    if (ehCopiaOuRevisao(i.tipo_criacao)) {
      copiasIgnoradas++;
      continue;
    }

    const { nomes } = tecnicosCreditados(i, entrada.tecnicos);
    acumular(total, data, nomes);

    const idUnidade = i.id_empresa ? unidadeDaEmpresa.get(i.id_empresa) : null;
    const chave = idUnidade ? chaveDaUnidade.get(idUnidade) : undefined;
    if (!chave) {
      visitasSemUnidade++;
      continue;
    }
    const acc = porChave.get(chave) ?? novoAcumulador();
    acumular(acc, data, nomes);
    porChave.set(chave, acc);
  }

  // ── As linhas ────────────────────────────────────────────────────────────
  // Mês fechado (hoje depois do fim) conta inteiro. Em curso, para em hoje.
  // Futuro (hoje antes do 1º) fica sem dia útil — a razão sai nula, não zero.
  const hoje = entrada.hoje ?? null;
  const ateHoje = hoje && hoje <= fim ? hoje : null;
  const diasUteisMesInteiro = diasUteisDoMesGeral(ano, mes, feriados).length;
  const diasUteisGerais = ateHoje
    ? diasUteisDoMesGeral(ano, mes, feriados, ateHoje).length
    : diasUteisMesInteiro;
  const linhas: LinhaMedia[] = [];

  // Toda dona de equipe aparece, mesmo com zero visita no mês: linha que some
  // porque ninguém saiu é exatamente a linha que a gestão quer ver.
  for (const [chave, { prod, unidade }] of donaPorChave) {
    const { datas, municipaisDescontados } = diasUteisDaUnidade(
      ano, mes, feriados, unidade?.municipio, ateHoje,
    );
    linhas.push(
      montarLinha(
        chave,
        (nomesPorChave.get(chave) ?? [prod.nome]).join(" + "),
        porChave.get(chave) ?? novoAcumulador(),
        datas.length,
        municipaisDescontados,
        tecnicosPorChave.get(chave) ?? 0,
      ),
    );
  }
  linhas.sort((a, b) => b.visitas - a.visitas || a.equipe.localeCompare(b.equipe, "pt-BR"));

  const semEquipe = porChave.get(SEM_EQUIPE);
  if (semEquipe) {
    linhas.push(montarLinha(SEM_EQUIPE, SEM_EQUIPE, semEquipe, diasUteisGerais, 0, 0));
  }

  return {
    linhas,
    total: montarLinha("total", "JCN Consultoria", total, diasUteisGerais, 0, tecnicosTotal),
    diasUteisGerais,
    diasUteisMesInteiro,
    ateHoje,
    temFeriadoMunicipalCadastrado: temFeriadoMunicipalCadastrado(feriados),
    copiasIgnoradas,
    visitasSemUnidade,
  };
}
