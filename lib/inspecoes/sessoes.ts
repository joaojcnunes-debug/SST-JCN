/**
 * Apontamento de tempo do documento (v311, 30/10/2026) — as contas, num lugar só.
 *
 * Cada sessão é um período de trabalho de UMA pessoa (Iniciar → Pausar/Concluir). Decisões
 * dele: só no documento (associados); pausa sozinha com 30 min sem atividade; "aguardando
 * cliente" conta à parte e NÃO entra no tempo trabalhado.
 *
 *  • trabalhado        soma das sessões (pessoa-hora: duas pessoas juntas contam as duas);
 *  • sessão aberta     vale até agora — ou até a última atividade, se parada há 30 min ou mais
 *                      (o banco fecha assim a cada 5 min; a tela já conta igual antes disso);
 *  • aguardando cliente do fim de uma sessão pausada com AGUARDANDO_CLIENTE até o próximo início
 *                      no documento (de qualquer pessoa) — ou até agora, se ninguém voltou.
 *                      Intervalos sobrepostos contam uma vez.
 *
 * Testado em sessoes.test.ts.
 */

export const MINUTOS_INATIVIDADE = 30;

export type MotivoPausa = "PAUSA" | "AGUARDANDO_CLIENTE" | "AGUARDANDO_TECNICO" | "OUTRA_PRIORIDADE" | "FIM_EXPEDIENTE";
export type MotivoFim = MotivoPausa | "TROCA" | "INATIVIDADE" | "CONCLUIDO" | "LIBERADO";

export const MOTIVOS_PAUSA: { valor: MotivoPausa; rotulo: string }[] = [
  { valor: "PAUSA", rotulo: "Pausa" },
  { valor: "AGUARDANDO_CLIENTE", rotulo: "Aguardando cliente" },
  { valor: "AGUARDANDO_TECNICO", rotulo: "Aguardando informação do técnico" },
  { valor: "OUTRA_PRIORIDADE", rotulo: "Outra prioridade" },
  { valor: "FIM_EXPEDIENTE", rotulo: "Fim do expediente" },
];

export const ROTULO_MOTIVO: Record<MotivoFim, string> = {
  ...(Object.fromEntries(MOTIVOS_PAUSA.map((m) => [m.valor, m.rotulo])) as Record<MotivoPausa, string>),
  TROCA: "Iniciou outro documento",
  INATIVIDADE: `Pausa automática (${MINUTOS_INATIVIDADE} min sem atividade)`,
  CONCLUIDO: "Documento concluído",
  LIBERADO: "Documento liberado",
};

export interface SessaoDocumento {
  id_sessao: string;
  id_inspecao: string;
  id_usuario: string;
  nome: string;
  inicio: string;
  ultima_atividade: string;
  fim: string | null;
  motivo_fim: MotivoFim | null;
  fechada_auto: boolean;
  /** v312: ajustada por um supervisor (o antes/depois fica em documento_sessoes_correcoes). */
  corrigida?: boolean;
}

/** Correção de sessão pelo supervisor (documento_sessoes_correcoes, v312). */
export interface CorrecaoSessao {
  id_correcao: string;
  id_sessao: string;
  antes: { inicio: string; fim: string | null; motivo_fim: string | null };
  depois: { inicio: string; fim: string | null; motivo_fim: string | null };
  justificativa: string;
  corrigido_por: string;
  corrigido_em: string;
}

const ms = (iso: string) => new Date(iso).getTime();
const LIMITE = MINUTOS_INATIVIDADE * 60_000;

/** A sessão está correndo agora (aberta e com atividade nos últimos 30 min). */
export function estaAberta(s: SessaoDocumento, agora: number): boolean {
  return !s.fim && agora - ms(s.ultima_atividade) < LIMITE;
}

/** Fim que vale para a conta: o gravado, agora (se correndo) ou a última atividade (se parada). */
export function fimEfetivo(s: SessaoDocumento, agora: number): number {
  if (s.fim) return ms(s.fim);
  return estaAberta(s, agora) ? agora : ms(s.ultima_atividade);
}

