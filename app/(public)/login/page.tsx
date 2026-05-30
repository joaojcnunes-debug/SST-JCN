"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !senha) {
      toast.error("Informe email e senha");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "Email ou senha incorretos"
            : error.message
        );
        return;
      }

      const { data: perfilRaw, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email.trim().toLowerCase())
        .single();

      const perfil = perfilRaw as
        | import("@/lib/supabase/types").Usuario
        | null;

      if (perfilError || !perfil) {
        toast.error(
          "Login válido, mas usuário não cadastrado na tabela 'usuarios'"
        );
        await supabase.auth.signOut();
        return;
      }

      if (perfil.ativo_sistema === false) {
        toast.error("Este usuário está inativo. Contate um administrador.");
        await supabase.auth.signOut();
        return;
      }

      setUser(perfil);
      toast.success(`Bem-vindo, ${perfil.nome}!`);
      const raw = params.get("next") ?? "";
      const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inicio";
      router.replace(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao entrar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
