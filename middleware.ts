import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/f/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permite assets e api públicas livremente.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Sem credenciais ainda? Não bloqueia para o dev conseguir abrir login.
  if (!url || !key || url === "PREENCHER" || key === "PREENCHER") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Supabase nao configurado no servidor." },
        { status: 500 }
      );
    }
    if (pathname !== "/login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Rota de API nao pode ser redirecionada para o login. O fetch do front
    // segue o 307, recebe o HTML da tela de login, o .json() falha e a tela
    // acaba mostrando a mensagem generica do catch — foi o que escondeu a causa
    // real do erro em /api/usuarios/credenciais. Para /api o certo e 401 com
    // corpo JSON, no mesmo formato { ok, error } que as rotas usam.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Sessao expirada. Entre de novo." },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, exceto: arquivos estáticos do Next, imagens e API auth do Supabase.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
