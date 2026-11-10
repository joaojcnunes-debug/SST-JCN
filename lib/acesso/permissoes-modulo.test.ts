import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ACOES_MODULO,
  GERAL,
  MODULO_DA_ROTA,
  TODAS_AS_COLUNAS,
  acoesDoModulo,
  flagsGerais,
  gradeComChaves,
  gradeDaConta,
  marcarNaGrade,
  moduloDaRota,
  permissoesParaGravar,
  podeNoModulo,
} from "./permissoes-modulo";
import { TODOS_MODULOS, type ModuloPermitido, type PerfilUsuario } from "../supabase/types";

const antigo = {
  perfil: "Tecnico" as const,
  modulos_permitidos: ["painel", "aet"] as ModuloPermitido[],
  pode_criar: true,
  pode_editar: true,
  pode_excluir: false,
  permissoes_modulos: null,
};

const novo = {
  ...antigo,
  modulos_permitidos: ["painel", "aet", "epi"] as ModuloPermitido[],
  permissoes_modulos: {
    painel: { criar: true, editar: true, excluir: false },
    aet: { criar: false, editar: false, excluir: false },
    geral: { criar: false, editar: true, excluir: false },
  },
};

/** A regra de ANTES da v0.3.901 (os hooks liam só as chaves gerais). */
function regraAntiga(u: typeof antigo | { perfil: PerfilUsuario; pode_criar: boolean; pode_editar: boolean; pode_excluir: boolean }, acao: "criar" | "editar" | "excluir") {
  if (u.perfil === "Admin") return true;
  return { criar: u.pode_criar, editar: u.pode_editar, excluir: u.pode_excluir }[acao] === true;
}

describe("podeNoModulo", () => {
  test("conta antiga (sem grade): as chaves gerais valem em todo módulo que vê e fora dos módulos", () => {
    assert.equal(podeNoModulo(antigo, "painel", "criar"), true);
    assert.equal(podeNoModulo(antigo, "aet", "editar"), true);
    assert.equal(podeNoModulo(antigo, "aet", "excluir"), false);
    assert.equal(podeNoModulo(antigo, null, "editar"), true);
  });

  test("conta com grade: só o que está marcado no módulo", () => {
    assert.equal(podeNoModulo(novo, "painel", "editar"), true);
    assert.equal(podeNoModulo(novo, "aet", "editar"), false);
    assert.equal(podeNoModulo(novo, "aet", "criar"), false);
  });

  test("com grade, fora dos módulos (Empresas, Validades) vale a linha geral — não as chaves gerais", () => {
    assert.equal(podeNoModulo(novo, null, "editar"), true);
    assert.equal(podeNoModulo(novo, null, "criar"), false); // pode_criar = true, mas a linha geral não marca
  });

  test("com grade, módulo visto mas sem entrada não tem nenhuma ação", () => {
    assert.equal(podeNoModulo(novo, "epi", "criar"), false);
    assert.deepEqual(acoesDoModulo(novo, "epi"), { criar: false, editar: false, excluir: false });
  });

  test("sem Visualizar (fora de modulos_permitidos) não pode nada, mesmo marcado", () => {
    const semVer = { ...novo, modulos_permitidos: ["aet"] as ModuloPermitido[] };
    assert.equal(podeNoModulo(semVer, "painel", "editar"), false);
  });

  test("Admin pode tudo; sem conta, nada", () => {
    assert.equal(podeNoModulo({ ...novo, perfil: "Admin" }, "aet", "excluir"), true);
    assert.equal(podeNoModulo(null, "painel", "criar"), false);
  });

  test("tela de dois módulos: basta poder em um que a conta veja", () => {
    assert.equal(podeNoModulo(novo, ["aet", "painel"], "criar"), true);
    assert.equal(podeNoModulo(novo, ["aet", "psicossocial"], "criar"), false);
  });

  test("conta antiga: dá o mesmo que a regra antiga em todo perfil, chave e módulo que a conta vê", () => {
    const perfis: PerfilUsuario[] = ["Admin", "Tecnico", "Visualizador", "Cliente"];
    for (const perfil of perfis)
      for (let bits = 0; bits < 8; bits++) {
        const u = {
          perfil,
          modulos_permitidos: ["painel", "aet", "epi", "frota"] as ModuloPermitido[],
          pode_criar: (bits & 1) > 0,
          pode_editar: (bits & 2) > 0,
          pode_excluir: (bits & 4) > 0,
          permissoes_modulos: null,
        };
        for (const acao of ACOES_MODULO) {
          const esperado = regraAntiga(u, acao);
          assert.equal(podeNoModulo(u, null, acao), esperado, `${perfil} ${bits} fora ${acao}`);
          for (const m of u.modulos_permitidos) assert.equal(podeNoModulo(u, m, acao), esperado, `${perfil} ${bits} ${m} ${acao}`);
          assert.equal(podeNoModulo(u, ["aep", "painel"], acao), esperado);
        }
      }
  });
});

