import { test } from "node:test";
import assert from "node:assert/strict";
import { conciliarEmpresa, indexarPareceres, type ParecerConciliacao } from "./conciliacao";
import {
  alertasRevisaoGrupo,
  documentosDoGrupo,
  empresasDoSetorConciliado,
  itensDoFechamentoGrupo,
  padronizacaoDoGrupo,
  resumirGrupo,
  rotuloEmpresa,
} from "./conciliacao-grupo";
import type { DocumentoFonte, LinhaFonte } from "./fontes";

const linha = (x: Partial<LinhaFonte>): LinhaFonte => ({
  idEmpresa: "E1", origem: "DRPS", idDocumento: "DRPS-1", setorOriginal: "Produção", fatorOriginal: "Assédio",
  nivel: "Médio", sinais: [], semSinal: false, nivelAiha: null, confianca: null, probabilidadeInformada: true, respondentes: 8,
  ...x,
});
const aep = (x: Partial<LinhaFonte>) =>
  linha({ origem: "AEP", idDocumento: "AEP-1", fatorOriginal: "assedio", nivel: "Identificado", respondentes: null, ...x });
const doc = (x: Partial<DocumentoFonte>): DocumentoFonte => ({
  id: "AEP-1", origem: "AEP", idEmpresa: "E1", titulo: "AEP", status: "CONCLUIDO", data: "2026-08-01",
  responsavel: null, necessitaAet: null, setores: 1, ...x,
});

const FATORES = [
  { id_fator: "assedio", nome: "Assédio", nome_curto: "Assédio", ordem: 1, ativo: true },
  { id_fator: "sobrecarga", nome: "Sobrecarga", nome_curto: "Sobrecarga", ordem: 2, ativo: true },
];
const DEPARA = [
  { origem: "AEP" as const, valor_origem: "assedio", id_fator: "assedio" },
  { origem: "AEP" as const, valor_origem: "sobrecarga", id_fator: "sobrecarga" },
];

test("documentosDoGrupo: o mais recente de cada empresa em cada origem, só das empresas do grupo", () => {
  const docs = [
    doc({ id: "AEP-old", idEmpresa: "E1", data: "2025-01-01" }),
    doc({ id: "AEP-1", idEmpresa: "E1", data: "2026-08-01" }),
    doc({ id: "QPS-2", origem: "QPS", idEmpresa: "E2", data: "2026-10-22" }),
    doc({ id: "AEP-fora", idEmpresa: "E9", data: "2026-10-01" }),
  ];
  assert.deepEqual(documentosDoGrupo(docs, ["E1", "E2"]).map((d) => d.id), ["AEP-1", "QPS-2"]);
});

test("grupo: a AEP de uma empresa e o QPS de outra se comparam; o nível diz de qual empresa veio", () => {
  const r = conciliarEmpresa({
    pendencias: [],
    fatores: FATORES,
    depara: DEPARA,
    documentos: new Set(["AEP-1", "QPS-2", "QPS-3"]),
    setoresAep: [{ idDocumento: "AEP-1", idEmpresa: "E1", setorOriginal: "Produção", expostos: 10 }],
    linhas: [
      aep({ nivelAiha: "Alto" }),
      linha({ idEmpresa: "E2", origem: "QPS", idDocumento: "QPS-2", nivel: "Médio" }),
      linha({ idEmpresa: "E3", origem: "QPS", idDocumento: "QPS-3", nivel: "Crítico" }),
    ],
  });
  const c = r.celulas.find((x) => x.idFator === "assedio")!;
  assert.equal(c.classe.QPS, "Convergente", "AEP Alto × QPS Crítico (o pior das duas empresas)");
  assert.equal(c.aep?.idEmpresa, "E1");
  assert.equal(c.qps?.idEmpresa, "E3", "vale o pior nível, e ele veio da E3");
  const s = r.setores[0];
  assert.deepEqual(s.empresas, { AEP: ["E1"], QPS: ["E2", "E3"] });
  assert.deepEqual(empresasDoSetorConciliado(s.empresas), ["E1", "E2", "E3"]);
  assert.equal(r.fonteUnica, false);
  assert.equal(r.setoresEmComum, 1);
});

test("resumirGrupo: falta, fonte única e divergências do grupo inteiro", () => {
  const docs = [doc({ id: "AEP-1" }), doc({ id: "QPS-2", origem: "QPS", idEmpresa: "E2" })];
  const r = conciliarEmpresa({
    pendencias: [],
    fatores: FATORES,
    depara: DEPARA,
    documentos: new Set(docs.map((d) => d.id)),
    setoresAep: [{ idDocumento: "AEP-1", idEmpresa: "E1", setorOriginal: "Produção" }],
    linhas: [aep({ nivelAiha: "Alto" }), linha({ idEmpresa: "E2", origem: "QPS", idDocumento: "QPS-2", fatorOriginal: "Sobrecarga", nivel: "Alto" })],
  });
  const res = resumirGrupo("GRP-1", docs, r);
  assert.deepEqual(res.falta, []);
  assert.equal(res.empresasComDocumento, 2);
  assert.equal(res.porClasse["Só AEP"], 1);
  assert.equal(res.porClasse["Só questionário"], 1);
  assert.equal(res.divergencias, 2);
  assert.equal(res.pareceres.pendentes, 2);

  const soAep = resumirGrupo("GRP-1", [doc({})], conciliarEmpresa({
    pendencias: [], fatores: FATORES, depara: DEPARA, documentos: new Set(["AEP-1"]),
    setoresAep: [{ idDocumento: "AEP-1", idEmpresa: "E1", setorOriginal: "Produção" }], linhas: [aep({ nivelAiha: "Alto" })],
  }));
  assert.deepEqual(soAep.falta, ["Questionário"]);
  assert.equal(soAep.fonteUnica, true);
});

