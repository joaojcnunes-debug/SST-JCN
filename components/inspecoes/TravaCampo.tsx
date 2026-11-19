"use client";

// Trava da edição pelo tempo de campo (0.3.314, 19/11/2026 — pedido do João: "só com o play ligado o colaborador pode
// inserir, editar e excluir, como na parte do relatório, para poder contabilizar o tempo de trabalho; ao clicar em
// algum botão sem ter dado o play, gerar uma mensagem informando que precisa dar o play").
// Envolve o conteúdo das abas da inspeção. Travado, qualquer botão, campo ou seleção dali mostra o aviso e não age.
// Links continuam funcionando (só navegam). Um elemento com `data-livre-campo` fica livre.

import type { ReactNode, SyntheticEvent } from "react";
import toast from "react-hot-toast";

const INTERATIVO = 'button, [role="button"], [role="menuitem"], [role="checkbox"], [role="switch"], input, select, textarea, [contenteditable="true"]';
export const AVISO_PLAY =
  "Dê o play no tempo de campo (Iniciar ou Retomar, no topo da inspeção) para incluir, editar ou excluir. O tempo de trabalho precisa estar contando.";

export default function TravaCampo({ ativa, className, children }: { ativa: boolean; className?: string; children: ReactNode }) {
  if (!ativa) return <div className={className}>{children}</div>;

  const barrar = (e: SyntheticEvent) => {
    const alvo = (e.target as HTMLElement).closest?.(INTERATIVO);
    if (!alvo || alvo.closest("[data-livre-campo]")) return;
    e.preventDefault();
    e.stopPropagation();
    if (alvo instanceof HTMLElement && e.type === "focus") alvo.blur();
    if (e.type !== "pointerdown") toast.error(AVISO_PLAY, { id: "trava-campo", duration: 5000 });
  };

  return (
    <div
      className={className}
      onPointerDownCapture={barrar}
      onClickCapture={barrar}
      onFocusCapture={barrar}
      onKeyDownCapture={barrar}
      onChangeCapture={barrar}
    >
      {children}
    </div>
  );
}
