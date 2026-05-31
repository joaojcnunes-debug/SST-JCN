"use client";

import { Suspense, useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";

type ElectronAPI = {
  loadCredentials?: () => Promise<{ email: string; password: string } | null>;
  saveCredentials?: (email: string, password: string) => Promise<{ success: boolean }>;
  clearCredentials?: () => Promise<void>;
};

function getElectron(): ElectronAPI | undefined {
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useUserStore((s) => s.setUser);
  const { data: configs } = useConfiguracoes();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);

  const autoTriedRef = useRef(false);

  // Auto-login: tenta com credenciais salvas na primeira renderização
  useEffect(() => {
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;

    // Logout intencional — não faz auto-login
    if (sessionStorage.getItem("intentional-logout")) {
      sessionStorage.removeItem("intentional-logout");
      return;
    }

    const api = getElectron();
    if (!api?.loadCredentials) return;

    api.loadCredentials().then((saved) => {
      if (!saved) return;
      setEmail(saved.email);
      setSenha(saved.password);
      setRememberMe(true);
      setAutoLogging(true);
      doLogin(saved.email, saved.password, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLogin(emailVal: string, senhaVal: string, remember: boolean) {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: emailVal.trim().toLowerCase(),
        password: senhaVal,
      });

      if (error) {
        setAutoLogging(false);
        toast.error(
          error.message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : error.message
        );
        // Credenciais salvas inválidas — limpa para não loop de erro
        if (remember) {
          getElectron()?.clearCredentials?.();
          setRememberMe(false);
        }
        return;
      }

      const { data: perfilRaw, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", emailVal.trim().toLowerCase())
        .single();

      const perfil = perfilRaw as
        | import("@/lib/supabase/types").Usuario
        | null;

      if (perfilError || !perfil) {
        setAutoLogging(false);
        toast.error("Login válido, mas usuário não cadastrado na tabela 'usuarios'");
        await supabase.auth.signOut();
        return;
      }

      if (perfil.ativo_sistema === false) {
        setAutoLogging(false);
        toast.error("Este usuário está inativo. Contate um administrador.");
        await supabase.auth.signOut();
        return;
      }

      // Salva ou limpa credenciais conforme a opção escolhida
      const api = getElectron();
      if (remember) {
        await api?.saveCredentials?.(emailVal.trim().toLowerCase(), senhaVal);
      } else {
        await api?.clearCredentials?.();
      }

      setUser(perfil);
      const raw = params.get("next") ?? "";
      const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inicio";
      router.replace(next);
    } catch (err) {
      setAutoLogging(false);
      const msg = err instanceof Error ? err.message : "Erro ao entrar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !senha) {
      toast.error("Informe email e senha");
      return;
    }
    await doLogin(email, senha, rememberMe);
  }

  // Tela de auto-login — mostra spinner enquanto autentica em background
  if (autoLogging) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background:
            "linear-gradient(135deg, #1e4d28 0%, #006B54 60%, #00835A 100%)",
        }}
      >
        <div className="flex flex-col items-center gap-4 text-white/80">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Entrando automaticamente...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #1e4d28 0%, #006B54 60%, #00835A 100%)",
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={configs?.logo_url || "/logo-chabra.png"}
            alt="Logo Chabra"
            className="h-20 w-auto max-w-[200px] object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo-chabra.png" }}
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Painel SST</h1>
          <p className="text-sm text-gray-500">Chabra · Segurança e Saúde do Trabalho</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              placeholder="seuemail@chabra.com.br"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700" htmlFor="senha">
              Senha
            </label>
            <div className="relative mt-1">
              <input
                id="senha"
                type={showPwd ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Só exibe "Manter conectado" dentro do app Electron */}
          {typeof window !== "undefined" && getElectron() && (
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 accent-verde-primary"
              />
              <span className="text-sm text-gray-600">Manter conectado</span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-verde-accent disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Chabra · Painel SST
        </p>
      </div>
    </div>
  );
}