export function duracao(s: SessaoDocumento, agora: number): number {
  return Math.max(0, fimEfetivo(s, agora) - ms(s.inicio));
}

export interface ResumoSessoes {
  trabalhadoMs: number;
  aguardandoClienteMs: number;
  /** Por pessoa, quem trabalhou mais primeiro. */
  porPessoa: { idUsuario: string; nome: string; ms: number; aberta: boolean }[];
  /** Esperando o cliente agora (a última pausa foi por isso e ninguém voltou). */
  aguardandoClienteAgora: boolean;
  primeiraEm: string | null;
}

/** @param ate fim da contagem do "aguardando cliente" sem retorno (padrão: agora; ex.: a conclusão). */
export function resumirSessoes(sessoes: readonly SessaoDocumento[], agora: number, ate?: number): ResumoSessoes {
  const ordem = [...sessoes].sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const pessoas = new Map<string, { idUsuario: string; nome: string; ms: number; aberta: boolean }>();
  let trabalhadoMs = 0;
  for (const s of ordem) {
    const d = duracao(s, agora);
    trabalhadoMs += d;
    const p = pessoas.get(s.id_usuario) ?? { idUsuario: s.id_usuario, nome: s.nome, ms: 0, aberta: false };
    p.ms += d;
    p.aberta ||= estaAberta(s, agora);
    pessoas.set(s.id_usuario, p);
  }

  const espera = esperasDoCliente(ordem, agora, ate);
  return {
    trabalhadoMs,
    aguardandoClienteMs: espera.intervalos.reduce((t, [de, a]) => t + (a - de), 0),
    porPessoa: [...pessoas.values()].sort((a, b) => b.ms - a.ms),
    aguardandoClienteAgora: espera.agora,
    primeiraEm: ordem[0]?.inicio ?? null,
  };
}

/**
 * Os períodos de "aguardando cliente" (do fim da pausa até o próximo início no documento, ou até
 * `ate`/agora), já juntando os que se sobrepõem — a linha do tempo do painel desenha estes.
 */
export function esperasDoCliente(
  sessoes: readonly SessaoDocumento[],
  agora: number,
  ate?: number,
): { intervalos: [number, number][]; agora: boolean } {
  const ordem = [...sessoes].sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const esperas: [number, number][] = [];
  let aguardandoAgora = false;
  for (const s of ordem) {
    if (s.motivo_fim !== "AGUARDANDO_CLIENTE" || !s.fim) continue;
    const de = ms(s.fim);
    const volta = ordem.find((o) => ms(o.inicio) >= de);
    const fimEspera = volta ? ms(volta.inicio) : (ate ?? agora);
    if (!volta && ate === undefined) aguardandoAgora = true;
    if (fimEspera > de) esperas.push([de, fimEspera]);
  }
  esperas.sort((a, b) => a[0] - b[0]);
  const juntas: [number, number][] = [];
  for (const e of esperas) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && e[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], e[1]);
    else juntas.push([e[0], e[1]]);
  }
  return { intervalos: juntas, agora: aguardandoAgora };
}

/** "01:42:07" — o cronômetro do painel (as horas passam de 24 se precisar). */
export function fmtCronometro(totalMs: number): string {
  const s = Math.max(0, Math.floor(totalMs / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** A sessão correndo agora desta pessoa neste documento. */
export function minhaSessaoAberta(sessoes: readonly SessaoDocumento[], idUsuario: string | null | undefined, agora: number) {
  if (!idUsuario) return undefined;
  return sessoes.find((s) => s.id_usuario === idUsuario && estaAberta(s, agora));
}

/** "45min", "1h12", "2d 3h". */
export function fmtDuracao(totalMs: number): string {
  const min = Math.floor(totalMs / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${String(min % 60).padStart(2, "0")}`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
