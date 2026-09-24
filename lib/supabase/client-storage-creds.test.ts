import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { requireServerStorageCreds } from "./server-storage-creds";

// O que estes testes protegem: as creds SERVER-ONLY do storage nao tem mais
// fallback para as publicas do bundle. O fallback antigo era mudo -- se a
// variavel sumisse do env, o servidor seguia de pe com a credencial do
// uploader (escopo `fotos`/`anexos`) e perdia certificados e pdfs-* inteiros,
// com o sintoma chegando como "o PDF nao abre". Se alguem reintroduzir o
// `?? pubKeyId`, estes testes caem.

const original = {
  id: process.env.STORAGE_ACCESS_KEY_ID,
  secret: process.env.STORAGE_SECRET_ACCESS_KEY,
};

/** Define (ou remove, com undefined) as duas variaveis server-only. */
function definir(id: string | undefined, secret: string | undefined) {
  if (id === undefined) delete process.env.STORAGE_ACCESS_KEY_ID;
  else process.env.STORAGE_ACCESS_KEY_ID = id;
  if (secret === undefined) delete process.env.STORAGE_SECRET_ACCESS_KEY;
  else process.env.STORAGE_SECRET_ACCESS_KEY = secret;
}

afterEach(() => definir(original.id, original.secret));

describe("credenciais server-only do storage", () => {
  test("devolve o par quando as duas estão no env", () => {
    definir("AK-SERVIDOR", "SK-SERVIDOR");
    assert.deepEqual(requireServerStorageCreds(), {
      accessKeyId: "AK-SERVIDOR",
      secretAccessKey: "SK-SERVIDOR",
    });
  });

  test("sem as duas, lança erro em vez de cair nas creds do bundle", () => {
    definir(undefined, undefined);
    assert.throws(
      () => requireServerStorageCreds(),
      /STORAGE_ACCESS_KEY_ID e STORAGE_SECRET_ACCESS_KEY nao configurado/
    );
  });

  test("o erro nomeia só a variável que faltou", () => {
    definir(undefined, "SK-SERVIDOR");
    assert.throws(
      () => requireServerStorageCreds(),
      /^Error: STORAGE_ACCESS_KEY_ID nao configurado/
    );
  });

  test("variável vazia conta como ausente — não vira credencial em branco", () => {
    definir("", "");
    assert.throws(
      () => requireServerStorageCreds(),
      /STORAGE_ACCESS_KEY_ID e STORAGE_SECRET_ACCESS_KEY nao configurado/
    );
  });
});
