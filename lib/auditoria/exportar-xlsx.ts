/**
 * Exportação da Auditoria em XLSX (Fase 3).
 *
 * Duas abas, porque servem a perguntas diferentes:
 *   1. Eventos — uma linha por gravação: quem, quando, o quê. É a lista da tela.
 *   2. Campos alterados — uma linha por CAMPO de cada edição, com antes e
 *      depois em colunas próprias. É a aba para filtrar no Excel ("quem mudou o
 *      status desta inspeção?"), o que a aba 1 não deixa fazer sem abrir texto.
 *
 * Criou/excluiu não entram na aba 2: a linha inteira já vai na coluna
 * "Conteúdo" da aba 1, e repetir 40 campos por criação afogaria as edições.
 *
 * Data/hora sai como TEXTO "AAAA-MM-DD HH:MM:SS" no fuso do navegador: ordena
 * certo como texto e não sofre o deslocamento de fuso que o `Date` do SheetJS
 * aplica na conversão.
 */

import * as XLSX from "xlsx";
import type { AuditoriaEvento } from "@/lib/supabase/types";
import { ehConclusao, formatarValor, nomeDoRegistro, quemGravou, rotuloModulo, rotuloTabela } from "./eventos";

/** Limite de caracteres de uma célula do Excel; acima disso o arquivo abre com erro. */
const LIMITE_CELULA = 32767;

type Celula = string | number;

function cortar(texto: string): string {
  return texto.length > LIMITE_CELULA ? texto.slice(0, LIMITE_CELULA - 40) + " … [cortado: passou do limite do Excel]" : texto;
}

export function dataHoraLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Linha inteira (criou/excluiu) como "campo: valor" por linha, sem os vazios. */
function conteudoDaLinha(linha: Record<string, unknown> | null): string {
  if (!linha) return "";
  return Object.entries(linha)
    .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${formatarValor(v)}`)
    .join("\n");
}

export interface EntradaXlsxAuditoria {
  eventos: AuditoriaEvento[];
  nomes: ReadonlyMap<string, string>;
  nomesEmpresas: ReadonlyMap<string, string>;
  /** Uma linha legível dos filtros aplicados, para o cabeçalho. */
  descricaoFiltros: string;
  /** true quando a exportação parou no limite e há mais eventos no servidor. */
  cortado: boolean;
}

export function montarXlsxAuditoria(e: EntradaXlsxAuditoria): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const cabecalho = [
    [`AUDITORIA DO PAINEL — ${e.eventos.length.toLocaleString("pt-BR")} evento${e.eventos.length === 1 ? "" : "s"}`],
    [`Filtros: ${e.descricaoFiltros}`],
    ...(e.cortado ? [["ATENÇÃO: a exportação parou no limite; há mais eventos. Estreite o período ou os filtros."]] : []),
    [],
  ];

  // ── 1. Eventos ────────────────────────────────────────────────────────────
  const colunas1: Celula[] = [
    "Data e hora", "Quem", "E-mail", "Origem", "Ação", "Concluiu?", "Módulo", "O quê",
    "Registro", "Empresa", "Campos alterados", "Conteúdo (criou/excluiu)", "Tabela", "ID do registro", "ID do evento",
  ];
  const linhas1 = e.eventos.map((ev): Celula[] => [
    dataHoraLocal(ev.ocorrido_em),
    quemGravou(ev, e.nomes),
    ev.usuario_email ?? "",
    ev.usuario_origem ?? (ev.usuario_role && ev.usuario_role !== "authenticated" ? ev.usuario_role : ""),
    ev.acao,
    ehConclusao(ev) ? "Sim" : "",
    rotuloModulo(ev.modulo),
    rotuloTabela(ev.tabela),
    cortar(nomeDoRegistro(ev)),
    ev.id_empresa ? (e.nomesEmpresas.get(ev.id_empresa) ?? ev.id_empresa) : "",
    ev.acao === "editou" ? ev.campos_alterados.join(", ") : "",
    ev.acao === "editou" ? "" : cortar(conteudoDaLinha(ev.acao === "criou" ? ev.depois : ev.antes)),
    ev.tabela,
    ev.registro_id ?? "",
    ev.id,
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([...cabecalho, colunas1, ...linhas1]);
  ws1["!cols"] = [19, 24, 28, 18, 8, 9, 16, 22, 40, 32, 30, 50, 22, 38, 10].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws1, "Eventos");

  // ── 2. Campos alterados ───────────────────────────────────────────────────
  const colunas2: Celula[] = ["Data e hora", "Quem", "Módulo", "O quê", "Registro", "Empresa", "Campo", "Antes", "Depois", "ID do registro", "ID do evento"];
  const linhas2: Celula[][] = [];
  for (const ev of e.eventos) {
    if (ev.acao !== "editou") continue;
    const comuns = {
      quando: dataHoraLocal(ev.ocorrido_em),
      quem: quemGravou(ev, e.nomes),
      registro: cortar(nomeDoRegistro(ev)),
      empresa: ev.id_empresa ? (e.nomesEmpresas.get(ev.id_empresa) ?? ev.id_empresa) : "",
    };
    for (const campo of ev.campos_alterados) {
      linhas2.push([
        comuns.quando, comuns.quem, rotuloModulo(ev.modulo), rotuloTabela(ev.tabela), comuns.registro, comuns.empresa,
        campo,
        cortar(formatarValor(ev.antes?.[campo])),
        cortar(formatarValor(ev.depois?.[campo])),
        ev.registro_id ?? "",
        ev.id,
      ]);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet([...cabecalho, colunas2, ...linhas2]);
  ws2["!cols"] = [19, 24, 16, 22, 40, 32, 22, 40, 40, 38, 10].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws2, "Campos alterados");

  return wb;
}

export function nomeArquivoAuditoria(agora = new Date()): string {
  return `auditoria-${dataHoraLocal(agora.toISOString()).replace(" ", "_").replace(/:/g, "")}.xlsx`;
}

export function baixarXlsxAuditoria(e: EntradaXlsxAuditoria) {
  XLSX.writeFile(montarXlsxAuditoria(e), nomeArquivoAuditoria());
}
