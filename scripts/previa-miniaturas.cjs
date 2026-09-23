/**
 * PREVIA VISUAL das miniaturas -- descartavel, nao entra no fluxo do painel.
 *
 * O ensaio do mutirao prova que o peso despenca; ele NAO prova que a miniatura
 * FICA BOA de olhar. Este script monta uma pagina autocontida com fotos reais da
 * producao: primeiro simulando o card da LISTA (que e onde a decisao acontece) e
 * depois lado a lado, original x miniatura.
 *
 * Nao escreve nada no banco nem no storage: so LE e cospe HTML.
 *
 * A saida NAO leva <!doctype>/<html>/<head>/<body> -- e conteudo de pagina, para
 * ser publicada como artifact.
 *
 *   docker exec -e NODE_PATH=/app/node_modules painel-sst-app \
 *     node /tmp/previa-miniaturas.cjs > /tmp/previa.html
 */

const sharp = require("sharp");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const MAX_PX = 320;
const QUALIDADE = 75;
const QUANTOS = 6;

// Medido no ensaio completo em 2026-08-10 (126 fotos, 0 falhas).
const TOTAIS = { fotos: 126, antes: "265,1 MB", depois: "1,1 MB", reducao: "99,6%" };

const ENDPOINT = process.env.NEXT_PUBLIC_STORAGE_ENDPOINT;
const BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "fotos";
const PGRST = process.env.POSTGREST_INTERNAL_URL || process.env.NEXT_PUBLIC_POSTGREST_URL;
const TOKEN = process.env.POSTGREST_SERVICE_TOKEN;

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: process.env.STORAGE_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
});

const STATUS_LABEL = {
  OPERANTE: "Em operação",
  MANUTENCAO: "Em manutenção",
  INATIVA: "Desativada",
  BAIXADA: "Baixada",
  RESERVA: "Reserva",
};

async function buffer(stream) {
  const p = [];
  for await (const c of stream) p.push(c);
  return Buffer.concat(p);
}
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

