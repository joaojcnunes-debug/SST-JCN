import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baixaRepresentatividade,
  chaveParecer,
  classificar,
  conciliarEmpresa,
  contarPareceres,
  documentosDaEmpresa,
  indexarPareceres,
  itensDoFechamento,
  prioridadeDe,
  resumirEmpresa,
  semelhancaSetor,
  situacaoParecer,
  sugereAet,
  sugerirPares,
  tituloComAcento,
  type ParecerConciliacao,
} from "./conciliacao";
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

test("nome do setor: caixa de título com o acento do documento; sem setor em comum é avisado", () => {
  assert.equal(tituloComAcento("IMPLEMENTAÇÃO DE SISTEMAS"), "Implementação de Sistemas");
  assert.equal(tituloComAcento("Atendimento ao Cliente"), "Atendimento ao Cliente");
  assert.equal(tituloComAcento("RH"), "RH");
  const r = conciliarEmpresa({
    ...base,
    setoresAep: [{ idDocumento: "AEP-1", setorOriginal: "Atendimento ao Cliente" }],
    linhas: [linha({ setorOriginal: "IMPLEMENTAÇÃO" })],
  });
  assert.deepEqual(r.setores.map((s) => s.setor), ["Atendimento ao Cliente", "Implementação"]);
  assert.equal(r.setoresEmComum, 0);
  const docs = { AEP: { id: "AEP-1" }, DRPS: { id: "DRPS-1" } } as never;
  assert.equal(resumirEmpresa("E1", docs, r).semSetorEmComum, true);
});

test("setores ligados à mão: viram um só, com o nome do destino e os dois originais", () => {
  const r = conciliarEmpresa({
    ...base,
    setoresAep: [{ idDocumento: "AEP-1", setorOriginal: "SAC", expostos: 20 }],
    deparaSetores: [{ chave_de: "SAC", chave_para: "ATENDIMENTO AO CLIENTE", nome_para: "Atendimento ao Cliente" }],
    linhas: [aep({ setorOriginal: "SAC", nivelAiha: "Alto" }), linha({ setorOriginal: "Atendimento ao Cliente", nivel: "Alto", respondentes: 15 })],
  });
  assert.equal(r.setores.length, 1);
  const s = r.setores[0];
  assert.equal(s.setor, "Atendimento ao Cliente");
  assert.deepEqual(s.originais, { AEP: ["SAC"], DRPS: ["Atendimento ao Cliente"] });
  assert.deepEqual(s.chavesOriginais.sort(), ["ATENDIMENTO AO CLIENTE", "SAC"]);
  assert.equal(s.expostos, 20);
  assert.equal(s.respondentes.DRPS, 15);
  assert.equal(r.setoresEmComum, 1);
  const c = r.celulas.find((x) => x.idFator === "assedio")!;
  assert.equal(c.classe.DRPS, "Convergente");
  assert.equal(c.chaveSetor, "ATENDIMENTO AO CLIENTE");
});

test("sugestão de pares: siglas, palavras em comum e cada setor uma vez", () => {
  assert.ok(semelhancaSetor("SAC", "Atendimento") >= 0.8);
  assert.ok(semelhancaSetor("RH", "Recursos Humanos") >= 0.8);
  assert.ok(semelhancaSetor("Produção", "PRODUCAO INDUSTRIAL") >= 0.5);
  assert.equal(semelhancaSetor("Financeiro", "Produção"), 0);
  const r = conciliarEmpresa({
    ...base,
    setoresAep: [
      { idDocumento: "AEP-1", setorOriginal: "SAC" },
      { idDocumento: "AEP-1", setorOriginal: "Financeiro" },
    ],
    linhas: [linha({ setorOriginal: "Atendimento ao Cliente" }), linha({ setorOriginal: "Produção Industrial" })],
  });
  const pares = sugerirPares(r.setores);
  assert.deepEqual(pares.map((p) => [p.aep.setor, p.questionario.setor]), [["SAC", "Atendimento ao Cliente"]]);
});

