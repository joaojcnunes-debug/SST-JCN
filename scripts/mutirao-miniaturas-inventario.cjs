/**
 * MUTIRAO DAS MINIATURAS DO INVENTARIO -- Fase 1 do briefing-equipamentos-chabra.md
 *
 * Gera a miniatura das fotos que JA existem. A v173 criou a coluna
 * `foto_thumb_path`, e o upload novo ja nasce com miniatura -- mas as 121 fotos
 * antigas ficariam sem, e o ganho so valeria para foto nova. Este script fecha
 * essa lacuna.
 *
 * PARA CADA item com foto e sem miniatura:
 *   1. baixa a ORIGINAL do MinIO
 *   2. reduz para 320px no lado maior, JPEG qualidade 75 (mesmos numeros de
 *      lib/imagem/redimensionar.ts, para a miniatura antiga e a nova saírem
 *      iguais)
 *   3. grava em fotos/inventario-maquinas/thumbs/{id_maquina}.jpg
 *   4. escreve o caminho em inventario_maquinas.foto_thumb_path
 *
 * A ORIGINAL NUNCA E TOCADA. O script so LE dela (GetObject). Decisao do
 * operador em 2026-08-10: encolher so para a tela, original preservada.
 *
 * SEGURO DE REPETIR: pega apenas linhas com foto_thumb_path nulo. Rodar de novo
 * depois de terminar nao faz nada. Se cair no meio, e so rodar de novo -- ele
 * continua de onde parou.
 *
 * SEGURO DE ERRAR: falha numa foto (formato exotico, arquivo corrompido) e
 * registrada e o script segue para a proxima. Nenhuma transacao fica pela metade,
 * porque cada item e independente.
 *
 * ─── COMO RODAR ────────────────────────────────────────────────────────────
 * Roda DENTRO do container do app na .107, onde o MinIO e o PostgREST estao a
 * um salto de rede e o `sharp` ja esta instalado. Assim os 272 MB nao trafegam
 * pela internet -- so dentro da maquina.
 *
 *   scp scripts/mutirao-miniaturas-inventario.cjs chabra-107:/tmp/
 *   ssh chabra-107 'docker cp /tmp/mutirao-miniaturas-inventario.cjs painel-sst-app:/tmp/'
 *
 *   # 1) ENSAIO -- nao escreve nada, so diz o que faria:
 *   ssh chabra-107 'docker exec -e NODE_PATH=/app/node_modules painel-sst-app \
 *     node /tmp/mutirao-miniaturas-inventario.cjs'
 *
 *   # 2) VALENDO -- exige a flag, para nao rodar por engano:
 *   ssh chabra-107 'docker exec -e NODE_PATH=/app/node_modules painel-sst-app \
 *     node /tmp/mutirao-miniaturas-inventario.cjs --aplicar'
 *
 * DESFAZER: `update public.inventario_maquinas set foto_thumb_path = null;`
 * (a lista volta a usar a original). Os arquivos de miniatura ficam no bucket,
 * inofensivos, e sao reaproveitados se voce rodar o mutirao de novo.
 */

const sharp = require("sharp");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

// Mesmos numeros de lib/imagem/redimensionar.ts. Mudar aqui sem mudar la faz a
// miniatura antiga e a nova sairem diferentes na mesma lista.
const MAX_PX = 320;
const QUALIDADE = 75;

const APLICAR = process.argv.includes("--aplicar");

const ENDPOINT = process.env.NEXT_PUBLIC_STORAGE_ENDPOINT;
const BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "fotos";
const PGRST = process.env.POSTGREST_INTERNAL_URL || process.env.NEXT_PUBLIC_POSTGREST_URL;
const TOKEN = process.env.POSTGREST_SERVICE_TOKEN;

