import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy server-side da consulta de CEP, para o endereço de destino da saída.
 *
 * POR QUE NÃO `fetch` DIRETO DO NAVEGADOR: o painel também roda em Electron, e o
 * CSP do renderer bloqueia `connect-src` externo — foi exatamente o que quebrou
 * a consulta de CNPJ com "Failed to fetch" antes de virar
 * `app/api/cnpj/[cnpj]/route.ts`. Mesmo problema, mesma solução: o fetch roda no
 * servidor, sem CORS e sem CSP.
 *
 * Dois provedores: ViaCEP primeiro, BrasilAPI como fallback. Se os dois
 * falharem, devolve 502 e o formulário degrada para digitação manual — que
 * continua sempre disponível. CEP é conveniência, não requisito: o endereço
 * mínimo (logradouro, cidade, UF) pode ser digitado inteiro.
 */

type Endereco = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cep: string }> },
) {
  const { cep } = await params;
  const digitos = (cep ?? "").replace(/\D/g, "");
  if (digitos.length !== 8) {
    return NextResponse.json({ error: "CEP deve ter 8 dígitos." }, { status: 400 });
  }

  // 1) ViaCEP
  try {
    const r = await fetchComTimeout(`https://viacep.com.br/ws/${digitos}/json/`, 6000);
    if (r.ok) {
      const d = (await r.json()) as Record<string, unknown>;
      // ViaCEP responde 200 com { erro: true } para CEP inexistente.
      if (d.erro) {
        return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
      }
      return NextResponse.json(
        {
          cep: formatarCep(digitos),
          logradouro: String(d.logradouro ?? ""),
          bairro: String(d.bairro ?? ""),
          cidade: String(d.localidade ?? ""),
          uf: String(d.uf ?? ""),
        } satisfies Endereco,
        { status: 200 },
      );
    }
  } catch {
    // cai para o fallback
  }

  // 2) BrasilAPI — mesmo provedor que a consulta de CNPJ já usa
  try {
    const r = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v1/${digitos}`, 6000);
    if (r.status === 404) {
      return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
    }
    if (r.ok) {
      const d = (await r.json()) as Record<string, unknown>;
      return NextResponse.json(
        {
          cep: formatarCep(digitos),
          logradouro: String(d.street ?? ""),
          bairro: String(d.neighborhood ?? ""),
          cidade: String(d.city ?? ""),
          uf: String(d.state ?? ""),
        } satisfies Endereco,
        { status: 200 },
      );
    }
  } catch {
    // cai no erro abaixo
  }

  return NextResponse.json(
    { error: "Consulta de CEP indisponível. Digite o endereço." },
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

const formatarCep = (d: string) => `${d.slice(0, 5)}-${d.slice(5)}`;
