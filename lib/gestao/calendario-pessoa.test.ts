import { test } from "node:test";
import assert from "node:assert/strict";
import { cartaoDaPessoa } from "./calendario-pessoa";

const ana = new Set(["ana@x.com"]);

test("responsável ou seguidora pelo vínculo", () => {
  assert.equal(cartaoDaPessoa({ responsavel: null }, ana, ["Ana Clara"], [{ usuario_email: "ANA@x.com", tipo: "responsavel" }], null), true);
  assert.equal(cartaoDaPessoa({ responsavel: null }, ana, ["Ana Clara"], [{ usuario_email: "ana@x.com", tipo: "seguidor" }], null), true);
  assert.equal(cartaoDaPessoa({ responsavel: null }, ana, ["Ana Clara"], [{ usuario_email: "bia@x.com", tipo: "responsavel" }], null), false);
});

test("quem criou o cartão", () => {
  assert.equal(cartaoDaPessoa({ responsavel: null }, ana, ["Ana Clara"], [], "e:ana@x.com"), true);
  assert.equal(cartaoDaPessoa({ responsavel: null }, ana, ["Ana Clara"], [], "e:bia@x.com"), false);
  assert.equal(cartaoDaPessoa({ responsavel: null }, ana, ["Ana Clara"], [], "f:ordem de serviço"), false);
});

test("cartão antigo com o responsável só pelo nome; equipe", () => {
  assert.equal(cartaoDaPessoa({ responsavel: "Ana Clara, João Silva" }, ana, ["Ana Clara"], [], null), true);
  const equipe = new Set(["ana@x.com", "joao@x.com"]);
  assert.equal(cartaoDaPessoa({ responsavel: null }, equipe, ["Ana Clara", "João Silva"], [{ usuario_email: "joao@x.com", tipo: "seguidor" }], null), true);
  assert.equal(cartaoDaPessoa({ responsavel: null }, new Set(), [], [{ usuario_email: "joao@x.com", tipo: "seguidor" }], null), false);
});
