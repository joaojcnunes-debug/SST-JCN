import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { EscalaFeriado } from "@/lib/escala/tipos";
import { diasUteisDaUnidade, diasUteisDoMesGeral, temFeriadoMunicipalCadastrado } from "./dias-uteis";
import {
  mediaInspecoesPorUnidade,
  SEM_EQUIPE,
  type EntradaMedia,
  type InspecaoDaMedia,
} from "./media-inspecoes";

function feriado(p: Partial<EscalaFeriado> & { data: string }): EscalaFeriado {
  return {
    id_feriado: p.id_feriado ?? p.data,
    data: p.data,
    descricao: p.descricao ?? "",
    abrangencia: p.abrangencia ?? "nacional",
    municipio: p.municipio ?? null,
    tipo: p.tipo ?? "feriado",
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("dias úteis pela régua da Escala", () => {
  test("agosto/2026 tem 21 dias úteis — sem feriado nacional nem estadual", () => {
    assert.equal(diasUteisDoMesGeral(2026, 8, []).length, 21);
  });

  test("feriado em dia de semana desconta; no fim de semana não", () => {
    // 07/09/2026 é segunda; 12/10/2026 é segunda; 15/11/2026 é domingo.
    assert.equal(diasUteisDoMesGeral(2026, 9, [feriado({ data: "2026-09-07" })]).length, 21);
    assert.equal(diasUteisDoMesGeral(2026, 11, [feriado({ data: "2026-11-15" })]).length, 21);
  });

  test("ponto facultativo bloqueia igual a feriado", () => {
    // Carnaval 2026: 16 e 17/02 (segunda e terça). Fevereiro tem 20 dias de semana.
    const carnaval = [
      feriado({ data: "2026-02-16", tipo: "facultativo" }),
      feriado({ data: "2026-02-17", tipo: "facultativo" }),
    ];
    assert.equal(diasUteisDoMesGeral(2026, 2, carnaval).length, 18);
  });

  test("feriado municipal desconta SÓ na unidade do município", () => {
    // 06/07/2026 é segunda.
    const feriados = [feriado({ data: "2026-07-06", abrangencia: "municipal", municipio: "Teresópolis" })];
    assert.equal(diasUteisDaUnidade(2026, 7, feriados, "Teresópolis").datas.length, 22);
    assert.equal(diasUteisDaUnidade(2026, 7, feriados, "Teresópolis").municipaisDescontados, 1);
    assert.equal(diasUteisDaUnidade(2026, 7, feriados, "Petrópolis").datas.length, 23);
    assert.equal(diasUteisDaUnidade(2026, 7, feriados, null).datas.length, 23);
  });

  test("o município casa sem caixa e sem espaço nas pontas", () => {
    const feriados = [feriado({ data: "2026-07-06", abrangencia: "municipal", municipio: " teresópolis " })];
    assert.equal(diasUteisDaUnidade(2026, 7, feriados, "TERESÓPOLIS").municipaisDescontados, 1);
  });

  test("sabe dizer se há municipal cadastrado", () => {
    assert.equal(temFeriadoMunicipalCadastrado([feriado({ data: "2026-01-01" })]), false);
    assert.equal(
      temFeriadoMunicipalCadastrado([feriado({ data: "2026-07-06", abrangencia: "municipal", municipio: "x" })]),
      true,
    );
  });
});

// ─── A média ──────────────────────────────────────────────────────────────────

const U_TERE = "u-tere";
const U_GUAPI = "u-guapi";
const U_PIABETA = "u-piabeta";
const U_CONSELHEIRO = "u-conselheiro";

const P_TERE = "p-tere";
const P_GUAPI = "p-guapi";
const P_PIABETA = "p-piabeta";

let seq = 0;
function insp(p: Partial<InspecaoDaMedia> & { data_inspecao: string; id_empresa: string | null }): InspecaoDaMedia {
  seq++;
  return {
    id_inspecao: p.id_inspecao ?? `i${seq}`,
    status: p.status ?? "CONCLUIDA",
    data_inspecao: p.data_inspecao,
    concluida_em: null,
    created_at: "2026-08-01T12:00:00Z",
    tipo_criacao: p.tipo_criacao ?? "BRANCO",
    id_empresa: p.id_empresa,
    responsavel: p.responsavel ?? "Alguém do Sistema",
  };
}

function base(extra: Partial<EntradaMedia> = {}): EntradaMedia {
  return {
    ano: 2026,
    mes: 8,
    inspecoes: [],
    empresas: [
      { id_empresa: "e-tere", id_unidade: U_TERE },
      { id_empresa: "e-guapi", id_unidade: U_GUAPI },
      { id_empresa: "e-piabeta", id_unidade: U_PIABETA },
      { id_empresa: "e-conselheiro", id_unidade: U_CONSELHEIRO },
      { id_empresa: "e-solta", id_unidade: null },
    ],
    unidades: [
      { id_unidade: U_TERE, nome: "Teresópolis", municipio: "Teresópolis" },
      { id_unidade: U_GUAPI, nome: "Guapimirim", municipio: "Guapimirim" },
      { id_unidade: U_PIABETA, nome: "Piabetá", municipio: "Magé" },
      { id_unidade: U_CONSELHEIRO, nome: "Conselheiro", municipio: null },
    ],
    prodUnidades: [
      { id: P_TERE, nome: "Teresopolis", id_unidade_equipe: null },
      { id: P_GUAPI, nome: "Guapimirim", id_unidade_equipe: null },
      { id: P_PIABETA, nome: "Piabetá", id_unidade_equipe: P_GUAPI },
    ],
    colaboradores: [
      { id_unidade: P_TERE, tipo: "tecnico_campo", ativo: true },
      { id_unidade: P_TERE, tipo: "tecnico_campo", ativo: true },
      { id_unidade: P_TERE, tipo: "tecnico_campo", ativo: false }, // inativo não conta
      { id_unidade: P_TERE, tipo: "documentos", ativo: true }, // administrativo não conta
      { id_unidade: P_GUAPI, tipo: "tecnico_campo", ativo: true },
      { id_unidade: P_PIABETA, tipo: "tecnico_campo", ativo: true }, // lotado na que compartilha → soma na dona
    ],
    feriados: [],
    ...extra,
  };
}

const linha = (r: ReturnType<typeof mediaInspecoesPorUnidade>, chave: string) => {
  const l = r.linhas.find((x) => x.chave === chave);
  assert.ok(l, `linha ${chave} não encontrada`);
  return l;
};

describe("média de inspeções por técnico por dia útil", () => {
  test("a conta: visitas ÷ (equipe × dias úteis), com agosto = 21 dias úteis", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-03", id_empresa: "e-tere", responsavel: "Ana" }),
          insp({ data_inspecao: "2026-08-04", id_empresa: "e-tere", responsavel: "Ana" }),
          insp({ data_inspecao: "2026-08-04", id_empresa: "e-tere", responsavel: "Bia" }),
        ],
      }),
    );
    const t = linha(r, P_TERE);
    assert.equal(t.visitas, 3);
    assert.equal(t.diasUteis, 21);
    assert.equal(t.tecnicos, 2);
    assert.equal(t.porTecnicoDiaUtil, 3 / (2 * 21));
    assert.equal(t.pessoasQueFizeram, 2);
    assert.equal(t.tecnicoDias, 3); // Ana dia 3, Ana dia 4, Bia dia 4
    assert.equal(t.porDiaEmCampo, 1);
    assert.equal(t.maisPessoasQueEquipe, false);
  });

  test("Piabetá soma em Guapimirim: equipe contada uma vez, visitas somadas, rótulo com a dona primeiro", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-guapi" }),
          insp({ data_inspecao: "2026-08-06", id_empresa: "e-piabeta" }),
          insp({ data_inspecao: "2026-08-07", id_empresa: "e-piabeta" }),
        ],
      }),
    );
    const g = linha(r, P_GUAPI);
    assert.equal(g.equipe, "Guapimirim + Piabetá");
    assert.equal(g.visitas, 3);
    assert.equal(g.tecnicos, 2);
    assert.equal(r.linhas.some((l) => l.chave === P_PIABETA), false, "Piabetá não tem linha própria");
  });

  test("cópia e revisão não são visita — ficam fora e contadas à parte", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere", tipo_criacao: "COPIA_EMPRESA" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere", tipo_criacao: "REVISAO" }),
        ],
      }),
    );
    assert.equal(linha(r, P_TERE).visitas, 1);
    assert.equal(r.total.visitas, 1);
    assert.equal(r.copiasIgnoradas, 2);
  });

  test("renovação de documento não é visita, nem entra no 'ficaram de fora' das cópias (23/09)", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere", tipo_criacao: "RENOVACAO" }),
        ],
      }),
    );
    assert.equal(linha(r, P_TERE).visitas, 1);
    assert.equal(r.total.visitas, 1);
    assert.equal(r.copiasIgnoradas, 0);
  });

  test("unidade do painel sem par na Produtividade vai para '(sem equipe cadastrada)', por último e sem divisor", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-conselheiro" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere" }),
        ],
      }),
    );
    const ultima = r.linhas[r.linhas.length - 1];
    assert.equal(ultima.chave, SEM_EQUIPE);
    assert.equal(ultima.visitas, 1);
    assert.equal(ultima.tecnicos, 0);
    assert.equal(ultima.porTecnicoDiaUtil, null);
  });

  test("visita de empresa sem unidade conta no total da JCN Consultoria, e em nenhuma linha", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-solta" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: null }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere" }),
        ],
      }),
    );
    assert.equal(r.total.visitas, 3);
    assert.equal(r.visitasSemUnidade, 2);
    assert.equal(r.linhas.reduce((s, l) => s + l.visitas, 0), 1);
    assert.equal(r.total.tecnicos, 4); // 2 Tere + 1 Guapi + 1 Piabetá
    assert.equal(r.total.diasUteis, 21);
  });

  test("dona de equipe SEM visita no mês continua na tela, com zero", () => {
    const r = mediaInspecoesPorUnidade(base({ inspecoes: [] }));
    const g = linha(r, P_GUAPI);
    assert.equal(g.visitas, 0);
    assert.equal(g.porTecnicoDiaUtil, 0);
    assert.equal(g.porDiaEmCampo, null);
    assert.equal(r.linhas.some((l) => l.chave === SEM_EQUIPE), false, "sem visita solta, sem a linha");
  });

  test("fora do mês, deletada e sem data não entram — a data é pura, dia 1º fica no mês", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-01", id_empresa: "e-tere" }),
          insp({ data_inspecao: "2026-08-31", id_empresa: "e-tere" }),
          insp({ data_inspecao: "2026-07-31", id_empresa: "e-tere" }),
          insp({ data_inspecao: "2026-09-01", id_empresa: "e-tere" }),
          insp({ data_inspecao: "2026-08-10", id_empresa: "e-tere", status: "DELETADA" }),
          insp({ data_inspecao: "", id_empresa: "e-tere" }),
        ],
      }),
    );
    assert.equal(linha(r, P_TERE).visitas, 2);
  });

  test("mais pessoas fizeram do que há cadastrado → aviso na linha", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-guapi", responsavel: "Ana" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-guapi", responsavel: "Bia" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-guapi", responsavel: "Caio" }),
        ],
      }),
    );
    const g = linha(r, P_GUAPI);
    assert.equal(g.pessoasQueFizeram, 3);
    assert.equal(g.tecnicos, 2);
    assert.equal(g.maisPessoasQueEquipe, true);
  });

  test("quem fez a visita é a MESMA regra do Ver detalhe: aba Responsáveis na frente, vínculo v204 antes do texto", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ id_inspecao: "dupla", data_inspecao: "2026-08-05", id_empresa: "e-tere", responsavel: "Quem Abriu" }),
          insp({ id_inspecao: "vinculo", data_inspecao: "2026-08-05", id_empresa: "e-tere", responsavel: "Quem Abriu" }),
        ],
        tecnicos: {
          tecnicosDeCampo: new Map([
            ["dupla", ["Ana", "Bia"]],
            ["vinculo", [{ digitado: "grafia errada", idUsuario: "id-ana" }]],
          ]),
          contas: [{ id_usuario: "id-ana", nome: "Ana" }],
          cadastro: ["Ana", "Bia", "Quem Abriu"],
        },
      }),
    );
    const t = linha(r, P_TERE);
    assert.equal(t.visitas, 2);
    assert.equal(t.pessoasQueFizeram, 2); // Ana e Bia; "Quem Abriu" não entra
    assert.equal(t.tecnicoDias, 2); // Ana|05 (uma vez, apesar de duas visitas) e Bia|05
  });

  test("feriado municipal desconta só da linha do município da dona", () => {
    // 03/08/2026 é segunda.
    const r = mediaInspecoesPorUnidade(
      base({
        feriados: [feriado({ data: "2026-08-03", abrangencia: "municipal", municipio: "Teresópolis" })],
      }),
    );
    assert.equal(linha(r, P_TERE).diasUteis, 20);
    assert.equal(linha(r, P_TERE).feriadosMunicipais, 1);
    assert.equal(linha(r, P_GUAPI).diasUteis, 21);
    assert.equal(r.total.diasUteis, 21);
    assert.equal(r.temFeriadoMunicipalCadastrado, true);
  });

  test("o nome casa sem acento e sem caixa entre o painel e a Produtividade", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        unidades: [{ id_unidade: U_TERE, nome: "TERESÓPOLIS", municipio: null }],
        inspecoes: [insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere" })],
      }),
    );
    assert.equal(linha(r, P_TERE).visitas, 1);
  });

  test("ordem: mais visitas primeiro", () => {
    const r = mediaInspecoesPorUnidade(
      base({
        inspecoes: [
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-guapi" }),
          insp({ data_inspecao: "2026-08-06", id_empresa: "e-guapi" }),
          insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere" }),
        ],
      }),
    );
    assert.deepEqual(r.linhas.map((l) => l.chave), [P_GUAPI, P_TERE]);
  });
});

