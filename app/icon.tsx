// Favicon dinâmico do Painel SST Chabra.
//
// Tenta usar a logo configurada em public.configuracoes.logo_url
// (uploadada via /config → "Logo da Empresa"). Se não houver logo
// configurada ou falhar a leitura, cai num fallback elegante:
// fundo verde Chabra + letra "C" branca.
//
// O Next.js gera automaticamente o /icon e /favicon a partir deste
// arquivo (App Router). Cache de 10min via revalidate.

import { ImageResponse } from "next/og";

// Roda no Edge runtime — o ImageResponse precisa disso pra renderizar SVG/font
export const runtime = "edge";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

async function fetchLogoUrl(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/configuracoes?chave=eq.logo_url&select=valor`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        // revalida a cada 10 min — favicon não muda toda hora
        next: { revalidate: 600 },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ valor: unknown }>;
    const valor = data?.[0]?.valor;
    if (typeof valor === "string" && valor.startsWith("http")) {
      return valor;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function Icon() {
  const logoUrl = await fetchLogoUrl();

  if (logoUrl) {
    // Renderiza a logo customizada com fundo branco arredondado
    // (logos com fundo transparente ficam ilegíveis em escuro/claro)
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#ffffff",
            borderRadius: 12,
            padding: 4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            width={56}
            height={56}
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { ...size }
    );
  }

  // Fallback: letra "C" branca em fundo verde Chabra
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#006B54",
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: -2,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        C
      </div>
    ),
    { ...size }
  );
}
