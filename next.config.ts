import type { NextConfig } from "next";
import path from "node:path";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // Necessário para empacotar o Next.js dentro do Electron (produção desktop).
  // Compatível com Vercel — ignorado pela plataforma no deploy web.
  output: "standalone",
  // Silencia o aviso "multiple lockfiles detected" — força este projeto
  // como raiz mesmo quando há um lockfile no diretório pai.
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["xlsx"],
  // Impede o webpack de tentar empacotar os módulos nativos do Puppeteer.
  // Eles são carregados via require() em runtime pelo Node.js (nunca bundlados).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  // Força a inclusão dos binários do Chromium no bundle de deploy do Vercel.
  // Sem isto, o file-tracing do Next.js não inclui os .br do sparticuz.
  outputFileTracingIncludes: {
    "/api/pdf/aep/[id]": ["./node_modules/@sparticuz/chromium/**/*"],
  },
  async redirects() {
    return [
      // O módulo "Projeção de Produtividade" saiu em 2026-09-23 (DIM-01), substituído
      // pelo /dimensionamento. As TELAS saem agora; as 7 tabelas prod_* continuam no
      // banco por enquanto — o drop (v254) só entra depois que uma release realmente
      // sair, senão a área de trabalho instalada fica com tela viva sobre tabela morta.
      //
      // 307 e não 308: o endereço novo NÃO é o mesmo conteúdo com outro nome. Cravar
      // permanente no cache do navegador de quem tinha o link antigo seria apostar que
      // a equivalência é definitiva — e o módulo novo é admin-only, então parte de quem
      // tinha o antigo vai bater em /modulos de propósito.
      {
        source: "/produtividade",
        destination: "/dimensionamento",
        permanent: false,
      },
      {
        source: "/produtividade/:caminho*",
        destination: "/dimensionamento",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Permite servir fotos do Supabase Storage.
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  webpack: (config) => {
    // O @digitalpersona/devices depende do 'WebSdk', que foi feito para carregar
    // via <script> (public/vendor/websdk.client.ui.min.js) — autocontido, já
    // inclui a lib `async`. Empacotar o websdk pelo webpack quebra o wiring
    // interno do async (async.waterfall = undefined). Então tratamos 'WebSdk'
    // como EXTERNAL global: o SDK passa a usar window.WebSdk (setado pelo script).
    // Aplica-se aos dois bundles (o server compila o módulo mesmo sendo dynamic
    // import client-only; nunca executa lá — o wrapper é guardado por window).
    const ext = config.externals || [];
    config.externals = [
      ...(Array.isArray(ext) ? ext : [ext]),
      { WebSdk: "WebSdk" },
    ];
    return config;
  },
};

export default nextConfig;
