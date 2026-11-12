// Colunas da lista de subtarefas como no Runrun (v357, 11/11/2026): Etapa, Tipo, Alocados, Horas trabalhadas,
// Progresso e Início desejado. Os valores vêm da sincronização (gestao_subtarefas); subtarefa criada na Gestão
// fica com eles vazios e usa o que já tem (status pelo "feito", responsável como alocado).

import type { GestaoStatus } from "@/lib/hooks/useGestao";

export interface AlocadoSubtarefa {
  email: string | null;
  nome: string;
  /** Já entregou a parte dela (no Runrun, o visto na foto). */
  feito: boolean;
}

/** Segundos → "00h00", como a coluna Horas trabalhadas do Runrun (as horas passam de 99 sem cortar). */
export function fmtHorasTrabalhadas(seg: number | null | undefined): string {
  const total = Math.max(0, Math.floor((seg ?? 0) / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

/** Progresso em % arredondado, sem limite (o Runrun mostra 3394% quando estoura); a barra para em 100. */
export function progressoExibir(p: number | null | undefined): { texto: string; barra: number } {
  const v = Number.isFinite(p) ? Math.max(0, Number(p)) : 0;
  return { texto: `${Math.round(v)}%`, barra: Math.min(100, v) };
}

/** Início e entrega desejados → "28/10/2026 12:00" no horário de Brasília (o do Runrun, que mostra a hora até quando é
 *  23:59, o "só o dia"); vazio → null. */
export function fmtDataDesejada(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Entrega desejada vencida numa subtarefa aberta: no Runrun a linha fica vermelha com um alerta (v358). */
export function entregaAtrasada(iso: string | null | undefined, feito: boolean, agora: Date = new Date()): boolean {
  if (!iso || feito) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < agora.getTime();
}

/** Texto preto ou branco sobre a cor do tipo (as claras do Runrun, #DCEDC8 e #F8BBD0, pedem texto escuro). */
export function corTextoSobre(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#1f2937" : "#ffffff";
}

/** Etapa da subtarefa: o nome do Runrun; senão o da etapa do SST (slug) no quadro da tarefa; senão nada.
 *  `concluida` pinta de verde, como "Concluída" no Runrun. */
export function etapaExibir(
  s: { etapa?: string | null; etapa_nome?: string | null; feito: boolean },
  statuses: Pick<GestaoStatus, "slug" | "nome" | "tipo">[],
): { nome: string; concluida: boolean } | null {
  const doQuadro = s.etapa ? statuses.find((x) => x.slug === s.etapa) : undefined;
  const nome = (s.etapa_nome ?? "").trim() || doQuadro?.nome || null;
  if (!nome) return null;
  const porNome = statuses.find((x) => x.nome.trim().toLowerCase() === nome.toLowerCase());
  const tipo = doQuadro?.tipo ?? porNome?.tipo;
  return { nome, concluida: tipo ? tipo === "concluido" : s.feito };
}

/** Quem aparece em Alocados: as pessoas do Runrun; sem elas, o responsável da Gestão. */
export function alocadosExibir(
  s: { alocados?: AlocadoSubtarefa[] | null; responsavel_email: string | null; feito: boolean },
  nomeDe: (email: string) => string | null,
): AlocadoSubtarefa[] {
  const lista = (s.alocados ?? []).filter((a) => a && (a.email || a.nome));
  if (lista.length) return lista.map((a) => ({ ...a, nome: (a.email && nomeDe(a.email)) || a.nome || a.email || "" }));
  if (!s.responsavel_email) return [];
  return [{ email: s.responsavel_email, nome: nomeDe(s.responsavel_email) ?? s.responsavel_email, feito: false }];
}
