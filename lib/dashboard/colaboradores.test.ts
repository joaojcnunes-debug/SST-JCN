import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { situacaoPorColaborador, type InspecaoColaborador } from "./colaboradores";

const OUT = 2026 * 12 + 9;
const mesDe = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

const insp = (p: Partial<InspecaoColaborador> & { id_inspecao: string }): InspecaoColaborador => ({
  status: "EM_ANDAMENTO",
  data_inspecao: "2026-10-01",
  concluida_em: null,
  created_at: "2026-10-01T10:00:00Z",
  tipo_criacao: "BRANCO",
  responsavel: "Quem Abriu",
  ...p,
});

const base = (inspecoes: InspecaoColaborador[], extra: Partial<Parameters<typeof situacaoPorColaborador>[0]> = {}) =>
  situacaoPorColaborador({
    inspecoes,
    associados: new Map(),
    documentos: [],
    opcoes: { tecnicosDeCampo: new Map([["A", [{ digitado: "Ana Técnica" }]]]) },
    mesAtual: OUT,
    mesDe,
    hoje: "2026-10-28",
    ...extra,
  });

describe("situacaoPorColaborador", () => {
  it("campo: credita quem foi a campo (aba Responsáveis); sem ninguém, quem abriu; renovação não conta", () => {
    const r = base([
      insp({ id_inspecao: "A", dias_espera: 40 }),
      insp({ id_inspecao: "B", dias_espera: 3 }),
      insp({ id_inspecao: "C", tipo_criacao: "RENOVACAO" }),
      insp({ id_inspecao: "D", status: "CONCLUIDA" }),
    ]);
    const ana = r.find((l) => l.pessoa === "Ana Técnica")!;
    const abriu = r.find((l) => l.pessoa === "Quem Abriu")!;
    assert.deepEqual([ana.campoAbertas, ana.campoParadas], [1, 1]);
    assert.deepEqual([abriu.campoAbertas, abriu.campoParadas], [1, 0], "B (sem registro) vai para quem abriu; C e D não contam");
  });

  it("documento: atribuído só com a inspeção concluída em campo; em elaboração vai para o responsável", () => {
    const r = base(
      [
        insp({ id_inspecao: "X", status: "CONCLUIDA", situacao_documento: "ATRIBUIDO" }),
        insp({ id_inspecao: "Y", status: "EM_ANDAMENTO", situacao_documento: "ATRIBUIDO" }),
        insp({ id_inspecao: "Z", status: "CONCLUIDA", situacao_documento: "EM_ELABORACAO", elaboracao_responsavel: "Bia" }),
      ],
      { associados: new Map([["X", ["Sarah"]], ["Y", ["Sarah"]], ["Z", ["Sarah", "Bia"]]]) },
    );
    const sarah = r.find((l) => l.pessoa === "Sarah")!;
    const bia = r.find((l) => l.pessoa === "Bia")!;
    assert.deepEqual([sarah.docAtribuidos, sarah.docEmElaboracao], [1, 0], "Y está em campo; Z é da Bia, que está com ele");
    assert.deepEqual([bia.docAtribuidos, bia.docEmElaboracao], [0, 1]);
  });

  it("entregues no mês: só o mês corrente, na pessoa da 1ª conclusão, grafias juntas", () => {
    const r = base([], {
      documentos: [
        { status: "CONCLUIDA", elaboracao_concluida_em: "2026-10-05T12:00:00Z", elaboracao_responsavel: "Ana Luíza" },
        { status: "CONCLUIDA", elaboracao_concluida_em: "2026-10-06T12:00:00Z", elaboracao_responsavel: "ana luiza" },
        { status: "CONCLUIDA", elaboracao_concluida_em: "2026-09-30T12:00:00Z", elaboracao_responsavel: "Ana Luíza" },
        { status: "DELETADA", elaboracao_concluida_em: "2026-10-07T12:00:00Z", elaboracao_responsavel: "Ana Luíza" },
      ],
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].entreguesMes, 2);
  });

  it("críticas e prazo vencido contam a inspeção uma vez por pessoa, e ordenam a tabela", () => {
    const r = base(
      [
        insp({ id_inspecao: "A", prioridade_efetiva: "CRITICA", prazo: "2026-10-01" }),
        insp({ id_inspecao: "B", prioridade_efetiva: "BAIXA" }),
        insp({ id_inspecao: "Q", status: "CONCLUIDA", situacao_documento: "ATRIBUIDO", prioridade_efetiva: "GRAVE" }),
      ],
      { associados: new Map([["Q", ["Ana Técnica"]]]) },
    );
    assert.equal(r[0].pessoa, "Ana Técnica", "quem tem crítica vem primeiro");
    assert.deepEqual([r[0].criticas, r[0].prazoVencido], [2, 1]);
  });

  it("'Sem responsável' não vira linha", () => {
    const r = base([insp({ id_inspecao: "S", responsavel: null })]);
    assert.equal(r.length, 0);
  });
});
