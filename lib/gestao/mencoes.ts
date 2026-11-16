// "@" nos comentários da Gestão (v368, 12/11/2026): sugerir pessoas ao digitar "@", inserir o nome e destacar quem foi
// marcado. Quem AVISA é o banco (gestao_mencionados, no gatilho do comentário); a regra aqui é a mesma, para a tela
// mostrar exatamente quem vai receber o aviso:
//   - "@Nome Completo" ou "@Primeiro" quando o primeiro nome é único entre as pessoas que podem ser marcadas;
//   - sem diferença de maiúscula e acento; o nome termina onde termina a palavra ("@ana" não é "@anabela");
//   - o "@" vem no começo ou depois de espaço/pontuação (o "@" de um e-mail no texto não conta).

export interface PessoaMencao {
  nome: string;
  email: string;
}

const tirarAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Nome como o banco compara: sem acento, minúsculo, espaços simples. */
export const nomeNormalizado = (nome: string) => tirarAcento(nome).toLowerCase().replace(/\s+/g, " ").trim();
const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Texto sem acento e minúsculo, com a posição de cada caractere no texto original (para destacar no original). */
function normalizarComMapa(texto: string): { s: string; orig: number[] } {
  let s = "";
  const orig: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    for (const ch of tirarAcento(texto[i]).toLowerCase()) {
      s += ch;
      orig.push(i);
    }
  }
  orig.push(texto.length);
  return { s, orig };
}

/** Por pessoa, o que vale como menção: o nome completo e, se ninguém mais tem esse primeiro nome, o primeiro nome. */
function formasDeMarcar(pessoas: readonly PessoaMencao[]): { pessoa: PessoaMencao; formas: string[] }[] {
  const validas = pessoas.filter((p) => p.nome.trim() && p.email.trim());
  const porPrimeiro = new Map<string, number>();
  for (const p of validas) {
    const pr = nomeNormalizado(p.nome).split(" ")[0];
    porPrimeiro.set(pr, (porPrimeiro.get(pr) ?? 0) + 1);
  }
  return validas.map((p) => {
    const nome = nomeNormalizado(p.nome);
    const pr = nome.split(" ")[0];
    return { pessoa: p, formas: porPrimeiro.get(pr) === 1 && pr !== nome ? [nome, pr] : [nome] };
  });
}

interface Trecho { inicio: number; fim: number; pessoa: PessoaMencao }

/** Menções no texto, sem sobreposição (a mais longa ganha: "@Emilia dos Reis" e não só "@Emilia"). */
function acharMencoes(texto: string, pessoas: readonly PessoaMencao[]): Trecho[] {
  if (!texto.includes("@")) return [];
  const { s, orig } = normalizarComMapa(texto);
  const achados: Trecho[] = [];
  for (const { pessoa, formas } of formasDeMarcar(pessoas)) {
    for (const f of formas) {
      const re = new RegExp(`(?<![a-z0-9._%+-])@${escaparRegex(f)}(?![a-z0-9])`, "g");
      for (const m of s.matchAll(re)) {
        const ini = m.index ?? 0;
        achados.push({ inicio: orig[ini], fim: orig[ini + m[0].length], pessoa });
      }
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const out: Trecho[] = [];
  for (const t of achados) if (!out.length || t.inicio >= out[out.length - 1].fim) out.push(t);
  return out;
}

/** E-mails de quem foi marcado (minúsculos, sem repetir) — a mesma resposta da gestao_mencionados. */
export function mencionados(texto: string, pessoas: readonly PessoaMencao[]): string[] {
  return [...new Set(acharMencoes(texto, pessoas).map((t) => t.pessoa.email.trim().toLowerCase()))].sort();
}

/** O texto em pedaços, com a pessoa nos pedaços que são menção (para destacar). */
export function partesComMencoes(texto: string, pessoas: readonly PessoaMencao[]): { texto: string; pessoa?: PessoaMencao }[] {
  const partes: { texto: string; pessoa?: PessoaMencao }[] = [];
  let pos = 0;
  for (const t of acharMencoes(texto, pessoas)) {
    if (t.inicio > pos) partes.push({ texto: texto.slice(pos, t.inicio) });
    partes.push({ texto: texto.slice(t.inicio, t.fim), pessoa: t.pessoa });
    pos = t.fim;
  }
  if (pos < texto.length || !partes.length) partes.push({ texto: texto.slice(pos) });
  return partes;
}

/** O "@…" que está sendo digitado antes do cursor, ou null. Aceita espaço ("@Emilia do") para achar pelo nome todo. */
export function mencaoEmDigitacao(texto: string, cursor: number): { inicio: number; termo: string } | null {
  const antes = texto.slice(0, Math.max(0, cursor));
  const i = antes.lastIndexOf("@");
  if (i < 0) return null;
  if (i > 0 && /[a-z0-9._%+-]/.test(tirarAcento(antes[i - 1]).toLowerCase())) return null; // e-mail
  const termo = antes.slice(i + 1);
  if (termo.length > 40 || /^\s|\s{2}|\n/.test(termo)) return null;
  return { inicio: i, termo };
}

/** Pessoas para o "@termo": o nome começa com o termo ou alguma palavra dele começa; nome começando primeiro. */
export function sugestoesMencao(termo: string, pessoas: readonly PessoaMencao[], max = 6): PessoaMencao[] {
  const q = nomeNormalizado(termo);
  const comNota = pessoas
    .filter((p) => p.nome.trim() && p.email.trim())
    .map((p) => {
      const n = nomeNormalizado(p.nome);
      const nota = !q || n.startsWith(q) ? 0 : n.includes(` ${q}`) ? 1 : -1;
      return { p, n, nota };
    })
    .filter((x) => x.nota >= 0);
  comNota.sort((a, b) => a.nota - b.nota || a.n.localeCompare(b.n, "pt-BR"));
  return comNota.slice(0, max).map((x) => x.p);
}

/** Troca o "@termo" em digitação por "@Nome Completo " e devolve onde o cursor fica. */
export function inserirMencao(texto: string, inicio: number, cursor: number, nome: string): { texto: string; cursor: number } {
  const depois = texto.slice(cursor);
  const marca = `@${nome.trim().replace(/\s+/g, " ")}${depois.startsWith(" ") ? "" : " "}`;
  return { texto: texto.slice(0, inicio) + marca + depois, cursor: inicio + marca.length };
}
