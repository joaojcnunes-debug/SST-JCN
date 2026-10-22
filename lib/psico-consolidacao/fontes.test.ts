import { test } from "node:test";
import assert from "node:assert/strict";
import { documentosPadrao, linhasDaAep, linhasDaAvaliacao, type DocumentoFonte } from "./fontes";
import { SINAIS_ORGANIZACIONAL } from "@/lib/aep/sinais-organizacional";
import type { AepSetor } from "@/lib/supabase/types";

const sinalSobrecarga = SINAIS_ORGANIZACIONAL.sobrecarga[0];

function setor(nome: string, parcial: Partial<AepSetor>): AepSetor {
  return { nome_setor: nome, checklist_organizacional: {}, ...parcial } as unknown as AepSetor;
}

test("AEP: só fator 'sim' vira linha Identificado, com sinais e alerta de sem sinal", () => {
  const linhas = linhasDaAep({
    id_relatorio: "AEP-1",
    id_empresa: "EMP-A",
    setores: [
      setor(" OBRA - ELETRICA ", {
        checklist_organizacional: { sobrecarga: "sim", falta_suporte: "sim", assedio: "nao", recompensas: "na" } as never,
        sinais_organizacional: { sobrecarga: [sinalSobrecarga.key] },
        aiha_organizacional: { sobrecarga: { probabilidade: "Baixa", severidade: "Severos", nivel: "Moderado" } } as never,
      }),
      setor("", { checklist_organizacional: { assedio: "sim" } as never }),
    ],
  });
  assert.equal(linhas.length, 2);
  const sob = linhas.find((l) => l.fatorOriginal === "sobrecarga")!;
  assert.equal(sob.setorOriginal, "OBRA - ELETRICA");
  assert.equal(sob.nivel, "Identificado");
  assert.deepEqual(sob.sinais, [sinalSobrecarga.label]);
  assert.equal(sob.semSinal, false);
  assert.equal(sob.nivelAiha, "Moderado");
  const sup = linhas.find((l) => l.fatorOriginal === "falta_suporte")!;
  assert.equal(sup.semSinal, true);
});

test("DRPS/QPS: cada fator com nível, inclusive Baixo, e respondentes", () => {
  const linhas = linhasDaAvaliacao("EMP-B", {
    fonte: "DRPS",
    id: "DRPS-1",
    titulo: "DRPS · Revisão 0",
    status: "CONCLUIDO",
    data: "2026-10-09",
    responsavel: null,
    setores: [
      {
        setor: "CANTEIRO - ADMINISTRATIVO",
        respondentes: 7,
        fatores: [
          { nome: "Tópico 10 - Excesso de demandas no trabalho (Sobrecarga)", fonteGeradora: null, nivel: "Crítico" },
          { nome: "Tópico 01 - Assédio de qualquer natureza no trabalho", fonteGeradora: null, nivel: "Baixo" },
        ],
        agravos: [],
        medidas: [],
        contagem: { Baixo: 1, Médio: 0, Alto: 0, Crítico: 1 },
        pior: "Crítico",
      },
    ],
  });
  assert.deepEqual(linhas.map((l) => [l.origem, l.nivel, l.respondentes]), [
    ["DRPS", "Crítico", 7],
    ["DRPS", "Baixo", 7],
  ]);
});

test("documento padrão: o mais recente por empresa e origem", () => {
  const d = (id: string, idEmpresa: string, origem: "AEP" | "DRPS", data: string | null): DocumentoFonte => ({
    id, idEmpresa, origem, data, titulo: id, status: "CONCLUIDO", responsavel: null, necessitaAet: null, setores: 1,
  });
  const escolhidos = documentosPadrao([
    d("A1", "E1", "AEP", "2026-01-01"),
    d("A2", "E1", "AEP", "2026-09-01"),
    d("D1", "E1", "DRPS", null),
    d("A3", "E2", "AEP", "2026-05-01"),
  ]);
  assert.deepEqual([...escolhidos].sort(), ["A2", "A3", "D1"]);
});
