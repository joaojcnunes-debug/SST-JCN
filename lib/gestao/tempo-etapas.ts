/**
 * Tempo da tarefa em cada coluna (item 7 da comparação, 10/11/2026): a partir das mudanças de status gravadas pelo
 * banco (gestao_tarefa_historico, tipo 'status'), soma quanto tempo a tarefa ficou em cada coluna, da criação até
 * agora. Coluna revisitada soma as passagens. Função pura — testada offline.
 */

export interface MudancaStatus {
  de: string | null;
  para: string | null;
  em: string;
}

export interface TempoEtapa {
  slug: string;
  ms: number;
  atual: boolean;
}

export function tempoPorEtapa(criadaEm: string, statusAtual: string, mudancas: MudancaStatus[], agora = Date.now()): TempoEtapa[] {
  const ord = [...mudancas].sort((a, b) => a.em.localeCompare(b.em));
  const acc = new Map<string, number>();
  const ordem: string[] = [];
  const somar = (slug: string, ms: number) => {
    if (!acc.has(slug)) ordem.push(slug);
    acc.set(slug, (acc.get(slug) ?? 0) + Math.max(0, ms));
  };
  let atual: string = ord[0]?.de ?? statusAtual;
  let desde = new Date(criadaEm).getTime();
  for (const m of ord) {
    const t = new Date(m.em).getTime();
    somar(atual, t - desde);
    atual = m.para ?? atual;
    desde = t;
  }
  // O trecho final é sempre da coluna em que a tarefa está agora (se o histórico tiver buraco, vale o status real).
  somar(statusAtual, agora - desde);
  return ordem.map((slug) => ({ slug, ms: acc.get(slug) ?? 0, atual: slug === statusAtual }));
}

/** Quando a tarefa entrou na coluna em que está (última mudança; sem mudança = criação). */
export function entrouNaColunaEm(criadaEm: string, mudancas: MudancaStatus[]): string {
  return mudancas.reduce((u, m) => (m.em > u ? m.em : u), criadaEm);
}

/** "3d 4h", "5h 20min", "12min", "menos de 1min". */
export function formatarTempoLongo(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "menos de 1min";
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}
