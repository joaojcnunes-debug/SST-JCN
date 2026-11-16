import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  FILTRO_VAZIO,
  apelido,
  comPadrao,
  contarFiltros,
  criadorDe,
  mapaApelidos,
  passaFiltros,
  produtosDa,
  type CtxFiltro,
  type FiltrosGestao,
  type TarefaFiltravel,
} from "./filtros";
import { CAMPO_PRODUTOS_ID } from "./regiao-produtos";

const HOJE = "2026-11-10"; // terça

const tf = (p: Partial<TarefaFiltravel> = {}): TarefaFiltravel => ({
  id_tarefa: "t1", id_quadro: "q1", responsavel: null, prioridade: "Media", status: "a_fazer",
  etiquetas: [], prazo: null, campos: {}, created_by: null, origem: null, ...p,
});
const ctx = (p: Partial<CtxFiltro> = {}): CtxFiltro => ({ hoje: HOJE, concluida: (t) => t.status === "feito", ...p });
const f = (p: Partial<FiltrosGestao>): FiltrosGestao => ({ ...FILTRO_VAZIO, ...p });

test("filtro vazio deixa tudo passar e conta zero", () => {
  assert.equal(passaFiltros(tf(), FILTRO_VAZIO, ctx()), true);
  assert.equal(contarFiltros(FILTRO_VAZIO), 0);
  assert.equal(contarFiltros(f({ regiao: "campos", produtos: ["PGR"], situacao: "abertas" })), 3);
});

test("filtro salvo antigo (sem os campos novos) ganha os campos vazios", () => {
  const antigo = { responsavel: "Ana", prioridades: [], status: [], etiquetas: [], prazo: "hoje", semResponsavel: false } as Partial<FiltrosGestao>;
  const c = comPadrao(antigo);
  assert.equal(c.pessoa, "n:Ana");
  assert.equal(c.papel, "responsavel");
  assert.equal("responsavel" in c, false, "o campo antigo sai");
  assert.deepEqual(c.produtos, []);
  assert.equal(c.equipe, "");
  assert.equal(contarFiltros(c), 2);
});

test("os filtros de antes continuam iguais (responsável, prioridade, status, etiquetas)", () => {
  const t = tf({ responsavel: "Ana Souza, Bruno Lima", prioridade: "Alta", status: "fazendo", etiquetas: ["urgente"] });
  const nomeDe = (e: string) => ({ "bruno@x.com": "Bruno Lima", "b@x.com": "Bruno" } as Record<string, string>)[e];
  assert.equal(passaFiltros(t, f({ pessoa: "e:bruno@x.com" }), ctx({ nomeDe })), true);
  assert.equal(passaFiltros(t, f({ pessoa: "e:b@x.com" }), ctx({ nomeDe })), false);
  assert.equal(passaFiltros(t, f({ pessoa: "n:Bruno Lima" }), ctx()), true, "filtro salvo antigo (pelo nome)");
  assert.equal(passaFiltros(t, f({ semResponsavel: true }), ctx()), false);
  assert.equal(passaFiltros(tf(), f({ semResponsavel: true }), ctx()), true);
  assert.equal(passaFiltros(t, f({ prioridades: ["Baixa"] }), ctx()), false);
  assert.equal(passaFiltros(t, f({ status: ["fazendo"] }), ctx()), true);
  assert.equal(passaFiltros(t, f({ etiquetas: ["outra", "urgente"] }), ctx()), true);
});

