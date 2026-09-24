import {
  createBrowserClient,
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  // Aviso visível em runtime em vez de quebrar silenciosamente.
  // Em dev fica fácil descobrir; em prod, o build falha rápido se faltar.
  if (typeof window !== "undefined") {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidas em .env.local"
    );
  }
}

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(url, anonKey);
}

// Server client: usado em Route Handlers, Server Actions e Server Components.
// Recebe `cookies()` do next/headers (passado pelo chamador para evitar
// importar next/headers em arquivos client).
type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set?: (name: string, value: string, options?: CookieOptions) => void;
};

/**
 * Client com SERVICE_ROLE — bypassa RLS. USAR SOMENTE em Route Handlers/Server
 * Actions, e SOMENTE depois de validar auth/autorização manualmente na rota.
 * Nunca importar/chamar em código client (a chave não tem prefixo NEXT_PUBLIC,
 * então é undefined no browser e a função lança erro).
 */
// v256 — QUEM está por trás da gravação. O token de serviço não carrega pessoa,
// e a auditoria (v212) gravava "Servidor (rota de serviço)" sem nome. A rota
// passa o e-mail de quem ela já autenticou (se houver) e de ONDE veio a
// gravação; o gatilho de auditoria só lê esses cabeçalhos quando o role é
// service_role — do navegador eles são ignorados, não dá para se passar por outro.
//
// No JCN os cabeçalhos entram por `global.headers` do SDK do Supabase, e não
// pelo fetch do cliente PostgREST próprio como no painel self-host. Mesmo
// contrato do lado do banco: X-Painel-Ator e X-Painel-Origem.
export interface AtorServico {
  /** E-mail do usuário que a rota autenticou; null quando não há pessoa (webhook, formulário público). */
  email: string | null | undefined;
  /** De onde veio a gravação, curto e ASCII — ex.: "usuarios/criar", "formulario-publico". */
  origem: string;
}

function cabecalhosDoAtor(ator: AtorServico): Record<string, string> {
  const h: Record<string, string> = { "X-Painel-Origem": ator.origem.replace(/[^ -~]/g, "") };
  const email = ator.email?.trim().toLowerCase();
  if (email && /^[!-~]+$/.test(email)) h["X-Painel-Ator"] = email;
  return h;
}

export function createSupabaseServiceClient(ator: AtorServico) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: cabecalhosDoAtor(ator) },
  });
}

export function createSupabaseServerClient(cookieStore: CookieStore) {
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookies) {
        if (!cookieStore.set) return;
        for (const { name, value, options } of cookies) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Ignorar: chamado em contexto onde cookies são read-only
            // (ex: Server Components fora de Route Handlers).
          }
        }
      },
    },
  });
}

/**
 * Tipo do cliente que as funcoes deste modulo devolvem.
 *
 * O painel-sst declara um `ComposedSupabaseClient` proprio porque la o cliente e
 * uma composicao de Supabase Auth + PostgREST + storage MinIO do self-host. Aqui
 * o cliente e o do supabase-js puro, entao o tipo e so um apelido — existe para
 * que o codigo compartilhado que recebe "o client" continue compilando sem saber
 * de qual dos dois mundos ele veio.
 */
export type ComposedSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;
