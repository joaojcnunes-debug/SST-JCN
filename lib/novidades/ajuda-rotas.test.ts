import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROTAS_AJUDA, ajudaDaRotaAtual } from "./ajuda-rotas";

/**
 * Varre app/ atrás das ajudas que existem de verdade.
 *
 * A aba Atualizações mora dentro das ajudas de módulo. Uma ajuda nova que
 * ninguém registre aqui simplesmente não ganha a aba — e o defeito é invisível:
 * a página abre, funciona, e só não tem as novidades. Este teste é o que faz
 * isso aparecer.
 */
function ajudasNoDisco(): string[] {
  const raizApp = join(process.cwd(), "app");
  const achadas: string[] = [];

  // app/(grupo)/<modulo>/ajuda/page.tsx — o (grupo) não entra na URL.
  for (const grupo of readdirSync(raizApp, { withFileTypes: true })) {
    if (!grupo.isDirectory() || !grupo.name.startsWith("(")) continue;
    const dirGrupo = join(raizApp, grupo.name);
    for (const modulo of readdirSync(dirGrupo, { withFileTypes: true })) {
      if (!modulo.isDirectory()) continue;
      const dirModulo = join(dirGrupo, modulo.name);
      let filhos: string[];
      try {
        filhos = readdirSync(dirModulo);
      } catch {
        continue;
      }
      if (filhos.includes("ajuda")) achadas.push(`/${modulo.name}/ajuda`);
    }
  }
  return achadas.sort();
}

describe("ROTAS_AJUDA acompanha o disco", () => {
  test("toda ajuda que existe em app/ está registrada", () => {
    const noDisco = ajudasNoDisco();
    const registradas: string[] = [...ROTAS_AJUDA].sort();

    const faltando = noDisco.filter((r) => !registradas.includes(r));
    assert.deepEqual(
      faltando,
      [],
      `Ajuda de módulo sem registro em ROTAS_AJUDA — ela não vai ganhar a aba ` +
        `Atualizações e ninguém vai perceber: ${faltando.join(", ")}`,
    );
  });

  test("toda rota registrada existe em app/", () => {
    const noDisco = ajudasNoDisco();
    const sobrando = ([...ROTAS_AJUDA] as string[]).filter((r) => !noDisco.includes(r));
    assert.deepEqual(
      sobrando,
      [],
      `ROTAS_AJUDA aponta para ajuda que não existe mais: ${sobrando.join(", ")}`,
    );
  });
});

describe("ajudaDaRotaAtual", () => {
  test("acha a ajuda do módulo em que a pessoa está", () => {
    assert.equal(ajudaDaRotaAtual("/frota/veiculos/FRV-123"), "/frota/ajuda");
    assert.equal(ajudaDaRotaAtual("/aet"), "/aet/ajuda");
    assert.equal(ajudaDaRotaAtual("/frota/ajuda"), "/frota/ajuda");
  });

  test("devolve null onde não há ajuda — o hub inclusive", () => {
    // Mandar alguém do hub para a ajuda da Frota só para ler novidade a
    // deixaria perdida num módulo que ela não abriu.
    assert.equal(ajudaDaRotaAtual("/"), null);
    assert.equal(ajudaDaRotaAtual("/inicio"), null);
    assert.equal(ajudaDaRotaAtual("/modulos"), null);
    assert.equal(ajudaDaRotaAtual("/gestao-gerencial/quadros"), null);
  });

  test("não confunde módulo que começa igual", () => {
    // /equipamentos tem ajuda; um /equip qualquer não teria. (Era o exemplo do
    // /inventario-maquinas, que saiu da interface em 2026-09-14.)
    assert.equal(ajudaDaRotaAtual("/equipamentos/lista"), "/equipamentos/ajuda");
    assert.equal(ajudaDaRotaAtual("/equip"), null);
  });
});
