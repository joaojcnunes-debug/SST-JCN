import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { montarLote } from "@/lib/dimensionamento/transformar";

export const dynamic = "force-dynamic";

/**
 * Sincronização do Dimensionamento com a API externa de SST (DIM-01, Fase 3).
 *
 * Porte da Edge Function `sincronizar-sst` do Chabra Dimensiona, com três
 * diferenças que valem ser lidas antes de mexer:
 *
 *  1. **Sem `service_role`.** Tudo roda com a SESSÃO DO PRÓPRIO USUÁRIO: o mesmo
 *     cliente que valida quem chamou é o que lê `dim_unidades`/`dim_clientes_porte`
 *     e chama a RPC. A RLS admin-only e a guarda `caller_eh_admin()` valem de ponta
 *     a ponta, e não existe caminho privilegiado para alguém achar depois. Na origem
 *     a função usava a chave de serviço porque rodava fora de qualquer sessão.
 *
 *  2. **Admin sempre.** A origem liberava quando `auth.uid()` era nulo, para o
 *     agendamento passar. Aqui não há caminho anônimo a acomodar — o botão da tela é
 *     o único chamador (D4: agendamento fica para depois).
 *
 *  3. **Credencial só depois de identificar quem chamou.** O 503 de "credencial
 *     ausente" vem DEPOIS do 401/403. Dizer a um anônimo *quais* segredos faltam no
 *     servidor é informação que ele não precisa ter.
 *
 * As credenciais (`CHABRA_API_BASE`, `CHABRA_CF_ID`, `CHABRA_CF_SECRET`, `CHABRA_JWT`)
 * vivem no bundle `/srv/chabra/painel-sst-secrets/.env.painel` E na allow-list do
 * `painel-sst-compose.yml` — var que falta num dos dois interpola vazia e o app sobe
 * fail-closed, sem erro visível.
 *
 * Entrada: POST { ano?: number, aplicar?: boolean }   — `aplicar: false` = prévia.
 */

const API_PADRAO = "https://api.chabra.com.br/v1";

