/**
 * Tempo de campo da inspeção (0.3.314, banco v364, 19/11/2026 — pedido do João: "na página de cadastro de inspeção
 * temos o contador de tempo?"). Mesmo modelo do tempo do documento (lib/inspecoes/sessoes.ts): sessões de uma
 * pessoa, pausa sozinha com 30 min parada. Decisões dele (19/11):
 *   - conta o TÉCNICO DE CAMPO (responsável, quem lançou ou quem está na aba Responsáveis);
 *   - começa pelo botão Iniciar/Retomar (o mesmo painel do tempo do documento); sem o play, o técnico não inclui,
 *     edita nem exclui na inspeção (travaEdicaoCampo) — isso substituiu o "começa sozinho na primeira alteração";
 *   - DESLOCAMENTO conta à parte, como o "aguardando cliente" (do fim da pausa até o próximo início);
 *   - concluir a inspeção fecha as sessões abertas;
 *   - o técnico vê o próprio tempo; a supervisão vê o de todos.
 * Funções puras, testadas em campo.test.ts.
 */

import { esperasPorMotivo, resumirSessoes, type MotivoFim, type SessaoDocumento } from "@/lib/inspecoes/sessoes";

export type MotivoPausaCampo = "PAUSA" | "DESLOCAMENTO" | "AGUARDANDO_CLIENTE" | "OUTRA_PRIORIDADE" | "FIM_EXPEDIENTE";

export const MOTIVOS_PAUSA_CAMPO: { valor: MotivoPausaCampo; rotulo: string }[] = [
  { valor: "PAUSA", rotulo: "Pausa / intervalo" },
  { valor: "DESLOCAMENTO", rotulo: "Deslocamento" },
  { valor: "AGUARDANDO_CLIENTE", rotulo: "Aguardando cliente" },
  { valor: "OUTRA_PRIORIDADE", rotulo: "Outra prioridade" },
  { valor: "FIM_EXPEDIENTE", rotulo: "Fim do expediente" },
];

/** Rótulo do motivo do fim numa sessão de campo (o "CONCLUIDO" aqui é a inspeção, não o documento). */
export function rotuloMotivoCampo(m: MotivoFim | null): string {
  if (!m) return "";
  if (m === "CONCLUIDO") return "Inspeção concluída";
  if (m === "TROCA") return "Iniciou outra inspeção";
  if (m === "INATIVIDADE") return "Pausa automática (30 min sem atividade)";
  return MOTIVOS_PAUSA_CAMPO.find((x) => x.valor === m)?.rotulo ?? m;
}

export interface ResumoCampo {
  trabalhadoMs: number;
  deslocamentoMs: number;
  aguardandoClienteMs: number;
  porPessoa: { idUsuario: string; nome: string; ms: number; aberta: boolean }[];
  /** Em deslocamento agora (a última pausa foi por isso e ninguém voltou). */
  deslocandoAgora: boolean;
}

const soma = (xs: [number, number][]) => xs.reduce((t, [de, ate]) => t + (ate - de), 0);

/** Totais do campo; com `idUsuario`, só as sessões dessa pessoa (o técnico vê o próprio). */
export function resumirCampo(sessoes: readonly SessaoDocumento[], agora: number, idUsuario?: string | null): ResumoCampo {
  const minhas = idUsuario ? sessoes.filter((s) => s.id_usuario === idUsuario) : sessoes;
  const base = resumirSessoes(minhas, agora);
  const desloc = esperasPorMotivo(minhas, "DESLOCAMENTO", agora);
  return {
    trabalhadoMs: base.trabalhadoMs,
    deslocamentoMs: soma(desloc.intervalos),
    aguardandoClienteMs: base.aguardandoClienteMs,
    porPessoa: base.porPessoa,
    deslocandoAgora: desloc.agora,
  };
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mesma regra do banco (campo_sessao_pode): responsável (nome), quem lançou (e-mail) ou aba Responsáveis. */
export function ehTecnicoDeCampo(
  insp: { responsavel?: string | null; usuario?: string | null },
  responsaveis: readonly { id_usuario?: string | null; tecnico_responsavel?: string | null }[],
  u: { id_usuario?: string | null; nome?: string | null; email?: string | null } | null | undefined,
): boolean {
  if (!u) return false;
  const nome = norm(u.nome);
  if (nome && norm(insp.responsavel) === nome) return true;
  if (u.email && norm(insp.usuario) === norm(u.email)) return true;
  return responsaveis.some(
    (r) => (!!u.id_usuario && r.id_usuario === u.id_usuario) || (!!nome && norm(r.tecnico_responsavel) === nome),
  );
}

/**
 * Trava da edição (0.3.314, pedido do João: "só com o play ligado o colaborador pode inserir, editar e excluir, como
 * na parte do relatório, para contabilizar o tempo de trabalho"). Vale para o técnico de campo que não é supervisor
 * (a mesma exceção do tempo do documento), com permissão de editar, na inspeção não concluída e sem a sessão de campo
 * dele correndo. Enquanto as sessões carregam, não trava.
 */
export function travaEdicaoCampo(p: {
  carregando: boolean;
  tecnico: boolean;
  supervisor: boolean;
  podeEditar: boolean;
  concluida: boolean;
  sessaoAberta: boolean;
}): boolean {
  return !p.carregando && p.tecnico && !p.supervisor && p.podeEditar && !p.concluida && !p.sessaoAberta;
}
