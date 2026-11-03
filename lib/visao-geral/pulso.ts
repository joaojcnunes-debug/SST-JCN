/**
 * Pulso de segurança da Visão geral (Etapa 4 do docs/plano-skin-viva-jcn.md).
 *
 * Fórmula aprovada pelo João em 03/11/2026 (só na Visão geral, não no portal do cliente):
 *   Documentos = válidos ÷ documentos com validade × 100   (válidos = em dia + a vencer;
 *                "sem validade" fica FORA da conta e aparece à parte)
 *   Ações      = ações 5W2H abertas no prazo ÷ ações abertas × 100   (sem ação aberta = 100)
 *   Pulso      = 70% Documentos + 30% Ações, arredondado
 *   Faixas: 85–100 Em dia · 60–84 Atenção · 0–59 Crítico.
 * Sem nenhum documento com validade não há nota (null): a tela mostra "—" e explica.
 * Testado em pulso.test.ts.
 */

export interface DocumentosValidade {
  emDia: number;
  vencendo: number;
  vencido: number;
  semValidade: number;
}

export interface AcaoPulso {
  status: string | null;
  when_prazo: string | null;
}

export type FaixaPulso = "em_dia" | "atencao" | "critico";

export interface Pulso {
  nota: number | null;
  faixa: FaixaPulso | null;
  docsPct: number | null;
  acoesPct: number;
  validos: number;
  comValidade: number;
  semValidade: number;
  abertas: number;
  noPrazo: number;
}

export const PESO_DOCUMENTOS = 0.7;
export const PESO_ACOES = 0.3;

export const ROTULO_FAIXA: Record<FaixaPulso, string> = {
  em_dia: "Em dia",
  atencao: "Atenção",
  critico: "Crítico",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Ação fechada: "Concluída/Concluida/Concluído" ou "Cancelada" (o status é texto livre). */
export function acaoFechada(status: string | null | undefined): boolean {
  const s = semAcento(status ?? "");
  return s.startsWith("conclu") || s.startsWith("cancel");
}

/** Conta as ações abertas e quantas ainda estão no prazo (sem prazo = no prazo). */
export function contarAcoes(acoes: readonly AcaoPulso[], hojeISO: string): { abertas: number; noPrazo: number } {
  let abertas = 0;
  let noPrazo = 0;
  for (const a of acoes) {
    if (acaoFechada(a.status)) continue;
    abertas++;
    if (!a.when_prazo || a.when_prazo.slice(0, 10) >= hojeISO.slice(0, 10)) noPrazo++;
  }
  return { abertas, noPrazo };
}

export function faixaDaNota(nota: number): FaixaPulso {
  return nota >= 85 ? "em_dia" : nota >= 60 ? "atencao" : "critico";
}

export function calcularPulso(docs: DocumentosValidade, acoes: { abertas: number; noPrazo: number }): Pulso {
  const validos = docs.emDia + docs.vencendo;
  const comValidade = validos + docs.vencido;
  const docsPct = comValidade > 0 ? (validos / comValidade) * 100 : null;
  const acoesPct = acoes.abertas > 0 ? (acoes.noPrazo / acoes.abertas) * 100 : 100;
  const nota = docsPct === null ? null : Math.round(PESO_DOCUMENTOS * docsPct + PESO_ACOES * acoesPct);
  return {
    nota,
    faixa: nota === null ? null : faixaDaNota(nota),
    docsPct,
    acoesPct,
    validos,
    comValidade,
    semValidade: docs.semValidade,
    abertas: acoes.abertas,
    noPrazo: acoes.noPrazo,
  };
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** A composição em uma linha — o texto que aparece ao passar o mouse. */
export function composicaoPulso(p: Pulso): string {
  const docs =
    p.docsPct === null
      ? "Documentos: nenhum com validade informada"
      : `Documentos ${pct(p.docsPct)} (${p.validos} válidos de ${p.comValidade}), peso 70%`;
  const acoes =
    p.abertas === 0
      ? "Ações 5W2H: nenhuma aberta (100%), peso 30%"
      : `Ações 5W2H ${pct(p.acoesPct)} (${p.noPrazo} no prazo de ${p.abertas}), peso 30%`;
  const sem = p.semValidade > 0 ? ` · ${p.semValidade} sem validade (fora da conta)` : "";
  return `${docs} · ${acoes}${sem}.`;
}
