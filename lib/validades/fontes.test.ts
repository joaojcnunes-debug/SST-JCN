import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FONTES, fontesPermitidas, tiposPermitidos } from "./fontes";
import { TODOS_MODULOS } from "@/lib/supabase/types";

/**
 * O mapa tabela → módulo lido do BANCO em 22/09 (`select tabela, modulo from
 * public.rls_modulo_tabelas`, o mesmo que a trava da v236 usa para decidir).
 * Escrito à mão aqui de propósito: se alguém mexer no módulo de uma fonte, o
 * teste compara com o que o banco realmente cobra e reprova.
 */
const MAPA_DO_BANCO: Record<string, string> = {
  aep_relatorios: "aep",
  aet_relatorios: "aet",
  analises_quimicos: "analise_quimicos",
  apreciacoes_maquinas: "apreciacao_maquinas",
  drps_relatorios: "psicossocial",
  inspecoes: "painel",
  investigacoes_acidente: "investigacao_acidente",
  relatorios_conformidade: "conformidade",
  relatorios_nao_conformidade: "nao_conformidade",
};

describe("o módulo de cada fonte", () => {
  it("é o mesmo que a trava do banco cobra, tabela a tabela", () => {
    for (const f of FONTES) {
      assert.equal(f.modulo, MAPA_DO_BANCO[f.tabela], `fonte ${f.tabela}`);
    }
    assert.equal(FONTES.length, Object.keys(MAPA_DO_BANCO).length);
  });

  it("existe de verdade em modulos_permitidos (a armadilha do nome curto)", () => {
    // `useRegistrosEmpresa` chamava o módulo dos questionários de
    // "questionarios" enquanto a conta guarda "questionarios_psicossociais":
    // com o nome curto, o filtro esconderia o módulo de TODO MUNDO.
    for (const f of FONTES) {
      assert.ok(TODOS_MODULOS.includes(f.modulo), `módulo inexistente: ${f.modulo}`);
    }
  });
});

describe("fontesPermitidas", () => {
  it("não varre nada enquanto o perfil não chegou", () => {
    // null/undefined = ainda não sei quem é. Varrer tudo aqui é justamente o
    // vazamento que a v0.3.636 fecha; a tela trata isso como CARREGANDO.
    assert.deepEqual(fontesPermitidas(null), []);
    assert.deepEqual(fontesPermitidas(undefined), []);
  });

  it("devolve só as tabelas dos módulos da conta", () => {
    // Conta real de 22/09: Visualizador com 2 módulos.
    const fontes = fontesPermitidas(["painel", "analise_quimicos"]);
    assert.deepEqual(
      fontes.map((f) => f.tabela).sort(),
      ["analises_quimicos", "inspecoes"],
    );
  });

  it("deixa passar as 9 para quem tem os 9", () => {
    const todos = FONTES.map((f) => f.modulo);
    assert.equal(fontesPermitidas(todos).length, 9);
  });

  it("ignora módulo que não abre documento nenhum", () => {
    // O técnico que perdeu os 9 cards no Início tem exatamente estes.
    assert.deepEqual(
      fontesPermitidas(["dimensionamento", "escala_supervisores", "epi"]),
      [],
    );
  });

  it("não deixa o módulo de um documento liberar o do outro", () => {
    const so = fontesPermitidas(["psicossocial"]);
    assert.equal(so.length, 1);
    assert.equal(so[0].tabela, "drps_relatorios");
    // questionários é OUTRO módulo e não tem fonte aqui.
    assert.deepEqual(fontesPermitidas(["questionarios_psicossociais"]), []);
  });
});

describe("tiposPermitidos", () => {
  it("segue as fontes permitidas, na mesma ordem", () => {
    assert.deepEqual(tiposPermitidos(["aet", "aep"]), ["AET", "AEP"]);
    assert.deepEqual(tiposPermitidos(null), []);
  });
});