async function main() {
  const resp = await fetch(
    `${PGRST}/inventario_maquinas?select=id_maquina,nome,status,setor,foto_storage_path` +
      `&foto_storage_path=not.is.null&order=nome.asc`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  const todos = await resp.json();

  // Amostra espalhada pela lista, para nao pegar so fotos parecidas.
  const passo = Math.max(1, Math.floor(todos.length / QUANTOS));
  const amostra = [];
  for (let i = 0; i < todos.length && amostra.length < QUANTOS; i += passo) {
    amostra.push(todos[i]);
  }

  const blocos = [];
  for (const item of amostra) {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: item.foto_storage_path })
    );
    const original = await buffer(obj.Body);
    const meta = await sharp(original).metadata();

    const miniatura = await sharp(original)
      .rotate()
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALIDADE })
      .toBuffer();

    // Reducao NEUTRA so para a pagina nao pesar 5 MB por foto. Nao e o que vai
    // para producao -- serve de referencia do que a original mostra.
    const referencia = await sharp(original)
      .rotate()
      .resize(760, 760, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    blocos.push({
      nome: item.nome || item.id_maquina,
      id: item.id_maquina,
      status: STATUS_LABEL[item.status] || item.status || "—",
      setor: item.setor || null,
      dim: `${meta.width}×${meta.height}`,
      pesoOriginal: original.length,
      pesoMiniatura: miniatura.length,
      mini: miniatura.toString("base64"),
      ref: referencia.toString("base64"),
    });
  }

  const cards = blocos
    .map(
      (b) => `
      <article class="card">
        <img class="card-foto" src="data:image/jpeg;base64,${b.mini}" alt="" width="64" height="64">
        <div class="card-txt">
          <p class="card-nome">${esc(b.nome)}</p>
          <p class="card-sub">${esc(b.setor || b.id)}</p>
        </div>
        <span class="pill">${esc(b.status)}</span>
      </article>`
    )
    .join("");

  const comparacoes = blocos
    .map(
      (b) => `
    <section class="cmp">
      <header class="cmp-head">
        <h3>${esc(b.nome)}</h3>
        <p class="dados">
          <span class="mono">${esc(b.id)}</span>
          <span class="sep">/</span>${b.dim} px
          <span class="sep">/</span><b class="mono">${kb(b.pesoOriginal)}</b>
          <span class="seta">→</span><b class="mono">${kb(b.pesoMiniatura)}</b>
          <span class="ganho mono">−${(100 * (1 - b.pesoMiniatura / b.pesoOriginal)).toFixed(1)}%</span>
        </p>
      </header>
      <div class="cmp-linha">
        <figure class="f-orig">
          <img src="data:image/jpeg;base64,${b.ref}" alt="Foto original de ${esc(b.nome)}">
          <figcaption><span class="rot">Original</span>abre ao clicar no equipamento</figcaption>
        </figure>
        <figure class="f-mini">
          <img src="data:image/jpeg;base64,${b.mini}" alt="Miniatura ampliada de ${esc(b.nome)}">
          <figcaption><span class="rot">Miniatura, ampliada</span>320 px — para julgar a qualidade</figcaption>
        </figure>
        <figure class="f-real">
          <img class="real" src="data:image/jpeg;base64,${b.mini}" alt="Miniatura no tamanho real" width="64" height="64">
          <figcaption><span class="rot destaque">Tamanho real</span>64 px — é só isto que a lista mostra</figcaption>
        </figure>
      </div>
    </section>`
    )
    .join("");

  process.stdout.write(`<title>Prévia — miniaturas do inventário</title>
<style>
  :root{
    --ground:#F2F5F8; --surface:#FFFFFF; --ink:#15202B; --muted:#5F6E7C;
    --line:#DCE3EA; --line-forte:#C3CDD7; --accent:#1F5C8B; --accent-fraco:#E8EFF6;
    --ganho:#17624A; --chip:#E9EEF3;
    --sombra:0 1px 2px rgba(21,32,43,.06), 0 1px 8px rgba(21,32,43,.04);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --ground:#0F151B; --surface:#18212A; --ink:#E6EDF4; --muted:#94A2B0;
      --line:#26313C; --line-forte:#38454F; --accent:#77AEDA; --accent-fraco:#1B2A38;
      --ganho:#54C79A; --chip:#212C37;
      --sombra:0 1px 2px rgba(0,0,0,.4), 0 1px 8px rgba(0,0,0,.25);
    }
  }
  :root[data-theme="dark"]{
    --ground:#0F151B; --surface:#18212A; --ink:#E6EDF4; --muted:#94A2B0;
    --line:#26313C; --line-forte:#38454F; --accent:#77AEDA; --accent-fraco:#1B2A38;
    --ganho:#54C79A; --chip:#212C37;
    --sombra:0 1px 2px rgba(0,0,0,.4), 0 1px 8px rgba(0,0,0,.25);
  }

  *{box-sizing:border-box}
  body{
    background:var(--ground); color:var(--ink);
    font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    margin:0; padding:32px 20px 72px;
  }
  .mono,.rot,.num,.dados{font-family:ui-monospace,"Cascadia Mono",Consolas,"Liberation Mono",monospace}
  .wrap{max-width:940px;margin:0 auto;display:flex;flex-direction:column;gap:28px}

  /* ── Cabeçalho ─────────────────────────────────────────── */
  .topo{display:flex;flex-direction:column;gap:10px;
    border-left:3px solid var(--accent);padding:2px 0 2px 18px}
  .olho{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0}
  h1{font-size:clamp(24px,4vw,32px);line-height:1.15;letter-spacing:-.02em;margin:0;text-wrap:balance}
  .lede{margin:0;color:var(--muted);max-width:62ch}
  .lede b{color:var(--ink)}

  /* ── Números ───────────────────────────────────────────── */
  .placar{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;
    background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .celula{background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:3px}
  .rotulo{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .num{font-size:23px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .celula.destaque .num{color:var(--ganho)}

  /* ── Simulação da lista ────────────────────────────────── */
  .bloco{display:flex;flex-direction:column;gap:14px}
  h2{font-size:19px;letter-spacing:-.01em;margin:0;text-wrap:balance}
  .nota{margin:0;color:var(--muted);font-size:14.5px;max-width:62ch}
  .grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
  .card{display:flex;gap:12px;align-items:center;background:var(--surface);
    border:1px solid var(--line);border-radius:10px;padding:12px;box-shadow:var(--sombra)}
  .card-foto{width:64px;height:64px;flex:0 0 64px;object-fit:cover;border-radius:7px;background:var(--chip)}
  .card-txt{min-width:0;flex:1}
  .card-nome{margin:0;font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .card-sub{margin:2px 0 0;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pill{flex:0 0 auto;align-self:flex-start;font-size:10px;font-weight:700;letter-spacing:.02em;
    background:var(--accent-fraco);color:var(--accent);border-radius:99px;padding:3px 9px}

  /* ── Comparações ───────────────────────────────────────── */
  .cmp{background:var(--surface);border:1px solid var(--line);border-radius:12px;
    padding:18px 20px 20px;box-shadow:var(--sombra);display:flex;flex-direction:column;gap:16px}
  .cmp-head{display:flex;flex-direction:column;gap:4px}
  .cmp h3{margin:0;font-size:16.5px;letter-spacing:-.01em}
  .dados{margin:0;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;
    display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
  .dados b{color:var(--ink);font-weight:600}
  .sep{color:var(--line-forte)}
  .seta{color:var(--muted)}
  .ganho{color:var(--ganho);font-weight:700}
  .cmp-linha{display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap}
  figure{margin:0;display:flex;flex-direction:column;gap:8px}
  figure img{display:block;border-radius:8px;border:1px solid var(--line);background:var(--chip);
    max-width:100%;height:auto}
  .f-orig img{width:340px}
  .f-mini img{width:200px}
  .f-real img.real{width:64px;height:64px;object-fit:cover;
    outline:2px solid var(--accent);outline-offset:3px}
  figcaption{font-size:11.5px;color:var(--muted);line-height:1.45;max-width:24ch}
  .rot{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}
  .rot.destaque{color:var(--accent)}

  /* ── Rodapé ────────────────────────────────────────────── */
  .rodape{border-top:1px solid var(--line);padding-top:20px;
    display:flex;flex-direction:column;gap:8px;color:var(--muted);font-size:14px}
  .rodape b{color:var(--ink)}
  .rodape ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px}

  @media (max-width:640px){
    body{padding:22px 14px 56px}
    .cmp-linha{gap:18px}
    .f-orig img{width:100%}
  }
</style>

<div class="wrap">

  <header class="topo">
    <p class="olho">Prévia antes de subir · 10 ago 2026</p>
    <h1>As miniaturas do inventário</h1>
    <p class="lede">A lista de equipamentos baixa hoje a <b>foto inteira, do tamanho que saiu do celular</b>,
      para desenhar um quadradinho de 64 pixels. A mudança guarda uma cópia pequena só para a lista —
      <b>a foto original continua intacta</b> e é ela que abre quando você clica no equipamento.
      Fotos reais da produção, medidas hoje.</p>
  </header>

  <div class="placar">
    <div class="celula"><span class="rotulo">Fotos medidas</span><span class="num">${TOTAIS.fotos}</span></div>
    <div class="celula"><span class="rotulo">Falhas</span><span class="num">0</span></div>
    <div class="celula"><span class="rotulo">A lista baixava</span><span class="num">${TOTAIS.antes}</span></div>
    <div class="celula"><span class="rotulo">Passa a baixar</span><span class="num">${TOTAIS.depois}</span></div>
    <div class="celula destaque"><span class="rotulo">Redução</span><span class="num">${TOTAIS.reducao}</span></div>
  </div>

  <section class="bloco">
    <h2>É assim que a lista vai ficar</h2>
    <p class="nota">Estes são os cards do inventário, montados com as miniaturas de verdade,
      no tamanho de verdade. <b>Se aqui estiver bom, a mudança está boa</b> — nenhuma outra
      tela usa a miniatura.</p>
    <div class="grade">${cards}
    </div>
  </section>

  <section class="bloco">
    <h2>Lado a lado</h2>
    <p class="nota">A mesma foto em três tamanhos: como ela é hoje, a miniatura ampliada
      para você julgar a qualidade, e a miniatura no tamanho real.</p>
    ${comparacoes}
  </section>

  <footer class="rodape">
    <p><b>O que esta prévia prova:</b> que o peso despenca e que a miniatura aguenta o tamanho em que é usada.</p>
    <p><b>O que ela não prova:</b> como a tela inteira se comporta com as 142 linhas carregadas de uma vez.
      Isso só na tela real, depois do deploy.</p>
    <ul>
      <li>Nada foi escrito: nem no banco, nem no armazenamento. O ensaio só leu.</li>
      <li>A original nunca é tocada — o mutirão apenas lê dela para gerar a cópia pequena.</li>
      <li>O inventário cresceu de 136 para 142 itens durante a medição de hoje: há gente cadastrando agora.</li>
    </ul>
  </footer>

</div>
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
