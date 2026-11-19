/**
 * Tempo de campo sem sinal (0.3.315, banco v365, 19/11/2026 — etapa 2 pedida pelo João). No campo falta internet:
 * o Iniciar/Retomar e o Pausar ficam numa FILA no aparelho (localStorage) e a tela já mostra o cronômetro correndo
 * (uma sessão provisória, `local-…`). Quando a conexão volta, a fila é enviada em ordem com o HORÁRIO em que cada
 * coisa aconteceu (`p_quando`; o banco limita a [agora − 24 h, agora] e não sobrepõe a sessão anterior).
 * Funções puras, testadas em campo-offline.test.ts; o envio está em lib/hooks/useCampoOffline.ts.
 */

import type { MotivoFim, SessaoDocumento } from "@/lib/inspecoes/sessoes";

export const CHAVE_CAMPO = "campo-sessoes";
export const CHAVE_FILA = "jcn.campo.fila";

export interface EventoCampo {
  tipo: "iniciar" | "pausar";
  idInspecao: string;
  motivo?: string;
  /** ISO do momento em que aconteceu no aparelho. */
  quando: string;
}

/** A falha foi de rede (sem sinal), e não um "não pode" do banco. */
export function ehFalhaDeRede(err: unknown, online = true): boolean {
  if (!online) return true;
  const msg = String((err as { message?: string } | null)?.message ?? err ?? "").toLowerCase();
  return /failed to fetch|networkerror|network request failed|fetch failed|load failed|err_internet_disconnected/.test(msg);
}

export function lerFila(texto: string | null | undefined): EventoCampo[] {
  try {
    const v = JSON.parse(texto ?? "[]");
    return Array.isArray(v) ? v.filter((e) => e && (e.tipo === "iniciar" || e.tipo === "pausar") && e.idInspecao && e.quando) : [];
  } catch {
    return [];
  }
}

/**
 * A tela enquanto o evento não chega ao banco: iniciar abre uma sessão provisória (fechando outra aberta minha nesta
 * inspeção); pausar fecha a minha sessão aberta com o motivo e o horário.
 */
export function aplicarNaTela(
  sessoes: readonly SessaoDocumento[],
  ev: EventoCampo,
  eu: { id_usuario: string; nome: string },
): SessaoDocumento[] {
  const fecharMinha = (lista: SessaoDocumento[], motivo: MotivoFim) =>
    lista.map((s) => (s.id_usuario === eu.id_usuario && !s.fim ? { ...s, fim: ev.quando, ultima_atividade: ev.quando, motivo_fim: motivo } : s));
  if (ev.tipo === "pausar") return fecharMinha([...sessoes], (ev.motivo ?? "PAUSA") as MotivoFim);
  if (sessoes.some((s) => s.id_usuario === eu.id_usuario && !s.fim)) return [...sessoes];
  return [
    ...sessoes,
    {
      id_sessao: `local-${ev.quando}`,
      id_inspecao: ev.idInspecao,
      id_usuario: eu.id_usuario,
      nome: eu.nome,
      inicio: ev.quando,
      ultima_atividade: ev.quando,
      fim: null,
      motivo_fim: null,
      fechada_auto: false,
    },
  ];
}

/** "Ainda estou aqui" sem sinal: a sessão provisória aberta acompanha a atividade (senão pausaria em 30 min). */
export function marcarAtividadeLocal(sessoes: readonly SessaoDocumento[], agoraIso: string): SessaoDocumento[] {
  return sessoes.map((s) => (s.id_sessao.startsWith("local-") && !s.fim ? { ...s, ultima_atividade: agoraIso } : s));
}
