"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    /** Rejeita quando o navegador PULA a transição. Opcional: nem toda
     *  implementação a expõe, e é por isso que o acesso abaixo é `?.`. */
    ready?: Promise<void>;
    finished: Promise<void>;
  };
};

/** Página principal (home). Ir PARA ela = "voltar"; sair DELA = "avançar". */
const HUB = "/inicio";

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
  //
  // 🪤 AQUI NÃO SE ZERA `runningRef`. Zerava, e era a causa da exceção
  // "Transition was aborted because of invalid state" (medida 2× em 01/09):
  // pathname troca ANTES de a animação terminar, e a janela entre os dois
  // eventos aceitava uma segunda `startViewTransition` que abortava a primeira.
  // Quem zera agora é o fim da própria animação, lá embaixo.
  useEffect(() => {
    if (finishRef.current) {
      finishRef.current();
      finishRef.current = null;
    }
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
        // `.finished` REJEITA quando a transição é abortada, e `.finally()` não
        // consome rejeição — sobrava uma exceção não tratada no console a cada
        // troca de rota. `then(f, f)` trata os dois desfechos com a mesma
        // limpeza: abortada ou concluída, o estado tem que voltar ao lugar.
        const encerrar = () => {
          if (root.dataset.vt === direcao) delete root.dataset.vt;
          runningRef.current = false;
        };
        transicao.finished.then(encerrar, encerrar);

        // 🪤 A API tem TRÊS promessas e só a `finished` estava sendo escutada.
        // Quando o navegador PULA a transição, quem rejeita é a `ready` — a
        // `finished` resolve normalmente. Sem ninguém escutando, sobrava uma
        // rejeição não tratada estourando no console.
        //
        // Medido em 03/09, 4 trocas de tela, mesma build:
        //   aba VISÍVEL → 0 rejeições · aba OCULTA → 8 rejeições
        //
        // O navegador pula a transição quando o documento está oculto, e isso
        // é o comportamento CERTO dele — não há o que consertar no desfecho.
        // O defeito era só deixar a rejeição vazar. Daí engolir, e nada mais:
        // a limpeza de estado continua sendo trabalho da `finished`.
        transicao.ready?.catch(() => {});
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
