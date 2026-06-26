"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
};

/** Página principal (hub). Ir PARA ela = "voltar"; sair DELA = "avançar". */
const HUB = "/visao-geral";

/**
 * Transição suave entre páginas via View Transitions API (Chromium/Electron).
 *
 * Intercepta cliques em links internos (capture-phase, antes do next/link) e
 * envolve a navegação num crossfade nativo (`document.startViewTransition`).
 * Não troca nenhum <Link>, não adiciona dependência. Degrada para a navegação
 * normal onde a API não existe ou quando o usuário pede redução de movimento.
 *
 * Escape hatch: adicionar `data-no-vt` a um <a> pula a transição para ele.
 */
export default function PageTransitions() {
  const pathname = usePathname();
  const router = useRouter();
  const finishRef = useRef<(() => void) | null>(null);

  // Navegação concluída (pathname mudou) → fecha a transição pendente.
  useEffect(() => {
    if (finishRef.current) {
      finishRef.current();
      finishRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    const doc = document as DocWithVT;
    if (typeof doc.startViewTransition !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (
        !href ||
        !href.startsWith("/") || // só rotas internas absolutas
        href.startsWith("//") ||
        (target && target !== "_self") ||
        anchor.hasAttribute("download") ||
        anchor.dataset.noVt !== undefined
      ) {
        return;
      }

      const url = new URL(href, window.location.origin);
      if (url.pathname === window.location.pathname) return; // mesma página (hash/query)

      e.preventDefault();
      const destino = url.pathname + url.search + url.hash;

      // Direção hierárquica: voltar ao hub, ou avançar para uma sub-página.
      const root = document.documentElement;
      const direcao =
        url.pathname === HUB ? "back" : window.location.pathname === HUB ? "forward" : "";
      if (direcao) root.dataset.vt = direcao;
      else delete root.dataset.vt;

      try {
        const transicao = doc.startViewTransition!(
          () =>
            new Promise<void>((resolve) => {
              finishRef.current = resolve;
              router.push(destino);
              // Safety: libera caso o pathname não mude (browser também encerra em ~4s).
              window.setTimeout(() => {
                if (finishRef.current) {
                  finishRef.current();
                  finishRef.current = null;
                }
              }, 700);
            }),
        );
        transicao.finished.finally(() => {
          if (root.dataset.vt === direcao) delete root.dataset.vt;
        });
      } catch {
        delete root.dataset.vt;
        router.push(destino); // fallback duro
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
