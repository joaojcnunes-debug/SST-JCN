"use client";

import { useEffect, useRef } from "react";
import { SIDEBAR_LARGURA_PADRAO, limitarLarguraSidebar, useSidebarMini } from "@/lib/store";

/**
 * Alça na borda direita do menu lateral: arrastar muda a largura, dois cliques
 * voltam ao padrão. Fica DENTRO do <aside> fixo (SidebarShell e Gestão).
 *
 * Quem desenha é o CSS (globals.css), lendo `--sidebar-w` no <html>: durante o
 * arraste só a variável muda (sem re-render a cada movimento); ao soltar a
 * largura vai para a store persistida, que o script de pré-hidratação lê.
 * Com o menu recolhido (mini) a alça some — o CSS cuida disso.
 */
export default function SidebarAlca() {
  const largura = useSidebarMini((s) => s.largura);
  const setLargura = useSidebarMini((s) => s.setLargura);
  const arraste = useRef<{ x: number; w: number; atual: number } | null>(null);

  // Mantém o <html> em dia com a store (outra aba, reset, hidratação).
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${largura}px`);
  }, [largura]);

  function aplicar(px: number) {
    document.documentElement.style.setProperty("--sidebar-w", `${px}px`);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { x: e.clientX, w: largura, atual: largura };
    // Desliga a transição e a seleção de texto enquanto arrasta.
    document.documentElement.setAttribute("data-sidebar-arrastando", "");
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const a = arraste.current;
    if (!a) return;
    a.atual = limitarLarguraSidebar(a.w + e.clientX - a.x);
    aplicar(a.atual);
  }

  function terminar() {
    const a = arraste.current;
    if (!a) return;
    arraste.current = null;
    document.documentElement.removeAttribute("data-sidebar-arrastando");
    setLargura(a.atual);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const passo = e.shiftKey ? 40 : 10;
    if (e.key === "ArrowLeft") setLargura(largura - passo);
    else if (e.key === "ArrowRight") setLargura(largura + passo);
    else if (e.key === "Home" || e.key === "Enter") setLargura(SIDEBAR_LARGURA_PADRAO);
    else return;
    e.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura do menu"
      tabIndex={0}
      title="Arraste para mudar a largura do menu (dois cliques volta ao padrão)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      onDoubleClick={() => setLargura(SIDEBAR_LARGURA_PADRAO)}
      onKeyDown={onKeyDown}
      className="sidebar-alca group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none"
    >
      <span className="mx-auto block h-full w-[3px] bg-transparent transition-colors group-hover:bg-verde-accent/70 group-focus-visible:bg-verde-accent/70 group-active:bg-verde-accent" />
    </div>
  );
}