test("prazo: atrasadas, hoje, amanhã, semana, mês, sem e período", () => {
  const ontem = tf({ prazo: "2026-11-09" });
  assert.equal(passaFiltros(ontem, f({ prazo: "atrasadas" }), ctx()), true);
  assert.equal(passaFiltros({ ...ontem, status: "feito" }, f({ prazo: "atrasadas" }), ctx()), false, "concluída não está atrasada");
  assert.equal(passaFiltros(tf({ prazo: HOJE }), f({ prazo: "hoje" }), ctx()), true);
  assert.equal(passaFiltros(tf({ prazo: "2026-11-11" }), f({ prazo: "amanha" }), ctx()), true);
  assert.equal(passaFiltros(tf({ prazo: "2026-11-17" }), f({ prazo: "semana" }), ctx()), true);
  assert.equal(passaFiltros(tf({ prazo: "2026-11-18" }), f({ prazo: "semana" }), ctx()), false);
  assert.equal(passaFiltros(tf({ prazo: "2026-11-30" }), f({ prazo: "mes" }), ctx()), true);
  assert.equal(passaFiltros(tf({ prazo: "2026-12-01" }), f({ prazo: "mes" }), ctx()), false);
  assert.equal(passaFiltros(tf(), f({ prazo: "sem" }), ctx()), true);
  assert.equal(passaFiltros(tf({ prazo: HOJE }), f({ prazo: "sem" }), ctx()), false);
  const per = f({ prazo: "periodo", prazoDe: "2026-11-05", prazoAte: "2026-11-12" });
  assert.equal(passaFiltros(tf({ prazo: "2026-11-05" }), per, ctx()), true);
  assert.equal(passaFiltros(tf({ prazo: "2026-11-13" }), per, ctx()), false);
  assert.equal(passaFiltros(tf({ prazo: "2030-01-01" }), f({ prazo: "periodo", prazoDe: "2026-11-05" }), ctx()), true, "sem 'até' = sem limite");
  assert.equal(passaFiltros(tf(), per, ctx()), false, "sem prazo fica fora do período");
  assert.equal(passaFiltros(tf(), f({ prazo: "periodo" }), ctx()), true, "Período sem datas ainda não filtra");
  assert.equal(contarFiltros(f({ prazo: "periodo" })), 0);
  assert.equal(contarFiltros(per), 1);
});

test("equipe: algum responsável é da equipe", () => {
  const t = tf({ responsavel: "Ana Souza, Bruno Lima" });
  assert.equal(passaFiltros(t, f({ equipe: "e1" }), ctx({ nomesDaEquipe: ["Bruno Lima", "Carla"] })), true);
  assert.equal(passaFiltros(t, f({ equipe: "e1" }), ctx({ nomesDaEquipe: ["Carla"] })), false);
  assert.equal(passaFiltros(t, f({ equipe: "e1" }), ctx({ nomesDaEquipe: [] })), false);
});

test("seguidor (por e-mail, sem diferença de maiúsculas)", () => {
  const segs = (id: string) => (id === "t1" ? ["Ana@Chabra.com.br"] : []);
  const seg = f({ pessoa: "e:ana@chabra.com.br", papel: "seguidor" });
  assert.equal(passaFiltros(tf(), seg, ctx({ seguidoresDe: segs })), true);
  assert.equal(passaFiltros(tf({ id_tarefa: "t2" }), seg, ctx({ seguidoresDe: segs })), false);
  assert.equal(passaFiltros(tf({ id_tarefa: "t2" }), seg, ctx()), true, "sem saber os seguidores (visita de outra lista), não filtra");
});

const pp = (x: FiltrosGestao) => ({ pessoa: x.pessoa, papel: x.papel });

describe("Pessoa: um campo só, com o papel (12/11/2026: os três separados se anulavam)", () => {
  const nomeDe = (e: string) => ({ "ana@x.com": "Ana Souza", "bia@x.com": "Bia Reis" } as Record<string, string>)[e];
  const segs = (id: string) => ({ t2: ["ana@x.com"] } as Record<string, string[]>)[id] ?? [];
  const chaveCriador = (t: TarefaFiltravel) => (t.created_by ? "e:" + t.created_by : null);
  const c = ctx({ nomeDe, seguidoresDe: segs, chaveCriador });
  const resp = tf({ id_tarefa: "t1", responsavel: "Ana Souza", created_by: "bia@x.com" });
  const segue = tf({ id_tarefa: "t2", responsavel: "Bia Reis", created_by: "bia@x.com" });
  const criou = tf({ id_tarefa: "t3", responsavel: "Bia Reis", created_by: "ana@x.com" });
  const nada = tf({ id_tarefa: "t4", responsavel: "Bia Reis", created_by: "bia@x.com" });
  const ids = (papel: FiltrosGestao["papel"], cx: CtxFiltro = c) =>
    [resp, segue, criou, nada].filter((t) => passaFiltros(t, f({ pessoa: "e:ana@x.com", papel }), cx)).map((t) => t.id_tarefa);
  test("cada papel traz só os cartões daquele papel", () => {
    assert.deepEqual(ids("responsavel"), ["t1"]);
    assert.deepEqual(ids("seguidor"), ["t2"]);
    assert.deepEqual(ids("criou"), ["t3"]);
  });
  test("Os três: responsável, seguidora OU criou (não zera a lista)", () => {
    assert.deepEqual(ids("todos"), ["t1", "t2", "t3"]);
    assert.deepEqual(ids("todos", { ...c, seguidoresDe: undefined }), ["t1", "t3"], "sem os seguidores, valem responsável e quem criou");
  });
  test("o papel sozinho não filtra nem conta; criador do Runrun", () => {
    assert.equal(contarFiltros(f({ papel: "todos" })), 0);
    assert.equal(contarFiltros(f({ pessoa: "e:ana@x.com", papel: "todos" })), 1);
    assert.equal(passaFiltros(nada, f({ papel: "seguidor" }), c), true);
    const rr = ctx({ chaveCriador: () => "r:madu" });
    assert.equal(passaFiltros(tf(), f({ pessoa: "r:madu", papel: "criou" }), rr), true);
    assert.equal(passaFiltros(tf(), f({ pessoa: "r:madu", papel: "todos" }), rr), true);
    assert.equal(passaFiltros(tf(), f({ pessoa: "r:madu", papel: "responsavel" }), rr), false);
  });
  test("filtros salvos antes: cada um vira o campo Pessoa; com mais de um, fica Responsável > Seguidor > Criada por", () => {
    assert.deepEqual(pp(comPadrao({ seguidor: "Ana@X.com" } as never)), { pessoa: "e:ana@x.com", papel: "seguidor" });
    assert.deepEqual(pp(comPadrao({ criadoPor: "r:madu" } as never)), { pessoa: "r:madu", papel: "criou" });
    assert.deepEqual(pp(comPadrao({ responsavel: "Ana Souza", seguidor: "bia@x.com", criadoPor: "e:bia@x.com" } as never)), { pessoa: "n:Ana Souza", papel: "responsavel" });
    assert.deepEqual(pp(comPadrao({ responsavel: "", seguidor: "", criadoPor: "" } as never)), { pessoa: "", papel: "responsavel" });
    assert.deepEqual(pp(comPadrao({ pessoa: "e:bia@x.com", papel: "todos" })), { pessoa: "e:bia@x.com", papel: "todos" });
    assert.deepEqual(pp(comPadrao({ pessoa: "e:bia@x.com", papel: "xyz" as never })), { pessoa: "e:bia@x.com", papel: "responsavel" });
  });
});

