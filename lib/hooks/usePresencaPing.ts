"use client";

import { useEffect } from "react";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Bate o ponto de presença (v218): enquanto a pessoa MEXE no painel com a aba
 * visível, chama `presenca_ping()` uma vez por minuto. O banco guarda um bloco
 * de 5 min por pessoa (upsert) — aba parada não gera nada, e é isso que mede a
 * inatividade.
 *
 * Regras:
 *  - "mexer" = mouse, tecla, toque, rolagem nos últimos 5 min. Só o carimbo de
 *    tempo é atualizado no evento (custo zero); a decisão é no tique do minuto.
 *  - Aba oculta não pinga. Ao voltar a ficar visível, pinga na hora.
 *  - Várias abas do mesmo navegador dividem uma trava em localStorage: só uma
 *    pinga por minuto. Sem isso, 4 abas = 4 requisições iguais.
 *  - Sem internet (app de campo offline) não faz nada. Erro de rede é engolido:
 *    presença nunca pode derrubar nem atrasar a tela.
 *  - Perfil Cliente (portal) não entra — o banco também recusa.
 *  - Se o banco devolver TRUE (v219), um Admin encerrou a sessão: desloga e
 *    manda para o login com o aviso.
 *
 * Montado dentro de useAuth(): todo layout protegido ganha de graça.
 */

const INTERVALO_PING_MS = 60_000;
const JANELA_ATIVIDADE_MS = 5 * 60_000;
const CHAVE_TRAVA = "painel-presenca-ultimo-ping";
const EVENTOS: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];

function origem(): "electron" | "pwa" | "web" {
  if (typeof window === "undefined") return "web";
  if ((window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron) return "electron";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  return "web";
}

export function usePresencaPing() {
  const perfil = useUserStore((s) => s.user?.perfil);
  const ligado = !!perfil && perfil !== "Cliente";

  useEffect(() => {
    if (!ligado) return;

    let ultimaAtividade = Date.now();
    let emVoo = false;
    const supabase = createSupabaseBrowserClient();

    const marcar = () => {
      ultimaAtividade = Date.now();
    };

    async function ping() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimaAtividade > JANELA_ATIVIDADE_MS) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (emVoo) return;

      // Trava entre abas: quem pingou há menos de ~1 min segura as outras.
      try {
        const ultimo = Number(localStorage.getItem(CHAVE_TRAVA) ?? 0);
        if (Date.now() - ultimo < INTERVALO_PING_MS - 5_000) return;
        localStorage.setItem(CHAVE_TRAVA, String(Date.now()));
      } catch {
        /* sem localStorage (modo privado): pinga assim mesmo */
      }

      emVoo = true;
      try {
        const { data } = await (
          supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }>
        )("presenca_ping", { p_origem: origem() });
        // v219: TRUE = um Admin pediu para encerrar esta sessão. Sai já — o
        // servidor já apagou a sessão do GoTrue; o signOut pode até falhar (403)
        // e não importa: a página recarrega no login com o aviso.
        if (data === true) {
          try {
            await supabase.auth.signOut();
          } catch {
            /* sessão já morta no servidor */
          }
          window.location.assign("/login?encerrada=1");
          return;
        }
      } catch {
        /* rede, 404 após rollback, sessão vencida: silêncio */
      } finally {
        emVoo = false;
      }
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") {
        marcar();
        void ping();
      }
    };

    for (const ev of EVENTOS) window.addEventListener(ev, marcar, { passive: true });
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    void ping(); // entrou: registra já
    const timer = window.setInterval(() => void ping(), INTERVALO_PING_MS);

    return () => {
      window.clearInterval(timer);
      for (const ev of EVENTOS) window.removeEventListener(ev, marcar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [ligado]);
}
