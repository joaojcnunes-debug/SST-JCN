// Calendário da Gestão (v0.3.914, como o do Runrun): regras puras das visões Mês, Semana, Dia e Agenda.
// A tela (components/gestao/VistaCalendario.tsx) só desenha o que sai daqui.
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export type VistaCal = "mes" | "semana" | "dia" | "agenda";
export type CorPor = "prioridade" | "status" | "situacao";
export type Situacao = "concluida" | "atrasada" | "hoje" | "no_prazo";

/** De que dia a que dia a tarefa ocupa o calendário, e em que horário (null = dia inteiro). */
export interface Intervalo {
  inicio: string; // yyyy-MM-dd
  fim: string; // yyyy-MM-dd (>= inicio)
  horaIni: string | null; // HH:mm
  horaFim: string | null; // HH:mm
}

interface DatasTarefa {
  prazo: string | null;
  data_inicio: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

export const MIN_DIA = 24 * 60;

/** 'HH:MM:SS' ou 'HH:MM' → 'HH:MM'; vazio → null. */
export function hhmm(h: string | null | undefined): string | null {
  const s = (h ?? "").trim();
  return /^\d{1,2}:\d{2}/.test(s) ? s.slice(0, 5).padStart(5, "0") : null;
}

export function minutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

export function horaDe(min: number): string {
  const m = Math.max(0, Math.min(MIN_DIA - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * O intervalo da tarefa. O dia de referência é o prazo; sem prazo, só onde `inicioSemPrazo`
 * (Agenda do Meu Espaço/Meu Quadro) a data de início entra no lugar. Início antes do prazo vira
 * uma faixa de vários dias (como "Início desejado → Entrega desejada" no Runrun); início depois do
 * prazo é ignorado.
 */
export function intervaloDa(t: DatasTarefa, inicioSemPrazo = false): Intervalo | null {
  const fim = t.prazo ?? (inicioSemPrazo ? t.data_inicio : null);
  if (!fim) return null;
  const inicio = t.prazo && t.data_inicio && t.data_inicio < t.prazo ? t.data_inicio : fim;
  return { inicio, fim, horaIni: hhmm(t.hora_inicio), horaFim: hhmm(t.hora_fim) };
}

export const ehVariosDias = (iv: Intervalo) => iv.inicio < iv.fim;
/** Na Semana/Dia: vai para a grade de horários (um dia só, com hora de início). */
export const ehComHorario = (iv: Intervalo) => !ehVariosDias(iv) && !!iv.horaIni;

/** Minutos de início e fim do bloco na grade. Sem fim (ou fim antes do início): 1 hora. */
export function blocoDe(iv: Intervalo): { ini: number; fim: number } {
  const ini = iv.horaIni ? minutos(iv.horaIni) : 0;
  const f = iv.horaFim ? minutos(iv.horaFim) : null;
  return { ini, fim: f != null && f > ini ? f : Math.min(ini + 60, MIN_DIA) };
}

/** "07:00 – 09:00", "07:00" ou "Dia inteiro". */
export function rotuloHorario(iv: Intervalo): string {
  if (!iv.horaIni) return "Dia inteiro";
  return iv.horaFim && minutos(iv.horaFim) > minutos(iv.horaIni) ? `${iv.horaIni} – ${iv.horaFim}` : iv.horaIni;
}

export function cobreDia(iv: Intervalo, dia: string): boolean {
  return iv.inicio <= dia && dia <= iv.fim;
}

export function cruzaPeriodo(iv: Intervalo, ini: string, fim: string): boolean {
  return iv.inicio <= fim && iv.fim >= ini;
}

export function situacaoDa(iv: Intervalo, concluida: boolean, hoje: string): Situacao {
  if (concluida) return "concluida";
  if (iv.fim < hoje) return "atrasada";
  if (cobreDia(iv, hoje)) return "hoje";
  return "no_prazo";
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  atrasada: "Atrasada",
  hoje: "Para hoje",
  no_prazo: "No prazo",
  concluida: "Concluída",
};
export const COR_SITUACAO: Record<Situacao, string> = {
  atrasada: "#dc2626",
  hoje: "#d97706",
  no_prazo: "#2563eb",
  concluida: "#9ca3af",
};

export function somarDias(dia: string, n: number): string {
  return format(addDays(parseISO(dia), n), "yyyy-MM-dd");
}

export function diasEntre(de: string, ate: string): number {
  return differenceInCalendarDays(parseISO(ate), parseISO(de));
}

export interface Faixa {
  id: string;
  col0: number; // 1ª coluna ocupada no período (0-based)
  col1: number; // última coluna ocupada
  linha: number; // "pista" (0-based), para não sobrepor
  cortadaIni: boolean; // começa antes do período
  cortadaFim: boolean; // termina depois do período
}

/**
 * Faixas (barras) dos itens num período de `ndias` a partir de `ini`: coluna de começo e de fim e
 * a pista em que cada uma cabe sem encostar nas outras. Os mais longos primeiro, para as barras
 * grandes ficarem em cima (como no Runrun).
 */
export function faixasDoPeriodo(itens: { id: string; inicio: string; fim: string }[], ini: string, ndias: number): Faixa[] {
  const fimPer = somarDias(ini, ndias - 1);
  const dentro = itens
    .filter((i) => i.inicio <= fimPer && i.fim >= ini)
    .map((i) => {
      const col0 = Math.max(0, diasEntre(ini, i.inicio));
      const col1 = Math.min(ndias - 1, diasEntre(ini, i.fim));
      return { id: i.id, col0, col1, cortadaIni: i.inicio < ini, cortadaFim: i.fim > fimPer };
    })
    .sort((a, b) => a.col0 - b.col0 || b.col1 - b.col0 - (a.col1 - a.col0) || a.id.localeCompare(b.id));
  const fimDaPista: number[] = [];
  return dentro.map((f) => {
    let linha = fimDaPista.findIndex((c) => c < f.col0);
    if (linha < 0) { linha = fimDaPista.length; fimDaPista.push(f.col1); } else fimDaPista[linha] = f.col1;
    return { ...f, linha };
  });
}

/**
 * Blocos de horário que se sobrepõem dividem a largura (como no Google Agenda/Runrun): cada bloco
 * recebe a coluna e quantas colunas o grupo de sobreposição dele usa.
 */
export function colunasDosBlocos(blocos: { id: string; ini: number; fim: number }[]): Map<string, { col: number; ncols: number }> {
  const ord = [...blocos].sort((a, b) => a.ini - b.ini || b.fim - a.fim || a.id.localeCompare(b.id));
  const out = new Map<string, { col: number; ncols: number }>();
  let grupo: { id: string; col: number }[] = [];
  let fimGrupo = -1;
  let fimCol: number[] = [];
  const fechar = () => {
    const n = fimCol.length;
    for (const g of grupo) out.set(g.id, { col: g.col, ncols: n });
    grupo = [];
    fimCol = [];
  };
  for (const b of ord) {
    if (grupo.length && b.ini >= fimGrupo) fechar();
    let col = fimCol.findIndex((f) => f <= b.ini);
    if (col < 0) { col = fimCol.length; fimCol.push(b.fim); } else fimCol[col] = b.fim;
    grupo.push({ id: b.id, col });
    fimGrupo = Math.max(grupo.length === 1 ? b.fim : fimGrupo, b.fim);
  }
  if (grupo.length) fechar();
  return out;
}

export interface PatchDatas {
  prazo?: string;
  data_inicio?: string;
  hora_inicio?: string;
  hora_fim?: string;
}

/**
 * O que gravar ao soltar a tarefa noutro dia (e, na grade da Semana/Dia, noutro horário). As datas
 * andam juntas (prazo e início com o mesmo deslocamento), então a duração fica igual. Com horário,
 * o fim acompanha a duração que a tarefa tinha (sem fim: 1 hora). Devolve null se nada muda.
 */
export function moverTarefa(t: DatasTarefa, iv: Intervalo, novoDia: string, novaHora?: string): PatchDatas | null {
  const patch: PatchDatas = {};
  const delta = diasEntre(iv.inicio, novoDia);
  if (delta !== 0) {
    if (t.prazo) patch.prazo = somarDias(t.prazo, delta);
    if (t.data_inicio) patch.data_inicio = somarDias(t.data_inicio, delta);
  }
  if (novaHora) {
    const atual = iv.horaIni;
    if (novaHora !== atual) {
      const dur = atual ? blocoDe(iv).fim - blocoDe(iv).ini : 60;
      patch.hora_inicio = novaHora;
      patch.hora_fim = horaDe(Math.min(minutos(novaHora) + dur, MIN_DIA - 1));
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Iniciais para o avatar pequeno ("Ana Souza" → "AS"). */
export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
