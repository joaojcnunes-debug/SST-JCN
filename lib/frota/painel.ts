/**
 * As contas do painel da frota, fora da tela.
 *
 * POR QUE AQUI: é a mesma lição de `lib/qps/matriz.ts` e de
 * `lib/aet/consolidar-psi.ts` — conta copiada em quatro telas vira quatro
 * contas, e duas delas divergem sem ninguém perceber. O painel, a ficha do
 * veículo e a tela de movimentações fazem as MESMAS perguntas ("este carro está
 * fora?", "quanto rodou no mês?"). A resposta mora num lugar só.
 *
 * Tudo aqui é função pura sobre linhas já carregadas: nenhuma consulta, nenhum
 * hook, nenhum `new Date()` escondido — a data de referência entra por
 * parâmetro para o resultado não depender do relógio de quem abriu a tela.
 */

import { STATUS_MANUTENCAO_ABERTA } from "@/lib/frota/tipos";
import type {
  FrotaAbastecimento,
  FrotaChecklist,
  FrotaLotacao,
  FrotaManutencao,
  FrotaSinistro,
  FrotaVeiculoLista,
} from "@/lib/frota/tipos";

/** Agendada ou em andamento — as que prendem o veículo.
 *  Mora aqui, e não no hook, para este arquivo continuar sem dependência de
 *  React: ele é conta pura e precisa poder ser lido de qualquer lugar. */
export const manutencaoEstaAberta = (m: FrotaManutencao): boolean =>
  STATUS_MANUTENCAO_ABERTA.includes(m.status);

// ─── Períodos ───────────────────────────────────────────────────────────────

export type Periodo = { inicio: Date; fim: Date; rotulo: string };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** O mês corrente, do dia 1º às 00h até o instante de referência. */
export function mesCorrente(hoje: Date): Periodo {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { inicio, fim: hoje, rotulo: `${MESES[hoje.getMonth()]}` };
}

/** O mês fechado anterior — a régua para saber se o mês atual está caro. */
export function mesAnterior(hoje: Date): Periodo {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, -1);
  return { inicio, fim, rotulo: MESES[inicio.getMonth()] };
}

const dentro = (iso: string | null, p: Periodo): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= p.inicio.getTime() && t <= p.fim.getTime();
};

