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
  const runningRef = useRef(false);

  // Navegação concluída (pathname mudou) → fecha a transição pendente.
  useEffect(() => {
    if (finishRef.current) {
      finishRef.current();
      finishRef.current = null;
    }
    runningRef.current = false;
  }, [pathname]);

  useEffect(() => {
    const doc = document as DocWithVT;
    const supportsVT = typeof doc.startViewTransition === "function";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /**
     * Núcleo da transição: dispara a barra de progresso e, quando suportado,
     * envolve a navegação num crossfade. `navigate` pode ser router.push (clique)
     * ou um no-op (popstate — o browser já navegou). Resolve no próximo pathname.
     */
    function runVT(navigate: () => void, direcao: "back" | "forward" | "") {
      window.dispatchEvent(new Event("nav:start")); // feedback imediato (progress bar)

      const root = document.documentElement;
      if (direcao) root.dataset.vt = direcao;
      else delete root.dataset.vt;

      if (!supportsVT || reduced || runningRef.current) {
        navigate();
        return;
      }
      runningRef.current = true;
      try {
        const transicao = doc.startViewTransition!(
          () =>
            new Promise<void>((resolve) => {
              finishRef.current = resolve;
              navigate();
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
          runningRef.current = false;
        });
      } catch {
        delete root.dataset.vt;
        runningRef.current = false;
        navigate(); // fallback duro
      }
    }

    // Avançar: clique em link interno (capture-phase, antes do next/link).
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
        anchor.dataset.noVt !== undefined // escape hatch: <a data-no-vt> pula a transição
      ) {
        return;
      }

      const url = new URL(href, window.location.origin);
      if (url.pathname === window.location.pathname) return; // mesma página (hash/query)

      e.preventDefault();
      const destino = url.pathname + url.search + url.hash;
      const direcao =
        url.pathname === HUB ? "back" : window.location.pathname === HUB ? "forward" : "";
      runVT(() => router.push(destino), direcao);
    }

    // Voltar/avançar: botão físico do browser/Electron e router.back() (sidebar).
    // O browser já iniciou a navegação; só envolvemos no crossfade + progresso,
    // resolvendo quando o pathname assenta. Simetria com o avançar.
    function onPopState() {
      runVT(() => {}, "back");
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [router]);

  return null;
}
