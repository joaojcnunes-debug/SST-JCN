# Deploy do SST-JCN na Vercel

A partir de 2026-09-24 o SST-JCN é **só web**. A camada Electron (empacotamento,
auto-atualização, fila offline em SQLite e o helper nativo de digital) saiu do
repositório; o histórico do git guarda tudo, caso um dia precise voltar.

## O que mudou no repositório

| Saiu | Por quê |
|---|---|
| `electron/`, `electron-builder.yml`, `scripts/launch-electron.js`, `scripts/fix-standalone-modules.js`, `scripts/publish-update.js` | empacotamento do desktop |
| `native/EpiFingerprint/` | helper C# que só o Electron chamava (`extraResources`) |
| `.github/workflows/release.yml` | publicava o instalador; a Vercel faz deploy por integração com o git |
| deps `electron`, `electron-builder`, `electron-updater`, `@electron/rebuild`, `better-sqlite3`, `@types/better-sqlite3`, `concurrently`, `wait-on`, `cross-env` | idem |
| `output: "standalone"` do `next.config.ts` | existia para o Electron embutir o servidor Next |

**Ficaram** as guardas `isElectron` espalhadas em 6 arquivos do app. Elas não são
resíduo: é o que faz o caminho web se comportar certo (o service worker, por
exemplo, só registra quando NÃO é Electron). Com a resposta sempre falsa, o
comportamento é o desejado.

**A digital continua funcionando.** Ela nunca dependeu do Electron: a modal de
EPI usa `lib/epi/digitalPersona.ts`, que carrega o `@digitalpersona/websdk` pelo
`/vendor/websdk.client.ui.min.js` e fala com o agente DigitalPersona instalado na
máquina do usuário. O que exige, isso sim, é HTTPS e o agente instalado.

## Variáveis de ambiente na Vercel

### Obrigatórias

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | endereço do projeto Supabase do JCN |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública (RLS manda) |
| `SUPABASE_SERVICE_ROLE_KEY` | rotas de serviço: assinatura de PDF, certificado, formulário da Gestão, agenda Google, ICS |

Sem a terceira, `createSupabaseServiceClient()` lança e essas rotas devolvem 500.

### Por funcionalidade (cada uma desliga só o seu módulo)

| Variável | Liga |
|---|---|
| `GROQ_API_KEY` | leitura de fotos por IA |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GESTAO_GOOGLE_ENC_KEY` | agenda Google da Gestão — **enquanto faltarem, `gestao_google_fila` enche sem drenar** |
| `SGG_WEBHOOK_SOCKET`, `SGG_WEBHOOK_HMAC_SECRET` | envio de riscos ao SGG |
| `CHABRA_API_BASE`, `CHABRA_JWT`, `CHABRA_CF_ID`, `CHABRA_CF_SECRET`, `MESTRES_POSTGREST_URL` | integrações da Chabra — provavelmente **não se aplicam ao JCN** |
| `EPI_MATCHER_URL` | matcher biométrico externo |
| `PDF_SERVICE_URL`, `PDF_SERVICE_SECRET`, `PDF_IMG_BASE_URL` | serviço de PDF externo (opcional) |
| `AUTH_INTERNAL_URL` | endereço interno de auth |

### Não configure

`STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_STORAGE_ENDPOINT`,
`NEXT_PUBLIC_STORAGE_PUBLIC_ENDPOINT` — são do S3 do painel self-host. O JCN usa o
Storage do Supabase; `lib/storage/signed-url.ts` pula esse trecho quando estão vazias.

`PDF_USE_SPARTICUZ` também não: na Vercel o `lib/pdf/gerar-pdf.ts` já detecta a
plataforma pela variável `VERCEL` e usa o `@sparticuz/chromium` sozinho.

## Do lado do Supabase

Depois de saber o domínio da Vercel, ajustar em **Authentication › URL
Configuration**:

- **Site URL** → o domínio de produção
- **Redirect URLs** → o domínio de produção **e** `https://*.vercel.app` para os
  deploys de prévia, senão o login quebra em toda branch

## Pontos de atenção

**Tempo das funções.** As 15 rotas de PDF declaram `maxDuration = 60`. No plano
Hobby o teto é menor; se um PDF grande cortar no meio, é isso. O `/api/pdf/aep/[id]`
é o que usa Chromium — os outros montam o PDF sem navegador.

**Service worker.** A identidade dele é `/sw.js?v=<id>`, e desde esta mudança o
`<id>` é o SHA do commit (`NEXT_PUBLIC_BUILD_ID`), não a versão do `package.json`.
Antes, dois deploys sem bump de versão deixariam todo mundo na casca em cache.

**A auditoria já sabe quem é o servidor.** A v256 lê `X-Painel-Ator` e
`X-Painel-Origem` das rotas de serviço; isso funciona igual na Vercel.
