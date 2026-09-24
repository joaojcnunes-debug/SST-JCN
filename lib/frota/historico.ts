/**
 * A LINHA DO TEMPO DO VEÍCULO — tudo que aconteceu com um carro, em ordem.
 *
 * O PEDIDO, nas palavras do operador: "crie um histórico do veículo; quando
 * você clica nele aparece seu documento e seu registro — para onde foi, se
 * ocorreu algo, o percurso, e os problemas ou coisas que aconteceram".
 *
 * O que existia antes eram cinco abas separadas: fotos, sinistros,
 * abastecimentos, saídas e uma visão geral. Cada uma respondia a sua pergunta e
 * nenhuma respondia a pergunta que o gestor faz de verdade, que é ao mesmo
 * tempo mais simples e mais difícil: *o que já aconteceu com este carro?* Para
 * responder era preciso abrir as cinco abas e casar datas na cabeça.
 *
 * Este arquivo faz esse casamento em um lugar só, e é FUNÇÃO PURA de propósito:
 * recebe as listas já carregadas e devolve eventos ordenados. Sem consulta, sem
 * hook, sem `new Date()` escondido. A tela decide ícone e cor; a ordem e o
 * conteúdo de cada linha são decididos aqui, onde dá para conferir.
 */

import { formatarKm } from "@/lib/frota/km";
import { enderecoEmLinha } from "@/lib/frota/maps";
import { moeda } from "@/lib/frota/painel";
import {
  ROTULO_COMBUSTIVEL,
  ROTULO_STATUS_MANUTENCAO,
  ROTULO_STATUS_SINISTRO,
  ROTULO_TIPO_MANUTENCAO,
  ROTULO_TIPO_SINISTRO,
  type FrotaAbastecimento,
  type FrotaChecklist,
  type FrotaLotacao,
  type FrotaManutencao,
  type FrotaRota,
  type FrotaSinistro,
  type FrotaVeiculo,
} from "@/lib/frota/tipos";

