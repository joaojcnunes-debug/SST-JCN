"use client";

// Comemoração discreta (Etapa 6 do docs/plano-skin-viva-jcn.md): um punhado de confete sai de
// perto do aviso de sucesso (canto de cima, à direita) e some em ~1,2 s. Quem conclui ou assina
// chama `comemorar()`; o <Comemoracao /> montado em lib/providers desenha. Com "reduzir
// movimento" não aparece nada (fica só o aviso). Fora da impressão.

import { useEffect, useState, type CSSProperties } from "react";

const EVENTO = "jcn:comemorar";
const CORES = ["#0ea5e9", "#0284c7", "#38bdf8", "#22c55e", "#facc15"];
const PECAS = 14;
const DURACAO_MS = 1400;

type Peca = { dx: number; dy: number; rot: number; cor: string; atraso: number };

/** Dispara a comemoração (inspeção concluída, documento emitido, relatório finalizado, assinatura). */
export function comemorar() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

function sortear(): Peca[] {
  return Array.from({ length: PECAS }, (_, i) => ({
    dx: Math.round((Math.random() - 0.5) * 320),
    dy: Math.round(20 + Math.random() * 150),
    rot: Math.round((Math.random() - 0.5) * 720),
    cor: CORES[i % CORES.length],
    atraso: Math.round(Math.random() * 120),
  }));
}

export default function Comemoracao() {
  const [rodada, setRodada] = useState<{ id: number; pecas: Peca[] } | null>(null);

  useEffect(() => {
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const aoComemorar = () => {
      if (reduz.matches) return;
      setRodada({ id: Date.now(), pecas: sortear() });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRodada(null), DURACAO_MS);
    };
    window.addEventListener(EVENTO, aoComemorar);
    return () => {
      window.removeEventListener(EVENTO, aoComemorar);
      window.clearTimeout(timer);
    };
  }, []);

  if (!rodada) return null;
  return (
    <div key={rodada.id} aria-hidden="true" className="pointer-events-none fixed right-44 top-8 z-[9999] print:hidden">
      {rodada.pecas.map((p, i) => (
        <span
          key={i}
          className="confete"
          style={
            {
              backgroundColor: p.cor,
              animationDelay: `${p.atraso}ms`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
