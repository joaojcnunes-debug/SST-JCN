/**
 * Service worker do Painel SST.
 *
 * O QUE ELE FAZ: deixa o app ABRIR sem internet. Só isso. Ele não guarda
 * relatório, não enfileira gravação e não sabe nada de checklist — quem faz isso
 * é `lib/offline/*`, do lado da aplicação. A divisão é proposital: o que o SW
 * enxerga é `POST /api/rest/v1/frota_checklists` com um JSON opaco; ele não tem
 * como saber que aquilo precisa da ordem foto → linha → finalizar por causa do
 * trigger `frota_exige_4_fotos`. Regra de negócio fica onde o negócio está.
 *
 * ESCRITO À MÃO, sem workbox: são ~150 linhas que dá para ler inteiras, contra
 * uma dependência nova + etapa de build num app que já empacota para Electron e
 * para Docker standalone. Menos peça móvel no pipeline.
 *
 * VERSÃO VIA QUERY STRING: o registro chama `/sw.js?v=0.3.522`. A URL faz parte
 * da identidade do worker — versão nova = worker novo = atualização detectada,
 * sem gerar arquivo em tempo de build.
 *
 * ⚠️ CLOUDFLARE ACCESS: todo o domínio está atrás do CF Access (verificado em
 * 14/08/2026 — `/api/health` e `/inicio` devolvem 302 para
 * messages-chabra.cloudflareaccess.com). Quando a sessão do CF expira, QUALQUER
 * pedido volta como HTML de login de OUTRA origem. Cachear isso envenenaria o
 * cache: o técnico abriria o app offline e veria uma tela de login morta, sem
 * saída. Por isso `respostaUtilizavel()` recusa tudo que foi redirecionado ou
 * que veio de outra origem — ver o uso abaixo.
 */

const VERSAO = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_ESTATICO = `painel-sst-estatico-${VERSAO}`;
const CACHE_PAGINAS = `painel-sst-paginas-${VERSAO}`;

/**
 * O mínimo para a casca abrir. Rotas dinâmicas (o veículo específico, a saída,
 * a inspeção) não entram aqui: elas chegam ao cache quando o técnico as visita
 * ainda na base — que é a mesma condição de já ter feito login antes de sair.
 *
 * As listas de módulo entram porque são o caminho: sem elas, o técnico offline
 * sai de `/inicio`, clica em Inspeções e bate na tela de "ainda não foi aberta
 * offline" antes de chegar ao documento que ele mesmo levou para o campo.
 *
 * `/pendencias` é o caso mais claro de todos. É a tela que existe justamente
 * para quando não há rede — ninguém a visita com sinal, então ela nunca cairia
 * no cache por visita. Fora do shell, ela é a única tela do app garantidamente
 * indisponível na hora em que é necessária.
 */
const SHELL = [
  "/inicio",
  "/modulos",
  "/pendencias",
  "/frota",
  "/frota/movimentacoes",
  "/inspecoes",
  "/relatorio-nao-conformidade",
  "/relatorio-conformidade",
  "/aet",
  "/aep",
  "/apreciacao-maquinas",
  "/equipamentos",
  "/icon-192.png",
  "/manifest.webmanifest",
];

/** Nunca passam pelo cache: são dados, e dado velho aqui é pior que erro de rede. */
function ehDados(url) {
  return (
    url.pathname.startsWith("/api/rest/v1") ||
    url.pathname.startsWith("/auth/v1") ||
    url.pathname.startsWith("/api/")
  );
}

/** Imutável por conteúdo — o Next põe hash no nome, então cache-first é seguro. */
function ehEstaticoImutavel(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Payload de navegação do App Router (RSC). É o que faz o clique entre telas
 *  funcionar offline depois que a tela foi visitada uma vez. */
function ehRsc(request, url) {
  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    (request.headers.get("Accept") || "").includes("text/x-component")
  );
}

/**
 * Dá para guardar esta resposta?
 *
 * As duas primeiras condições são o antídoto ao CF Access: `redirected` pega o
 * 302 para a tela de login e `origin` diferente pega qualquer coisa que não
 * saiu do nosso domínio. Sem elas, uma sessão expirada no meio do dia trocaria
 * a casca do app pelo HTML de login — e o técnico ficaria sem app no pátio.
 */
