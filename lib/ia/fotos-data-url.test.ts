import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fotosParaDataUrl } from "./fotos-data-url";

// O que estes testes protegem: a IA de visao NAO pode voltar a mandar a URL
// publica da foto para o Groq. Desde 10/09 o bucket `fotos` e privado e o
// fornecedor recebe 403 ("failed to retrieve media"). O caminho certo e o
// servidor baixar a foto e embutir em base64 -- e uma foto que falha nao pode
// derrubar as outras, senao a analise some inteira por 1 arquivo apagado.

const ENDPOINT = "https://storage.chabra.com.br";
const originalEndpoint = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_ENDPOINT;

interface Chamada {
  bucket: string;
  path: string;
}

function storageFalso(arquivos: Record<string, { bytes: Uint8Array; type?: string }>) {
  const chamadas: Chamada[] = [];
  const storage = {
    from(bucket: string) {
      return {
        async download(path: string) {
          chamadas.push({ bucket, path });
          const a = arquivos[path];
          if (!a) return { data: null, error: { message: "nao existe" } };
          return { data: new Blob([a.bytes as BlobPart], { type: a.type ?? "" }), error: null };
        },
      };
    },
  };
  return { storage: storage as never, chamadas };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe("fotosParaDataUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_ENDPOINT = ENDPOINT;
  });
  afterEach(() => {
    if (originalEndpoint === undefined) delete process.env.NEXT_PUBLIC_STORAGE_PUBLIC_ENDPOINT;
    else process.env.NEXT_PUBLIC_STORAGE_PUBLIC_ENDPOINT = originalEndpoint;
  });

  test("URL publica do MinIO gravada no banco vira data: URL baixada pelo servidor", async () => {
    const { storage, chamadas } = storageFalso({
      "EMP-1/INS-2/FT-3.JPEG": { bytes: PNG, type: "image/jpeg" },
    });

    const r = await fotosParaDataUrl(storage, [`${ENDPOINT}/fotos/EMP-1/INS-2/FT-3.JPEG`], 3);

    assert.deepEqual(chamadas, [{ bucket: "fotos", path: "EMP-1/INS-2/FT-3.JPEG" }]);
    assert.equal(r.falhas.length, 0);
    assert.equal(r.prontas.length, 1);
    assert.equal(r.prontas[0], `data:image/jpeg;base64,${Buffer.from(PNG).toString("base64")}`);
  });

  test("sem content-type, o mime vem da extensao (nunca a URL crua)", async () => {
    const { storage } = storageFalso({ "a/b.png": { bytes: PNG } });

    const r = await fotosParaDataUrl(storage, [`${ENDPOINT}/fotos/a/b.png`], 3);

    assert.match(r.prontas[0], /^data:image\/png;base64,/);
  });

  test("uma foto que falha nao derruba as outras -- vai para `falhas`", async () => {
    const { storage } = storageFalso({ "ok.jpg": { bytes: PNG, type: "image/jpeg" } });

    const r = await fotosParaDataUrl(
      storage,
      [`${ENDPOINT}/fotos/apagada.jpg`, `${ENDPOINT}/fotos/ok.jpg`, "https://outro.site/x.jpg"],
      3,
    );

    assert.equal(r.prontas.length, 1);
    assert.deepEqual(r.falhas, [`${ENDPOINT}/fotos/apagada.jpg`, "https://outro.site/x.jpg"]);
  });

  test("respeita o teto de fotos e passa data: URL adiante sem baixar", async () => {
    const { storage, chamadas } = storageFalso({
      "1.jpg": { bytes: PNG, type: "image/jpeg" },
      "2.jpg": { bytes: PNG, type: "image/jpeg" },
    });
    const embutida = "data:image/jpeg;base64,AAAA";

    const r = await fotosParaDataUrl(
      storage,
      [embutida, `${ENDPOINT}/fotos/1.jpg`, `${ENDPOINT}/fotos/2.jpg`],
      2,
    );

    assert.deepEqual(chamadas, [{ bucket: "fotos", path: "1.jpg" }]);
    assert.deepEqual(r.prontas.slice(0, 1), [embutida]);
    assert.equal(r.prontas.length, 2);
  });
});
