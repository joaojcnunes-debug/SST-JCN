/**
 * QA das bordas (Fase 8).
 *
 * Os casos que o contrato do módulo mandou exercitar, mais os que apareceram
 * ao escrever estes testes. Ficam num arquivo próprio, e não espalhados nos
 * testes de cada peça, porque são o ROTEIRO de aceite do módulo: quem for
 * mexer aqui um dia lê este arquivo para saber o que não pode quebrar.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { gerarMes } from "./gerar";
import { diasUteisDoMes } from "./regras";
import { porMes, porUnidadeESupervisor, supervisoresDoRelatorio } from "./relatorios";
import { diasNoMes } from "./datas";
import type {
  EscalaDia,
  EscalaFeriado,
  EscalaPadraoSemanal,
  EscalaSupervisor,
  UnidadeDaEscala,
} from "./tipos";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function sup(id: string, campos: Partial<EscalaSupervisor> = {}): EscalaSupervisor {
  return {
    id_supervisor: id,
    nome: id,
    nome_resumido: id,
    funcao: null,
    usuario_email: null,
    ordem: 0,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...campos,
  };
}

function uni(id: string, nome: string, campos: Partial<UnidadeDaEscala> = {}): UnidadeDaEscala {
  return {
    id_unidade: id,
    nome,
    cor_hex: "#0ea5e9",
    ordem: 0,
    municipio: nome,
    ativo: true,
    configurada: true,
    ...campos,
  };
}

function padrao(
  id_supervisor: string,
  dia_semana: 1 | 2 | 3 | 4 | 5,
  campos: Partial<EscalaPadraoSemanal> = {}
): EscalaPadraoSemanal {
  return {
    id_padrao: `EPAD-${id_supervisor}-${dia_semana}-${campos.vigencia_inicio ?? "base"}`,
    id_supervisor,
    dia_semana,
    unidade_ids: ["UNI-TERE"],
    situacao: null,
    vigencia_inicio: "2020-01-01",
    vigencia_fim: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...campos,
  };
}

function dia(id_supervisor: string, data: string, campos: Partial<EscalaDia> = {}): EscalaDia {
  return {
    id_dia: `EDIA-${id_supervisor}-${data}`,
    id_supervisor,
    data,
    unidade_ids: ["UNI-TERE"],
    situacao: null,
    origem: "padrao",
    observacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...campos,
  };
}

const UNIDADES = [uni("UNI-TERE", "Teresópolis"), uni("UNI-PETRO", "Petrópolis")];

// ─── 1. Supervisor inativado no meio do mês ─────────────────────────────────

describe("supervisor inativado no meio do mes", () => {
  const saiu = sup("SAIU", { ativo: false });
  const ficou = sup("FICOU");
  // Ele trabalhou ate o dia 15 e foi inativado.
  const diasDele = ["2026-01-05", "2026-01-06", "2026-01-07"].map((d) => dia("SAIU", d));
  const diasDoOutro = ["2026-01-05", "2026-01-06"].map((d) => dia("FICOU", d));
  const todos = [...diasDele, ...diasDoOutro];

  test("nao entra em mes NOVO -- a geracao so recebe os ativos", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 2,
      supervisores: [ficou], // e o que a tela passa: so ativos
      padroes: [padrao("SAIU", 1), padrao("FICOU", 1)],
      feriados: [],
      unidades: UNIDADES,
      existentes: [],
    });
    assert.ok(r.aCriar.every((l) => l.id_supervisor === "FICOU"));
  });

  test("ENTRA no relatorio do periodo em que trabalhou", () => {
    // O historico e dele. Sumir com os dias faria os totais encolherem sem
    // explicacao -- o pior tipo de erro num relatorio.
    const doRelatorio = supervisoresDoRelatorio([ficou, saiu], todos);
    assert.equal(doRelatorio.length, 2);

    const m = porUnidadeESupervisor({
      supervisores: doRelatorio,
      unidades: UNIDADES,
      dias: todos,
    });
    assert.equal(m.totalPorSupervisor.SAIU, 3);
    assert.equal(m.totalGeral, 5);
  });

  test("inativo SEM dia no periodo nao polui o relatorio", () => {
    const nunca = sup("NUNCA", { ativo: false });
    const doRelatorio = supervisoresDoRelatorio([ficou, saiu, nunca], todos);
    assert.deepEqual(
      doRelatorio.map((s) => s.id_supervisor).sort(),
      ["FICOU", "SAIU"]
    );
  });

  test("o relatorio por mes tambem conta os dias de quem saiu", () => {
    const m = porMes({
      ano: 2026,
      supervisores: supervisoresDoRelatorio([ficou, saiu], todos),
      unidades: UNIDADES,
      dias: todos,
    });
    assert.equal(m.linhas[0].porSupervisor.SAIU, 3);
  });
});

// ─── 2. Unidade desativada ──────────────────────────────────────────────────

describe("unidade desativada depois de ter dias", () => {
  test("os dias dela somem do relatorio -- e isso e DE PROPOSITO", () => {
    // A unidade fechou. A tela passa so as ativas, entao a linha nao aparece.
    // Documentado aqui para ninguem "consertar" isso por engano: o relatorio
    // segue o cadastro atual de unidades. Se um dia for preciso ver a unidade
    // extinta, o caminho e passar as inativas tambem, nao inventar linha.
    const m = porUnidadeESupervisor({
      supervisores: [sup("A")],
      unidades: [uni("UNI-TERE", "Teresópolis")], // Petropolis ficou de fora
      dias: [dia("A", "2026-01-05", { unidade_ids: ["UNI-PETRO"] })],
    });
    assert.equal(m.linhas.length, 1);
    assert.equal(m.totalGeral, 0);
  });

  test("mas o dia continua contando em 'dias com escala'", () => {
    // O dia existiu. Some da matriz de unidades, nao do total de dias.
    const m = porMes({
      ano: 2026,
      supervisores: [sup("A")],
      unidades: [uni("UNI-TERE", "Teresópolis")],
      dias: [dia("A", "2026-01-05", { unidade_ids: ["UNI-PETRO"] })],
    });
    assert.equal(m.totalGeral, 1);
  });
});

// ─── 3. Fevereiro, bissexto e virada de ano ─────────────────────────────────

describe("fevereiro e o ano bissexto", () => {
  test("fevereiro tem 28 dias em ano comum e 29 no bissexto", () => {
    assert.equal(diasNoMes(2026, 2), 28);
    assert.equal(diasNoMes(2028, 2), 29);
    // 2100 NAO e bissexto (divisivel por 100 e nao por 400).
    assert.equal(diasNoMes(2100, 2), 28);
    assert.equal(diasNoMes(2000, 2), 29);
  });

  test("29/02 do bissexto entra na geracao e nao no ano comum", () => {
    const base = {
      supervisores: [sup("A")],
      padroes: [1, 2, 3, 4, 5].map((d) => padrao("A", d as 1)),
      feriados: [],
      unidades: UNIDADES,
      existentes: [],
    };
    const bissexto = gerarMes({ ...base, ano: 2028, mes: 2 });
    assert.ok(bissexto.aCriar.some((l) => l.data === "2028-02-29"));

    const comum = gerarMes({ ...base, ano: 2026, mes: 2 });
    assert.ok(!comum.aCriar.some((l) => l.data.startsWith("2026-02-29")));
  });

  test("31 de dezembro e 1o de janeiro nao se atropelam", () => {
    const base = {
      supervisores: [sup("A")],
      padroes: [1, 2, 3, 4, 5].map((d) => padrao("A", d as 1)),
      feriados: [],
      unidades: UNIDADES,
      existentes: [],
    };
    const dez = gerarMes({ ...base, ano: 2026, mes: 12 });
    const jan = gerarMes({ ...base, ano: 2027, mes: 1 });
    assert.ok(dez.aCriar.some((l) => l.data === "2026-12-31")); // quinta
    assert.ok(jan.aCriar.some((l) => l.data === "2027-01-01")); // sexta
    assert.ok(!dez.aCriar.some((l) => l.data.startsWith("2027")));
    assert.ok(!jan.aCriar.some((l) => l.data.startsWith("2026")));
  });
});

// ─── 4. Padrão que muda no meio do mês ──────────────────────────────────────

describe("padrao que muda no meio do mes", () => {
  test("cada dia usa a vigencia que valia NELE", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A")],
      padroes: [
        padrao("A", 1, { vigencia_inicio: "2020-01-01", vigencia_fim: "2026-01-14" }),
        padrao("A", 1, { vigencia_inicio: "2026-01-15", unidade_ids: ["UNI-PETRO"] }),
      ],
      feriados: [],
      unidades: UNIDADES,
      existentes: [],
    });
    // Segundas de janeiro/2026: 05, 12, 19, 26. A virada e no dia 15.
    const em = (d: string) => r.aCriar.find((l) => l.data === d)?.alocacao;
    assert.deepEqual(em("2026-01-05"), { tipo: "unidades", unidade_ids: ["UNI-TERE"] });
    assert.deepEqual(em("2026-01-12"), { tipo: "unidades", unidade_ids: ["UNI-TERE"] });
    assert.deepEqual(em("2026-01-19"), { tipo: "unidades", unidade_ids: ["UNI-PETRO"] });
    assert.deepEqual(em("2026-01-26"), { tipo: "unidades", unidade_ids: ["UNI-PETRO"] });
  });
});

// ─── 5. Feriados em situações estranhas ─────────────────────────────────────

describe("feriado nas bordas", () => {
  const feriado = (data: string, campos: Partial<EscalaFeriado> = {}): EscalaFeriado => ({
    id_feriado: `EFER-${data}-${campos.descricao ?? ""}`,
    data,
    descricao: "Feriado",
    abrangencia: "nacional",
    municipio: null,
    tipo: "feriado",
    created_at: "2026-01-01T00:00:00Z",
    ...campos,
  });

  test("feriado que cai no SABADO nao muda a conta de dias uteis", () => {
    // 03/01/2026 e sabado. Ja nao era dia util; nao pode descontar de novo.
    assert.equal(diasUteisDoMes(2026, 1, []).length, 22);
    assert.equal(diasUteisDoMes(2026, 1, [feriado("2026-01-03")]).length, 22);
  });

  test("DOIS feriados no mesmo dia descontam UMA vez", () => {
    const doisNoMesmoDia = [
      feriado("2026-01-01", { descricao: "Nacional" }),
      feriado("2026-01-01", { descricao: "Estadual", abrangencia: "estadual" }),
    ];
    assert.equal(diasUteisDoMes(2026, 1, doisNoMesmoDia).length, 21);
  });

  test("feriado de OUTRO mes nao interfere", () => {
    assert.equal(diasUteisDoMes(2026, 1, [feriado("2026-02-16")]).length, 22);
  });

  test("mes inteiro de feriado deixa zero dias uteis, sem quebrar", () => {
    const todosOsDias = Array.from({ length: 28 }, (_, i) =>
      feriado(`2026-02-${String(i + 1).padStart(2, "0")}`)
    );
    assert.equal(diasUteisDoMes(2026, 2, todosOsDias).length, 0);
  });
});

// ─── 6. Vazios que não podem quebrar ────────────────────────────────────────

describe("vazios", () => {
  test("mes sem supervisor nenhum gera nada e nao quebra", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 1,
      supervisores: [],
      padroes: [],
      feriados: [],
      unidades: UNIDADES,
      existentes: [],
    });
    assert.equal(r.aCriar.length, 0);
    assert.equal(r.diasDeSemana, 22);
  });

  test("relatorio sem dia nenhum devolve matriz zerada, nao vazia", () => {
    // As linhas das unidades tem que existir mesmo zeradas: a tabela precisa
    // mostrar QUAIS unidades ficaram sem ninguem.
    const m = porUnidadeESupervisor({
      supervisores: [sup("A")],
      unidades: UNIDADES,
      dias: [],
    });
    assert.equal(m.linhas.length, 2);
    assert.equal(m.totalGeral, 0);
  });

  test("relatorio sem supervisor nenhum nao quebra", () => {
    const m = porUnidadeESupervisor({ supervisores: [], unidades: UNIDADES, dias: [] });
    assert.equal(m.totalGeral, 0);
    assert.deepEqual(m.totalPorSupervisor, {});
  });
});