test("representatividade, sugestão de AET e prioridade", () => {
  assert.equal(baixaRepresentatividade(2, null), true, "menos de 3 respondentes");
  assert.equal(baixaRepresentatividade(5, 20), true, "25% de adesão");
  assert.equal(baixaRepresentatividade(12, 20), false);
  assert.equal(baixaRepresentatividade(null, 20), false);
  const q = (degrau: number) => ({ degrau, nivel: "", respondentes: 5 });
  assert.equal(sugereAet("Nível divergente", q(4)), true);
  assert.equal(sugereAet("Só questionário", q(3)), true);
  assert.equal(sugereAet("Só questionário", q(2)), false, "Médio só: não pede AET");
  assert.equal(sugereAet("Só AEP", q(1)), false);
  const a = { degrau: 4, nivelAiha: "Muito Alto", sinais: [] };
  const alta = prioridadeDe("Nível divergente", a, q(2), 40, false);
  assert.ok(alta > prioridadeDe("Só AEP", a, q(1), 40, false));
  assert.ok(alta > prioridadeDe("Nível divergente", a, q(2), 40, true), "baixa representatividade cai");
  assert.equal(prioridadeDe("Sem indicação", null, q(1), 40, false), 0);

  const r = conciliarEmpresa({
    ...base,
    setoresAep: [{ idDocumento: "AEP-1", setorOriginal: "Produção", expostos: 40, necessitaAet: true }],
    linhas: [aep({ nivelAiha: "Muito Alto" }), linha({ nivel: "Médio", respondentes: 6 })],
  });
  const c = r.celulas.find((x) => x.idFator === "assedio")!;
  assert.equal(c.classe.DRPS, "Nível divergente");
  assert.equal(c.sugereAet.DRPS, true);
  assert.equal(c.baixaRepresentatividade.DRPS, true, "6 de 40");
  assert.equal(r.setores[0].necessitaAet, true);
});

test("parecer: pendente, sem ação, desatualizado e a foto do fechamento", () => {
  const r = conciliarEmpresa({
    ...base,
    setoresAep: [{ idDocumento: "AEP-1", setorOriginal: "Produção" }],
    linhas: [linha({ nivel: "Alto" }), linha({ fatorOriginal: "Sobrecarga", nivel: "Alto" })],
  });
  // assedio e sobrecarga: Só questionário.
  const par = (x: Partial<ParecerConciliacao>): ParecerConciliacao => ({
    id_parecer: "P1", id_empresa: "E1", setor_chave: "PRODUCAO", setor_nome: "Produção", id_fator: "assedio",
    questionario: "DRPS", decisao: "CONFIRMAR", justificativa: null, classe: "Só questionário", documentos: {},
    id_acao: null, atualizado_por: null, atualizado_em: null, ...x,
  });
  assert.equal(situacaoParecer("Só questionário", undefined), "pendente");
  assert.equal(situacaoParecer("Convergente", undefined), "nao-precisa");
  assert.equal(situacaoParecer("Só questionário", par({})), "sem-acao");
  assert.equal(situacaoParecer("Só questionário", par({ id_acao: "ACA-1" })), "ok");
  assert.equal(situacaoParecer("Só questionário", par({ decisao: "DESCARTAR", justificativa: "x" })), "ok");
  assert.equal(situacaoParecer("Nível divergente", par({ id_acao: "ACA-1" })), "desatualizado");

  const idx = indexarPareceres([par({ id_acao: "ACA-1" })]);
  assert.equal(chaveParecer("PRODUCAO", "assedio", "DRPS"), [...idx.keys()][0]);
  assert.deepEqual(contarPareceres(r, idx), { pendentes: 1, semAcao: 0, desatualizados: 0, comParecer: 1 });
  const itens = itensDoFechamento(r, idx, (id) => id.toUpperCase());
  assert.deepEqual(
    itens.map((i) => [i.id_fator, i.classe, i.decisao, i.id_acao]),
    [["assedio", "Só questionário", "CONFIRMAR", "ACA-1"], ["sobrecarga", "Só questionário", null, null]],
  );
  assert.equal(resumirEmpresa("E1", { AEP: { id: "AEP-1" }, DRPS: { id: "DRPS-1" } } as never, r, idx).pareceres.pendentes, 1);
});
