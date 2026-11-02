import test from "node:test";
import assert from "node:assert/strict";
import { montarCopia, OPCOES_COPIA_PADRAO, type OpcoesCopia, type OrigemCopia, type ParametrosCopia } from "@/lib/inspecoes/copiar";

const ANTIGA = { id_inspecao: "INS-OLD", id_empresa: "EMP-OLD" };

function origem(): OrigemCopia {
  return {
    setores: [{ ...ANTIGA, id_setor: "S1", setor_ghe: "Produção", conformidade: "ok", created_at: "2020-01-01" }],
    cargos: [{ ...ANTIGA, id_cargo: "C1", id_setor: "S1", cargo: "Operador" }],
    riscos: [{ ...ANTIGA, id_risco: "R1", id_setor: "S1", id_cargo: "C1", agente: "Ruído", respostas_custom: { a: 1 }, id_matriz: "MTZ-1" }],
    epis: [
      { ...ANTIGA, id_protecao: "E1", id_risco: "R1", id_setor: "S1", descricao: "Protetor", fotos_urls: ["u1"] },
      { ...ANTIGA, id_protecao: "E2", id_risco: "R-SUMIU", id_setor: null, descricao: "órfão" },
    ],
    fotos: [{ ...ANTIGA, id_foto: "F1", id_setor: "S1", arquivo_foto: "http://x/f.jpg", usuario: "outro@x" }],
    responsaveis: [{ ...ANTIGA, id_responsavel: "RS1", tecnico_responsavel: "Ana", id_usuario: "U1" }],
    complementos: [{ ...ANTIGA, id_complemento: "CP1", id_setor: "S1", tipo: "x", dados: { k: 1 } }],
    paeContatos: [
      { ...ANTIGA, id_contato: "P2", id_parent: "P1", nome: "Filho" },
      { ...ANTIGA, id_contato: "P1", id_parent: null, nome: "Pai" },
    ],
    treinamentos: [{ ...ANTIGA, id_treinamento: "T1", nr: "NR-35", titulo: "Altura" }],
    treinamentosSetor: [{ id_treinamento: "T1", id_setor: "S1" }],
    treinamentosCargo: [{ id_treinamento: "T1", id_cargo: "C1" }],
    treinamentosRisco: [{ id_treinamento: "T1", id_risco: "R1" }],
    extintores: [{ ...ANTIGA, id_extintor: "X1", id_setor: "S1", situacao: "OK", nao_conformidades: ["a"] }],
    maquinas: [{ ...ANTIGA, id_maquina_inspecao: "M1", id_setor: "S1", nome: "Prensa", ids_setores: ["S1", "S-FORA"] }],
  };
}

function params(opcoes = OPCOES_COPIA_PADRAO): ParametrosCopia {
  let n = 0;
  return {
    idInspecao: "INS-NEW",
    idEmpresa: "EMP-NEW",
    opcoes,
    usuarioEmail: "eu@chabra",
    agora: "2026-10-22T00:00:00Z",
    gerarId: (p) => `${p}-${++n}`,
    gerarUuid: () => `uuid-${++n}`,
  };
}

const marcarTodas = (v: boolean): OpcoesCopia =>
  Object.fromEntries(Object.keys(OPCOES_COPIA_PADRAO).map((k) => [k, v])) as unknown as OpcoesCopia;
const TODAS = marcarTodas(true);

test("copia TODAS as colunas e troca dono, ids e datas", () => {
  const c = montarCopia(origem(), params(TODAS));
  const s = c.setores[0];
  assert.equal(s.id_inspecao, "INS-NEW");
  assert.equal(s.id_empresa, "EMP-NEW");
  assert.notEqual(s.id_setor, "S1");
  assert.equal(s.conformidade, "ok");
  assert.equal(s.created_at, "2026-10-22T00:00:00Z");
  assert.deepEqual(c.epi_epc[0].fotos_urls, ["u1"]);
  assert.deepEqual(c.extintores[0].nao_conformidades, ["a"]);
  assert.equal(c.riscos[0].id_matriz, "MTZ-1");
  assert.deepEqual(c.complementos[0].dados, { k: 1 });
  assert.equal(c.responsaveis[0].id_usuario, "U1");
  assert.equal(c.fotos[0].usuario, "eu@chabra");
});

test("vínculos apontam para as linhas NOVAS", () => {
  const c = montarCopia(origem(), params(TODAS));
  const setor = c.setores[0].id_setor;
  const cargo = c.cargos[0].id_cargo;
  const risco = c.riscos[0].id_risco;
  const treina = c.treinamentos_nr[0].id_treinamento;
  assert.equal(c.cargos[0].id_setor, setor);
  assert.equal(c.riscos[0].id_setor, setor);
  assert.equal(c.riscos[0].id_cargo, cargo);
  assert.equal(c.epi_epc[0].id_risco, risco);
  assert.deepEqual(c.treinamentos_setor, [{ id_treinamento: treina, id_setor: setor }]);
  assert.deepEqual(c.treinamentos_cargo, [{ id_treinamento: treina, id_cargo: cargo }]);
  assert.deepEqual(c.treinamentos_risco, [{ id_treinamento: treina, id_risco: risco }]);
  assert.equal(c.extintores[0].id_setor, setor);
  assert.equal(c.complementos[0].id_setor, setor);
  assert.equal(c.fotos[0].id_setor, setor);
});

test("PAE: filho aponta para o pai novo mesmo vindo antes na lista", () => {
  const c = montarCopia(origem(), params(TODAS));
  const pai = c.pae_contatos.find((x) => x.nome === "Pai")!;
  const filho = c.pae_contatos.find((x) => x.nome === "Filho")!;
  assert.equal(filho.id_parent, pai.id_contato);
  assert.equal(pai.id_parent, null);
});

test("máquinas: id novo, sem o campo derivado, e só setores copiados na ligação", () => {
  const c = montarCopia(origem(), params(TODAS));
  const m = c.inspecao_maquinas[0];
  assert.match(String(m.id_maquina_inspecao), /^uuid-/);
  assert.equal("ids_setores" in m, false);
  assert.deepEqual(c.inspecao_maquinas_setores, [
    { id_maquina_inspecao: m.id_maquina_inspecao, id_setor: c.setores[0].id_setor },
  ]);
});

test("EPI de risco inexistente fica de fora", () => {
  const c = montarCopia(origem(), params(TODAS));
  assert.equal(c.epi_epc.length, 1);
});

test("sem setores: nada aponta para o setor da inspeção de origem", () => {
  const c = montarCopia(origem(), params({ ...TODAS, setores: false }));
  assert.equal(c.setores.length, 0);
  assert.equal(c.cargos.length, 0);
  assert.equal(c.riscos[0].id_setor, null);
  assert.equal(c.riscos[0].id_cargo, null);
  assert.equal(c.extintores[0].id_setor, null);
  assert.equal(c.treinamentos_setor.length, 0);
  assert.equal(c.inspecao_maquinas_setores.length, 0);
});

test("opções desmarcadas não copiam", () => {
  const c = montarCopia(origem(), params());
  assert.equal(c.responsaveis.length, 0);
  assert.equal(c.fotos.length, 0);
  assert.equal(c.treinamentos_nr.length, 1);
  const nada = montarCopia(origem(), params(marcarTodas(false)));
  assert.ok(Object.values(nada).every((xs) => xs.length === 0));
});

test("não altera a origem", () => {
  const o = origem();
  const antes = JSON.stringify(o);
  montarCopia(o, params(TODAS));
  assert.equal(JSON.stringify(o), antes);
});
