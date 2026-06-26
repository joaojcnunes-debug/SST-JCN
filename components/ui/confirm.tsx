"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

type Opts = { title: string; description?: string; confirmLabel?: string; variant?: "danger" | "primary" };

let resolver: ((v: boolean) => void) | null = null;
let abrir: ((o: { open: boolean; opts: Opts }) => void) | null = null;

/** Confirmação imperativa: `if (await confirmar({ title })) { ... }`. Cai para window.confirm se o host não estiver montado. */
export function confirmar(opts: Opts): Promise<boolean> {
  if (!abrir) return Promise.resolve(typeof window !== "undefined" ? window.confirm(opts.title) : false);
  return new Promise((resolve) => { resolver = resolve; abrir!({ open: true, opts }); });
}

/** Monte uma vez na árvore (ex.: na página). */
export function ConfirmHost() {
  const [state, setState] = useState<{ open: boolean; opts: Opts }>({ open: false, opts: { title: "" } });
  useEffect(() => { abrir = setState; return () => { abrir = null; }; }, []);
  const fechar = (v: boolean) => { setState((s) => ({ ...s, open: false })); resolver?.(v); resolver = null; };
  return (
    <ConfirmDialog
      open={state.open}
      title={state.opts.title}
      description={state.opts.description}
      variant={state.opts.variant ?? "danger"}
      confirmLabel={state.opts.confirmLabel ?? "Excluir"}
      onConfirm={() => fechar(true)}
      onCancel={() => fechar(false)}
    />
  );
}