/** Dias inteiros entre duas datas. Negativo quando `ate` é anterior. */
export function diasEntre(de: string | Date, ate: string | Date): number {
  const a = typeof de === "string" ? new Date(de) : de;
  const b = typeof ate === "string" ? new Date(ate) : ate;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Situação de cada veículo, agora ────────────────────────────────────────

export const SITUACOES_FROTA = ["FORA", "MANUTENCAO", "DISPONIVEL", "INATIVO"] as const;
export type SituacaoFrota = (typeof SITUACOES_FROTA)[number];

export const ROTULO_SITUACAO_FROTA: Record<SituacaoFrota, string> = {
  FORA: "Na rua",
  MANUTENCAO: "Na oficina",
  DISPONIVEL: "Na base",
  INATIVO: "Fora de operação",
};

export type LinhaSituacao = {
  veiculo: FrotaVeiculoLista;
  situacao: SituacaoFrota;
  /** A viagem que ainda não voltou, quando existe. */
  saidaAberta: FrotaChecklist | null;
  /** A manutenção agendada ou em andamento, quando existe. */
  manutencaoAberta: FrotaManutencao | null;
  /** Há quantos dias o carro está fora. Nulo quando não está. */
  diasFora: number | null;
};

/**
 * A ordem de prioridade não é estética, é operacional: se o carro está na rua,
 * é isso que o gestor precisa ver, mesmo que exista uma manutenção agendada
 * para semana que vem. Fora de operação vem antes de tudo porque um veículo
 * vendido não deveria aparecer em nenhuma das outras contas.
 */
export function situacaoDoVeiculo(args: {
  veiculo: FrotaVeiculoLista;
  saidaAberta?: FrotaChecklist | null;
  manutencaoAberta?: FrotaManutencao | null;
  hoje: Date;
}): LinhaSituacao {
  const { veiculo, hoje } = args;
  const saidaAberta = args.saidaAberta ?? null;
  const manutencaoAberta = args.manutencaoAberta ?? null;

  const situacao: SituacaoFrota =
    veiculo.status === "INATIVO" || veiculo.status === "VENDIDO"
      ? "INATIVO"
      : saidaAberta
        ? "FORA"
        : manutencaoAberta || veiculo.status === "MANUTENCAO"
          ? "MANUTENCAO"
          : "DISPONIVEL";

  return {
    veiculo,
    situacao,
    saidaAberta,
    manutencaoAberta,
    diasFora: saidaAberta ? diasEntre(saidaAberta.data_saida, hoje) : null,
  };
}

/** Monta a situação de toda a frota de uma vez, casando as listas por veículo. */
export function situacaoDaFrota(args: {
  veiculos: FrotaVeiculoLista[];
  saidasEmAberto: FrotaChecklist[];
  manutencoes: FrotaManutencao[];
  hoje: Date;
}): LinhaSituacao[] {
  // A saída em aberto MAIS ANTIGA é a que vale: se por engano existirem duas
  // para o mesmo carro, a que interessa é a que está pendurada há mais tempo.
  const saidaPorVeiculo = new Map<string, FrotaChecklist>();
  for (const s of args.saidasEmAberto) {
    const atual = saidaPorVeiculo.get(s.id_veiculo);
    if (!atual || new Date(s.data_saida) < new Date(atual.data_saida)) {
      saidaPorVeiculo.set(s.id_veiculo, s);
    }
  }

  const manutencaoPorVeiculo = new Map<string, FrotaManutencao>();
  for (const m of args.manutencoes) {
    if (!manutencaoEstaAberta(m)) continue;
    const atual = manutencaoPorVeiculo.get(m.id_veiculo);
    if (!atual || m.data_entrada < atual.data_entrada) {
      manutencaoPorVeiculo.set(m.id_veiculo, m);
    }
  }

  return args.veiculos.map((veiculo) =>
    situacaoDoVeiculo({
      veiculo,
      saidaAberta: saidaPorVeiculo.get(veiculo.id_veiculo) ?? null,
      manutencaoAberta: manutencaoPorVeiculo.get(veiculo.id_veiculo) ?? null,
      hoje: args.hoje,
    }),
  );
}

// ─── Custo e consumo ────────────────────────────────────────────────────────

export type ResumoPeriodo = {
  periodo: Periodo;
  /** Soma de (km_retorno − km_saida) das viagens FECHADAS no período. */
  kmRodado: number;
  /** Quantas viagens entraram nessa soma, e quantas ficaram de fora por não
   *  terem km de retorno. Sem isto o número parece completo quando não é. */
  viagensComKm: number;
  viagensSemKm: number;
  litros: number;
  valorCombustivel: number;
  valorManutencao: number;
  /** km/l. Nulo quando falta um dos dois lados da divisão. */
  consumoMedio: number | null;
  /** R$/km, combustível + manutenção. Nulo quando não houve km medido. */
  custoPorKm: number | null;
  /** Houve abastecimento de tanque parcial no período — a média fica torta. */
  temTanqueParcial: boolean;
};

/**
 * O km rodado sai das VIAGENS FECHADAS, não da diferença de odômetro.
 *
 * A diferença de odômetro entre o começo e o fim do mês parece mais simples,
 * mas mistura tudo que subiu o km — inclusive lançamento de abastecimento
 * atrasado e leitura de oficina — e não sabe dizer a QUAL mês o rodado
 * pertence. Somar viagens fechadas responde a pergunta certa ("quanto este
 * carro rodou a trabalho em agosto") e tem um efeito colateral desejado: quem
 * não fecha a viagem não aparece no relatório, o que é exatamente o incentivo
 * que faltava.
 *
 * O preço é honesto e está no retorno: `viagensSemKm` conta o que ficou de fora.
 */
export function resumoDoPeriodo(args: {
  periodo: Periodo;
  saidas: FrotaChecklist[];
  abastecimentos: FrotaAbastecimento[];
  manutencoes: FrotaManutencao[];
  lotacoes?: FrotaLotacao[];
}): ResumoPeriodo {
  const { periodo } = args;

  let kmRodado = 0;
  let viagensComKm = 0;
  let viagensSemKm = 0;
  for (const s of args.saidas) {
    if (!dentro(s.data_retorno, periodo)) continue;
    if (s.km_retorno == null) {
      viagensSemKm++;
      continue;
    }
    kmRodado += Math.max(0, s.km_retorno - s.km_saida);
    viagensComKm++;
  }

  // A transferência entre bases também é rodagem — e é a única que não passa
  // por uma saída, porque ninguém tira checklist para levar o carro de uma base
  // para a outra.
  for (const l of args.lotacoes ?? []) {
    if (l.km_percorrido != null && dentro(l.data_movimentacao, periodo)) {
      kmRodado += l.km_percorrido;
    }
  }

  let litros = 0;
  let valorCombustivel = 0;
  let temTanqueParcial = false;
  for (const a of args.abastecimentos) {
    if (!dentro(a.data_hora, periodo)) continue;
    litros += a.litros ?? 0;
    valorCombustivel += a.valor_total ?? 0;
    if (!a.tanque_cheio) temTanqueParcial = true;
  }

  let valorManutencao = 0;
  for (const m of args.manutencoes) {
    // Pela data de ENTRADA: é quando o serviço aconteceu. Usar a data de saída
    // jogaria o custo para o mês em que o carro deixou a oficina, e uma
    // manutenção que atravessa a virada do mês sumiria do mês em que começou.
    if (m.status === "CANCELADA") continue;
    if (!dentro(`${m.data_entrada}T12:00:00`, periodo)) continue;
    valorManutencao += m.valor ?? 0;
  }

  return {
    periodo,
    kmRodado,
    viagensComKm,
    viagensSemKm,
    litros,
    valorCombustivel,
    valorManutencao,
    consumoMedio: kmRodado > 0 && litros > 0 ? kmRodado / litros : null,
    custoPorKm: kmRodado > 0 ? (valorCombustivel + valorManutencao) / kmRodado : null,
    temTanqueParcial,
  };
}

// ─── Alertas: o que exige alguém fazer alguma coisa ─────────────────────────

/** Depois disto, viagem sem retorno deixa de ser "ainda na rua" e vira pendência. */
export const DIAS_VIAGEM_LONGA = 3;
/** Rascunho parado além disto é registro que ninguém terminou. */
export const DIAS_RASCUNHO_PARADO = 1;
/** Revisão a menos disto do vencimento já entra no radar. */
export const DIAS_REVISAO_PROXIMA = 30;
/** Idem para o km: faltando menos que isto, avisa. */
export const KM_REVISAO_PROXIMA = 1000;

export const NIVEIS_ALERTA = ["URGENTE", "ATENCAO"] as const;
export type NivelAlerta = (typeof NIVEIS_ALERTA)[number];

export type Alerta = {
  id: string;
  nivel: NivelAlerta;
  titulo: string;
  detalhe: string;
  idVeiculo: string | null;
  /** Para onde o clique leva. */
  href: string;
};

/**
 * Os alertas do painel.
 *
 * Regra de corte: só entra o que pede AÇÃO DE ALGUÉM. Informação sem ação vira
 * ruído, e painel com ruído deixa de ser lido — e aí o alerta que importava
 * também passa despercebido.
 */
export function alertasDaFrota(args: {
  situacao: LinhaSituacao[];
  rascunhos: FrotaChecklist[];
  sinistros: FrotaSinistro[];
  manutencoes: FrotaManutencao[];
  placaDe: (idVeiculo: string) => string;
  hoje: Date;
}): Alerta[] {
  const alertas: Alerta[] = [];
  const { placaDe, hoje } = args;

  for (const linha of args.situacao) {
    const id = linha.veiculo.id_veiculo;

    if (linha.saidaAberta && (linha.diasFora ?? 0) >= DIAS_VIAGEM_LONGA) {
      alertas.push({
        id: `viagem-longa-${linha.saidaAberta.id_checklist}`,
        nivel: (linha.diasFora ?? 0) >= DIAS_VIAGEM_LONGA * 3 ? "URGENTE" : "ATENCAO",
        titulo: `${placaDe(id)} fora há ${linha.diasFora} dias`,
        detalhe: `Com ${linha.saidaAberta.condutor_nome}. Se o carro já voltou, falta registrar o retorno.`,
        idVeiculo: id,
        href: `/frota/${id}/saida/${linha.saidaAberta.id_checklist}`,
      });
    }

    // Duas verdades sobre o mesmo carro. Não é erro de sistema — é sinal de que
    // alguém esqueceu de atualizar um dos dois lados, e o painel é o lugar de
    // dizer isso em voz alta.
    if (linha.manutencaoAberta && linha.veiculo.status === "ATIVO" && !linha.saidaAberta) {
      alertas.push({
        id: `divergencia-manutencao-${id}`,
        nivel: "ATENCAO",
        titulo: `${placaDe(id)} está na oficina, mas consta como Ativo`,
        detalhe: `${linha.manutencaoAberta.descricao}. Ajuste a situação do veículo ou feche a manutenção.`,
        idVeiculo: id,
        href: `/frota/${id}`,
      });
    }

    if (linha.saidaAberta && linha.veiculo.status !== "ATIVO") {
      alertas.push({
        id: `divergencia-fora-${id}`,
        nivel: "URGENTE",
        titulo: `${placaDe(id)} está na rua, mas consta como ${linha.veiculo.status.toLowerCase()}`,
        detalhe: "Um dos dois registros está errado. Vale conferir antes de o carro sumir do controle.",
        idVeiculo: id,
        href: `/frota/${id}`,
      });
    }
  }

  for (const r of args.rascunhos) {
    const dias = diasEntre(r.criado_em, hoje);
    if (dias < DIAS_RASCUNHO_PARADO) continue;
    alertas.push({
      id: `rascunho-${r.id_checklist}`,
      nivel: dias >= 7 ? "URGENTE" : "ATENCAO",
      titulo: `Saída não finalizada há ${dias} ${dias === 1 ? "dia" : "dias"}`,
      detalhe: `${placaDe(r.id_veiculo)}, com ${r.condutor_nome}. Sem as quatro fotos, a saída não vale como registro.`,
      idVeiculo: r.id_veiculo,
      href: `/frota/${r.id_veiculo}/saida/${r.id_checklist}`,
    });
  }

  for (const s of args.sinistros) {
    if (s.status !== "ABERTO" && s.status !== "EM_ANALISE") continue;
    const dias = diasEntre(`${s.data_ocorrencia}T12:00:00`, hoje);
    if (dias < 30) continue;
    alertas.push({
      id: `sinistro-${s.id_sinistro}`,
      nivel: dias >= 90 ? "URGENTE" : "ATENCAO",
      titulo: `Sinistro sem desfecho há ${dias} dias`,
      detalhe: `${placaDe(s.id_veiculo)} — ${s.descricao.slice(0, 90)}`,
      idVeiculo: s.id_veiculo,
      href: `/frota/${s.id_veiculo}`,
    });
  }

  for (const m of args.manutencoes) {
    if (m.status === "CANCELADA") continue;
    const kmVeiculo = args.situacao.find((l) => l.veiculo.id_veiculo === m.id_veiculo)?.veiculo;
    const kmAtual = kmVeiculo ? kmVeiculo.km_atual ?? kmVeiculo.km_cadastro : null;

    if (m.proxima_revisao_data) {
      const dias = diasEntre(hoje, `${m.proxima_revisao_data}T12:00:00`);
      if (dias <= DIAS_REVISAO_PROXIMA) {
        alertas.push({
          id: `revisao-data-${m.id_manutencao}`,
          nivel: dias < 0 ? "URGENTE" : "ATENCAO",
          titulo:
            dias < 0
              ? `${placaDe(m.id_veiculo)}: revisão vencida há ${Math.abs(dias)} dias`
              : `${placaDe(m.id_veiculo)}: revisão em ${dias} dias`,
          detalhe: `Marcada na manutenção de ${m.data_entrada.slice(8, 10)}/${m.data_entrada.slice(5, 7)} — ${m.descricao.slice(0, 70)}`,
          idVeiculo: m.id_veiculo,
          href: `/frota/${m.id_veiculo}`,
        });
      }
    }

    if (m.proxima_revisao_km != null && kmAtual != null) {
      const faltam = m.proxima_revisao_km - kmAtual;
      if (faltam <= KM_REVISAO_PROXIMA) {
        alertas.push({
          id: `revisao-km-${m.id_manutencao}`,
          nivel: faltam < 0 ? "URGENTE" : "ATENCAO",
          titulo:
            faltam < 0
              ? `${placaDe(m.id_veiculo)}: revisão passou ${Math.abs(faltam).toLocaleString("pt-BR")} km`
              : `${placaDe(m.id_veiculo)}: faltam ${faltam.toLocaleString("pt-BR")} km para a revisão`,
          detalhe: `Prevista para ${m.proxima_revisao_km.toLocaleString("pt-BR")} km.`,
          idVeiculo: m.id_veiculo,
          href: `/frota/${m.id_veiculo}`,
        });
      }
    }
  }

  // Urgente primeiro; dentro do nível, a ordem em que foram achados — que já é
  // a ordem das listas, todas vindas do banco por data decrescente.
  return alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "URGENTE" ? -1 : 1));
}

// ─── Formatação compartilhada pelas telas do módulo ─────────────────────────

export function moeda(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function numero(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "17/08/2026 14:30". Aceita ISO com ou sem hora. */
export function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** "17/08/2026" a partir de uma data pura (`date` do Postgres, sem fuso).
 *  Não passa por `new Date`: "2026-08-17" viraria 16/08 em fuso negativo. */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : "—";
}