for (const [nome, valor] of Object.entries({
  NEXT_PUBLIC_STORAGE_ENDPOINT: ENDPOINT,
  STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
  POSTGREST_URL: PGRST,
  POSTGREST_SERVICE_TOKEN: TOKEN,
})) {
  if (!valor) {
    console.error(`ABORTADO: variavel ${nome} ausente no ambiente.`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: process.env.STORAGE_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
});

const cabecalhos = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function corpoParaBuffer(stream) {
  const pedacos = [];
  for await (const p of stream) pedacos.push(p);
  return Buffer.concat(pedacos);
}

async function main() {
  console.log(
    APLICAR
      ? "=== MUTIRAO DAS MINIATURAS -- VALENDO (vai escrever) ==="
      : "=== MUTIRAO DAS MINIATURAS -- ENSAIO (nao escreve nada) ==="
  );
  console.log(`Miniatura: ${MAX_PX}px no lado maior, JPEG q${QUALIDADE}`);
  console.log(`Bucket: ${BUCKET} @ ${ENDPOINT}\n`);

  const urlComColuna =
    `${PGRST}/inventario_maquinas` +
    `?select=id_maquina,nome,foto_storage_path,foto_thumb_path` +
    `&foto_storage_path=not.is.null&foto_thumb_path=is.null`;
  // Sem a coluna (v173 ainda nao aplicada) nao ha o que filtrar: todo item com
  // foto esta "sem miniatura". Serve para o ENSAIO rodar ANTES da migration, que
  // e o que permite ver os numeros sem ainda ter mexido na producao.
  const urlSemColuna =
    `${PGRST}/inventario_maquinas` +
    `?select=id_maquina,nome,foto_storage_path&foto_storage_path=not.is.null`;

  let resp = await fetch(urlComColuna, { headers: cabecalhos });
  if (!resp.ok) {
    const corpo = await resp.text();
    const semColuna = corpo.includes("foto_thumb_path") && corpo.includes("42703");
    if (semColuna && APLICAR) {
      console.error("ABORTADO: a coluna foto_thumb_path nao existe.");
      console.error("Aplique a migration v173 antes de rodar com --aplicar:");
      console.error("  supabase/migrations/v173_inventario_foto_thumb.sql");
      process.exit(1);
    }
    if (!semColuna) {
      console.error(`ABORTADO: PostgREST devolveu ${resp.status} ao listar.`);
      console.error(corpo);
      process.exit(1);
    }
    console.log(
      "AVISO: coluna foto_thumb_path ainda nao existe (v173 nao aplicada).\n" +
        "       Como isto e um ENSAIO, sigo medindo TODAS as fotos.\n"
    );
    resp = await fetch(urlSemColuna, { headers: cabecalhos });
    if (!resp.ok) {
      console.error(`ABORTADO: PostgREST devolveu ${resp.status} ao listar.`);
      console.error(await resp.text());
      process.exit(1);
    }
  }
  const itens = await resp.json();

  if (itens.length === 0) {
    console.log("Nada a fazer: nenhum item com foto e sem miniatura.");
    return;
  }
  console.log(`${itens.length} item(ns) com foto e sem miniatura.\n`);

  let ok = 0;
  let falhou = 0;
  let bytesOriginais = 0;
  let bytesMiniaturas = 0;
  const erros = [];

  for (const [i, item] of itens.entries()) {
    const prefixo = `[${String(i + 1).padStart(3)}/${itens.length}] ${item.id_maquina}`;
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: item.foto_storage_path })
      );
      const original = await corpoParaBuffer(obj.Body);

      const miniatura = await sharp(original)
        .rotate() // respeita o EXIF do celular; sem isto a foto deitava
        .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALIDADE })
        .toBuffer();

      bytesOriginais += original.length;
      bytesMiniaturas += miniatura.length;

      const destino = `inventario-maquinas/thumbs/${item.id_maquina}.jpg`;

      if (APLICAR) {
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: destino,
            Body: miniatura,
            ContentType: "image/jpeg",
            CacheControl: "3600",
          })
        );
        const patch = await fetch(
          `${PGRST}/inventario_maquinas?id_maquina=eq.${encodeURIComponent(item.id_maquina)}`,
          {
            method: "PATCH",
            headers: { ...cabecalhos, Prefer: "return=minimal" },
            body: JSON.stringify({ foto_thumb_path: destino }),
          }
        );
        if (!patch.ok) throw new Error(`PATCH ${patch.status}: ${await patch.text()}`);
      }

      ok++;
      console.log(
        `${prefixo}  ${kb(original.length)} -> ${kb(miniatura.length)}  ${(item.nome || "").slice(0, 40)}`
      );
    } catch (e) {
      falhou++;
      erros.push({ id: item.id_maquina, nome: item.nome, erro: e.message });
      console.log(`${prefixo}  FALHOU: ${e.message}`);
    }
  }

  console.log("\n=== RESUMO ===");
  console.log(`Processados com sucesso: ${ok}`);
  console.log(`Falharam:                ${falhou}`);
  console.log(`Peso das originais lidas: ${mb(bytesOriginais)}`);
  console.log(`Peso das miniaturas:      ${mb(bytesMiniaturas)}`);
  if (bytesOriginais > 0) {
    const reducao = (1 - bytesMiniaturas / bytesOriginais) * 100;
    console.log(`Reducao:                  ${reducao.toFixed(1)}%`);
  }
  if (erros.length) {
    console.log("\nItens que falharam (a lista continua usando a original neles):");
    for (const e of erros) console.log(`  ${e.id}  ${e.nome}  -- ${e.erro}`);
  }
  if (!APLICAR) {
    console.log("\nENSAIO: nada foi escrito. Rode de novo com --aplicar para valer.");
  }
}

main().catch((e) => {
  console.error("ABORTADO:", e);
  process.exit(1);
});
