"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Barra de progresso fina no topo — feedback imediato de navegação.
 * Começa no evento `nav:start` (disparado pelo PageTransitions em cliques e
 * voltar/avançar) e completa quando o pathname muda. Funciona junto da View
 * Transition: tem view-transition-name próprio (congelado), então não cruza.
 */
export default function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const active = useRef(false);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  // Início: escuta o evento global disparado pelo interceptador.
  useEffect(() => {
    function start() {
      if (active.current) return;
      active.current = true;
      setVisible(true);
      setProgress(8);
      // "Trickle" — sobe rápido no começo e desacelera, sem nunca chegar a 100.
      timers.current.push(
        window.setTimeout(() => setProgress(35), 90),
        window.setTimeout(() => setProgress(60), 280),
        window.setTimeout(() => setProgress(78), 650),
        window.setTimeout(() => setProgress(90), 1400),
      );
    }
    window.addEventListener("nav:start", start);
    return () => {
      window.removeEventListener("nav:start", start);
      clearTimers();
    };
  }, []);

  // Fim: o pathname mudou → completa e some. Não dispara no mount.
  useEffect(() => {
    if (!active.current) return;
    clearTimers();
    setProgress(100);
    const done = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      active.current = false;
    }, 240);
    return () => window.clearTimeout(done);
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 print:hidden"
      style={{ viewTransitionName: "progress" }}
    >
      {visible && (
        <div
          className="h-full rounded-r-full bg-verde-accent shadow-[0_0_8px_#0284c7]"
          style={{
            width: `${progress}%`,
            opacity: progress >= 100 ? 0 : 1,
            transition: "width 220ms cubic-bezier(.3,.7,.4,1), opacity 240ms ease 120ms",
          }}
        />
      )}
    </div>
  );
}
