import test from "node:test";
import assert from "node:assert/strict";
import type { LaudoValidadeItem } from "@/lib/hooks/useLaudosValidade";
import { derivarVencimentos, diasAte, HORIZONTE_DIAS } from "@/lib/vencimentos/derivar";

const HOJE = new Date("2026-09-02T15:00:00");

/** O `href` acompanha o `id` sozinho — é assim que o hook real monta a lista. */
function laudo(p: Partial<LaudoValidadeItem>): LaudoValidadeItem {
  const base: LaudoValidadeItem = {
    tipo: "Inspeção",
    tabela: "inspecoes",
    idCol: "id_inspecao",
    id: "1",
    empresaNome: "JCN Consultoria",
    dataDoc: "2026-01-10",
    data_validade: null,
    href: "/inspecoes/1",
  };
  const item = { ...base, ...p };
  if (p.id && !p.href) item.href = `/inspecoes/${p.id}`;
  return item;
}

test("laudo sem validade não entra — era o filtro que a consulta antiga fazia no servidor", () => {
  const r = derivarVencimentos([laudo({ data_validade: null })], HOJE);
  assert.deepEqual(r, { vencidos: [], vencendo: [] });
});

test("vencido e vencendo caem em listas diferentes", () => {
  const r = derivarVencimentos(
    [
      laudo({ id: "a", data_validade: "2026-08-01" }), // passado
      laudo({ id: "b", data_validade: "2026-09-20" }), // dentro do horizonte
    ],
    HOJE,
  );
  assert.equal(r.vencidos.length, 1);
  assert.equal(r.vencidos[0].href, "/inspecoes/a");
  assert.equal(r.vencendo.length, 1);
  assert.equal(r.vencendo[0].dias, 18);
});

test("vence HOJE conta como vencendo, não como vencido", () => {
  const r = derivarVencimentos([laudo({ data_validade: "2026-09-02" })], HOJE);
  assert.equal(r.vencidos.length, 0);
  assert.equal(r.vencendo.length, 1);
  assert.equal(r.vencendo[0].dias, 0);
});

test("a borda do horizonte: 60 dias entra, 61 fica de fora", () => {
  const dentro = new Date(HOJE);
  dentro.setDate(dentro.getDate() + HORIZONTE_DIAS);
  const fora = new Date(HOJE);
  fora.setDate(fora.getDate() + HORIZONTE_DIAS + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const r = derivarVencimentos(
    [laudo({ id: "d", data_validade: iso(dentro) }), laudo({ id: "f", data_validade: iso(fora) })],
    HOJE,
  );
  assert.deepEqual(r.vencendo.map((v) => v.href), ["/inspecoes/d"]);
});

test("ordem: vencido mais recente primeiro, e o que vence antes primeiro", () => {
  const r = derivarVencimentos(
    [
      laudo({ id: "v90", data_validade: "2026-06-04" }),
      laudo({ id: "v1", data_validade: "2026-09-01" }),
      laudo({ id: "p50", data_validade: "2026-10-20" }),
      laudo({ id: "p5", data_validade: "2026-09-07" }),
    ],
    HOJE,
  );
  assert.deepEqual(r.vencidos.map((v) => v.href), ["/inspecoes/v1", "/inspecoes/v90"]);
  assert.deepEqual(r.vencendo.map((v) => v.href), ["/inspecoes/p5", "/inspecoes/p50"]);
});

test("AET e AEP mantêm o destino CURTO do cartão, e não o da lista de Validades", () => {
  const r = derivarVencimentos(
    [
      laudo({ tabela: "aet_relatorios", tipo: "AET", id: "7", href: "/aet/7/dados", data_validade: "2026-09-10" }),
      laudo({ tabela: "aep_relatorios", tipo: "AEP", id: "8", href: "/aep/8/dados", data_validade: "2026-09-11" }),
    ],
    HOJE,
  );
  assert.deepEqual(r.vencendo.map((v) => v.href), ["/aet/7", "/aep/8"]);
});

test("a Apreciação continua se chamando 'Apreciação NR-12' no cartão", () => {
  const r = derivarVencimentos(
    [laudo({ tabela: "apreciacoes_maquinas", tipo: "Apreciação", id: "9", href: "/apreciacao-maquinas/9", data_validade: "2026-09-10" })],
    HOJE,
  );
  assert.equal(r.vencendo[0].tipo, "Apreciação NR-12");
  assert.equal(r.vencendo[0].href, "/apreciacao-maquinas/9");
});

test("os outros 6 módulos passam intactos", () => {
  const iguais = [
    ["relatorios_conformidade", "Conformidade", "/relatorio-conformidade/1"],
    ["relatorios_nao_conformidade", "Não Conformidade", "/relatorio-nao-conformidade/1"],
    ["drps_relatorios", "DRPS", "/psicossocial/1/metadados"],
    ["analises_quimicos", "Análise de Químicos", "/analise-quimicos/1"],
    ["investigacoes_acidente", "Investigação", "/investigacao-acidente/1"],
    ["inspecoes", "Inspeção", "/inspecoes/1"],
  ] as const;
  for (const [tabela, tipo, href] of iguais) {
    const r = derivarVencimentos([laudo({ tabela, tipo, href, data_validade: "2026-09-10" })], HOJE);
    assert.equal(r.vencendo[0].tipo, tipo);
    assert.equal(r.vencendo[0].href, href);
  }
});

test("a hora do dia não muda a conta de dias", () => {
  const cedo = new Date("2026-09-02T00:05:00");
  const tarde = new Date("2026-09-02T23:55:00");
  assert.equal(diasAte("2026-09-05", cedo), diasAte("2026-09-05", tarde));
});