test("região pela etiqueta (aceita a grafia do importador) e produtos", () => {
  assert.equal(passaFiltros(tf({ etiquetas: ["nova-friburgo"] }), f({ regiao: "nova friburgo" }), ctx()), true);
  assert.equal(passaFiltros(tf({ etiquetas: ["teresopolis"] }), f({ regiao: "nova friburgo" }), ctx()), false);
  const comProd = tf({ campos: { [CAMPO_PRODUTOS_ID]: ["PGR", "LTCAT"] } });
  assert.deepEqual(produtosDa(comProd.campos), ["PGR", "LTCAT"]);
  assert.equal(passaFiltros(comProd, f({ produtos: ["ASOs", "LTCAT"] }), ctx()), true);
  assert.equal(passaFiltros(comProd, f({ produtos: ["ASOs"] }), ctx()), false);
  assert.equal(passaFiltros(tf(), f({ produtos: ["ASOs"] }), ctx()), false);
});

test("situação: em aberto e concluídas", () => {
  assert.equal(passaFiltros(tf(), f({ situacao: "abertas" }), ctx()), true);
  assert.equal(passaFiltros(tf({ status: "feito" }), f({ situacao: "abertas" }), ctx()), false);
  assert.equal(passaFiltros(tf({ status: "feito" }), f({ situacao: "concluidas" }), ctx()), true);
});

test("ignorar: o calendário de várias listas não usa status nem pessoa", () => {
  const t = tf({ status: "x", responsavel: "Ana" });
  const ign = new Set<keyof FiltrosGestao>(["status", "pessoa"]);
  assert.equal(passaFiltros(t, f({ status: ["y"], pessoa: "n:Bruno" }), ctx({ ignorar: ign })), true);
  assert.equal(passaFiltros(t, f({ status: ["y"], pessoa: "n:Bruno", prioridades: ["Alta"] }), ctx({ ignorar: ign })), false);
});

