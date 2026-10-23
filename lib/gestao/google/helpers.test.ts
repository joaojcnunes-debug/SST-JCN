import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { LEMBRETE_MINUTOS_ANTES, convidadosDoEvento, deveAplicarInbound, deveImportarEvento, montarEvento, origemPublica, planejarDestinatarios, textoDaDescricao, writebackDoEvento } from "./helpers";

describe("origemPublica (retorno do Google e webhook)", () => {
  test("usa o APP_URL em vez do endereço interno do container", () => {
    assert.equal(origemPublica("https://painel-sst.chabra.com.br", "https://0.0.0.0:3000"), "https://painel-sst.chabra.com.br");
  });
  test("tira a barra do fim", () => {
    assert.equal(origemPublica("https://painel-sst.chabra.com.br/", "https://0.0.0.0:3000"), "https://painel-sst.chabra.com.br");
  });
  test("sem APP_URL (ou inválido) usa a origem da requisição", () => {
    assert.equal(origemPublica(undefined, "http://localhost:3000"), "http://localhost:3000");
    assert.equal(origemPublica("", "http://localhost:3000"), "http://localhost:3000");
    assert.equal(origemPublica("painel-sst.chabra.com.br", "http://localhost:3000"), "http://localhost:3000");
    assert.equal(origemPublica("https://x.com/caminho", "http://localhost:3000"), "http://localhost:3000");
  });
});

const ordenar = (p: { email: string; acao: string }[]) => [...p].sort((a, b) => a.email.localeCompare(b.email));

describe("Google Agenda: quem recebe o quê (planejarDestinatarios)", () => {
  test("tarefa normal: vinculados conectados recebem upsert", () => {
    const p = planejarDestinatarios({
      vinculados: ["a@x", "b@x"],
      comEvento: ["a@x"],
      conectados: ["a@x", "b@x"],
      ehDelete: false,
    });
    assert.deepEqual(ordenar(p), [
      { email: "a@x", acao: "upsert" },
      { email: "b@x", acao: "upsert" },
    ]);
  });

  test("TAREFA APAGADA: os vinculados sumiram em cascata, o evento do mapa é apagado", () => {
    // O caso medido na produção em 23/09: 1 evento órfão porque a lista de vinculados veio vazia.
    const p = planejarDestinatarios({ vinculados: [], comEvento: ["a@x"], conectados: ["a@x"], ehDelete: true });
    assert.deepEqual(p, [{ email: "a@x", acao: "delete" }]);
  });

  test("PESSOA TIRADA da tarefa: só o evento dela é apagado, os outros seguem", () => {
    const p = planejarDestinatarios({
      vinculados: ["b@x"],
      comEvento: ["a@x", "b@x"],
      conectados: ["a@x", "b@x"],
      ehDelete: false,
    });
    assert.deepEqual(ordenar(p), [
      { email: "a@x", acao: "delete" },
      { email: "b@x", acao: "upsert" },
    ]);
  });

  test("tarefa concluída ou sem prazo: delete para todos, vinculados ou não", () => {
    const p = planejarDestinatarios({
      vinculados: ["a@x"],
      comEvento: ["a@x", "c@x"],
      conectados: ["a@x", "c@x"],
      ehDelete: true,
    });
    assert.ok(p.every((d) => d.acao === "delete"));
    assert.equal(p.length, 2);
  });

  test("conta não conectada (ou desativada) fica de fora — não há como falar com a agenda dela", () => {
    const p = planejarDestinatarios({
      vinculados: ["a@x", "b@x"],
      comEvento: ["c@x"],
      conectados: ["a@x"],
      ehDelete: false,
    });
    assert.deepEqual(p, [{ email: "a@x", acao: "upsert" }]);
  });

  test("ninguém conectado: nada a fazer (o caso de ~toda a fila hoje)", () => {
    const p = planejarDestinatarios({ vinculados: ["a@x"], comEvento: [], conectados: [], ehDelete: false });
    assert.deepEqual(p, []);
  });

  test("mesmo e-mail vinculado e no mapa aparece uma vez só", () => {
    const p = planejarDestinatarios({ vinculados: ["a@x", "a@x"], comEvento: ["a@x"], conectados: ["a@x"], ehDelete: false });
    assert.equal(p.length, 1);
  });
});

