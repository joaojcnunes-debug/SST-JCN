/**
 * Presença no painel — as regras que a tela e o card usam (v218).
 *
 * O dado que chega é o de `presenca_resumo()`: por pessoa, quando entrou hoje,
 * última atividade, minutos com ping. Aqui mora só o que é decisão de
 * apresentação: qual cor a pessoa recebe, como se diz "há 29 min", e como se
 * agrupa os blocos de 5 min em dias e sessões.
 *
 * O que ISSO mede: atividade no painel (mouse/teclado com a aba aberta). Não
 * mede trabalho — técnico em campo com o app offline não gera ping. Todo texto
 * que sair daqui diz "no painel", nunca "trabalhando".
 */

export type StatusPresenca = "ativo" | "ausente" | "fora";

/** Mexeu nos últimos 5 min → ativo. */
export const LIMIAR_ATIVO_MS = 5 * 60_000;
/** Parado entre 5 e 30 min → ausente. Acima → fora. */
export const LIMIAR_AUSENTE_MS = 30 * 60_000;
/** Tamanho do bloco gravado pelo banco. */
export const BLOCO_MS = 5 * 60_000;
/** Dois blocos separados por mais que isto viram sessões diferentes. */
export const INTERVALO_NOVA_SESSAO_MS = 30 * 60_000;

export interface PresencaResumoRow {
  usuario_email: string;
  nome: string;
  perfil: string;
  cargo: string | null;
  entrou_em: string | null;
  ultima_atividade: string | null;
  blocos: number;
  minutos_ativos: number;
  ultima_atividade_geral: string | null;
}

export interface PresencaPessoa extends PresencaResumoRow {
  status: StatusPresenca;
  /** ms desde a última atividade de HOJE; null se não entrou hoje. */
  inativoHaMs: number | null;
}

export const ROTULO_STATUS: Record<StatusPresenca, string> = {
  ativo: "Ativo agora",
  ausente: "Ausente",
  fora: "Fora",
};

/** Classes do ponto de status (fundo) e da tarja (badge). */
export const COR_STATUS: Record<StatusPresenca, { ponto: string; tarja: string }> = {
  ativo: { ponto: "bg-emerald-500", tarja: "bg-emerald-100 text-emerald-700" },
  ausente: { ponto: "bg-amber-500", tarja: "bg-amber-100 text-amber-700" },
  fora: { ponto: "bg-gray-400", tarja: "bg-gray-100 text-gray-600" },
};

export function statusDe(ultimaAtividade: string | null, agora: number): StatusPresenca {
  if (!ultimaAtividade) return "fora";
  const dt = agora - new Date(ultimaAtividade).getTime();
  if (dt <= LIMIAR_ATIVO_MS) return "ativo";
  if (dt <= LIMIAR_AUSENTE_MS) return "ausente";
  return "fora";
}

/**
 * Classifica e ordena: ausentes primeiro (é o que se quer ver), depois ativos,
 * depois quem já saiu, depois quem não entrou. Dentro do grupo, pelo nome.
 */
export function classificar(rows: PresencaResumoRow[], agora: number): PresencaPessoa[] {
  const peso: Record<StatusPresenca, number> = { ausente: 0, ativo: 1, fora: 2 };
  return rows
    .map((r) => ({
      ...r,
      status: statusDe(r.ultima_atividade, agora),
      inativoHaMs: r.ultima_atividade ? agora - new Date(r.ultima_atividade).getTime() : null,
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return peso[a.status] - peso[b.status];
      // Entre os "fora", quem entrou hoje vem antes de quem não entrou.
      const aEntrou = a.entrou_em ? 0 : 1;
      const bEntrou = b.entrou_em ? 0 : 1;
      if (aEntrou !== bEntrou) return aEntrou - bEntrou;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

export function contarPorStatus(pessoas: PresencaPessoa[]): Record<StatusPresenca, number> & { semEntrar: number } {
  const c = { ativo: 0, ausente: 0, fora: 0, semEntrar: 0 };
  for (const p of pessoas) {
    c[p.status]++;
    if (!p.entrou_em) c.semEntrar++;
  }
  return c;
}

/** "há 29 min", "há 2 h", "há 3 dias", "agora". */
export function haQuantoTempo(desde: string | null, agora: number): string {
  if (!desde) return "—";
  const ms = agora - new Date(desde).getTime();
  if (ms < 60_000) return "agora";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** 0 → "—", 45 → "45 min", 140 → "2h20". */
export function formatarMinutos(min: number): string {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function horaLocal(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function diaLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // sv-SE dá YYYY-MM-DD direto, no fuso pedido.
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// ── Blocos → dias e sessões (tela de detalhe) ────────────────────────────────

export interface PresencaBloco {
  bloco: string;
  primeiro_em: string;
  ultimo_em: string;
  pings: number;
  origem: string | null;
}

export interface SessaoPresenca {
  inicio: string;
  fim: string;
  blocos: number;
  minutos: number;
}

export interface DiaPresenca {
  dia: string; // YYYY-MM-DD (America/Sao_Paulo)
  entrou: string;
  saiu: string;
  blocos: number;
  minutos: number;
  sessoes: SessaoPresenca[];
}

/**
 * Agrupa os blocos por dia civil (RJ) e, dentro do dia, em sessões: dois
 * blocos a mais de 30 min um do outro são períodos diferentes de uso. Devolve
 * do dia mais recente ao mais antigo.
 */
export function agruparPorDia(blocos: PresencaBloco[]): DiaPresenca[] {
  const ordenados = [...blocos].sort((a, b) => a.bloco.localeCompare(b.bloco));
  const porDia = new Map<string, PresencaBloco[]>();
  for (const b of ordenados) {
    const dia = diaLocal(b.bloco);
    const lista = porDia.get(dia);
    if (lista) lista.push(b);
    else porDia.set(dia, [b]);
  }

  const dias: DiaPresenca[] = [];
  for (const [dia, lista] of porDia) {
    const sessoes: SessaoPresenca[] = [];
    let atual: SessaoPresenca | null = null;
    let ultimoBlocoMs = 0;
    for (const b of lista) {
      const inicioMs = new Date(b.bloco).getTime();
      const minutos = Math.min(b.pings, 5);
      if (atual && inicioMs - ultimoBlocoMs <= INTERVALO_NOVA_SESSAO_MS) {
        atual.fim = b.ultimo_em;
        atual.blocos++;
        atual.minutos += minutos;
      } else {
        atual = { inicio: b.primeiro_em, fim: b.ultimo_em, blocos: 1, minutos };
        sessoes.push(atual);
      }
      ultimoBlocoMs = inicioMs;
    }
    dias.push({
      dia,
      entrou: lista[0].primeiro_em,
      saiu: lista[lista.length - 1].ultimo_em,
      blocos: lista.length,
      minutos: sessoes.reduce((s, x) => s + x.minutos, 0),
      sessoes,
    });
  }
  return dias.sort((a, b) => b.dia.localeCompare(a.dia));
}