/** Aceita o segredo com texto em volta ("opcional; padrão https://…") e cai no padrão. */
function baseDaApi(valor: string | undefined): string {
  const achado = /https?:\/\/[^\s"']+/i.exec(valor ?? "");
  return (achado ? achado[0] : API_PADRAO).replace(/\/+$/, "");
}

interface Credenciais {
  base: string;
  cabecalhos: Record<string, string>;
}

/** GET na API com retentativa em 429 e parada imediata em 401 (credencial recusada). */
async function apiGet(
  cred: Credenciais,
  caminho: string,
  params: Record<string, string>,
  tentativa = 0,
): Promise<unknown[]> {
  const url = `${cred.base}/${caminho}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: cred.cabecalhos, cache: "no-store" });

  if (res.status === 429 && tentativa < 5) {
    const espera = (Number(res.headers.get("retry-after") ?? "1") || 1) * 1000 * 2 ** tentativa;
    await new Promise((r) => setTimeout(r, espera));
    return apiGet(cred, caminho, params, tentativa + 1);
  }
  // 401 não se repete: repetir com credencial recusada só gasta o rate limit da origem
  if (res.status === 401) {
    throw new Error("A API recusou a credencial (401). Confira o JWT no cofre e avise a TI.");
  }
  if (res.status === 403 || res.status === 302) {
    throw new Error("A borda (Cloudflare Access) recusou a chamada: confira o par CF-Access-Client-Id/Secret.");
  }
  if (!res.ok) {
    throw new Error(`A API respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as unknown[];
}

/** Pagina até esgotar (teto de 1.000 por resposta), sempre com ordenação determinística. */
async function apiTodos(
  cred: Credenciais,
  caminho: string,
  params: Record<string, string>,
): Promise<unknown[]> {
  const saida: unknown[] = [];
  for (let offset = 0; ; offset += 1000) {
    const pagina = await apiGet(cred, caminho, {
      ...params,
      order: params.order ?? "id",
      limit: "1000",
      offset: String(offset),
    });
    saida.push(...pagina);
    if (pagina.length < 1000) return saida;
    if (offset > 200000) return saida; // guarda contra laço infinito
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // 1. Sessão
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller?.email) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  // 2. Admin (perfil lido da .107 com o JWT do próprio chamador)
  const { data: callerRow } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("email", caller.email.toLowerCase())
    .single();
  if ((callerRow as { perfil?: string } | null)?.perfil !== "Admin") {
    return NextResponse.json(
      { ok: false, error: "Apenas administradores sincronizam o dimensionamento" },
      { status: 403 },
    );
  }

  // 3. Só agora: o estado das credenciais do servidor não é informação pública
  const cfId = process.env.CHABRA_CF_ID ?? "";
  const cfSecret = process.env.CHABRA_CF_SECRET ?? "";
  const jwt = process.env.CHABRA_JWT ?? "";
  if (!cfId || !cfSecret || !jwt) {
    const faltando = [
      !cfId && "CHABRA_CF_ID",
      !cfSecret && "CHABRA_CF_SECRET",
      !jwt && "CHABRA_JWT",
    ].filter(Boolean);
    return NextResponse.json(
      {
        ok: false,
        error: `Credenciais da API não configuradas no servidor: ${faltando.join(", ")}. ` +
          "Elas precisam existir no bundle .env.painel E na allow-list do compose.",
      },
      { status: 503 },
    );
  }
  const cred: Credenciais = {
    base: baseDaApi(process.env.CHABRA_API_BASE),
    cabecalhos: {
      "CF-Access-Client-Id": cfId,
      "CF-Access-Client-Secret": cfSecret,
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
    },
  };

  // 4. Corpo
  let corpo: { ano?: unknown; aplicar?: unknown } = {};
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    /* corpo vazio é válido: assume ano corrente e aplicar=true */
  }
  const ano = Number(corpo.ano) || new Date().getFullYear();
  const aplicar = corpo.aplicar !== false;
  if (ano < 2000 || ano > 2100) {
    return NextResponse.json({ ok: false, error: "Ano inválido" }, { status: 400 });
  }

  try {
    // 5. Cadastro local (pela sessão do usuário — a RLS admin-only se aplica)
    const { data: unidades, error: erroUnidades } = await supabase
      .from("dim_unidades")
      .select("id, nome, codigo_api");
    if (erroUnidades) {
      throw new Error(`Não foi possível ler as unidades: ${erroUnidades.message}`);
    }
    const { data: clientes } = await supabase
      .from("dim_clientes_porte")
      .select("codigo, cnpj, porte, condicao");

    const classificacao = {
      porCnpj: {} as Record<string, unknown>,
      porCodigo: {} as Record<string, unknown>,
    };
    for (const c of (clientes ?? []) as Array<Record<string, string | null>>) {
      const dado = { porte: c.porte, condicao: c.condicao };
      if (c.cnpj) classificacao.porCnpj[String(c.cnpj).replace(/\D+/g, "")] = dado;
      if (c.codigo) classificacao.porCodigo[String(c.codigo)] = dado;
    }

    // 6. Cobertura por unidade — manda no que pode ser gravado
    const cobertura = await apiGet(cred, "sincronizacao", {
      select: "unidade,cobertura,ultima_varredura_em,status_varredura,documentos_sst,cobertura_motivo",
    });
    const utilizaveis = (cobertura as Array<Record<string, string>>)
      .filter((c) => ["ok", "parcial", "desatualizado"].includes(c.cobertura))
      .map((c) => c.unidade);

    // 7. Documentos: vencimentos do ano (corrente) + emissões do ano (inclui substituídos)
    let documentos: unknown[] = [];
    if (utilizaveis.length) {
      const campos = "id,unidade,tipo,numero,emitido_em,vence_em,vigente,estado,empresa_id,empresa_cnpj,empresa_razao_social";
      const filtroUnidade = `in.(${utilizaveis.join(",")})`;
      const vencendo = await apiTodos(cred, "documentos", {
        unidade: filtroUnidade,
        vigente: "is.true",
        vence_em: `gte.${ano}-01-01`,
        and: `(vence_em.lte.${ano}-12-31)`,
        select: campos,
      });
      const emitidos = await apiTodos(cred, "documentos", {
        unidade: filtroUnidade,
        emitido_em: `gte.${ano}-01-01`,
        and: `(emitido_em.lte.${ano}-12-31)`,
        select: campos,
      });
      const porId = new Map<string, unknown>();
      for (const d of [...vencendo, ...emitidos] as Array<Record<string, unknown>>) {
        porId.set(String(d.id), d);
      }
      documentos = [...porId.values()];
    }

    // 8. Transformação pura (mesma função que os 12 testes de `transformar.test.ts` cobrem)
    const lote = montarLote({ ano, cobertura, documentos, unidades: unidades ?? [], classificacao });

    if (!aplicar) {
      return NextResponse.json({ ok: true, previa: true, ...lote });
    }

    // 9. Grava pela RPC (que também exige Admin — segunda tranca, no banco)
    const { error: erroRpc } = await supabase.rpc("dim_aplicar_sincronizacao_sst" as never, {
      p_payload: {
        ano,
        unidades: lote.unidades.map((u) => ({
          unidade_id: u.unidade_id,
          codigo_api: u.codigo_api,
          cobertura: u.cobertura,
          ultima_varredura_em: u.ultima_varredura_em,
          documentos: u.documentos,
          aplicar: u.aplicar,
          mensagem: u.mensagem,
          demanda: u.demanda,
          atendidas: u.atendidas,
        })),
      },
    } as never);
    if (erroRpc) throw new Error(`Falha ao gravar: ${erroRpc.message}`);

    return NextResponse.json({
      ok: true,
      aplicado: true,
      ano,
      resumo: lote.resumo,
      unidades: lote.unidades.map((u) => ({
        codigo_api: u.codigo_api,
        unidade: u.unidade_nome,
        cobertura: u.cobertura,
        aplicar: u.aplicar,
        demanda: u.totalDemanda,
        atendidas: u.totalAtendidas,
        mensagem: u.mensagem,
      })),
      naoClassificados: lote.naoClassificados.slice(0, 200),
    });
  } catch (e) {
    // 502: o erro veio de FORA (API, borda) ou da gravação — não é culpa do pedido
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
