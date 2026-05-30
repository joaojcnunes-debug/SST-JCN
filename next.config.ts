import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Necessário para empacotar o Next.js dentro do Electron (produção desktop).
  // Compatível com Vercel — ignorado pela plataforma no deploy web.
  output: "standalone",
  // Silencia o aviso "multiple lockfiles detected" — força este projeto
  // como raiz mesmo quando há um lockfile no diretório pai.
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["xlsx"],
  images: {
    remotePatterns: [
      // Permite servir fotos do Supabase Storage.
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