/** Os módulos que alguma tela consulta (pelo endereço). Transferências fica de fora: é só a entrada, sem rota própria. */
const MODULOS_COM_TELA = [...new Set(Object.values(MODULO_DA_ROTA).flatMap((v) => (typeof v === "string" ? [v] : [...v])))];

describe("salvar no cadastro novo sem mexer na grade não muda nada", () => {
  test("os módulos com tela são todos menos Transferências", () => {
    assert.deepEqual(
      TODOS_MODULOS.filter((m) => !MODULOS_COM_TELA.includes(m)),
      ["transferencias"],
    );
  });

  const casos = [
    antigo,
    { ...antigo, pode_criar: false, pode_editar: false, pode_excluir: false },
    { ...antigo, perfil: "Visualizador" as const, pode_criar: false, pode_excluir: false }, // edita (Empresas) sem criar
    { ...antigo, modulos_permitidos: [] as ModuloPermitido[] }, // nenhum módulo: Empresas/Validades continuam
    { ...antigo, modulos_permitidos: ["inventario_maquinas", "transferencias"] as never },
    { ...antigo, perfil: "Admin" as const, pode_criar: false, pode_editar: false, pode_excluir: false },
  ];
  for (const [i, conta] of casos.entries()) {
    test(`caso ${i + 1}`, () => {
      const grade = gradeDaConta(conta);
      const salva = {
        ...conta,
        ...flagsGerais(conta.modulos_permitidos, grade),
        permissoes_modulos: permissoesParaGravar(conta.modulos_permitidos, grade),
      };
      // as chaves gerais (que as funções do banco leem) ficam iguais quando a conta podia em algum lugar
      assert.deepEqual(
        { c: salva.pode_criar, e: salva.pode_editar, x: salva.pode_excluir },
        { c: conta.pode_criar, e: conta.pode_editar, x: conta.pode_excluir },
      );
      for (const acao of ACOES_MODULO) {
        assert.equal(podeNoModulo(salva, null, acao), podeNoModulo(conta, null, acao), `fora ${acao}`);
        for (const m of MODULOS_COM_TELA) assert.equal(podeNoModulo(salva, m, acao), podeNoModulo(conta, m, acao), `${m} ${acao}`);
      }
    });
  }
});

describe("cadastro: grade, marcação, gravação e chaves gerais", () => {
  const vazia = gradeComChaves([], null, {});

  test("a grade de conta antiga copia as chaves gerais nos módulos que ela vê e em Empresas/Validades", () => {
    const g = gradeDaConta(antigo);
    assert.equal(Object.keys(g).length, TODOS_MODULOS.length + 1);
    assert.deepEqual(g.aet, { criar: true, editar: true, excluir: false });
    assert.deepEqual(g.frota, { criar: false, editar: false, excluir: false });
    assert.deepEqual(g[GERAL], { criar: true, editar: true, excluir: false });
  });

  test("padrão da função: chave definida vale em todas as linhas que valem; null mantém o que estava", () => {
    const g = gradeComChaves(["painel", "aet"], gradeDaConta(novo), { criar: false, editar: null, excluir: true });
    assert.deepEqual(g.painel, { criar: false, editar: true, excluir: true });
    assert.deepEqual(g.aet, { criar: false, editar: false, excluir: true });
    assert.deepEqual(g.epi, { criar: false, editar: false, excluir: false });
    assert.deepEqual(g[GERAL], { criar: false, editar: true, excluir: true });
  });

  test("marcar Criar marca o Visualizar junto", () => {
    const r = marcarNaGrade(["painel"], vazia, ["aet"], ["criar"], true);
    assert.deepEqual(r.modulos, ["painel", "aet"]);
    assert.deepEqual(r.grade.aet, { criar: true, editar: false, excluir: false });
  });

  test("tirar o Visualizar limpa Criar/Editar/Excluir; tirar só o Editar mantém o resto", () => {
    const cheia = marcarNaGrade([], vazia, ["aet"], TODAS_AS_COLUNAS, true);
    assert.deepEqual(cheia.grade.aet, { criar: true, editar: true, excluir: true });
    const semEditar = marcarNaGrade(cheia.modulos, cheia.grade, ["aet"], ["editar"], false);
    assert.deepEqual(semEditar.modulos, ["aet"]);
    assert.deepEqual(semEditar.grade.aet, { criar: true, editar: false, excluir: true });
    const semVer = marcarNaGrade(cheia.modulos, cheia.grade, ["aet"], ["ver"], false);
    assert.deepEqual(semVer.modulos, []);
    assert.deepEqual(semVer.grade.aet, { criar: false, editar: false, excluir: false });
  });

  test("Empresas/Validades (geral) não depende de Visualizar e não entra em modulos_permitidos", () => {
    const r = marcarNaGrade(["painel"], vazia, [GERAL], ["editar"], true);
    assert.deepEqual(r.modulos, ["painel"]);
    assert.deepEqual(r.grade[GERAL], { criar: false, editar: true, excluir: false });
    const tirar = marcarNaGrade(r.modulos, r.grade, [GERAL], TODAS_AS_COLUNAS, false);
    assert.deepEqual(tirar.grade[GERAL], { criar: false, editar: false, excluir: false });
    assert.deepEqual(tirar.modulos, ["painel"]);
  });

  test("Transferências é só entrada: Permitir todas marca o Visualizar e nada mais", () => {
    const r = marcarNaGrade([], vazia, ["transferencias", "frota"], TODAS_AS_COLUNAS, true);
    assert.deepEqual(r.grade.transferencias, { criar: false, editar: false, excluir: false });
    assert.deepEqual(r.grade.frota, { criar: true, editar: true, excluir: true });
    assert.deepEqual(r.modulos, ["transferencias", "frota"]);
  });

  test("módulo que não existe mais (inventario_maquinas) fica na lista como estava", () => {
    const r = marcarNaGrade(["inventario_maquinas", "aet"], vazia, ["aet"], ["ver"], false);
    assert.deepEqual(r.modulos, ["inventario_maquinas"]);
  });

  test("grava os módulos com Visualizar e a linha geral", () => {
    const g = gradeDaConta(antigo);
    assert.deepEqual(Object.keys(permissoesParaGravar(["painel", "inventario_maquinas"], g)), ["painel", GERAL]);
  });

  test("chaves gerais = pode em algum lugar (Empresas/Validades ou módulo que vê)", () => {
    let grade = marcarNaGrade([], vazia, ["painel"], ["editar"], true).grade;
    grade = marcarNaGrade(["painel"], grade, ["aet"], ["criar"], true).grade;
    grade = { ...grade, epi: { criar: false, editar: false, excluir: true } };
    assert.deepEqual(flagsGerais(["painel", "aet"], grade), { pode_criar: true, pode_editar: true, pode_excluir: false });
    assert.deepEqual(flagsGerais([], grade), { pode_criar: false, pode_editar: false, pode_excluir: false });
    const soGeral = marcarNaGrade([], vazia, [GERAL], ["excluir"], true).grade;
    assert.deepEqual(flagsGerais([], soGeral), { pode_criar: false, pode_editar: false, pode_excluir: true });
  });
});