describe("Google Agenda: evento da tarefa (montarEvento)", () => {
  test("só prazo: evento de dia inteiro no prazo, com lembrete na véspera às 9h", () => {
    const ev = montarEvento({ id_tarefa: "TRF-1", titulo: "Trocar SSD", prazo: "2026-10-17", data_inicio: null });
    assert.deepEqual(ev.start, { date: "2026-10-17", dateTime: null });
    assert.deepEqual(ev.end, { date: "2026-10-18", dateTime: null }); // fim exclusivo
    assert.deepEqual(ev.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 900 }] });
    assert.equal(ev.extendedProperties.private.gestao_id_tarefa, "TRF-1");
  });

  test("lembrete dentro do limite do Google (0 a 40320 min antes do início)", () => {
    assert.ok(LEMBRETE_MINUTOS_ANTES >= 0 && LEMBRETE_MINUTOS_ANTES <= 40320);
  });

  test("intervalo: começa em data_inicio e termina no prazo (virada de mês)", () => {
    const ev = montarEvento({ id_tarefa: "TRF-2", titulo: "x", prazo: "2026-10-31", data_inicio: "2026-10-29" });
    assert.deepEqual(ev.start, { date: "2026-10-29", dateTime: null });
    assert.deepEqual(ev.end, { date: "2026-11-01", dateTime: null });
  });
});

describe("Google Agenda: tarefa com hora (v298)", () => {
  const fuso = "America/Sao_Paulo";

  test("hora de início e fim no mesmo dia: evento com hora, lembrete na véspera às 9h", () => {
    const ev = montarEvento({ id_tarefa: "T", titulo: "x", prazo: "2026-10-20", data_inicio: "2026-10-20", hora_inicio: "08:30:00", hora_fim: "10:00:00" });
    assert.deepEqual(ev.start, { date: null, dateTime: "2026-10-20T08:30:00", timeZone: fuso });
    assert.deepEqual(ev.end, { date: null, dateTime: "2026-10-20T10:00:00", timeZone: fuso });
    assert.equal(ev.reminders.overrides[0].minutes, 900 + 510);
  });

  test("intervalo de dias: começa em data_inicio às hora_inicio e termina no prazo às hora_fim", () => {
    const ev = montarEvento({ id_tarefa: "T", titulo: "x", prazo: "2026-10-22", data_inicio: "2026-10-20", hora_inicio: "14:00", hora_fim: "09:00" });
    assert.equal(ev.start.dateTime, "2026-10-20T14:00:00");
    assert.equal(ev.end.dateTime, "2026-10-22T09:00:00");
  });

  test("só uma das horas: 1 h de duração", () => {
    assert.equal(montarEvento({ id_tarefa: "T", titulo: "x", prazo: "2026-10-20", data_inicio: null, hora_inicio: "08:00" }).end.dateTime, "2026-10-20T09:00:00");
    assert.equal(montarEvento({ id_tarefa: "T", titulo: "x", prazo: "2026-10-20", data_inicio: null, hora_fim: "17:00" }).start.dateTime, "2026-10-20T16:00:00");
  });

  test("fim antes do início no mesmo dia: fim = início + 1 h", () => {
    const ev = montarEvento({ id_tarefa: "T", titulo: "x", prazo: "2026-10-20", data_inicio: null, hora_inicio: "15:00", hora_fim: "09:00" });
    assert.equal(ev.end.dateTime, "2026-10-20T16:00:00");
  });

  test("inbound de evento com hora: prazo é a data do fim (não o fim exclusivo) e as horas voltam", () => {
    const wb = writebackDoEvento({ start: { dateTime: "2026-10-20T08:30:00-03:00" }, end: { dateTime: "2026-10-20T10:00:00-03:00" } });
    assert.deepEqual(wb, { prazo: "2026-10-20", data_inicio: null, hora_inicio: "08:30:00", hora_fim: "10:00:00" });
  });

  test("inbound de dia inteiro: horas null (round-trip do outbound)", () => {
    const wb = writebackDoEvento({ start: { date: "2026-10-29" }, end: { date: "2026-11-01" } });
    assert.deepEqual(wb, { prazo: "2026-10-31", data_inicio: "2026-10-29", hora_inicio: null, hora_fim: null });
  });

  test("mudar só a hora no celular aplica; '08:30' e '08:30:00' contam como iguais", () => {
    const base = { etagEvento: "b", etagGravado: "a", prazoNovo: "2026-10-20", prazoAtual: "2026-10-20", inicioNovo: null, inicioAtual: null };
    assert.equal(deveAplicarInbound({ ...base, horaInicioNova: "09:00:00", horaInicioAtual: "08:30:00" }), true);
    assert.equal(deveAplicarInbound({ ...base, horaInicioNova: "08:30:00", horaInicioAtual: "08:30" }), false);
  });
});

