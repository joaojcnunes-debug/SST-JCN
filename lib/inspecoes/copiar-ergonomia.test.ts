import test from "node:test";
import assert from "node:assert/strict";
import { montarCopiaErgonomia, type OrigemErgonomia, type ParametrosErgonomia } from "@/lib/inspecoes/copiar-ergonomia";

const SETORES = [{ id: "s-uuid-1", nome_setor: "Produção", checklist_fisica: { a: true } }];

function origem(): OrigemErgonomia {
  return {
    aep: {
      id_relatorio: "aep-old", id_empresa: "EMP-OLD", id_inspecao: "INS-OLD", status: "CONCLUIDO",
      setores: SETORES, conclusao: "Texto", checklist_gestao: { x: 1 }, concluido_em: "2026-01-01",
      liberado_comercial_em: "2026-01-02", liberado_comercial_por: "fulano", data_validade: "2028-01-01",
      data_elaboracao: "2026-01-01", endereco_empresa: "Rua Velha", responsavel_elaboracao: "Ana",
    },
    aet: {
      id_relatorio: "aet-old", id_empresa: "EMP-OLD", id_inspecao: "INS-OLD", status: "CONCLUIDO",
      setores: SETORES, consideracoes_finais: "Fim", textos_secoes: { s: "t" }, data_validade: "2028-01-01",
    },
    aetAcoes: [{ id_acao: "AAC-1", id_relatorio: "aet-old", id_setor: "s-uuid-1", what_acao: "Trocar cadeira", status: "Pendente" }],
    aetQps: [{ id_relatorio: "aet-old", id_setor: "s-uuid-1", codigo_fator: "F1", pergunta_ordem: 1, resposta: 3 }],
  };
}

function params(): ParametrosErgonomia {
  let n = 0;
  return {
    idInspecao: "INS-NEW", idEmpresa: "EMP-NEW", enderecoEmpresa: "Rua Nova, 10", usuarioId: "uid-eu",
    agora: "2026-10-22T15:00:00.000Z", gerarId: (p) => `${p}-${++n}`, gerarUuid: () => `uuid-${++n}`,
  };
}

test("laudos novos: conteúdo inteiro, dono novo, andamento zerado", () => {
  const c = montarCopiaErgonomia(origem(), params());
  const aep = c.aep_relatorios[0];
  assert.match(String(aep.id_relatorio), /^uuid-/);
  assert.equal(aep.id_empresa, "EMP-NEW");
  assert.equal(aep.id_inspecao, "INS-NEW");
  assert.deepEqual(aep.setores, SETORES);
  assert.equal(aep.conclusao, "Texto");
  assert.deepEqual(aep.checklist_gestao, { x: 1 });
  assert.equal(aep.responsavel_elaboracao, "Ana");
  assert.equal(aep.status, "RASCUNHO");
  assert.equal(aep.concluido_em, null);
  assert.equal(aep.liberado_comercial_em, null);
  assert.equal(aep.liberado_comercial_por, null);
  assert.equal(aep.data_validade, null);
  assert.equal(aep.data_elaboracao, "2026-10-22");
  assert.equal(aep.endereco_empresa, "Rua Nova, 10");
  assert.equal(aep.enviado_modulo_em, "2026-10-22T15:00:00.000Z");
  assert.equal(aep.usuario, "uid-eu");
  // Coluna que a AET não tem não aparece do nada.
  assert.equal("concluido_em" in c.aet_relatorios[0], false);
  assert.equal(c.aet_relatorios[0].consideracoes_finais, "Fim");
});

test("filhas da AET vão para o laudo novo, mantendo o setor do JSON", () => {
  const c = montarCopiaErgonomia(origem(), params());
  const idAet = c.aet_relatorios[0].id_relatorio;
  assert.notEqual(idAet, c.aep_relatorios[0].id_relatorio);
  assert.equal(c.aet_acoes[0].id_relatorio, idAet);
  assert.notEqual(c.aet_acoes[0].id_acao, "AAC-1");
  assert.equal(c.aet_acoes[0].id_setor, "s-uuid-1");
  assert.equal(c.aet_acoes[0].what_acao, "Trocar cadeira");
  assert.deepEqual(c.aet_laudo_qps_respostas[0], {
    id_relatorio: idAet, id_setor: "s-uuid-1", codigo_fator: "F1", pergunta_ordem: 1, resposta: 3,
    updated_at: "2026-10-22T15:00:00.000Z",
  });
});

test("sem laudo na origem, nada a copiar", () => {
  const c = montarCopiaErgonomia({ aep: null, aet: null, aetAcoes: [], aetQps: [] }, params());
  assert.ok(Object.values(c).every((xs) => xs.length === 0));
});

test("só AEP: nenhuma filha de AET", () => {
  const o = origem();
  const c = montarCopiaErgonomia({ ...o, aet: null }, params());
  assert.equal(c.aep_relatorios.length, 1);
  assert.equal(c.aet_relatorios.length, 0);
  assert.equal(c.aet_acoes.length, 0);
  assert.equal(c.aet_laudo_qps_respostas.length, 0);
});
