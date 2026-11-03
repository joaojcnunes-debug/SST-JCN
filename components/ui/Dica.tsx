"use client";

// Dica de preenchimento (Etapa 1 do docs/plano-skin-viva-jcn.md).
//
// Passar o mouse, focar com Tab ou tocar no NOME do campo abre uma caixa pequena com 1–2 linhas
// de "como preencher". A indicação é discreta: sublinhado pontilhado no rótulo.
//  • abre depois de ~300 ms (mouse/foco) para não piscar ao atravessar a tela; toque abre na hora;
//  • fica acima do rótulo e, sem espaço, abaixo — nunca em cima do campo;
//  • Esc fecha; role="tooltip" + aria-describedby; não sai na impressão;
//  • vai para o <body> (portal): dentro de janela com rolagem a caixa não é cortada;
//  • sem animação para quem pediu menos movimento (motion-reduce).
// Os textos ficam em lib/dicas/<modulo>.ts, não espalhados nas telas.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const ATRASO_MS = 300;
const LARGURA_MAX = 260;
const MARGEM = 8;

interface Posicao {
  top: number;
  left: number;
  embaixo: boolean;
}

export default function Dica({
  texto,
  children,
  className,
}: {
  texto: string;
  /** O nome do campo (o que recebe o sublinhado pontilhado). */
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const gatilho = useRef<HTMLSpanElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aberta, setAberta] = useState(false);
  const [pos, setPos] = useState<Posicao | null>(null);

  const limpar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const abrir = (imediato = false) => {
    limpar();
    if (imediato) setAberta(true);
    else timer.current = setTimeout(() => setAberta(true), ATRASO_MS);
  };
  const fechar = useCallback(() => {
    limpar();
    setAberta(false);
    setPos(null);
  }, []);

  // Posiciona depois de abrir (precisa da altura real da caixa).
  useEffect(() => {
    if (!aberta) return;
    const g = gatilho.current?.getBoundingClientRect();
    const c = caixa.current?.getBoundingClientRect();
    if (!g || !c) return;
    const embaixo = g.top - c.height - MARGEM < 0;
    const top = embaixo ? g.bottom + MARGEM : g.top - c.height - MARGEM;
    const left = Math.min(Math.max(MARGEM, g.left), window.innerWidth - c.width - MARGEM);
    setPos({ top, left, embaixo });
  }, [aberta]);

  // Esc fecha; rolar ou redimensionar também (a posição deixaria de valer).
  useEffect(() => {
    if (!aberta) return;
    // Esc com o foco em outro lugar (dica aberta pelo mouse): fecha a dica.
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    const fora = (e: PointerEvent) => {
      if (!gatilho.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberta, fechar]);

  useEffect(() => limpar, []);

  return (
    <>
      <span
        ref={gatilho}
        tabIndex={0}
        aria-describedby={aberta ? id : undefined}
        onMouseEnter={() => abrir()}
        onMouseLeave={fechar}
        onFocus={() => abrir()}
        onBlur={fechar}
        onKeyDown={(e) => {
          // Com o foco no nome, o Esc fecha só a dica: o Modal ignora tecla já tratada.
          if (e.key === "Escape" && aberta) {
            e.preventDefault();
            fechar();
          }
        }}
        onPointerDown={(e) => {
          // Toque: abre/fecha na hora (no celular não há "passar o mouse").
          if (e.pointerType === "touch") {
            e.preventDefault();
            if (aberta) fechar();
            else abrir(true);
          }
        }}
        className={cn(
          "cursor-help underline decoration-gray-400 decoration-dotted decoration-1 underline-offset-[3px] outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-marca-primary/40 dark:decoration-gray-500",
          className,
        )}
      >
        {children}
      </span>
      {aberta &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={caixa}
            id={id}
            role="tooltip"
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              maxWidth: LARGURA_MAX,
            }}
            className={cn(
              "pointer-events-none fixed z-[200] rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-gray-700 shadow-lg print:hidden",
              "transition-opacity duration-150 motion-reduce:transition-none",
              pos ? "opacity-100" : "opacity-0",
            )}
          >
            {texto}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Rótulo de campo com dica: o mesmo `<label>` de sempre; com `dica`, o nome ganha o sublinhado
 * pontilhado e abre a caixa. `extra` fica depois do nome e fora do gatilho (ex.: o asterisco).
 */
export function CampoLabel({
  dica,
  children,
  extra,
  className,
  htmlFor,
}: {
  dica?: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={className}>
      {dica ? <Dica texto={dica}>{children}</Dica> : children}
      {extra}
    </label>
  );
}