// ─── Mês em curso: dias úteis até hoje ────────────────────────────────────────

describe("mês em curso conta só os dias úteis até hoje", () => {
  // Agosto/2026: 1º é sábado; 3–7, 10–14 = 10 dias úteis até sexta 14/08.
  const cincoVisitas = [
    insp({ data_inspecao: "2026-08-03", id_empresa: "e-tere", responsavel: "Ana" }),
    insp({ data_inspecao: "2026-08-04", id_empresa: "e-tere", responsavel: "Ana" }),
    insp({ data_inspecao: "2026-08-05", id_empresa: "e-tere", responsavel: "Ana" }),
    insp({ data_inspecao: "2026-08-06", id_empresa: "e-tere", responsavel: "Ana" }),
    insp({ data_inspecao: "2026-08-14", id_empresa: "e-tere", responsavel: "Ana" }),
  ];

  test("hoje dentro do mês: divide pelos dias úteis vividos, inclusive hoje", () => {
    const r = mediaInspecoesPorUnidade(base({ inspecoes: cincoVisitas, hoje: "2026-08-14" }));
    assert.equal(r.ateHoje, "2026-08-14");
    assert.equal(r.diasUteisGerais, 10);
    assert.equal(r.diasUteisMesInteiro, 21);
    assert.equal(linha(r, P_TERE).diasUteis, 10);
    // 5 visitas ÷ (2 técnicos × 10 dias) — e não ÷ 21.
    assert.equal(linha(r, P_TERE).porTecnicoDiaUtil, 5 / 20);
    assert.equal(r.total.diasUteis, 10);
  });

  test("hoje depois do fim (mês fechado) ou ausente: mês inteiro, sem corte", () => {
    const fechado = mediaInspecoesPorUnidade(base({ inspecoes: cincoVisitas, hoje: "2026-09-17" }));
    assert.equal(fechado.ateHoje, null);
    assert.equal(fechado.diasUteisGerais, 21);
    assert.equal(linha(fechado, P_TERE).porTecnicoDiaUtil, 5 / 42);

    const semHoje = mediaInspecoesPorUnidade(base({ inspecoes: cincoVisitas }));
    assert.equal(semHoje.ateHoje, null);
    assert.equal(semHoje.diasUteisGerais, 21);
  });

  test("mês futuro: zero dias úteis e razão nula — não zero", () => {
    const r = mediaInspecoesPorUnidade(base({ hoje: "2026-07-15" }));
    assert.equal(r.ateHoje, "2026-07-15");
    assert.equal(r.diasUteisGerais, 0);
    assert.equal(r.diasUteisMesInteiro, 21);
    assert.equal(linha(r, P_TERE).porTecnicoDiaUtil, null);
  });

  test("feriado municipal que ainda vai acontecer não conta como descontado", () => {
    // 10/08 e 24/08 são segundas; hoje é 14/08.
    const passado = mediaInspecoesPorUnidade(
      base({
        hoje: "2026-08-14",
        feriados: [feriado({ data: "2026-08-10", abrangencia: "municipal", municipio: "Teresópolis" })],
      }),
    );
    assert.equal(linha(passado, P_TERE).diasUteis, 9);
    assert.equal(linha(passado, P_TERE).feriadosMunicipais, 1);

    const futuro = mediaInspecoesPorUnidade(
      base({
        hoje: "2026-08-14",
        feriados: [feriado({ data: "2026-08-24", abrangencia: "municipal", municipio: "Teresópolis" })],
      }),
    );
    assert.equal(linha(futuro, P_TERE).diasUteis, 10);
    assert.equal(linha(futuro, P_TERE).feriadosMunicipais, 0);
  });
});
