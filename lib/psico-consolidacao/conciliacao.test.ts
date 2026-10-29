import { test } from "node:test";
import assert from "node:assert/strict";
import { classificar, conciliarEmpresa, documentosDaEmpresa, resumirEmpresa } from "./conciliacao";
import type { DocumentoFonte, LinhaFonte } from "./fontes";

const linha = (x: Partial<LinhaFonte>): LinhaFonte => ({
  idEmpresa: "E1", origem: "DRPS", idDocumento: "DRPS-1", setorOriginal: "Produção", fatorOriginal: "Assédio",
  nivel: "Médio", sinais: [], semSinal: false, nivelAiha: null, confianca: null, probabilidadeInformada: true, respondentes: 8,
  ...x,
});
const aep = (x: Partial<LinhaFonte>) =>
  linha({ origem: "AEP", idDocumento: "AEP-1", fatorOriginal: "assedio", nivel: "Identificado", respondentes: null, ...x });

const FATORES = [
  { id_fator: "assedio", nome: "Assédio", nome_curto: "Assédio", ordem: 1, ativo: true },
  { id_fator: "sobrecarga", nome: "Sobrecarga", nome_curto: "Sobrecarga", ordem: 2, ativo: true },
];
// AEP grava a chave do checklist; o de-para da v295 liga a chave ao fator.
const DEPARA = [
  { origem: "AEP" as const, valor_origem: "assedio", id_fator: "assedio" },
  { origem: "AEP" as const, valor_origem: "sobrecarga", id_fator: "sobrecarga" },
];
const DOCS = new Set(["AEP-1", "DRPS-1", "QPS-1"]);
const base = { pendencias: [], fatores: FATORES, depara: DEPARA, documentos: DOCS };

test("classificar: presença e nível (até 1 degrau converge; 2 ou mais diverge)", () => {
  const q = (degrau: number) => ({ degrau, nivel: "", respondentes: 5 });
  const a = (degrau: number | null) => ({ degrau, nivelAiha: null, sinais: [] });
  assert.equal(classificar(a(3), q(4), true, true), "Convergente");
  assert.equal(classificar(a(2), q(4), true, true), "Nível divergente");
  assert.equal(classificar(a(null), q(4), true, true), "Convergente", "Sim sem AIHA: vale a presença");
  assert.equal(classificar(null, q(3), true, true), "Só questionário");
  assert.equal(classificar(a(1), q(3), true, true), "Só questionário", "AEP Trivial/Baixo não aponta");
  assert.equal(classificar(a(3), q(1), true, true), "Só AEP", "questionário Baixo não aponta");
  assert.equal(classificar(null, q(1), true, true), "Sem indicação");
  assert.equal(classificar(a(3), null, true, false), "Sem par", "o questionário não tem o setor");
  assert.equal(classificar(null, q(3), false, true), "Sem par", "a AEP não tem o setor");
});

test("empresa: setor casado pelo nome sugerido; DRPS e QPS com classe própria", () => {
  const r = conciliarEmpresa({
    ...base,
    setoresAep: [{ idDocumento: "AEP-1", setorOriginal: "PRODUCAO" }, { idDocumento: "AEP-1", setorOriginal: "Expedição" }],
    linhas: [
      aep({ setorOriginal: "PRODUCAO", nivelAiha: "Alto" }),
      linha({ nivel: "Crítico" }),
      linha({ fatorOriginal: "Sobrecarga", nivel: "Alto" }),
      linha({ origem: "QPS", idDocumento: "QPS-1", nivel: "Baixo" }),
    ],
  });
  assert.deepEqual(r.questionarios, ["DRPS", "QPS"]);
  assert.deepEqual(r.setores.map((s) => s.setor), ["Expedição", "Produção"]);
  const prod = (f: string) => r.celulas.find((c) => c.setor === "Produção" && c.idFator === f)!;
  assert.deepEqual(prod("assedio").classe, { DRPS: "Convergente", QPS: "Só AEP" });
  assert.deepEqual(prod("sobrecarga").classe, { DRPS: "Só questionário", QPS: "Sem indicação" });
  // Expedição só existe na AEP: nada a conciliar.
  const exp = r.celulas.find((c) => c.setor === "Expedição" && c.idFator === "assedio")!;
  assert.deepEqual(exp.classe, { DRPS: "Sem par", QPS: "Sem par" });
  assert.equal(r.totais.DRPS.Convergente, 1);
  assert.equal(r.totais.DRPS["Sem par"], 2);
});

test("empresa: setor repetido vale o pior; documento não escolhido não conta; N/I marcado", () => {
  const r = conciliarEmpresa({
    ...base,
    documentos: new Set(["AEP-1", "DRPS-1"]),
    setoresAep: [{ idDocumento: "AEP-1", setorOriginal: "Produção" }],
    pendencias: [{ idEmpresa: "E1", origem: "AEP", idDocumento: "AEP-1", setorOriginal: "Produção", fatorOriginal: "sobrecarga", tipo: "nao_identificado" }],
    linhas: [
      aep({ nivelAiha: "Moderado" }),
      aep({ setorOriginal: "Produção - Altura", nivelAiha: "Muito Alto" }),
      linha({ nivel: "Médio" }),
      linha({ origem: "QPS", idDocumento: "QPS-ANTIGO", nivel: "Crítico" }),
      linha({ fatorOriginal: "Categoria inventada xyz" }),
    ],
  });
  assert.deepEqual(r.questionarios, ["DRPS"]);
  const c = r.celulas.find((x) => x.setor === "Produção" && x.idFator === "assedio")!;
  assert.equal(c.aep?.nivelAiha, "Muito Alto");
  assert.equal(c.classe.DRPS, "Nível divergente", "Muito Alto (4) × Médio (2)");
  assert.equal(c.classe.QPS, null);
  assert.equal(r.celulas.find((x) => x.idFator === "sobrecarga")!.aepNaoIdentificado, true);
  assert.equal(r.linhasSemFator, 1);
});

test("resumo: documentos padrão, o que falta e a contagem de divergências", () => {
  const doc = (id: string, origem: "AEP" | "DRPS" | "QPS", data: string): DocumentoFonte => ({
    id, origem, idEmpresa: "E1", titulo: id, status: "CONCLUIDO", data, responsavel: null, necessitaAet: null, setores: 1,
  });
  const docs = documentosDaEmpresa(
    [doc("DRPS-old", "DRPS", "2026-01-01"), doc("DRPS-1", "DRPS", "2026-09-01"), { ...doc("X", "AEP", "2026-09-01"), idEmpresa: "E2" }],
    "E1",
  );
  assert.equal(docs.DRPS?.id, "DRPS-1");
  assert.equal(docs.AEP, undefined);
  const r = conciliarEmpresa({ ...base, setoresAep: [], linhas: [linha({ nivel: "Alto" })] });
  const s = resumirEmpresa("E1", docs, r);
  assert.deepEqual(s.falta, ["AEP"]);
  assert.equal(s.divergencias, 0);
  assert.equal(s.porClasse["Sem par"], 2);
});
