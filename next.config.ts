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
  images: {
    remotePatterns: [
      // Permite servir fotos do Supabase Storage.
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  webpack: (config, { webpack }) => {
    // O SDK @digitalpersona/devices usa o módulo-irmão 'WebSdk' de duas formas:
    // (1) como especificador de import nu -> resolvido pelo alias abaixo;
    // (2) como VARIÁVEL GLOBAL em runtime -> injetada pelo ProvidePlugin (senão
    //     dá "ReferenceError: WebSdk is not defined" no navegador).
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      WebSdk: path.resolve(__dirname, "node_modules/@digitalpersona/websdk"),
    };
    // WebSdk global + a lib `async` (o websdk usa `async.waterfall` como global).
    config.plugins.push(
      new webpack.ProvidePlugin({
        WebSdk: "@digitalpersona/websdk",
        async: "async",
      }),
    );
    return config;
  },
};

export default nextConfig;
