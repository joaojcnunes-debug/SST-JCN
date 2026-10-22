import { test } from "node:test";
import assert from "node:assert/strict";
import { montarEntrada } from "./entrada";
import type { LinhaFonte } from "./fontes";

const linha = (x: Partial<LinhaFonte>): LinhaFonte => ({
  idEmpresa: "E1", origem: "QPS", idDocumento: "D1", setorOriginal: "CANTEIRO - ELÉTRICA", fatorOriginal: "Assédio",
  nivel: "Médio", sinais: [], semSinal: false, nivelAiha: null, confianca: null, probabilidadeInformada: true, respondentes: 4,
  ...x,
});
const FATORES = [
  { id_fator: "assedio", nome: "Assédio", nome_curto: "Assédio", ordem: 1, ativo: true },
  { id_fator: "sobrecarga", nome: "Sobrecarga", nome_curto: "Sobrecarga", ordem: 3, ativo: true },
];
const base = {
  pendencias: [], empresas: [], fatores: FATORES, fatorDepara: [], ignorados: [], aepIncluirTrivialBaixo: true,
};

test("setor: o confirmado vale; sem confirmação, a sugestão (e conta como pendente)", () => {
  const r = montarEntrada({
    ...base,
    linhas: [linha({}), linha({ idEmpresa: "E2", setorOriginal: "Elétrica" })],
    canonicos: [{ id_setor_canonico: "SCN-1", id_grupo: "G", nome: "Instalações elétricas", transita: false, created_at: "", created_by: null }],
    setorDepara: [{
      id_depara: "SDP-1", id_grupo: "G", id_empresa: "E1", origem: "QPS", setor_original: "CANTEIRO - ELÉTRICA",
      id_setor_canonico: "SCN-1", confirmado_por: "x", confirmado_em: "2026-10-19", created_at: "",
    }],
  });
  assert.deepEqual(r.entrada.itens.map((i) => i.setor), ["Instalações elétricas", "Elétrica"]);
  assert.equal(r.setoresSemConfirmacao, 1);
  assert.deepEqual(r.entrada.setoresSemTransito, ["Instalações elétricas"]);
});

test("fator ignorado pelo grupo sai da lista; nome sem fator fica fora e é contado", () => {
  const r = montarEntrada({
    ...base,
    ignorados: ["sobrecarga"],
    canonicos: [],
    setorDepara: [],
    linhas: [linha({}), linha({ fatorOriginal: "Categoria inventada xyz" })],
  });
  assert.deepEqual(r.entrada.fatores.map((f) => f.id_fator), ["assedio"]);
  assert.equal(r.entrada.itens.length, 1);
  assert.equal(r.linhasSemFator, 1);
});
