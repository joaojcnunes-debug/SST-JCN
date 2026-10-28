import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { situacaoDocumento, type LinhaDocumento } from "./documento";

const base: LinhaDocumento = {
  status: "CONCLUIDA",
  elaboracao_status: null,
  elaboracao_responsavel: null,
  elaboracao_concluida_em: null,
};

describe("situacaoDocumento", () => {
  it("entregue: a lista mostra a data, o card mostra quem e quando", () => {
    const insp: LinhaDocumento = {
      ...base,
      elaboracao_status: "CONCLUIDO",
      elaboracao_responsavel: "Emilia dos Reis",
      elaboracao_concluida_em: "2026-09-21T14:32:00",
    };
    assert.deepEqual(situacaoDocumento(insp, ["Emilia dos Reis"], "curto"), {
      chave: "ENTREGUE",
      texto: "Entregue em 21/09/2026",
      cor: "text-emerald-700",
    });
    assert.equal(
      situacaoDocumento(insp, ["Emilia dos Reis"], "longo")?.texto,
      "Concluído por Emilia dos Reis · 21/09/2026 14:32",
    );
  });

  it("entregue sem responsável (o nome foi tirado pelo chip) usa o associado", () => {
    const insp: LinhaDocumento = { ...base, elaboracao_status: "CONCLUIDO", elaboracao_responsavel: "" };
    assert.equal(situacaoDocumento(insp, ["Ana Luiza"], "longo")?.texto, "Concluído por Ana Luiza");
    assert.equal(situacaoDocumento(insp, [], "longo")?.texto, "Concluído por —");
  });

  it("28/10: associado no chip sem início é ATRIBUÍDO, não em elaboração", () => {
    const insp: LinhaDocumento = { ...base }; // elaboracao_status null, inspeção CONCLUIDA
    assert.deepEqual(situacaoDocumento(insp, ["Emilia dos Reis"], "curto"), {
      chave: "ATRIBUIDO",
      texto: "Atribuído · Emilia",
      cor: "text-amber-700",
    });
    assert.equal(situacaoDocumento(insp, ["Emilia dos Reis"], "longo")?.texto, "Atribuído a Emilia dos Reis — ainda não iniciado");
  });

  it("em elaboração mostra desde quando, e se o início veio da 1ª edição", () => {
    const insp: LinhaDocumento = {
      ...base, elaboracao_status: "EM_ELABORACAO", elaboracao_responsavel: "Sarah Lima",
      elaboracao_iniciada_em: "2026-10-27T10:00:00", elaboracao_inicio_origem: "AUTOMATICO",
    };
    assert.equal(situacaoDocumento(insp, [], "curto")?.texto, "Em elaboração · Sarah");
    assert.equal(situacaoDocumento(insp, [], "longo")?.texto, "Em elaboração · Sarah Lima · desde 27/10/2026 (início pela 1ª edição)");
    assert.equal(
      situacaoDocumento({ ...insp, elaboracao_inicio_origem: "BOTAO" }, [], "longo")?.texto,
      "Em elaboração · Sarah Lima · desde 27/10/2026",
    );
  });

  it("o responsável vem na frente dos associados, e a lista conta os outros", () => {
    const insp: LinhaDocumento = { ...base, elaboracao_status: "EM_ELABORACAO", elaboracao_responsavel: "Paulina Cunha" };
    assert.equal(situacaoDocumento(insp, ["Ana Luiza", "paulina cunha"], "curto")?.texto, "Em elaboração · Paulina +1");
    assert.equal(situacaoDocumento(insp, ["Paulina Cunha"], "curto")?.texto, "Em elaboração · Paulina");
  });

  it('"Ninguém assumiu" só quando não há ninguém mesmo', () => {
    assert.deepEqual(situacaoDocumento(base, [], "curto"), {
      chave: "NINGUEM",
      texto: "Ninguém assumiu",
      cor: "text-gray-400",
    });
    assert.equal(situacaoDocumento(base, [], "longo")?.texto, "Pendente — ninguém assumiu a elaboração");
  });

  it("inspeção ainda em campo não rotula na lista, mas o card sempre tem frase", () => {
    const insp: LinhaDocumento = { ...base, status: "EM_ANDAMENTO" };
    assert.equal(situacaoDocumento(insp, [], "curto"), null);
    assert.equal(situacaoDocumento(insp, [], "longo")?.chave, "NINGUEM");
    // Com gente no documento, rotula mesmo em campo.
    assert.equal(situacaoDocumento(insp, ["Ana Luiza"], "curto")?.texto, "Atribuído · Ana");
  });
});