describe("Evento criado na agenda vira tarefa (v301)", () => {
  const desde = "2026-10-19T12:00:00Z";
  const base = {
    id: "ev1",
    status: "confirmed",
    created: "2026-10-19T13:00:00Z",
    organizer: { email: "eu@chabra.com.br", self: true },
    start: { date: "2026-10-22" },
    end: { date: "2026-10-23" },
  };
  test("evento que a pessoa criou depois da ativação → importa", () => {
    assert.equal(deveImportarEvento(base, desde), true);
  });
  test("convite de outra pessoa → não importa", () => {
    assert.equal(deveImportarEvento({ ...base, organizer: { email: "outro@x", self: false } }, desde), false);
    assert.equal(deveImportarEvento({ ...base, organizer: undefined }, desde), false);
  });
  test("criado antes da ativação (editar evento antigo) → não importa", () => {
    assert.equal(deveImportarEvento({ ...base, created: "2026-10-01T10:00:00Z" }, desde), false);
  });
  test("repetição, apagado, tipo especial ou sem data → não importa", () => {
    assert.equal(deveImportarEvento({ ...base, recurringEventId: "serie" }, desde), false);
    assert.equal(deveImportarEvento({ ...base, status: "cancelled" }, desde), false);
    assert.equal(deveImportarEvento({ ...base, eventType: "outOfOffice" }, desde), false);
    assert.equal(deveImportarEvento({ ...base, eventType: "fromGmail" }, desde), false);
    assert.equal(deveImportarEvento({ ...base, start: null }, desde), false);
  });
  test("evento comum explícito importa; sem data de corte (conta sem coluna) não importa", () => {
    assert.equal(deveImportarEvento({ ...base, eventType: "default" }, desde), true);
    assert.equal(deveImportarEvento(base, null), false);
  });
  test("convidados: sem a própria pessoa, salas e quem recusou; minúsculas, sem repetir", () => {
    const ev = {
      ...base,
      attendees: [
        { email: "eu@chabra.com.br", self: true },
        { email: "Ana@Chabra.com.br" },
        { email: "ana@chabra.com.br" },
        { email: "sala@resource.calendar.google.com", resource: true },
        { email: "joao@chabra.com.br", responseStatus: "declined" },
        { email: "bia@chabra.com.br", responseStatus: "tentative" },
      ],
    };
    assert.deepEqual(convidadosDoEvento(ev), ["ana@chabra.com.br", "bia@chabra.com.br"]);
    assert.deepEqual(convidadosDoEvento(base), []);
  });
  test("descrição em HTML vira texto", () => {
    assert.equal(textoDaDescricao('Ver <b>NR-35</b><br>Link: <a href="https://x">aqui</a> &amp; mais'), "Ver NR-35\nLink: aqui & mais");
    assert.equal(textoDaDescricao("  "), null);
    assert.equal(textoDaDescricao(undefined), null);
  });
  test("datas do evento com hora viram prazo e horas da tarefa", () => {
    const wb = writebackDoEvento({ start: { dateTime: "2026-10-22T09:00:00-03:00" }, end: { dateTime: "2026-10-22T10:30:00-03:00" } });
    assert.deepEqual(wb, { prazo: "2026-10-22", data_inicio: null, hora_inicio: "09:00:00", hora_fim: "10:30:00" });
  });
});
