import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { AuditoriaEvento } from "@/lib/supabase/types";
import { montarXlsxAuditoria, nomeArquivoAuditoria } from "./exportar-xlsx";

function evento(parcial: Partial<AuditoriaEvento>): AuditoriaEvento {
  return {
    id: 1,
    ocorrido_em: "2026-09-14T19:07:25.000Z",
    tabela: "empresas",
    registro_id: "EMP-1",
    acao: "editou",
    modulo: "sistema",
    id_empresa: "EMP-1",
    titulo: "TERE FRUTAS",
    usuario_email: "alguem@chabra.com.br",
    usuario_role: "authenticated",
    campos_alterados: ["telefone", "status"],
    antes: { telefone: "2126193833", status: "EM_ANDAMENTO" },
    depois: { telefone: "2199990000", status: "CONCLUIDO" },
    ...parcial,
  };
}

function linhas(wb: XLSX.WorkBook, aba: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: "" });
}

const base = {
  nomes: new Map([["alguem@chabra.com.br", "Alguém da Silva"]]),
  nomesEmpresas: new Map([["EMP-1", "TERE FRUTAS LTDA"]]),
  descricaoFiltros: "7 dias",
  cortado: false,
};

describe("montarXlsxAuditoria", () => {
  test("aba Eventos: uma linha por evento, com nome, empresa e conclusão", () => {
    const wb = montarXlsxAuditoria({ ...base, eventos: [evento({})] });
    const l = linhas(wb, "Eventos");
    const cab = l.findIndex((r) => r[0] === "Data e hora");
    assert.ok(cab > 0);
    const r = l[cab + 1];
    assert.equal(r[1], "Alguém da Silva");
    assert.equal(r[4], "editou");
    assert.equal(r[5], "Sim");
    assert.equal(r[9], "TERE FRUTAS LTDA");
    assert.equal(r[10], "telefone, status");
    assert.equal(l.length, cab + 2);
  });

  test("aba Campos alterados: um campo por linha, antes e depois separados; criou fica fora", () => {
    const criou = evento({ id: 2, acao: "criou", campos_alterados: [], antes: null, depois: { nome_empresa: "X", telefone: null } });
    const wb = montarXlsxAuditoria({ ...base, eventos: [evento({}), criou] });
    const l = linhas(wb, "Campos alterados");
    const cab = l.findIndex((r) => r[0] === "Data e hora");
    const corpo = l.slice(cab + 1);
    assert.equal(corpo.length, 2);
    assert.deepEqual(corpo.map((r) => [r[6], r[7], r[8]]), [
      ["telefone", "2126193833", "2199990000"],
      ["status", "EM_ANDAMENTO", "CONCLUIDO"],
    ]);
    // A criação vai inteira na aba Eventos, sem os campos vazios.
    const ev = linhas(wb, "Eventos");
    const linhaCriou = ev.find((r) => r[14] === 2)!;
    assert.equal(linhaCriou[11], "nome_empresa: X");
  });

  test("valor maior que o limite do Excel é cortado e avisa", () => {
    const enorme = "a".repeat(40000);
    const wb = montarXlsxAuditoria({
      ...base,
      eventos: [evento({ campos_alterados: ["obs"], antes: { obs: "" }, depois: { obs: enorme } })],
    });
    const l = linhas(wb, "Campos alterados");
    const depois = String(l[l.length - 1][8]);
    assert.ok(depois.length <= 32767);
    assert.match(depois, /cortado/);
  });

  test("exportação cortada pelo limite diz isso no cabeçalho", () => {
    const wb = montarXlsxAuditoria({ ...base, eventos: [], cortado: true });
    assert.match(String(linhas(wb, "Eventos")[2][0]), /parou no limite/);
  });

  test("nome do arquivo tem data e hora sem dois-pontos", () => {
    assert.match(nomeArquivoAuditoria(new Date(2026, 8, 25, 9, 5, 3)), /^auditoria-2026-09-25_090503\.xlsx$/);
  });
});
