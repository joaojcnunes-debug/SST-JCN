"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import type { Usuario } from "@/lib/supabase/types";

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
 * Quem SUPERVISIONA (v229): reabre inspeção/elaboração de outro, troca o
 * responsável, associa gente, configura o módulo (texto padrão, OWAS, 13
 * fatores, tipos do QPS, base de químicos). Até a v229 isso era `perfil ===
 * "Admin"`, o que obrigava supervisores e psicólogos a serem Admin do sistema.
 * Agora é o nível "Aprovacao" (ou Admin). Conta sem `nivel` gravado cai no
 * comportamento antigo: só Admin.
 *
 * O que continua SÓ Admin: usuários, configurações, credenciais/certificado,
 * lixeira — `useIsAdmin()`. Presença e Auditoria: `useVePresencaAuditoria()` (v231).
 */
export function ehSupervisor(user: Pick<Usuario, "perfil" | "nivel"> | null | undefined) {
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  return user.nivel === "Aprovacao" || user.nivel === "Admin";
}

export function useIsSupervisor() {
  const user = useUserStore((s) => s.user);
  return ehSupervisor(user);
}

/**
 * Quem abre Sistema › Presença e Sistema › Auditoria (v231): Admin, ou função
 * com `ve_presenca_auditoria` (TI, Gerente, Supervisora do administrativo —
 * editável em Sistema › Funções). Decisão dele em 21/09: "gerentes e admin,
 * além do TI"; supervisores dos técnicos NÃO entram. Só leitura: derrubar
 * sessão e a limpeza de retenção seguem exigindo Admin (tela e banco).
 */
export function vePresencaAuditoria(user: Pick<Usuario, "perfil" | "funcoes_painel"> | null | undefined) {
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  return user.funcoes_painel?.ve_presenca_auditoria === true;
}

export function useVePresencaAuditoria() {
  const user = useUserStore((s) => s.user);
  return vePresencaAuditoria(user);
}

/**
 * Espelho do `caller_pode_editar()` do banco (v74/v76): a RLS só aceita
 * escrita de Admin e Tecnico — os flags granulares NÃO são consultados lá.
 * Um Visualizador com `pode_editar` ligado no cadastro passava pela UI
 * inteira e só descobria no submit, com o erro cru de RLS do Postgres
 * (2026-08-21, analises_quimicos).
 *
 * O guard vale para os caminhos de CRIAÇÃO (useCanCreate/useRequireCreate) e
 * para useRequireEdit. NÃO vale para useCanEdit/useCanDelete: a Gestão (v117)
 * decide escrita por membership (`gestao_pode_editar_q()`), sem perfil — e
 * quadro não-restrito autoriza `edit` a Visualizador membro (medido
 * 2026-08-21: 7+ Visualizadores com flag têm `edit` real em 8 quadros
 * abertos). Guard ali removeria em silêncio capacidade que o banco aceita.
 */
export function perfilEscreveNaRls(perfil?: string) {
  return perfil === "Admin" || perfil === "Tecnico";
}

/**
 * Permissão de EDITAR dados (rascunhos, observações, situação de itens etc).
 *
 * V45+: leva em conta o flag granular `pode_editar`. Admin SEMPRE pode
 * (contorna o flag), porque a flag dele é só pra UI e admin é admin.
 * Sem guard de perfil aqui — ver o comentário de `perfilEscreveNaRls`.
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
 *
 * `exigeEditar`: nos módulos cobertos pelas policies `for all` da v74/v76 o
 * banco exige `pode_editar` até no INSERT. Passe `{ exigeEditar: true }` para
 * o botão "Novo" não aparecer para quem o Postgres vai barrar depois.
 */