export const TIPOS_EVENTO = [
  "CADASTRO",
  "SAIDA",
  "RETORNO",
  "ABASTECIMENTO",
  "SINISTRO",
  "MANUTENCAO",
  "LOTACAO",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const ROTULO_TIPO_EVENTO: Record<TipoEvento, string> = {
  CADASTRO: "Cadastro",
  SAIDA: "Saídas",
  RETORNO: "Retornos",
  ABASTECIMENTO: "Abastecimentos",
  SINISTRO: "Ocorrências",
  MANUTENCAO: "Manutenção",
  LOTACAO: "Mudança de base",
};

export type EventoHistorico = {
  id: string;
  tipo: TipoEvento;
  /** ISO. É por ela que a lista é ordenada, da mais recente para a mais antiga. */
  quando: string;
  titulo: string;
  /** A linha de baixo: quem, onde, quanto. */
  detalhe: string | null;
  /** O percurso da viagem, quando houver — cada trecho já em texto. */
  trechos: string[];
  /**
   * O que deu errado. Sai destacado na tela: avaria constatada, avaria na
   * volta, descrição do sinistro. É a parte do "problemas ou coisas que
   * aconteceram" que não pode se perder no meio do resto.
   */
  problema: string | null;
  /** Leitura de odômetro associada ao evento, quando existe. */
  km: number | null;
  /** Para onde o clique leva. Nulo quando o evento não tem tela própria. */
  href: string | null;
};

const iso = (d: string | null | undefined): string => d ?? "";

/** "2026-08-17" (date do Postgres) → ISO com hora, para ordenar junto do resto.
 *  Meio-dia, e não meia-noite, para não trocar de dia em fuso negativo. */
const doDia = (data: string): string => `${data.slice(0, 10)}T12:00:00`;

export function montarHistorico(args: {
  veiculo: FrotaVeiculo;
  saidas: FrotaChecklist[];
  rotas: FrotaRota[];
  abastecimentos: FrotaAbastecimento[];
  sinistros: FrotaSinistro[];
  manutencoes: FrotaManutencao[];
  lotacoes: FrotaLotacao[];
  /** A tela sabe o nome das bases; este arquivo não consulta nada. */
  nomeBase: (idUnidade: string | null) => string;
}): EventoHistorico[] {
  const eventos: EventoHistorico[] = [];

  // Os trechos de cada saída, agrupados uma vez. Buscar dentro do laço faria
  // uma varredura da lista inteira por viagem — barato com dez, tolo com mil.
  const trechosPorSaida = new Map<string, string[]>();
  for (const r of [...args.rotas].sort((a, b) => a.ordem - b.ordem)) {
    const linha = [
      `${r.origem} → ${r.destino}`,
      r.km_percorrido != null ? `${formatarKm(r.km_percorrido)} km` : null,
      r.finalidade,
    ]
      .filter(Boolean)
      .join(" · ");
    const atual = trechosPorSaida.get(r.id_checklist) ?? [];
    atual.push(linha);
    trechosPorSaida.set(r.id_checklist, atual);
  }

  // ── O começo de tudo ──────────────────────────────────────
  eventos.push({
    id: `cadastro-${args.veiculo.id_veiculo}`,
    tipo: "CADASTRO",
    quando: args.veiculo.criado_em,
    titulo: "Veículo cadastrado",
    detalhe: [
      `na base ${args.nomeBase(args.veiculo.id_unidade)}`,
      `com ${formatarKm(args.veiculo.km_cadastro)} km`,
      args.veiculo.criado_por ? `por ${args.veiculo.criado_por}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    trechos: [],
    // A linha de base da lataria entra como "problema" de propósito: é contra
    // ela que toda avaria futura é comparada, e quem lê o histórico precisa
    // saber o que o carro já tinha antes da primeira viagem.
    problema: args.veiculo.avarias_padrao?.trim()
      ? `Já existia no cadastro: ${args.veiculo.avarias_padrao.trim()}`
      : null,
    km: args.veiculo.km_cadastro,
    href: null,
  });

  // ── Saídas e retornos: DOIS eventos, não um ───────────────
  // A viagem que saiu em 30 de julho e voltou em 2 de agosto tem de aparecer
  // nos dois dias. Um evento só a colocaria em um deles, e a leitura do
  // histórico perderia justamente a informação de que o carro passou dias fora.
  for (const s of args.saidas) {
    const trechos = trechosPorSaida.get(s.id_checklist) ?? [];
    const href = `/frota/${s.id_veiculo}/saida/${s.id_checklist}`;

    eventos.push({
      id: `saida-${s.id_checklist}`,
      tipo: "SAIDA",
      quando: s.data_saida,
      titulo:
        s.status === "RASCUNHO"
          ? `Saída não finalizada — ${s.condutor_nome}`
          : `Saiu com ${s.condutor_nome}`,
      detalhe: [enderecoEmLinha(s) || null, `${formatarKm(s.km_saida)} km`]
        .filter(Boolean)
        .join(" · "),
      trechos,
      problema: s.avarias_constatadas?.trim()
        ? `Constatado na saída: ${s.avarias_constatadas.trim()}`
        : null,
      km: s.km_saida,
      href,
    });

    if (s.data_retorno) {
      const rodado = s.km_retorno != null ? s.km_retorno - s.km_saida : null;
      eventos.push({
        id: `retorno-${s.id_checklist}`,
        tipo: "RETORNO",
        quando: s.data_retorno,
        titulo: rodado != null ? `Voltou — ${formatarKm(rodado)} km na viagem` : "Voltou",
        detalhe: [
          s.condutor_nome,
          s.km_retorno != null ? `${formatarKm(s.km_retorno)} km` : "sem km informado",
          s.retorno_por ? `registrado por ${s.retorno_por}` : null,
          s.retorno_observacao,
        ]
          .filter(Boolean)
          .join(" · "),
        trechos: [],
        problema: s.avarias_retorno?.trim() ? `Na volta: ${s.avarias_retorno.trim()}` : null,
        km: s.km_retorno,
        href,
      });
    }
  }

  for (const a of args.abastecimentos) {
    eventos.push({
      id: `abast-${a.id_abastecimento}`,
      tipo: "ABASTECIMENTO",
      quando: a.data_hora,
      titulo: [
        ROTULO_COMBUSTIVEL[a.tipo_combustivel],
        a.litros != null ? `${a.litros} L` : null,
        a.valor_total != null ? moeda(a.valor_total) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      detalhe: [
        a.posto,
        a.cidade_uf,
        a.condutor_nome,
        a.tanque_cheio ? "tanque cheio" : "tanque parcial",
        a.km_odometro != null ? `odômetro ${formatarKm(a.km_odometro)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      trechos: [],
      problema: null,
      km: a.km_odometro,
      href: null,
    });
  }

  for (const s of args.sinistros) {
    eventos.push({
      id: `sin-${s.id_sinistro}`,
      tipo: "SINISTRO",
      quando: s.hora_ocorrencia
        ? `${s.data_ocorrencia.slice(0, 10)}T${s.hora_ocorrencia}`
        : doDia(s.data_ocorrencia),
      titulo: `${ROTULO_TIPO_SINISTRO[s.tipo]}${s.com_vitima ? " — com vítima" : ""}`,
      detalhe: [
        ROTULO_STATUS_SINISTRO[s.status],
        s.condutor_nome,
        s.local_ocorrencia,
        s.seguradora,
        s.valor_prejuizo != null ? `prejuízo ${moeda(s.valor_prejuizo)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      trechos: [],
      problema: s.descricao,
      km: null,
      href: null,
    });
  }

  for (const m of args.manutencoes) {
    eventos.push({
      id: `man-${m.id_manutencao}`,
      tipo: "MANUTENCAO",
      quando: doDia(m.data_entrada),
      titulo: `${ROTULO_TIPO_MANUTENCAO[m.tipo]} — ${ROTULO_STATUS_MANUTENCAO[m.status]}`,
      detalhe: [
        m.oficina,
        m.valor != null ? moeda(m.valor) : null,
        m.data_saida ? `saiu em ${m.data_saida.slice(8, 10)}/${m.data_saida.slice(5, 7)}` : "ainda na oficina",
        m.km_odometro != null ? `odômetro ${formatarKm(m.km_odometro)}` : null,
        m.proxima_revisao_km != null
          ? `próxima aos ${formatarKm(m.proxima_revisao_km)} km`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      trechos: [],
      problema: m.descricao,
      km: m.km_odometro,
      href: null,
    });
  }

  for (const l of args.lotacoes) {
    eventos.push({
      id: `lot-${l.id_lotacao}`,
      tipo: "LOTACAO",
      quando: l.data_movimentacao,
      titulo: `Mudou de base: ${args.nomeBase(l.id_unidade_origem)} → ${args.nomeBase(l.id_unidade_destino)}`,
      detalhe: [
        l.motivo,
        l.responsavel_nome ? `por ${l.responsavel_nome}` : null,
        l.km_percorrido != null ? `${formatarKm(l.km_percorrido)} km no trecho` : null,
        l.observacao,
      ]
        .filter(Boolean)
        .join(" · "),
      trechos: [],
      problema: null,
      km: l.km_odometro,
      href: null,
    });
  }

  // Mais recente primeiro. Evento sem data válida vai para o fim em vez de
  // embaralhar a lista — `new Date("")` é NaN, e NaN em comparador produz
  // ordenação imprevisível conforme o algoritmo de sort.
  return eventos.sort((a, b) => {
    const ta = new Date(iso(a.quando)).getTime();
    const tb = new Date(iso(b.quando)).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
}

/** Quantos eventos de cada tipo — alimenta os filtros da linha do tempo. */
export function contarPorTipo(eventos: EventoHistorico[]): Record<TipoEvento, number> {
  const base = Object.fromEntries(TIPOS_EVENTO.map((t) => [t, 0])) as Record<TipoEvento, number>;
  for (const e of eventos) base[e.tipo]++;
  return base;
}