test("itensDoFechamentoGrupo: cada item leva as empresas do setor", () => {
  const r = conciliarEmpresa({
    pendencias: [], fatores: FATORES, depara: DEPARA, documentos: new Set(["AEP-1", "QPS-2"]),
    setoresAep: [{ idDocumento: "AEP-1", idEmpresa: "E1", setorOriginal: "Produção" }],
    linhas: [aep({ nivelAiha: "Alto" }), linha({ idEmpresa: "E2", origem: "QPS", idDocumento: "QPS-2", nivel: "Baixo" })],
  });
  const parecer: ParecerConciliacao = {
    id_parecer: "PGP-1", id_empresa: "", setor_chave: r.setores[0].chave, setor_nome: "Produção", id_fator: "assedio",
    questionario: "QPS", decisao: "CONFIRMAR", justificativa: null, classe: "Só AEP", documentos: {}, id_acao: "ACA-1",
    id_acoes: ["ACA-1", "ACA-2"], atualizado_por: null, atualizado_em: null,
  };
  const itens = itensDoFechamentoGrupo(r, indexarPareceres([parecer]), (id) => id, (e) => (e === "E1" ? "0001-01" : "0002-02"));
  assert.equal(itens.length, 1);
  assert.deepEqual(itens[0].empresas, ["0001-01", "0002-02"]);
  assert.deepEqual(itens[0].id_acoes, ["ACA-1", "ACA-2"]);
  assert.equal(itens[0].decisao, "CONFIRMAR");
});

test("rotuloEmpresa: a filial do CNPJ; sem CNPJ, o nome", () => {
  assert.equal(rotuloEmpresa({ nome: "Tere Frutas", cnpj: "39.508.023/0006-51" }), "0006-51");
  assert.equal(rotuloEmpresa({ nome: "Tere Frutas", cnpj: null }), "Tere Frutas");
});

test("alertasRevisaoGrupo: documento antigo com a empresa, datas distantes e fechamento desatualizado", () => {
  const docs = [
    doc({ id: "AEP-1", data: "2024-01-10" }),
    doc({ id: "QPS-2", origem: "QPS", idEmpresa: "E2", data: "2026-10-22" }),
  ];
  const a = alertasRevisaoGrupo({
    documentos: docs,
    ultimoFechamento: { fechado_em: "2026-11-01T12:00:00Z", documentos: [{ id: "AEP-1" }] },
    hoje: "2026-11-12",
    rotulo: (e) => (e === "E1" ? "0001-01" : "0002-02"),
  });
  assert.deepEqual(a.map((x) => x.tipo), ["documento-antigo", "documentos-distantes", "fechamento-desatualizado"]);
  assert.match(a[0].texto, /empresa 0001-01/);
  const emDia = alertasRevisaoGrupo({
    documentos: [doc({ data: "2026-08-01" })],
    ultimoFechamento: { fechado_em: "2026-11-01T12:00:00Z", documentos: [{ id: "AEP-1" }] },
    hoje: "2026-11-12",
    rotulo: (e) => e,
  });
  assert.deepEqual(emDia, []);
});

test("grupo segue a Consolidação: setor padronizado (só confirmado) junta nomes diferentes; fator ignorado sai", () => {
  const pad = padronizacaoDoGrupo(
    [{ id_setor_canonico: "SC1", nome: "Atendimento" }],
    [
      { id_empresa: "E1", origem: "AEP", setor_original: "SAC", id_setor_canonico: "SC1", confirmado_em: "2026-11-01" },
      { id_empresa: "E2", origem: "QPS", setor_original: "Central de Atendimento", id_setor_canonico: "SC1", confirmado_em: "2026-11-01" },
      { id_empresa: "E2", origem: "QPS", setor_original: "Loja", id_setor_canonico: "SC1", confirmado_em: null },
    ],
  );
  assert.equal(pad.confirmados, 2);
  assert.equal(pad.setorDe("E2", "QPS", "Loja"), null, "sem confirmação vale a sugestão");
  const base = {
    pendencias: [], fatores: FATORES, depara: DEPARA, documentos: new Set(["AEP-1", "QPS-2"]),
    setoresAep: [{ idDocumento: "AEP-1", idEmpresa: "E1", setorOriginal: "SAC" }],
    linhas: [
      aep({ setorOriginal: "SAC", nivelAiha: "Alto" }),
      aep({ setorOriginal: "SAC", fatorOriginal: "sobrecarga", nivelAiha: "Alto" }),
      linha({ idEmpresa: "E2", origem: "QPS", idDocumento: "QPS-2", setorOriginal: "Central de Atendimento", nivel: "Alto" }),
    ],
  };
  const sem = conciliarEmpresa(base);
  assert.equal(sem.setoresEmComum, 0, "sem a padronização, SAC e Central de Atendimento não se encontram");
  const com = conciliarEmpresa({ ...base, setorPadronizado: pad.setorDe, fatoresIgnorados: ["sobrecarga"] });
  assert.deepEqual(com.setores.map((s) => s.setor), ["Atendimento"]);
  assert.equal(com.setoresEmComum, 1);
  assert.deepEqual(com.celulas.map((c) => c.idFator), ["assedio"], "o fator ignorado no grupo não entra");
  assert.equal(com.celulas[0].classe.QPS, "Convergente");
});