/**
 * Cada grupo de rotas de módulo chama `useRequireModule(...)` no layout. Toda pasta desse grupo precisa estar em
 * MODULO_DA_ROTA com o mesmo módulo — senão a tela nova usa a linha geral e ignora a grade do módulo.
 */
function modulosDosGrupos(): Map<string, string[]> {
  const raizApp = join(process.cwd(), "app");
  const porPasta = new Map<string, string[]>();
  for (const grupo of readdirSync(raizApp, { withFileTypes: true })) {
    if (!grupo.isDirectory() || !grupo.name.startsWith("(")) continue;
    const layout = join(raizApp, grupo.name, "layout.tsx");
    if (!existsSync(layout)) continue;
    const m = readFileSync(layout, "utf8").match(/useRequireModule\(([^)]*)\);/);
    if (!m) continue;
    const modulos = [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
    for (const pasta of readdirSync(join(raizApp, grupo.name), { withFileTypes: true })) {
      if (pasta.isDirectory()) porPasta.set(pasta.name, modulos);
    }
  }
  return porPasta;
}

describe("MODULO_DA_ROTA acompanha o disco", () => {
  const noDisco = modulosDosGrupos();

  test("toda pasta de grupo de módulo está mapeada para o módulo do layout", () => {
    assert.ok(noDisco.size >= 28, `só ${noDisco.size} pastas achadas`);
    for (const [pasta, modulos] of noDisco) {
      const mapeado = MODULO_DA_ROTA[pasta];
      assert.ok(mapeado, `app/(…)/${pasta} não está em MODULO_DA_ROTA`);
      assert.deepEqual(typeof mapeado === "string" ? [mapeado] : [...mapeado], modulos, pasta);
    }
  });

  test("toda entrada de MODULO_DA_ROTA existe no disco", () => {
    for (const pasta of Object.keys(MODULO_DA_ROTA)) assert.ok(noDisco.has(pasta), `${pasta} não existe em app/`);
  });

  test("moduloDaRota lê o primeiro pedaço do endereço", () => {
    assert.equal(moduloDaRota("/aet/123/dados"), "aet");
    assert.equal(moduloDaRota("/inspecoes/minhas"), "painel");
    assert.equal(moduloDaRota("/empresas"), null);
    assert.equal(moduloDaRota("/validades"), null);
    assert.equal(moduloDaRota("/gestao"), null);
    assert.equal(moduloDaRota("/constructor"), null);
    assert.equal(moduloDaRota(""), null);
  });
});
