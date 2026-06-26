"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";

export function useCurrentUser() {
  return useUserStore((s) => s.user);
}

export function useIsCliente() {
  const user = useUserStore((s) => s.user);
  return user?.perfil === "Cliente";
}

export function useIsAdmin() {
  const user = useUserStore((s) => s.user);
  return user?.perfil === "Admin";
}

/**
 * Permissão de EDITAR dados (rascunhos, observações, situação de itens etc).
 *
 * V45+: leva em conta o flag granular `pode_editar`. Admin SEMPRE pode
 * (contorna o flag), porque a flag dele é só pra UI e admin é admin.
 */
export function useCanEdit() {
  const user = useUserStore((s) => s.user);
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  return user.pode_editar === true;
}

/**
 * Permissão de CRIAR novos relatórios/análises/inspeções.
 *
 * V45+: usa o flag granular `pode_criar`. Admin sempre pode.
 */
export function useCanCreate() {
  const user = useUserStore((s) => s.user);
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  return user.pode_criar === true;
}

/**
 * Permissão de EXCLUIR relatórios/análises top-level (destrutivo).
 *
 * V45+: usa o flag granular `pode_excluir`. Admin sempre pode. Esse hook
 * substituiu o `useIsAdmin()` que era usado nos botões de excluir.
 */
export function useCanDelete() {
  const user = useUserStore((s) => s.user);
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  return user.pode_excluir === true;
}

/**
 * Bloqueia páginas de criação pra quem não tem `pode_criar`.
 * Redireciona pra `redirectTo` com toast.
 */
export function useRequireCreate(redirectTo: string = "/inicio") {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (user.perfil === "Admin") return;
    if (user.pode_criar === true) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error("Você não tem permissão para criar.");
    }
    router.replace(redirectTo);
  }, [user, redirectTo, router]);
}

/**
 * Bloqueia páginas de edição (`/editar`, `/[id]` quando o uso é só edição)
 * pra quem não tem `pode_editar`. Admin sempre passa.
 *
 * Pra páginas de detalhe com estado misto (leitura + edição), prefira
 * `useCanEdit()` direto e gate os inputs/botões — não redirect.
 */
export function useRequireEdit(redirectTo: string = "/inicio") {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (user.perfil === "Admin") return;
    if (user.pode_editar === true) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error("Você não tem permissão para editar.");
    }
    router.replace(redirectTo);
  }, [user, redirectTo, router]);
}