export function useCanCreate(opts?: { exigeEditar?: boolean }) {
  const user = useUserStore((s) => s.user);
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  if (!perfilEscreveNaRls(user.perfil)) return false;
  if (user.pode_criar !== true) return false;
  return opts?.exigeEditar === true ? user.pode_editar === true : true;
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
 *
 * `exigeEditar`: a RLS da v74/v76 usa policies `for all` com
 * `caller_pode_editar()` — ou seja, o banco exige `pode_editar` até para
 * INSERT. Nos módulos cobertos por elas, quem tem só `pode_criar` preenchia
 * o formulário inteiro e só descobria no submit, com erro de RLS cru vindo
 * do Postgres. Passe `{ exigeEditar: true }` para barrar na entrada.
 */
export function useRequireCreate(
  redirectTo: string = "/inicio",
  opts?: { exigeEditar?: boolean },
) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);
  const exigeEditar = opts?.exigeEditar === true;

  useEffect(() => {
    if (!user) return;
    if (user.perfil === "Admin") return;

    const perfilPermite = perfilEscreveNaRls(user.perfil);
    const podeCriar = perfilPermite && user.pode_criar === true;
    const passaNaRls = !exigeEditar || user.pode_editar === true;
    if (podeCriar && passaNaRls) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(
        !perfilPermite
          ? "Seu perfil é somente leitura no sistema — cadastrar exige perfil Técnico ou Admin. Peça ao administrador."
          : user.pode_criar !== true
            ? "Você não tem permissão para criar."
            : "Cadastrar neste módulo exige a permissão de editar. Peça ao administrador.",
      );
    }
    router.replace(redirectTo);
  }, [user, redirectTo, router, exigeEditar]);
}

/**
 * Capability de escrita de QUÍMICOS, desacoplada do perfil (F1.3-A / v189).
 *
 * Espelha o gate ADITIVO da RLS `analises_quimicos_rw_uni`:
 * `caller_pode_editar() OR pode_escrever_quimicos()`. Ou seja: quem já podia
 * criar químicos pelo perfil (Admin/Técnico via `useCanCreate({exigeEditar:true})`)
 * continua podendo; e quem tem a flag `pode_escrever_quimicos` também — mesmo sendo
 * Visualizador. NÃO afrouxa `perfilEscreveNaRls` para os outros módulos: a capability
 * só é consultada AQUI, no fluxo de químicos.
 */
export function usePodeQuimicos() {
  const podePerfil = useCanCreate({ exigeEditar: true });
  const user = useUserStore((s) => s.user);
  if (podePerfil) return true;
  return user?.pode_escrever_quimicos === true;
}

/**
 * Bloqueia a página de criação de químicos pra quem não pode escrever químicos —
 * pelo perfil OU pela capability. Redireciona com toast. Espelha
 * `useRequireCreate(..., {exigeEditar:true})` mais o atalho da capability, para
 * NÃO expulsar o Visualizador-flagueado de `/analise-quimicos/nova`.
 */
export function useRequireQuimicos(redirectTo: string = "/analise-quimicos") {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (user.perfil === "Admin") return;
    if (user.pode_escrever_quimicos === true) return;

    const perfilPermite = perfilEscreveNaRls(user.perfil);
    const podeCriar = perfilPermite && user.pode_criar === true;
    const passaNaRls = user.pode_editar === true;
    if (podeCriar && passaNaRls) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(
        !perfilPermite
          ? "Seu perfil é somente leitura no sistema — cadastrar químicos exige perfil Técnico/Admin ou a permissão de escrita de químicos. Peça ao administrador."
          : user.pode_criar !== true
            ? "Você não tem permissão para criar."
            : "Cadastrar químicos exige a permissão de editar. Peça ao administrador.",
      );
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
    if (perfilEscreveNaRls(user.perfil) && user.pode_editar === true) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(
        perfilEscreveNaRls(user.perfil)
          ? "Você não tem permissão para editar."
          : "Seu perfil é somente leitura no sistema — edição exige perfil Técnico ou Admin.",
      );
    }
    router.replace(redirectTo);
  }, [user, redirectTo, router]);
}
