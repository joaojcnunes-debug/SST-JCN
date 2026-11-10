/**
 * Testes das funções do módulo Gestão que ainda não tinham cobertura (pedido de 10/11/2026: "o teste faça no módulo
 * gestão"). Padrão AAA (Arrange, Act, Assert), um comportamento por teste, nomes "deve <resultado> quando <condição>".
 * Funções puras: nada a mockar. As datas são montadas no fuso local, então o resultado não depende do fuso da máquina.
 *
 * Cobertos aqui: linkTarefa (link-tarefa.ts), fmtPrazo e fmtMeta (sla.ts), isoLocal (datas-rapidas.ts),
 * minutos, horaDe, cobreDia e cruzaPeriodo (calendario.ts).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { linkTarefa } from "./link-tarefa";
import { linkTarefa as linkTarefaDosEmails } from "./avisos-email";
import { fmtMeta, fmtPrazo } from "./sla";
import { isoLocal } from "./datas-rapidas";
import { cobreDia, cruzaPeriodo, horaDe, MIN_DIA, minutos, type Intervalo } from "./calendario";

const intervalo = (inicio: string, fim: string): Intervalo => ({ inicio, fim, horaIni: null, horaFim: null });

describe("linkTarefa — endereço da tarefa (Copiar link e e-mails de aviso)", () => {
  test("deve montar /gestao com quadro e tarefa quando os dois existem", () => {
    // Arrange
    const appUrl = "https://sst-jcn.vercel.app";
    // Act
    const url = linkTarefa(appUrl, { id_quadro: "QDR-1", id_tarefa: "TRF-1" });
    // Assert
    assert.equal(url, "https://sst-jcn.vercel.app/gestao?quadro=QDR-1&tarefa=TRF-1");
  });

  test("deve tirar as barras do fim do endereço quando o appUrl termina com /", () => {
    const url = linkTarefa("https://x.com///", { id_quadro: "Q", id_tarefa: "T" });
    assert.equal(url, "https://x.com/gestao?quadro=Q&tarefa=T");
  });

  test("deve devolver só /gestao quando não há quadro nem tarefa", () => {
    const url = linkTarefa("https://x.com", { id_quadro: null, id_tarefa: null });
    assert.equal(url, "https://x.com/gestao");
  });

  test("deve levar só o quadro quando a tarefa é nula", () => {
    const url = linkTarefa("https://x.com", { id_quadro: "QDR-9", id_tarefa: null });
    assert.equal(url, "https://x.com/gestao?quadro=QDR-9");
  });

  test("deve codificar caracteres especiais quando o id tem espaço ou &", () => {
    const url = linkTarefa("https://x.com", { id_quadro: "Q 1", id_tarefa: "A&B" });
    assert.equal(url, "https://x.com/gestao?quadro=Q+1&tarefa=A%26B");
  });

  test("deve ser a mesma função usada nos e-mails de aviso quando importada de avisos-email", () => {
    assert.equal(linkTarefaDosEmails, linkTarefa);
  });
});

describe("fmtPrazo — prazo de atendimento no painel da tarefa", () => {
  const agora = new Date(2026, 10, 10, 9, 0).getTime(); // 10/11/2026 09:00 (local)

  test("deve dizer 'hoje' com a hora quando o prazo é no mesmo dia", () => {
    const iso = new Date(2026, 10, 10, 15, 30).toISOString();
    assert.equal(fmtPrazo(iso, agora), "hoje 15:30");
  });

  test("deve dizer 'amanhã' com a hora quando o prazo é no dia seguinte", () => {
    const iso = new Date(2026, 10, 11, 8, 5).toISOString();
    assert.equal(fmtPrazo(iso, agora), "amanhã 08:05");
  });

  test("deve mostrar dia/mês e hora quando o prazo é depois de amanhã", () => {
    const iso = new Date(2026, 10, 13, 17, 0).toISOString();
    assert.equal(fmtPrazo(iso, agora), "13/11 17:00");
  });

  test("deve mostrar dia/mês quando o prazo já passou (ontem)", () => {
    const iso = new Date(2026, 10, 9, 10, 0).toISOString();
    assert.equal(fmtPrazo(iso, agora), "09/11 10:00");
  });
});

describe("fmtMeta — meta do prazo de atendimento em horas", () => {
  test("deve mostrar só as horas quando os minutos fecham hora cheia", () => {
    assert.equal(fmtMeta(480), "8h");
  });

  test("deve mostrar horas e minutos com dois dígitos quando sobram minutos", () => {
    assert.equal(fmtMeta(125), "2h05");
  });

  test("deve mostrar 0h quando a meta é zero", () => {
    assert.equal(fmtMeta(0), "0h");
  });

  test("deve mostrar travessão quando não há meta", () => {
    assert.equal(fmtMeta(null), "—");
  });
});

describe("isoLocal — data do dia local em AAAA-MM-DD", () => {
  test("deve devolver a data local quando recebe um Date no meio do dia", () => {
    assert.equal(isoLocal(new Date(2026, 10, 10, 12, 0)), "2026-11-10");
  });

  test("deve manter o dia local quando a hora é 23:59", () => {
    assert.equal(isoLocal(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
  });

  test("deve completar com zero quando mês e dia têm um dígito", () => {
    assert.equal(isoLocal(new Date(2027, 0, 5, 8, 0)), "2027-01-05");
  });
});

describe("minutos e horaDe — conversão de hora do calendário", () => {
  test("deve converter HH:MM em minutos do dia quando a hora é válida", () => {
    assert.equal(minutos("09:30"), 570);
  });

  test("deve dar zero quando a hora é meia-noite", () => {
    assert.equal(minutos("00:00"), 0);
  });

  test("deve formatar com dois dígitos quando converte minutos em HH:MM", () => {
    assert.equal(horaDe(65), "01:05");
  });

  test("deve travar em 23:59 quando os minutos passam do fim do dia", () => {
    assert.equal(horaDe(MIN_DIA + 30), "23:59");
  });

  test("deve travar em 00:00 quando os minutos são negativos", () => {
    assert.equal(horaDe(-10), "00:00");
  });

  test("deve arredondar quando os minutos vêm com fração", () => {
    assert.equal(horaDe(89.6), "01:30");
  });

  test("deve voltar à mesma hora quando faz ida e volta minutos → horaDe", () => {
    assert.equal(horaDe(minutos("14:45")), "14:45");
  });
});

describe("cobreDia — a tarefa ocupa o dia?", () => {
  test("deve cobrir quando o dia está no meio do intervalo", () => {
    assert.equal(cobreDia(intervalo("2026-11-10", "2026-11-12"), "2026-11-11"), true);
  });

  test("deve cobrir quando o dia é o primeiro ou o último do intervalo", () => {
    const iv = intervalo("2026-11-10", "2026-11-12");
    assert.equal(cobreDia(iv, "2026-11-10"), true);
    assert.equal(cobreDia(iv, "2026-11-12"), true);
  });

  test("não deve cobrir quando o dia é antes do início", () => {
    assert.equal(cobreDia(intervalo("2026-11-10", "2026-11-12"), "2026-11-09"), false);
  });

  test("não deve cobrir quando o dia é depois do fim", () => {
    assert.equal(cobreDia(intervalo("2026-11-10", "2026-11-12"), "2026-11-13"), false);
  });
});

describe("cruzaPeriodo — a tarefa aparece no período da tela?", () => {
  test("deve cruzar quando a tarefa está dentro do período", () => {
    assert.equal(cruzaPeriodo(intervalo("2026-11-12", "2026-11-12"), "2026-11-10", "2026-11-16"), true);
  });

  test("deve cruzar quando a tarefa começa antes e termina dentro do período", () => {
    assert.equal(cruzaPeriodo(intervalo("2026-11-05", "2026-11-10"), "2026-11-10", "2026-11-16"), true);
  });

  test("deve cruzar quando a tarefa começa antes e termina depois do período", () => {
    assert.equal(cruzaPeriodo(intervalo("2026-10-01", "2026-12-31"), "2026-11-10", "2026-11-16"), true);
  });

  test("não deve cruzar quando a tarefa termina antes do período", () => {
    assert.equal(cruzaPeriodo(intervalo("2026-11-01", "2026-11-09"), "2026-11-10", "2026-11-16"), false);
  });

  test("não deve cruzar quando a tarefa começa depois do período", () => {
    assert.equal(cruzaPeriodo(intervalo("2026-11-17", "2026-11-20"), "2026-11-10", "2026-11-16"), false);
  });
});