function respostaUtilizavel(resposta) {
  if (!resposta || !resposta.ok) return false;
  if (resposta.redirected) return false;
  try {
    if (new URL(resposta.url).origin !== self.location.origin) return false;
  } catch {
    return false;
  }
  return true;
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_PAGINAS);
      // `allSettled`: se uma rota do shell falhar (CF Access expirado bem na
      // hora da instalação), o worker instala mesmo assim com o que conseguiu.
      // Falhar a instalação inteira por causa de uma rota deixaria o app sem
      // service worker nenhum.
      await Promise.allSettled(
        SHELL.map(async (rota) => {
          const resposta = await fetch(rota, { credentials: "same-origin" });
          if (respostaUtilizavel(resposta)) await cache.put(rota, resposta);
        })
      );
    })()
  );
  // Sem skipWaiting de propósito: trocar o worker com o app aberto pode deixar
  // uma página já carregada pedindo chunk que o cache novo não tem ("chunk load
  // error" clássico pós-deploy). O worker novo assume no próximo start do app —
  // e o técnico fecha o app todo dia.
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n.startsWith("painel-sst-") && n !== CACHE_ESTATICO && n !== CACHE_PAGINAS)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return; // gravação é assunto da fila, não do SW
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // MinIO, fontes, etc.
  if (ehDados(url)) return; // PostgREST e GoTrue sempre na rede

  if (ehEstaticoImutavel(url)) {
    evento.respondWith(cacheAntes(request, CACHE_ESTATICO));
    return;
  }

  if (request.mode === "navigate" || ehRsc(request, url)) {
    evento.respondWith(redeAntes(request, CACHE_PAGINAS));
    return;
  }

  // Ícones, manifest e demais estáticos de /public.
  if (url.pathname.startsWith("/icon-") || url.pathname === "/manifest.webmanifest") {
    evento.respondWith(cacheAntes(request, CACHE_ESTATICO));
  }
});

async function cacheAntes(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const resposta = await fetch(request);
  if (respostaUtilizavel(resposta)) cache.put(request, resposta.clone());
  return resposta;
}

async function redeAntes(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  try {
    const resposta = await fetch(request);
    if (respostaUtilizavel(resposta)) {
      cache.put(request, resposta.clone());
      return resposta;
    }
    // Resposta veio, mas é o login do CF Access (ou erro). Não guardamos —
    // e devolvemos como está, para o usuário poder reautenticar na tela.
    return resposta;
  } catch {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    if (request.mode === "navigate") return paginaSemConexao();
    return Response.error();
  }
}

/**
 * Último recurso: a rota nunca foi visitada e não há rede. Uma tela honesta vale
 * mais que o dinossauro do Chrome — ela diz o que fazer (voltar ao que já está
 * aberto) em vez de sugerir que o app quebrou.
 */
function paginaSemConexao() {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão — Painel SST</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
         font-family: system-ui, -apple-system, sans-serif; background:#f6f7f8; color:#111; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#0f1211; color:#f3f4f6; } .cartao { background:#171a19 !important; } }
  .cartao { background:#fff; border-radius:16px; padding:32px 28px; max-width:420px; text-align:center;
            box-shadow:0 8px 30px rgba(0,0,0,.08); }
  .marca { width:56px; height:56px; border-radius:14px; background:#006B54; color:#fff; display:grid;
           place-items:center; font-size:30px; font-weight:800; margin:0 auto 18px; }
  h1 { font-size:19px; margin:0 0 10px; }
  p { font-size:14px; line-height:1.55; opacity:.75; margin:0 0 20px; }
  button { background:#006B54; color:#fff; border:0; border-radius:10px; padding:11px 20px;
           font-size:14px; font-weight:600; cursor:pointer; }
</style>
</head>
<body>
  <div class="cartao">
    <div class="marca">C</div>
    <h1>Esta tela ainda não foi aberta offline</h1>
    <p>O Painel SST funciona sem internet, mas só nas telas que você abriu enquanto ainda tinha sinal.
       O que você já registrou está guardado no aparelho e sobe sozinho quando a rede voltar.</p>
    <button onclick="history.back()">Voltar</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
