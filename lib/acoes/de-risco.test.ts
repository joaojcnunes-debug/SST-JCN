import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  acaoDeRisco,
  justificativaDaAcao,
  riscosElegiveis,
  riscoViraAcao,
  textoDaAcao,
} from "./de-risco";
import type { Risco, Setor } from "@/lib/supabase/types";

function risco(over: Partial<Risco> = {}): Risco {
  return {
    id_risco: "RIS-1",
    id_inspecao: "INS-1",
    id_empresa: "EMP-1",
    id_setor: "SET-1",
    id_cargo: null,
    tipo_risco: "Físico" as Risco["tipo_risco"],
    agente: "Ruído",
    fonte_geradora: JSON.stringify(["Compressor"]),
    probabilidade: "Provável",
    severidade: "Crítica",
    nivel_risco: "Alto",
    meio_propagacao: null,
    id_matriz: null,
    situacao: null,
    tempo_exposicao: null,
    tecnica_utilizada: null,
    concentracao_exposicao: null,
    limite_tolerancia: null,
    insalubridade: null,
    periculosidade: null,
    numero_cas: null,
    via_absorcao: null,
    tipo_agente_biologico: null,
    fator_ergonomico: null,
    fator_psicossocial: null,
    pontuacao_iapat: null,
    fisico_necessita_medicao: null,
    fisico_qual_medicao: null,
    fisico_motivo_medicao: null,
    quim_q1: null,
    quim_q2: null,
    quim_q3: null,
    quim_q4: null,
    quim_q5: null,
    quim_q6: null,
    uso_processo: null,
    foto_quim_url: null,
    medidas_adotadas: null,
    medidas_recomendadas: JSON.stringify(["Enclausurar o compressor"]),
    observacoes_risco: null,
    ...over,
  } as Risco;
}

const setores = [{ id_setor: "SET-1", setor_ghe: "Produção" }] as Setor[];

const opts = {
  idInspecao: "INS-1",
  referenciaInspecao: "ACME · 01/08/2026 · INS-1",
  setores,
  createdBy: "quem@clicou.com",
};

describe("o corte de nível", () => {
  test("aceita Alto e Muito Alto", () => {
    assert.equal(riscoViraAcao(risco({ nivel_risco: "Alto" })), true);
    assert.equal(riscoViraAcao(risco({ nivel_risco: "Muito Alto" })), true);
  });

  test("recusa Moderado, Baixo e Trivial — eles ficam só no laudo", () => {
    for (const n of ["Moderado", "Baixo", "Trivial"] as const) {
      assert.equal(riscoViraAcao(risco({ nivel_risco: n })), false);
    }
  });

  test("recusa nível nulo em vez de chutar", () => {
    assert.equal(riscoViraAcao(risco({ nivel_risco: null })), false);
  });

  test("filtra a lista preservando a ordem de entrada", () => {
    const lista = [
      risco({ id_risco: "A", nivel_risco: "Baixo" }),
      risco({ id_risco: "B", nivel_risco: "Muito Alto" }),
      risco({ id_risco: "C", nivel_risco: "Alto" }),
    ];
    assert.deepEqual(riscosElegiveis(lista).map((r) => r.id_risco), ["B", "C"]);
  });
});

describe("o texto da ação", () => {
  test("usa as medidas recomendadas que o técnico digitou", () => {
    const r = risco({
      medidas_recomendadas: JSON.stringify(["Enclausurar", "Fornecer protetor"]),
    });
    assert.equal(textoDaAcao(r, "Produção"), "Enclausurar; Fornecer protetor");
  });

  test("aceita medida gravada como texto puro (não-JSON)", () => {
    const r = risco({ medidas_recomendadas: "Instalar barreira acústica" });
    assert.equal(textoDaAcao(r, "Produção"), "Instalar barreira acústica");
  });

  test("nunca nasce vazio quando não há medida — what_acao é NOT NULL", () => {
    for (const vazio of [null, "", "[]"]) {
      const t = textoDaAcao(risco({ medidas_recomendadas: vazio }), "Produção");
      assert.ok(t.length > 0);
      assert.ok(t.includes("Ruído"));
      assert.ok(t.includes("Produção"));
    }
  });
});

describe("a justificativa", () => {
  test("monta o retrato do risco como foi avaliado", () => {
    assert.equal(justificativaDaAcao(risco()), "Risco Físico — Ruído · nível Alto · Provável / Crítica · fonte: Compressor");
  });

  test("não deixa buraco quando o risco está pela metade", () => {
    const j = justificativaDaAcao(
      risco({ agente: null, probabilidade: null, fonte_geradora: null })
    );
    assert.equal(j, "Risco Físico · nível Alto");
  });
});

describe("a ação gerada", () => {
  test("nasce Pendente, sem prazo e sem responsável (decisão de 26/08)", () => {
    const a = acaoDeRisco(risco(), opts);
    assert.equal(a.status, "Pendente");
    assert.equal(a.when_prazo, null);
    assert.equal(a.who_responsavel, null);
    assert.equal(a.how_metodo, null);
    assert.equal(a.how_much_custo, null);
  });

  test("traduz o nível em prioridade", () => {
    assert.equal(acaoDeRisco(risco({ nivel_risco: "Muito Alto" }), opts).prioridade, "Critica");
    assert.equal(acaoDeRisco(risco({ nivel_risco: "Alto" }), opts).prioridade, "Alta");
  });

  test("marca a origem para o envio não duplicar", () => {
    const a = acaoDeRisco(risco({ id_risco: "RIS-42" }), opts);
    assert.equal(a.id_risco_origem, "RIS-42");
    assert.equal(a.id_risco, "RIS-42");
    assert.equal(a.id_inspecao, "INS-1");
    assert.ok(a.observacoes?.includes("ACME · 01/08/2026 · INS-1"));
  });

  test("resolve o nome do setor e aguenta setor ausente", () => {
    assert.equal(acaoDeRisco(risco(), opts).where_local, "Produção");
    assert.equal(acaoDeRisco(risco({ id_setor: "SET-X" }), opts).where_local, null);
  });
});
