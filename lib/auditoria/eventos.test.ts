import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuditoriaEvento } from "@/lib/supabase/types";
import {
  agruparPorDia,
  descreverEvento,
  ehConclusao,
  formatarValor,
  nomeDoRegistro,
  quemGravou,
  rotaDoRegistro,
  rotuloModulo,
  rotuloTabela,
  semAcento,
} from "./eventos";

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
    campos_alterados: ["telefone"],
    antes: { telefone: "2126193833" },
    depois: { telefone: "2199990000" },
    ...parcial,
  };
}

describe("descreverEvento", () => {
  test("edição lista os campos que mudaram, com o id_ sem prefixo", () => {
    const ev = evento({ campos_alterados: ["telefone", "id_unidade"], antes: {}, depois: {} });
    assert.equal(descreverEvento(ev), "editou empresa TERE FRUTAS (telefone, unidade)");
  });

  test("mais de 4 campos vira '+N' — a frase não pode virar um parágrafo", () => {
    const ev = evento({ campos_alterados: ["a", "b", "c", "d", "e", "f"] });
    assert.equal(descreverEvento(ev), "editou empresa TERE FRUTAS (a, b, c, d +2)");
  });

  test("criação e exclusão não listam campos", () => {
    assert.equal(descreverEvento(evento({ acao: "criou", campos_alterados: [] })), "criou empresa TERE FRUTAS");
    assert.equal(descreverEvento(evento({ acao: "excluiu", campos_alterados: [] })), "excluiu empresa TERE FRUTAS");
  });

  test("tabela sem tradução sai com espaço no lugar do '_' — nunca some", () => {
    assert.equal(rotuloTabela("gestao_subtarefa_modelos"), "gestao subtarefa modelos");
    assert.equal(rotuloTabela("riscos"), "risco");
  });
});

describe("nomeDoRegistro", () => {
  test("sem título gravado, acha uma coluna de nome no antes/depois", () => {
    const ev = evento({ titulo: null, tabela: "riscos", depois: { descricao: "Queda de altura" } });
    assert.equal(nomeDoRegistro(ev), "Queda de altura");
  });

  test("sem nada, cai no id — 99 das 167 tabelas não têm coluna de título", () => {
    const ev = evento({ titulo: null, registro_id: "RSK-9", antes: null, depois: { id_risco: "RSK-9" } });
    assert.equal(nomeDoRegistro(ev), "RSK-9");
  });

  test("descrição longa é cortada com reticências", () => {
    const ev = evento({ titulo: null, depois: { descricao: "x".repeat(200) } });
    assert.equal(nomeDoRegistro(ev).length, 118);
    assert.ok(nomeDoRegistro(ev).endsWith("…"));
  });
});

describe("ehConclusao", () => {
  test("status indo para CONCLUIDA/FINALIZADO conta; outros valores não", () => {
    assert.equal(ehConclusao(evento({ campos_alterados: ["status"], depois: { status: "CONCLUIDA" } })), true);
    assert.equal(ehConclusao(evento({ campos_alterados: ["status"], depois: { status: "FINALIZADO" } })), true);
    assert.equal(ehConclusao(evento({ campos_alterados: ["status"], depois: { status: "EM_ANDAMENTO" } })), false);
  });

  test("criar já concluído NÃO é conclusão — só a edição que fechou o documento", () => {
    assert.equal(ehConclusao(evento({ acao: "criou", campos_alterados: [], depois: { status: "CONCLUIDA" } })), false);
  });

  test("edição que não tocou o status não conta, mesmo que o status esteja no depois", () => {
    assert.equal(ehConclusao(evento({ campos_alterados: ["telefone"], depois: { status: "CONCLUIDA" } })), false);
  });
});

describe("formatarValor", () => {
  test("nulo, booleano, lista e objeto", () => {
    assert.equal(formatarValor(null), "—");
    assert.equal(formatarValor(true), "Sim");
    assert.equal(formatarValor(["a", "b"]), "a, b");
    assert.equal(formatarValor([]), "—");
    assert.equal(formatarValor({ a: 1 }), '{"a":1}');
  });

  test("data ISO com hora vira data/hora local; só data fica como está", () => {
    assert.match(formatarValor("2026-09-14T19:07:25.000Z"), /2026/);
    assert.equal(formatarValor("2026-09-14"), "2026-09-14");
  });
});

describe("quemGravou", () => {
  const nomes = new Map([["alguem@chabra.com.br", "Alguém"]]);
  test("e-mail conhecido vira nome; desconhecido fica o e-mail", () => {
    assert.equal(quemGravou(evento({}), nomes), "Alguém");
    assert.equal(quemGravou(evento({ usuario_email: "outro@chabra.com.br" }), nomes), "outro@chabra.com.br");
  });

  test("rota de serviço e psql ficam identificados, não somem", () => {
    assert.equal(quemGravou(evento({ usuario_email: null, usuario_role: "service_role" }), nomes), "Servidor (rota de serviço)");
    assert.equal(quemGravou(evento({ usuario_email: null, usuario_role: "chabra_admin" }), nomes), "Banco (chabra_admin)");
  });
});

describe("rotaDoRegistro", () => {
  test("documento tem tela própria", () => {
    assert.equal(rotaDoRegistro(evento({ tabela: "inspecoes", registro_id: "INS-1" })), "/inspecoes/INS-1");
    assert.equal(rotaDoRegistro(evento({ tabela: "aet_relatorios", registro_id: "AET-1" })), "/aet/AET-1");
  });

  test("filha leva ao pai quando o pai está no evento; sem pai, nada", () => {
    assert.equal(rotaDoRegistro(evento({ tabela: "riscos", registro_id: "R1", depois: { id_inspecao: "INS-7" } })), "/inspecoes/INS-7");
    assert.equal(rotaDoRegistro(evento({ tabela: "riscos", registro_id: "R1", antes: null, depois: { x: 1 } })), null);
  });

  test("exclusão ainda leva ao pai — o pai fica no 'antes'", () => {
    assert.equal(rotaDoRegistro(evento({ tabela: "setores", acao: "excluiu", antes: { id_inspecao: "INS-3" }, depois: null })), "/inspecoes/INS-3");
  });
});

describe("agruparPorDia", () => {
  test("mantém a ordem e junta o mesmo dia", () => {
    const g = agruparPorDia([
      { ocorrido_em: "2026-09-14T12:00:00.000Z" },
      { ocorrido_em: "2026-09-14T09:00:00.000Z" },
      { ocorrido_em: "2026-09-13T12:00:00.000Z" },
    ]);
    assert.equal(g.length, 2);
    assert.equal(g[0].eventos.length, 2);
    assert.equal(g[1].eventos.length, 1);
  });
});

describe("rotuloModulo", () => {
  test("os 3 ids que só existem na trilha têm rótulo", () => {
    assert.equal(rotuloModulo("gestao_chabra"), "Gestão JCN Consultoria (tarefas)");
    assert.equal(rotuloModulo("sistema"), "Sistema");
    assert.equal(rotuloModulo("pdfs"), "PDFs gerados");
    assert.equal(rotuloModulo("frota"), "Frota JCN Consultoria – Checklist de Veículos");
  });
});

describe("semAcento", () => {
  test("tira acento e cedilha, mantém o resto — o índice da v213 é assim", () => {
    assert.equal(semAcento("Luva nitrílica — Ação São João"), "Luva nitrilica — Acao Sao Joao");
    assert.equal(semAcento("sem acento"), "sem acento");
  });
});