test("criada por: e-mail, importador com apelido do Runrun e apelido sem dono", () => {
  const pessoas = [
    { nome: "Isabela Esteves Ramos", email: "isabela@chabra.com.br" },
    { nome: "Ana Clara Souza", email: "anaclara@chabra.com.br" },
    { nome: "Ana Clara Mendes", email: "anaclara2@chabra.com.br" },
    { nome: "Leana Carvalho", email: "leana@chabra.com.br" },
  ];
  const nomes = new Map(pessoas.map((p) => [p.email, p.nome]));
  const ap = mapaApelidos(pessoas);
  assert.equal(apelido("Leana Carvalho"), "leana-carvalho");
  assert.equal(ap.get("isabela-esteves"), "isabela@chabra.com.br", "dois primeiros nomes");
  assert.equal(ap.get("isabela-ramos"), "isabela@chabra.com.br", "nome + sobrenome");
  assert.equal(ap.has("ana-clara"), false, "duas Ana Clara: não junta");

  assert.deepEqual(criadorDe({ created_by: "Leana@Chabra.com.br" }, nomes, ap), { chave: "e:leana@chabra.com.br", nome: "Leana Carvalho" });
  assert.deepEqual(criadorDe({ created_by: "importador", origem: { user_id: "isabela-esteves" } }, nomes, ap), { chave: "e:isabela@chabra.com.br", nome: "Isabela Esteves Ramos" });
  assert.deepEqual(criadorDe({ created_by: "importador", origem: { user_id: "madu" } }, nomes, ap), { chave: "r:madu", nome: "Madu (Runrun)" });
  assert.equal(criadorDe({ created_by: "importador", origem: { user_id: "" } }, nomes, ap), null);
  assert.equal(criadorDe({ created_by: null }, nomes, ap), null);

  const chave = (t: TarefaFiltravel) => criadorDe(t, nomes, ap)?.chave ?? null;
  assert.equal(passaFiltros(tf({ created_by: "importador", origem: { user_id: "isabela-esteves" } }), f({ pessoa: "e:isabela@chabra.com.br", papel: "criou" }), ctx({ chaveCriador: chave })), true);
  assert.equal(passaFiltros(tf({ created_by: "leana@chabra.com.br" }), f({ pessoa: "e:isabela@chabra.com.br", papel: "criou" }), ctx({ chaveCriador: chave })), false);
});

test("Mostrar (tarefas/subtarefas): padrão só tarefas, conta quando muda e filtro salvo antigo/estranho volta ao padrão", () => {
  assert.equal(FILTRO_VAZIO.mostrar, "tarefas");
  assert.equal(contarFiltros(f({ mostrar: "subtarefas" })), 1);
  assert.equal(contarFiltros(f({ mostrar: "ambas", situacao: "abertas" })), 2);
  assert.equal(comPadrao({ responsavel: "Ana" }).mostrar, "tarefas");
  assert.equal(comPadrao({ mostrar: "ambas" }).mostrar, "ambas");
  assert.equal(comPadrao({ mostrar: "xyz" as never }).mostrar, "tarefas");
  // não mexe no resto do filtro
  assert.equal(passaFiltros(tf(), f({ mostrar: "subtarefas" }), ctx()), true);
});

test("criada por (formulário): quem enviou logado; sem login, o formulário; nunca o responsável fixo do form", () => {
  const nomes = new Map([["ana@x.com", "Ana Clara"], ["ti@x.com", "Equipe TI"]]);
  const ap = new Map<string, string>();
  // enviado logado: a pessoa (mesma chave de quando ela cria pelo painel)
  const logado = { created_by: "ti@x.com", origem: { tipo: "formulario", id_formulario: "F1", titulo_formulario: "Ordem de Serviço", enviado_por: "ANA@x.com" } };
  assert.deepEqual(criadorDe(logado, nomes, ap), { chave: "e:ana@x.com", nome: "Ana Clara" });
  assert.deepEqual(criadorDe({ created_by: "ana@x.com", origem: null }, nomes, ap)?.chave, "e:ana@x.com");
  // sem login: o formulário
  const anonimo = { created_by: "ti@x.com", origem: { tipo: "formulario", id_formulario: "F1", titulo_formulario: "Ordem de Serviço", enviado_por: null } };
  assert.deepEqual(criadorDe(anonimo, nomes, ap), { chave: "f:ordem de serviço", nome: "Formulário: Ordem de Serviço" });
  // enviado antes da v0.3.932 (sem título nem quem enviou) e o legado created_by="Formulário"
  assert.deepEqual(criadorDe({ created_by: "ti@x.com", origem: { tipo: "formulario", id_formulario: "F1" } }, nomes, ap), { chave: "f:", nome: "Formulário" });
  assert.deepEqual(criadorDe({ created_by: "Formulário", origem: null }, nomes, ap), { chave: "f:", nome: "Formulário" });
  // filtro por criador usa a mesma chave
  const c = ctx({ chaveCriador: (t) => criadorDe(t, nomes, ap)?.chave ?? null });
  assert.equal(passaFiltros(tf(logado), f({ pessoa: "e:ana@x.com", papel: "criou" }), c), true);
  assert.equal(passaFiltros(tf(logado), f({ pessoa: "e:ti@x.com", papel: "criou" }), c), false);
});
