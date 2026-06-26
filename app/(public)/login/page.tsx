"use client";

import { Suspense, useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, Download } from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";

type ElectronAPI = {
  loadCredentials?: () => Promise<{ email: string; password: string } | null>;
  saveCredentials?: (email: string, password: string) => Promise<{ success: boolean }>;
  clearCredentials?: () => Promise<void>;
  getVersion?: () => Promise<string>;
  getInstallerUrl?: () => Promise<{ success: boolean; url?: string; error?: string }>;
  downloadUpdateFile?: (url: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  runInstallerFile?: (path: string) => Promise<{ success: boolean; error?: string }>;
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
      const defaultHome = perfil.perfil === "Cliente" ? "/portal-cliente/inicio" : "/visao-geral";
      const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : defaultHome;
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
            "linear-gradient(135deg, #1e4d28 0%, #0ea5e9 60%, #0284c7 100%)",
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
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
      style={{ background: "linear-gradient(135deg, #0369a1 0%, #0ea5e9 65%, #0284c7 100%)" }}
    >
      {/* Círculos decorativos de fundo */}
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-white/[0.06] blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Card principal */}
        <div className="reveal-up rounded-3xl bg-white px-8 py-10 shadow-[0_25px_60px_rgba(0,0,0,0.25)] ring-1 ring-black/5">

          {/* Logo + título */}
          <div className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={configs?.logo_url || "/logo-jcn.svg"}
              alt="Logo JCN Consultoria"
              className="h-20 w-auto max-w-[200px] object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo-jcn.svg"; }}
            />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">SST JCN Consultoria</h1>
            <p className="mt-1 text-sm text-gray-400">JCN Consultoria · Segurança e Saúde do Trabalho</p>
          </div>

          {/* Formulário */}
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
                placeholder="seuemail@jcnconsultoria.com.br"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500" htmlFor="senha">
                Senha
              </label>
              <div className="relative mt-1.5">
                <input
                  id="senha"
                  type={showPwd ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10 text-sm shadow-sm transition focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

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
              className="sheen flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)" }}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} JCN Consultoria · SST JCN Consultoria
          </p>

          {typeof window !== "undefined" && getElectron() && (
            <UpdateButton />
          )}
        </div>
      </div>
    </div>
  );
}

function UpdateButton() {
  const [state, setState] = useState<
    "idle" | "checking" | "downloading" | "up-to-date" | "error"
  >("idle");
  const [percent, setPercent] = useState(0);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  async function handleClick() {
    const api = getElectron();
    if (!api) return;

    setState("checking");
    try {
      // Verifica versão disponível
      const resp = await fetch(
        "https://api.github.com/repos/joaojcnunes-debug/SST-JCN/releases/latest",
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (!resp.ok) throw new Error("Falha ao consultar GitHub");
      const release = (await resp.json()) as { tag_name: string };
      const remote = release.tag_name.replace(/^v/, "");
      const current = (await api.getVersion?.()) ?? "0.0.0";
      setLatestVersion(remote);

      const [rMaj, rMin, rPatch] = remote.split(".").map(Number);
      const [cMaj, cMin, cPatch] = current.split(".").map(Number);
      const newer =
        rMaj > cMaj ||
        (rMaj === cMaj && rMin > cMin) ||
        (rMaj === cMaj && rMin === cMin && rPatch > cPatch);

      if (!newer) {
        setState("up-to-date");
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      // Baixa o instalador
      setState("downloading");
      setPercent(0);

      const urlResult = await api.getInstallerUrl?.();
      if (!urlResult?.success || !urlResult.url) throw new Error("URL não encontrada");

      // Progresso via polling simples (getInstallerUrl já tem o URL)
      const result = await api.downloadUpdateFile?.(urlResult.url);
      if (!result?.success || !result.path) throw new Error("Falha no download");

      await api.runInstallerFile?.(result.path);
      setState("idle");
    } catch (err) {
      setState("error");
      toast.error(err instanceof Error ? err.message : "Erro ao verificar atualização");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  if (state === "downloading") {
    return (
      <div className="mt-4 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="size-3 animate-spin" />
          Baixando v{latestVersion}… aguarde
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "checking"}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 transition-colors"
      >
        {state === "checking" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Download className="size-3" />
        )}
        {state === "checking"
          ? "Verificando…"
          : state === "up-to-date"
          ? "Você já tem a versão mais recente"
          : state === "error"
          ? "Erro — tente novamente"
          : "Verificar atualização"}
      </button>
    </div>
  );
}
