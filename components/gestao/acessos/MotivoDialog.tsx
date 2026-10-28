"use client";

import { useCallback, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

const SUGESTOES = ["Mudou de função", "Entrou na equipe", "Passou a cuidar desta unidade", "Saiu da unidade", "Ajuste de acesso pedido pelo gestor"];

// O último motivo fica na memória da aba: em várias alterações seguidas, não precisa redigitar.
let ultimoMotivo = "";

/**
 * Motivo pedido NA HORA de confirmar (v305) — antes era um campo no topo do modal que travava
 * todos os botões até ser preenchido. O banco continua exigindo ≥ 5 caracteres e grava no log.
 *
 *   const { pedirMotivo, dialogo } = useMotivo();
 *   const motivo = await pedirMotivo("Conceder acesso", "3 pessoas × 2 listas");
 *   if (!motivo) return;   // cancelou
 */
export function useMotivo() {
  const [pedido, setPedido] = useState<{ titulo: string; resumo?: string } | null>(null);
  const [texto, setTexto] = useState("");
  const resolver = useRef<((m: string | null) => void) | null>(null);

  const pedirMotivo = useCallback((titulo: string, resumo?: string) => {
    setTexto(ultimoMotivo);
    setPedido({ titulo, resumo });
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const fechar = (m: string | null) => {
    if (m) ultimoMotivo = m;
    resolver.current?.(m);
    resolver.current = null;
    setPedido(null);
  };
  const ok = texto.trim().length >= 5;

  const dialogo = (
    <Modal open={!!pedido} onClose={() => fechar(null)} title={pedido?.titulo ?? ""} size="sm">
      <div className="space-y-3">
        {pedido?.resumo && <p className="text-sm text-gray-600">{pedido.resumo}</p>}
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Motivo da alteração *</span>
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ok) fechar(texto.trim());
            }}
            placeholder="Ex.: supervisor das unidades da Região Serrana"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => setTexto(s)} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">
              {s}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">Fica registrado no histórico de acessos, com quem fez e quando.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => fechar(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={() => fechar(texto.trim())}
            className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );

  return { pedirMotivo, dialogo };
}
