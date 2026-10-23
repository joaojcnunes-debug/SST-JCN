import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { gerarTicketAnexo, ticketAnexoValido, VALIDADE_TICKET_MS } from "./anexo-ticket";

const CHAVE = "chave-de-teste";
const T0 = 1_800_000_000_000;

describe("ticket de anexo do formulário público", () => {
  test("vale para a tarefa que o gerou, dentro do prazo", () => {
    const t = gerarTicketAnexo(CHAVE, "TRF-AAAA0001", T0);
    assert.equal(ticketAnexoValido(CHAVE, "TRF-AAAA0001", t, T0 + 1000), true);
  });

  test("não vale para outra tarefa nem com outra chave", () => {
    const t = gerarTicketAnexo(CHAVE, "TRF-AAAA0001", T0);
    assert.equal(ticketAnexoValido(CHAVE, "TRF-BBBB0002", t, T0), false);
    assert.equal(ticketAnexoValido("outra", "TRF-AAAA0001", t, T0), false);
  });

  test("expira depois da janela", () => {
    const t = gerarTicketAnexo(CHAVE, "TRF-AAAA0001", T0);
    assert.equal(ticketAnexoValido(CHAVE, "TRF-AAAA0001", t, T0 + VALIDADE_TICKET_MS + 1), false);
  });

  test("prazo adulterado, ticket vazio/malformado ou chave vazia = inválido", () => {
    const t = gerarTicketAnexo(CHAVE, "TRF-AAAA0001", T0);
    const [, sig] = t.split(".");
    assert.equal(ticketAnexoValido(CHAVE, "TRF-AAAA0001", `${T0 + 10 * VALIDADE_TICKET_MS}.${sig}`, T0), false);
    assert.equal(ticketAnexoValido(CHAVE, "TRF-AAAA0001", "", T0), false);
    assert.equal(ticketAnexoValido(CHAVE, "TRF-AAAA0001", "abc", T0), false);
    assert.equal(ticketAnexoValido("", "TRF-AAAA0001", t, T0), false);
  });
});
