"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
  closeOnBackdrop = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);

  // 🔑 `onClose` chega quase sempre como arrow inline (`onClose={() => setX(null)}`),
  // ou seja: identidade NOVA a cada render do pai. Guardá-la numa ref é o que
  // permite o efeito de foco abaixo depender só de `open` — ver o comentário lá.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement;
    } else {
      prevFocusRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /**
   * Foco inicial. Depende SÓ de `open`, e isso é o ponto.
   *
   * 🐛 Enquanto dependia de `onClose`, o efeito rodava a cada render do pai —
   * e como o pai re-renderiza a cada tecla digitada (o valor do campo é estado
   * dele), o `.focus()` do primeiro campo roubava o cursor de volta depois de
   * UMA letra. Quem estava no 2º campo do modal via a letra entrar e o cursor
   * saltar para o 1º. Valia para os 83 modais do painel, não só para a Escala.
   */
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;

    const inputs = Array.from(
      dialog.querySelectorAll<HTMLElement>('input:not([disabled]), textarea:not([disabled])')
    );
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    (inputs[0] ?? focusable[0])?.focus();
  }, [open]);

  /**
   * Esc fecha + armadilha de Tab, no `onKeyDown` do React (fase de bolha).
   *
   * 🐛 Antes era um `keydown` NATIVO no diálogo com `stopPropagation()` em toda
   * tecla (84b31818, para a tecla não vazar do modal). Só que o React escuta na
   * raiz/portal, ACIMA do diálogo — então nenhum `onKeyDown` dentro de modal
   * disparava: Enter no CNPJ do "Editar Empresa" SALVAVA a empresa em vez de
   * buscar o CNPJ (medido 07/10/2026), Enter em "Adicionar…" não adicionava,
   * Esc da edição em linha fechava o modal inteiro.
   *
   * Agora quem está dentro vê a tecla primeiro; aqui ela para de subir pela
   * árvore do React (o portal a levaria aos pais do modal). Quem já tratou a
   * tecla (`preventDefault`) não fecha o modal nem tem o Tab desviado.
   */
  function onDialogKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.defaultPrevented) return;
    if (e.key === "Escape") { onCloseRef.current(); return; }
    if (e.key !== "Tab") return;
    const dialog = e.currentTarget;
    const els = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] animate-in fade-in print:hidden"
      onClick={closeOnBackdrop ? onClose : undefined}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : undefined}
        className={cn(
          "w-full rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 flex flex-col max-h-[90vh]",
          SIZE[size]
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 id={titleId.current} className="text-base font-bold text-gray-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="rounded-b-2xl border-t border-gray-100 bg-gray-50/70 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
