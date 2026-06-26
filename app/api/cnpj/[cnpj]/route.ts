import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy server-side da consulta de CNPJ.
 *
 * Antes o componente fazia `fetch` direto para a BrasilAPI no navegador, o que
 * quebrava com "Failed to fetch" no app Electron (CSP do renderer bloqueia
 * connect-src externo) e ficava sujeito a CORS/instabilidade no web.
 *
 * Aqui o fetch roda no servidor (sem CORS/CSP) e devolvemos o JSON no mesmo
 * formato que o componente já consome (campos da BrasilAPI). Há um provedor de
 * fallback (CNPJ.ws público) mapeado para os mesmos campos.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const { cnpj } = await params;
  const digitos = (cnpj ?? "").replace(/\D/g, "");
  if (digitos.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ deve ter 14 dígitos." },
      { status: 400 },
    );
  }

  // 1) BrasilAPI (formato já esperado pelo componente)
  try {
    const r = await fetchComTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${digitos}`,
      8000,
    );
    if (r.status === 404) {
      return NextResponse.json(
        { error: "CNPJ não encontrado na Receita." },
        { status: 404 },
      );
    }
    if (r.ok) {
      const d = await r.json();
      return NextResponse.json(d, { status: 200 });
    }
  } catch {
    // cai para o fallback
  }

  // 2) Fallback: CNPJ.ws público — mapeado para os campos da BrasilAPI
  try {
    const r = await fetchComTimeout(
      `https://publica.cnpj.ws/cnpj/${digitos}`,
      8000,
    );
    if (r.status === 404) {
      return NextResponse.json(
        { error: "CNPJ não encontrado na Receita." },
        { status: 404 },
      );
    }
    if (r.ok) {
      const d = await r.json();
      return NextResponse.json(mapearCnpjWs(d), { status: 200 });
    }
  } catch {
    // ambos falharam
  }

  return NextResponse.json(
    { error: "Serviço de consulta de CNPJ indisponível no momento." },
    { status: 502 },
  );
}

function fetchComTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    signal: ctrl.signal,
    headers: { Accept: "application/json" },
  }).finally(() => clearTimeout(t));
}

/** Converte a resposta do CNPJ.ws público para o shape da BrasilAPI. */
function mapearCnpjWs(d: Record<string, unknown>): Record<string, unknown> {
  const est = (d.estabelecimento ?? {}) as Record<string, unknown>;
  const estado = (est.estado ?? {}) as Record<string, unknown>;
  const cidade = (est.cidade ?? {}) as Record<string, unknown>;
  const atividade = (est.atividade_principal ?? {}) as Record<string, unknown>;
  const ddd = (est.ddd1 ?? "") as string;
  const tel = (est.telefone1 ?? "") as string;
  return {
    razao_social: d.razao_social ?? "",
    nome_fantasia: est.nome_fantasia ?? "",
    cep: est.cep ?? "",
    logradouro:
      [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" ").trim() ||
      "",
    numero: est.numero ?? "",
    complemento: est.complemento ?? "",
    bairro: est.bairro ?? "",
    municipio: cidade.nome ?? "",
    uf: estado.sigla ?? "",
    ddd_telefone_1: [ddd, tel].filter(Boolean).join(" ").trim(),
    email: est.email ?? "",
    cnae_fiscal: atividade.id ?? atividade.subclasse ?? "",
    cnae_fiscal_descricao: atividade.descricao ?? "",
    descricao_situacao_cadastral: est.situacao_cadastral ?? "",
    porte: (d.porte as Record<string, unknown>)?.descricao ?? "",
  };
}
