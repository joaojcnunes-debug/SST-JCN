"use client";

import { useRef } from "react";
import { X, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import SignatureCanvas, { type SignatureCanvasHandle } from "@/components/epi/SignatureCanvas";
import type { Transferencia } from "@/lib/hooks/useTransferencias";

/**
 * Modal de assinatura do aceite de uma transferência. Usado tanto na tela
 * `/transferencia` quanto no `RecebimentosModal` por unidade — por isso vive em
 * arquivo próprio. Fica em z-[60] para sobrepor o RecebimentosModal (z-50).
 */
export default function AssinaturaAceiteModal({
  transferencia,
  pending,
  onConfirmar,
  onFechar,
}: {
  transferencia: Transferencia;
  pending: boolean;
  onConfirmar: (png: string) => void;
  onFechar: () => void;
}) {
  const sigRef = useRef<SignatureCanvasHandle>(null);

  function confirmar() {
    if (sigRef.current?.isEmpty()) {
      toast.error("Assine no quadro para confirmar o recebimento.");
      return;
    }
    onConfirmar(sigRef.current?.getDataUrl() ?? "");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Confirmar recebimento</h3>
          <button type="button" onClick={onFechar} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-600">
          <strong>{transferencia.maquina_nome ?? "Equipamento"}</strong> chegando de{" "}
          {transferencia.de_unidade ?? "origem"}. Ao assinar, você confirma o recebimento e o
          equipamento passa para <strong>{transferencia.para_unidade ?? "esta base"}</strong>.
        </p>
        <SignatureCanvas ref={sigRef} />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => sigRef.current?.clear()}
            className="text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Limpar
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Confirmar recebimento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
