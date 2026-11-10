import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  TELAS_DO_MODULO,
  TODAS_AS_TELAS,
  cartaoBloqueado,
  marcarTelas,
  primeiraTelaLiberada,
  rotaBloqueada,
  telaBloqueada,
  telaDaRota,
  telasDosModulos,
  telasParaGravar,
} from "./telas-modulo";
import { TODOS_MODULOS, type ModuloPermitido, type PerfilUsuario } from "@/lib/supabase/types";

const conta = (bloqueadas: string[] | null, perfil: PerfilUsuario = "Tecnico", modulos: ModuloPermitido[] = [...TODOS_MODULOS]) => ({
  perfil,
  modulos_permitidos: modulos,
  telas_bloqueadas: bloqueadas,
});

test("toda tela do catálogo tem página (app/(grupo)/<rota>/page.tsx)", () => {
  const app = join(process.cwd(), "app");
  const grupos = readdirSync(app).filter((g) => g.startsWith("("));
  for (const tela of TODAS_AS_TELAS) {
    for (const rota of [tela.id, ...(tela.rotasExtras ?? [])]) {
      const achou = grupos.some((g) => existsSync(join(app, g, ...rota.split("/").filter(Boolean), "page.tsx")));
      assert.ok(achou, `sem página para ${rota}`);
    }
  }
});

test("só módulos que existem; a Sinalização é a mesma tela na AEP e no DRPS", () => {
  for (const m of Object.keys(TELAS_DO_MODULO)) assert.ok(TODOS_MODULOS.includes(m as ModuloPermitido), m);
  assert.equal(TODAS_AS_TELAS.filter((t) => t.id === "/sinalizacao-psicossocial").length, 1);
  assert.ok(TELAS_DO_MODULO.aep?.some((t) => t.id === "/sinalizacao-psicossocial"));
  assert.ok(TELAS_DO_MODULO.psicossocial?.some((t) => t.id === "/sinalizacao-psicossocial"));
});

test("a rota é da tela de prefixo mais longo, respeitando os segmentos", () => {
  assert.equal(telaDaRota("/inspecoes/minhas")?.rotulo, "Minhas inspeções");
  assert.equal(telaDaRota("/inspecoes/INS-123/relatorio")?.rotulo, "Inspeções");
  assert.equal(telaDaRota("/aep/AEP-1/laudo")?.rotulo, "Análises");
  assert.equal(telaDaRota("/aep/matriz-aiha")?.rotulo, "Matriz AIHA");
  assert.equal(telaDaRota("/sinalizacao-matriz-aiha")?.id, "/sinalizacao-psicossocial");
  assert.equal(telaDaRota("/comercial-matriz-aiha")?.rotulo, "Matriz AIHA");
  assert.equal(telaDaRota("/comercial")?.rotulo, "Oportunidades");
  assert.equal(telaDaRota("/consolidacao-grupo/vendas?empresa=E1")?.rotulo, "Vendas");
  assert.equal(telaDaRota("/consolidacao-grupo/G1")?.rotulo, "Grupos de empresas");
  assert.equal(telaDaRota("/acoes/texto-padrao")?.rotulo, "Texto Padrão — Plano de Ação");
  assert.equal(telaDaRota("/empresas"), null);
  assert.equal(telaDaRota("/modulos"), null);
});

test("conta antiga (NULL) e Admin veem tudo; a tela bloqueada fica fora", () => {
  assert.equal(rotaBloqueada(conta(null), "/consolidacao-grupo/vendas"), false);
  assert.equal(rotaBloqueada(conta([]), "/consolidacao-grupo/vendas"), false);
  const c = conta(["/consolidacao-grupo/vendas"]);
  assert.equal(rotaBloqueada(c, "/consolidacao-grupo/vendas"), true);
  assert.equal(rotaBloqueada(c, "/consolidacao-grupo/conciliacao"), false);
  assert.equal(telaBloqueada(conta(["/consolidacao-grupo/vendas"], "Admin"), "/consolidacao-grupo/vendas"), false);
  assert.equal(rotaBloqueada(null, "/consolidacao-grupo/vendas"), false);
});

test("entrada direta: vai para a primeira tela liberada do módulo, ou para o hub", () => {
  assert.equal(primeiraTelaLiberada(conta(["/comercial"]), ["comercial"]), "/comercial-matriz-aiha");
  assert.equal(primeiraTelaLiberada(conta(["/comercial", "/comercial-matriz-aiha"]), ["comercial"]), null);
  // Sinalização: layout de AEP ou DRPS; sem AEP, cai no DRPS.
  assert.equal(
    primeiraTelaLiberada(conta(["/sinalizacao-psicossocial"], "Tecnico", ["psicossocial"]), ["aep", "psicossocial"]),
    "/psicossocial/dashboard-geral",
  );
});

test("cartão do hub: o da Sinalização some com a tela; o do módulo só sem nenhuma tela liberada", () => {
  assert.equal(cartaoBloqueado(conta(["/sinalizacao-psicossocial"]), "psicossocial", "/sinalizacao-psicossocial"), true);
  assert.equal(cartaoBloqueado(conta(["/sinalizacao-psicossocial"]), "psicossocial", "/psicossocial"), false);
  assert.equal(cartaoBloqueado(conta(["/dashboard"]), "painel", "/dashboard"), false);
  const todasDoPainel = (TELAS_DO_MODULO.painel ?? []).map((t) => t.id);
  assert.equal(cartaoBloqueado(conta(todasDoPainel), "painel", "/dashboard"), true);
  assert.equal(cartaoBloqueado(conta(todasDoPainel, "Admin"), "painel", "/dashboard"), false);
});

test("cadastro: marcar/desmarcar telas e o que se grava", () => {
  assert.deepEqual(marcarTelas([], ["/comercial-matriz-aiha"], false), ["/comercial-matriz-aiha"]);
  assert.deepEqual(marcarTelas(["/comercial-matriz-aiha"], ["/comercial-matriz-aiha"], true), []);
  assert.deepEqual(marcarTelas(["/x"], ["/x"], false), ["/x"]); // sem repetir
  assert.deepEqual(telasDosModulos(["comercial"]), ["/comercial", "/comercial-matriz-aiha"]);
  // Vazia vira NULL (vê tudo); tela de módulo que a conta não vê sai; a Sinalização fica com AEP OU DRPS.
  assert.equal(telasParaGravar(["comercial"], []), null);
  assert.deepEqual(telasParaGravar(["comercial"], ["/comercial-matriz-aiha", "/consolidacao-grupo/vendas"]), [
    "/comercial-matriz-aiha",
  ]);
  assert.deepEqual(telasParaGravar(["aep"], ["/sinalizacao-psicossocial"]), ["/sinalizacao-psicossocial"]);
  assert.equal(telasParaGravar(["comercial"], ["/sinalizacao-psicossocial"]), null);
});
